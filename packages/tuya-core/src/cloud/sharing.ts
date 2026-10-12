/**
 * Cliente da API "Smart Life sharing" — a mesma que a integração oficial
 * Tuya do Home Assistant usa (porta de tuya_sharing/customerapi.py, MIT © Tuya).
 *
 * Serve para três coisas:
 *   - inventário: casas, aparelhos, local keys e mapa de DPs;
 *   - status e comandos pela nuvem, para quem não fala pela rede local
 *     (sub-dispositivos de gateway, ares por infravermelho);
 *   - renovar o token sozinho.
 */
import type { SharingAppCredentials } from './app-credentials.ts';
import { uuidv4 } from './encoding.ts';
import { CloudError, type SharingSession } from './login.ts';
import { decryptPayload, deriveSecret, encryptPayload, hashKey, restfulSign } from './signing.ts';

export * from './login.ts';

export interface DpSpec {
  /** id numérico do DP (0 quando só a nuvem conhece o aparelho) */
  dpId: number;
  code: string;
  /** Boolean | Integer | Enum | String | Json | Raw | Bitmap */
  type: string;
  /** faixa/opções: min, max, step, scale, unit, range… */
  values?: Record<string, unknown>;
  /** aceita escrita (aparece em `functions` da especificação) */
  writable: boolean;
}

export interface CloudDevice {
  id: string;
  name: string;
  localKey: string;
  category: string;
  productId: string;
  productName: string;
  /** sub-dispositivo de um gateway ou de um controle IR */
  sub: boolean;
  online: boolean;
  homeId: string;
  homeName: string;
  icon?: string;
  /** último status conhecido pela nuvem, por código */
  status: Record<string, unknown>;
  dps: DpSpec[];
  /** o produto declara suporte a controle local */
  supportLocal: boolean;
  /** a lista de DPs graváveis veio da nuvem (se false, `writable` é desconhecido) */
  writableKnown: boolean;
}

export interface CloudCommand {
  code: string;
  value: unknown;
}

export interface SharingClientOptions {
  app: SharingAppCredentials;
  fetch?: typeof fetch;
  /** chamado quando o token é renovado — persista a nova sessão */
  onSessionUpdate?: (session: SharingSession) => void;
}

export interface SharingClient {
  /** sessão atual (muda quando o token é renovado) */
  session(): SharingSession;
  request<T = any>(method: 'GET' | 'POST', path: string, params?: object, body?: object): Promise<T>;
  homes(): Promise<{ id: string; name: string }[]>;
  inventory(options?: { concurrency?: number }): Promise<CloudDevice[]>;
  /** status atual pela nuvem, por código */
  statusOf(deviceIds: string[]): Promise<Record<string, { online: boolean; status: Record<string, unknown> }>>;
  sendCommands(deviceId: string, commands: CloudCommand[]): Promise<void>;
  logout(): Promise<void>;
}

