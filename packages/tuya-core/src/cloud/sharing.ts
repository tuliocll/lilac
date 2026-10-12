/**
 * Cliente da API "Smart Life sharing" — o mesmo backend que a integração
 * oficial Tuya do Home Assistant usa. Fluxo:
 *
 *  1. requestLoginQr(userCode) → token; o QR contém `tuyaSmart--qrLogin?token=…`
 *  2. o usuário escaneia no app Smart Life e confirma
 *  3. pollLogin(token) até vir a sessão (access/refresh token + endpoint regional)
 *  4. SharingClient(session).inventory() → casas, dispositivos, local keys e mapa de DPs
 *
 * Depois disso o controle é 100% local; a nuvem só é consultada para
 * re-sincronizar (dispositivo novo, local key trocada após re-pareamento…).
 */
import type { SharingAppCredentials } from './app-credentials.ts';
import { uuidv4 } from './encoding.ts';
import { decryptPayload, deriveSecret, encryptPayload, hashKey, restfulSign } from './signing.ts';

export const LOGIN_HOST = 'https://apigw.iotbing.com';

type FetchFn = typeof fetch;

export class CloudError extends Error {
  constructor(
    message: string,
    readonly code?: string | number,
  ) {
    super(message);
  }
}

export interface SharingSession {
  uid: string;
  username?: string;
  accessToken: string;
  refreshToken: string;
  /** epoch ms em que o accessToken expira */
  expiresAt: number;
  /** host regional, ex.: https://apigw.tuyaus.com */
  endpoint: string;
  terminalId: string;
  userCode: string;
}

export interface LoginQr {
  token: string;
  /** conteúdo a ser codificado no QR */
  qrData: string;
}

export function qrDataFor(token: string): string {
  return `tuyaSmart--qrLogin?token=${token}`;
}

export async function requestLoginQr(
  userCode: string,
  app: SharingAppCredentials,
  fetchFn: FetchFn = fetch,
): Promise<LoginQr> {
  const q = new URLSearchParams({ clientid: app.clientId, usercode: userCode.trim(), schema: app.schema });
  const res = await fetchFn(`${LOGIN_HOST}/v1.0/m/life/home-assistant/qrcode/tokens?${q}`, { method: 'POST' });
  const json: any = await res.json();
  if (!json?.success || !json.result?.qrcode) {
    throw new CloudError(json?.msg || `falha ao gerar QR (HTTP ${res.status})`, json?.code);
  }
  return { token: json.result.qrcode, qrData: qrDataFor(json.result.qrcode) };
}

/** Uma consulta. Retorna `null` enquanto o usuário não confirmou no app. */
export async function checkLogin(
  token: string,
  userCode: string,
  app: SharingAppCredentials,
  fetchFn: FetchFn = fetch,
): Promise<SharingSession | null> {
  const q = new URLSearchParams({ clientid: app.clientId, usercode: userCode.trim() });
  const res = await fetchFn(`${LOGIN_HOST}/v1.0/m/life/home-assistant/qrcode/tokens/${token}?${q}`);
  const json: any = await res.json();
  if (!json?.success) return null;
  const r = json.result ?? {};
  return {
    uid: r.uid,
    username: r.username,
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Number(json.t ?? Date.now()) + Number(r.expire_time ?? 0) * 1000,
    endpoint: r.endpoint,
    terminalId: r.terminal_id,
    userCode: userCode.trim(),
  };
}