export function createSharingClient(initial: SharingSession, options: SharingClientOptions): SharingClient {
  const fetchFn = options.fetch ?? fetch;
  let session = initial;
  let refreshing: Promise<void> | null = null;

  // ------------------------------------------------------------ transporte

  async function request<T = any>(method: 'GET' | 'POST', path: string, params?: object, body?: object): Promise<T> {
    await refreshIfNeeded();
    return signedRequest<T>(method, path, params, body);
  }

  async function signedRequest<T>(method: 'GET' | 'POST', path: string, params?: object, body?: object): Promise<T> {
    const requestId = uuidv4();
    const key = hashKey(requestId, session.refreshToken);
    const secret = deriveSecret(requestId, '', key);

    let url = session.endpoint + path;
    let queryEnc = '';
    if (params && Object.keys(params).length) {
      queryEnc = encryptPayload(JSON.stringify(params), secret);
      url += `?encdata=${encodeURIComponent(queryEnc)}`;
    }
    let bodyEnc = '';
    if (body && Object.keys(body).length) bodyEnc = encryptPayload(JSON.stringify(body), secret);

    const headers: Record<string, string> = {
      'X-appKey': options.app.clientId,
      'X-requestId': requestId,
      'X-sid': '',
      'X-time': String(Date.now()),
    };
    if (session.accessToken) headers['X-token'] = session.accessToken;
    headers['X-sign'] = restfulSign(key, queryEnc, bodyEnc, headers);
    if (bodyEnc) headers['Content-Type'] = 'application/json';

    const response = await fetchFn(url, { method, headers, body: bodyEnc ? JSON.stringify({ encdata: bodyEnc }) : undefined });
    if (!response.ok) throw new CloudError(`HTTP ${response.status} em ${path}`, response.status);
    const json = (await response.json()) as any;
    if (!json?.success) throw new CloudError(`${json?.msg ?? 'erro'} (${path})`, json?.code);
    if (typeof json.result === 'string' && json.result) {
      const plain = decryptPayload(json.result, secret);
      json.result = parseJsonOr(plain, plain);
    }
    return json as T;
  }

  /** Renova o token um minuto antes de expirar. Chamadas simultâneas esperam a mesma renovação. */
  function refreshIfNeeded(): Promise<void> {
    if (session.expiresAt - 60_000 > Date.now()) return Promise.resolve();
    refreshing ??= (async () => {
      try {
        const r = await signedRequest<any>('GET', `/v1.0/m/token/${session.refreshToken}`);
        const t = r.result ?? {};
        session = {
          ...session,
          uid: t.uid ?? session.uid,
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
          expiresAt: Number(r.t ?? Date.now()) + Number(t.expireTime ?? 0) * 1000,
        };
        options.onSessionUpdate?.(session);
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  // ------------------------------------------------------------ inventário

  async function homes() {
    const r = await request('GET', '/v1.0/m/life/users/homes');
    return ((r.result ?? []) as any[]).map((h) => ({ id: String(h.ownerId), name: String(h.name ?? '') }));
  }

  /** DPs pela "estratégia local" do produto (com dpId). */
  async function localStrategy(deviceId: string) {
    const r = await request('GET', `/v1.0/m/life/devices/${deviceId}/status`);
    const relations: any[] = r.result?.dpStatusRelationDTOS ?? [];
    return {
      dps: relations.map<DpSpec>((d) => ({
        dpId: Number(d.dpId),
        code: String(d.statusCode),
        type: String(d.valueType),
        values: parseValues(d.valueDesc),
        writable: false,
      })),
      supportLocal: relations.length > 0 && relations.every((d) => d.supportLocal),
    };
  }

  /** Especificação: `functions` (graváveis) e `status` (legíveis). */
  async function specification(deviceId: string) {
    const r = await request('GET', `/v1.1/m/life/${deviceId}/specifications`);
    const toSpec = (f: any, writable: boolean): DpSpec => ({
      dpId: Number(f.dp_id ?? f.dpId ?? 0),
      code: String(f.code),
      type: String(f.type),
      values: parseValues(f.values),
      writable,
    });
    return {
      functions: ((r.result?.functions ?? []) as any[]).map((f) => toSpec(f, true)),
      status: ((r.result?.status ?? []) as any[]).map((f) => toSpec(f, false)),
    };
  }

  /** Junta as duas fontes: a estratégia local traz os dpIds, a especificação diz o que é gravável. */
  async function describe(deviceId: string) {
    const [strategy, spec] = await Promise.all([
      localStrategy(deviceId).catch(() => ({ dps: [] as DpSpec[], supportLocal: false })),
      specification(deviceId).catch(() => null),
    ]);
    const writable = new Set(spec?.functions.map((f) => f.code));
    let dps = strategy.dps.map((d) => ({ ...d, writable: writable.has(d.code) }));

    // aparelhos só da nuvem (ex.: ar por infravermelho) não têm estratégia local
    if (!dps.length && spec) {
      const byCode = new Map<string, DpSpec>();
      for (const s of [...spec.status, ...spec.functions]) byCode.set(s.code, { ...byCode.get(s.code), ...s, writable: writable.has(s.code) });
      dps = [...byCode.values()];
    }
    return { dps, supportLocal: strategy.supportLocal, writableKnown: spec !== null };
  }

  async function inventory({ concurrency = 4 } = {}): Promise<CloudDevice[]> {
    const devices: CloudDevice[] = [];
    for (const home of await homes()) {
      const r = await request('GET', '/v1.0/m/life/ha/home/devices', { homeId: home.id });
      const queue: any[] = [...(r.result ?? [])];
      const worker = async () => {
        for (let d = queue.shift(); d; d = queue.shift()) {
          const described = await describe(d.id);
          devices.push({
            id: d.id,
            name: d.name,
            localKey: d.local_key ?? '',
            category: d.category,
            productId: d.product_id,
            productName: d.product_name,
            sub: Boolean(d.sub),
            online: Boolean(d.online),
            homeId: home.id,
            homeName: home.name,
            icon: d.icon,
            status: statusByCode(d.status),
            ...described,
          });
        }
      };
      await Promise.all(Array.from({ length: concurrency }, worker));
    }
    return devices;
  }

  // ------------------------------------------------------------ controle pela nuvem

  async function statusOf(deviceIds: string[]) {
    if (!deviceIds.length) return {};
    const r = await request('GET', '/v1.0/m/life/ha/devices/detail', { devIds: deviceIds.join(',') });
    const out: Record<string, { online: boolean; status: Record<string, unknown> }> = {};
    for (const d of (r.result ?? []) as any[]) out[d.id] = { online: Boolean(d.online), status: statusByCode(d.status) };
    return out;
  }

  async function sendCommands(deviceId: string, commands: CloudCommand[]) {
    await request('POST', `/v1.1/m/thing/${deviceId}/commands`, undefined, { commands });
  }

  async function logout() {
    await request('POST', '/v1.0/m/token/terminal/expire', undefined, {
      accessToken: session.accessToken,
      terminalId: session.terminalId,
    });
  }

  return { session: () => session, request, homes, inventory, statusOf, sendCommands, logout };
}

// ------------------------------------------------------------ utilitários

/** [{ code: 'switch', value: true }, …] → { switch: true, … } */
function statusByCode(list: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    if (item && typeof item === 'object' && 'code' in item) {
      const { code, value } = item as { code: string; value: unknown };
      out[code] = value;
    }
  }
  return out;
}

function parseValues(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === 'object') return v as Record<string, unknown>;
  if (typeof v !== 'string' || !v) return undefined;
  const parsed = parseJsonOr(v, undefined);
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
}

function parseJsonOr<T>(text: string, fallback: T): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