/** Faz polling até o login ser confirmado, expirar (`timeoutMs`) ou ser abortado. */
export async function pollLogin(
  token: string,
  userCode: string,
  app: SharingAppCredentials,
  opts: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal; fetch?: FetchFn } = {},
): Promise<SharingSession> {
  const { intervalMs = 2000, timeoutMs = 3 * 60_000, signal } = opts;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new CloudError('login cancelado');
    try {
      const s = await checkLogin(token, userCode, app, opts.fetch);
      if (s) return s;
    } catch {
      // rede instável: tenta de novo no próximo ciclo
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new CloudError('QR expirou sem confirmação');
}

// ---------------------------------------------------------------------------

export interface DpSpec {
  dpId: number;
  code: string;
  /** Boolean | Integer | Enum | String | Json | Raw | Bitmap */
  type: string;
  /** faixa/opções (min, max, step, scale, unit, range…) */
  values?: Record<string, unknown>;
  /** aceita escrita (está em `functions` da especificação) */
  writable: boolean;
}

export interface CloudDevice {
  id: string;
  name: string;
  localKey: string;
  category: string;
  productId: string;
  productName: string;
  /** sub-dispositivo de um gateway (Zigbee/BLE) */
  sub: boolean;
  online: boolean;
  homeId: string;
  homeName: string;
  icon?: string;
  /** status atual pela nuvem, por code */
  status: Record<string, unknown>;
  /** mapa dpId → spec; vazio se o produto não suporta controle local */
  dps: DpSpec[];
  supportLocal: boolean;
}

export interface SharingClientOptions {
  app: SharingAppCredentials;
  fetch?: FetchFn;
  /** chamado quando o token é renovado — persista a nova sessão */
  onSessionUpdate?: (s: SharingSession) => void;
}

function parseJson(v: unknown): Record<string, unknown> | undefined {
  if (typeof v !== 'string' || !v) return (v as Record<string, unknown>) ?? undefined;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}

export class SharingClient {
  private refreshing = false;
  private readonly fetchFn: FetchFn;

  constructor(
    public session: SharingSession,
    private readonly opts: SharingClientOptions,
  ) {
    this.fetchFn = opts.fetch ?? fetch;
  }

  async request<T = any>(method: 'GET' | 'POST', path: string, params?: Record<string, unknown>, body?: Record<string, unknown>): Promise<T> {
    await this.refreshIfNeeded();

    const rid = uuidv4();
    const sid = '';
    const hk = hashKey(rid, this.session.refreshToken);
    const secret = deriveSecret(rid, sid, hk);

    let queryEnc = '';
    let url = this.session.endpoint + path;
    if (params && Object.keys(params).length) {
      queryEnc = encryptPayload(JSON.stringify(params), secret);
      url += `?encdata=${encodeURIComponent(queryEnc)}`;
    }
    let bodyEnc = '';
    let bodyStr: string | undefined;
    if (body && Object.keys(body).length) {
      bodyEnc = encryptPayload(JSON.stringify(body), secret);
      bodyStr = JSON.stringify({ encdata: bodyEnc });
    }

    const headers: Record<string, string> = {
      'X-appKey': this.opts.app.clientId,
      'X-requestId': rid,
      'X-sid': sid,
      'X-time': String(Date.now()),
    };
    if (this.session.accessToken) headers['X-token'] = this.session.accessToken;
    headers['X-sign'] = restfulSign(hk, queryEnc, bodyEnc, headers);
    if (bodyStr) headers['Content-Type'] = 'application/json';

    const res = await this.fetchFn(url, { method, headers, body: bodyStr });
    if (!res.ok) throw new CloudError(`HTTP ${res.status} em ${path}`, res.status);
    const json: any = await res.json();
    if (!json?.success) throw new CloudError(`${json?.msg ?? 'erro'} (${path})`, json?.code);
    if (json.result) {
      const plain = decryptPayload(json.result, secret);
      try {
        json.result = JSON.parse(plain);
      } catch {
        json.result = plain;
      }
    }
    return json as T;
  }

  private async refreshIfNeeded(): Promise<void> {
    if (this.refreshing || this.session.expiresAt - 60_000 > Date.now()) return;
    this.refreshing = true;
    try {
      const r: any = await this.request('GET', `/v1.0/m/token/${this.session.refreshToken}`);
      const t = r.result ?? {};
      this.session = {
        ...this.session,
        uid: t.uid ?? this.session.uid,
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        expiresAt: Number(r.t ?? Date.now()) + Number(t.expireTime ?? 0) * 1000,
      };
      this.opts.onSessionUpdate?.(this.session);
    } finally {
      this.refreshing = false;
    }
  }

  async homes(): Promise<{ id: string; name: string }[]> {
    const r = await this.request('GET', '/v1.0/m/life/users/homes');
    return (r.result ?? []).map((h: any) => ({ id: String(h.ownerId), name: String(h.name ?? '') }));
  }

  async devicesRaw(homeId: string): Promise<any[]> {
    const r = await this.request('GET', '/v1.0/m/life/ha/home/devices', { homeId });
    return r.result ?? [];
  }

  /** dpId → code/tipo/faixa, a partir da "estratégia local" do produto. */
  async dpSpecs(deviceId: string): Promise<{ dps: DpSpec[]; supportLocal: boolean }> {
    const r = await this.request('GET', `/v1.0/m/life/devices/${deviceId}/status`);
    const rel: any[] = r.result?.dpStatusRelationDTOS ?? [];
    const dps: DpSpec[] = rel.map((d) => ({
      dpId: Number(d.dpId),
      code: String(d.statusCode),
      type: String(d.valueType),
      values: parseJson(d.valueDesc),
      writable: false,
    }));
    return { dps, supportLocal: rel.length > 0 && rel.every((d) => d.supportLocal) };
  }

  /** Códigos graváveis (functions) — o que pode virar controle. */
  async writableCodes(deviceId: string): Promise<Set<string>> {
    const r = await this.request('GET', `/v1.1/m/life/${deviceId}/specifications`);
    return new Set((r.result?.functions ?? []).map((f: any) => String(f.code)));
  }

  /** Tudo que o app precisa para operar localmente. */
  async inventory(opts: { concurrency?: number } = {}): Promise<CloudDevice[]> {
    const out: CloudDevice[] = [];
    for (const home of await this.homes()) {
      const raw = await this.devicesRaw(home.id);
      const queue = [...raw];
      const worker = async () => {
        for (let d = queue.shift(); d; d = queue.shift()) {
          let spec = { dps: [] as DpSpec[], supportLocal: false };
          try {
            spec = await this.dpSpecs(d.id);
            const writable = await this.writableCodes(d.id).catch(() => new Set<string>());
            for (const dp of spec.dps) dp.writable = writable.has(dp.code);
          } catch {
            // sem spec: aparece na lista, mas sem controle local por enquanto
          }
          const status: Record<string, unknown> = {};
          for (const s of d.status ?? []) if (s && 'code' in s) status[s.code] = s.value;
          out.push({
            id: d.id,
            name: d.name,
            localKey: d.local_key,
            category: d.category,
            productId: d.product_id,
            productName: d.product_name,
            sub: Boolean(d.sub),
            online: Boolean(d.online),
            homeId: home.id,
            homeName: home.name,
            icon: d.icon,
            status,
            dps: spec.dps,
            supportLocal: spec.supportLocal,
          });
        }
      };
      await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
    }
    return out;
  }

  /** Encerra a sessão no servidor (logout). */
  async logout(): Promise<void> {
    await this.request('POST', '/v1.0/m/token/terminal/expire', undefined, {
      accessToken: this.session.accessToken,
      terminalId: this.session.terminalId,
    });
  }
}
