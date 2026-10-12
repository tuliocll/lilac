/**
 * Conta Smart Life e inventário (nomes, categorias, local keys, DPs).
 *
 * Quem guarda tudo em disco é a página: sessão e local keys no cofre do
 * sistema (tiny.app.secrets), o resto no tiny.store. Aqui só avisamos com o
 * evento `persist` sempre que algo muda.
 */
import {
  createSharingClient,
  HOME_ASSISTANT_CREDENTIALS,
  pollLogin,
  requestLoginQr,
  type CloudDevice,
  type SharingClient,
  type SharingSession,
} from '@tuyabar/core';
import qrcode from 'qrcode-generator';
import { push } from './app.ts';

const APP_CREDENTIALS = HOME_ASSISTANT_CREDENTIALS;
const QR_LIFETIME_MS = 3 * 60_000;

let cloud: SharingClient | null = null;
let inventory: CloudDevice[] = [];
let loginAbort: AbortController | null = null;
const listeners = new Set<() => void>();

export const cloudClient = () => cloud;
export const devices = () => inventory;
export const findDevice = (id: string) => inventory.find((d) => d.id === id);

export function onInventoryChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** O que a página leu do cofre na inicialização. */
export function restore(saved: { session?: SharingSession | null; inventory?: Omit<CloudDevice, 'localKey'>[] | null; keys?: Record<string, string> }) {
  inventory = (saved.inventory ?? []).map((d) => ({ ...d, localKey: saved.keys?.[d.id] ?? '' }));
  if (saved.session) useSession(saved.session);
  changed();
  return { loggedIn: Boolean(saved.session) };
}

function useSession(session: SharingSession) {
  cloud = createSharingClient(session, { app: APP_CREDENTIALS, onSessionUpdate: persist });
  push('account', { username: session.username ?? session.uid });
}

/** Busca o inventário na nuvem. Sem rede, segue com o que já estava salvo. */
export async function sync() {
  if (!cloud) return;
  push('sync-start');
  try {
    inventory = mergeImported(await cloud.inventory());
    persist();
    changed();
    push('sync-end', { count: inventory.length });
  } catch (error) {
    push('sync-end', { error: (error as Error).message });
  }
}

// ------------------------------------------------------------------ login

export async function startLogin(userCode: string) {
  loginAbort?.abort();
  const { token, qrData } = await requestLoginQr(userCode, APP_CREDENTIALS);
  const abort = (loginAbort = new AbortController());

  pollLogin(token, userCode, APP_CREDENTIALS, { signal: abort.signal, timeoutMs: QR_LIFETIME_MS })
    .then(async (session) => {
      useSession(session);
      persist();
      push('login-ok', { username: session.username ?? session.uid });
      await sync();
    })
    .catch((error: Error) => {
      if (!abort.signal.aborted) push('login-error', error.message);
    });

  return { svg: qrSvg(qrData), expiresInMs: QR_LIFETIME_MS };
}

export function cancelLogin() {
  loginAbort?.abort();
  loginAbort = null;
}

export async function logout() {
  await cloud?.logout().catch(() => {}); // sem rede: encerra só localmente
  cloud = null;
  inventory = inventory.filter((d) => d.homeId === IMPORTED_HOME); // chaves importadas não vêm da conta
  persist();
  changed();
}

// ------------------------------------------------------------------ chaves importadas

const IMPORTED_HOME = 'imported';

/**
 * Importa chaves de outras ferramentas, para quem não quer logar:
 *   - tinytuya: devices.json  → [{ id, key, name, category?, mapping?: { "1": { code, type, values } } }]
 *   - genérico: [{ id, key, name }]
 * Devolve quantos aparelhos entraram ou foram atualizados.
 */
export function importKeys(json: unknown): number {
  const list = Array.isArray(json) ? json : [];
  let count = 0;
  for (const item of list) {
    const id = String(item?.id ?? item?.devId ?? '');
    const key = String(item?.key ?? item?.local_key ?? item?.localKey ?? '');
    if (!id || key.length !== 16) continue;

    const existing = findDevice(id);
    if (existing) {
      existing.localKey = key;
    } else {
      inventory.push({
        id,
        name: String(item.name || id),
        localKey: key,
        category: String(item.category ?? ''),
        productId: String(item.product_id ?? ''),
        productName: String(item.product_name ?? ''),
        sub: Boolean(item.sub),
        online: false,
        homeId: IMPORTED_HOME,
        homeName: '',
        status: {},
        dps: dpsFromTinytuyaMapping(item.mapping),
        supportLocal: true,
        writableKnown: false,
      });
    }
    count++;
  }
  if (count) {
    persist();
    changed();
  }
  return count;
}

function dpsFromTinytuyaMapping(mapping: unknown): CloudDevice['dps'] {
  if (!mapping || typeof mapping !== 'object') return [];
  return Object.entries(mapping as Record<string, any>).map(([dpId, m]) => ({
    dpId: Number(dpId),
    code: String(m?.code ?? `dp_${dpId}`),
    type: String(m?.type ?? 'Raw'),
    values: m?.values && typeof m.values === 'object' ? m.values : undefined,
    writable: false,
  }));
}

/** Mantém aparelhos importados que a conta não conhece. */
function mergeImported(fromCloud: CloudDevice[]) {
  const ids = new Set(fromCloud.map((d) => d.id));
  return [...fromCloud, ...inventory.filter((d) => d.homeId === IMPORTED_HOME && !ids.has(d.id))];
}

// ------------------------------------------------------------------ utilitários

function persist() {
  push('persist', {
    session: cloud?.session() ?? null,
    // sem as chaves: elas vão separadas para o cofre do sistema
    inventory: inventory.map(({ localKey: _key, ...rest }) => rest),
    keys: Object.fromEntries(inventory.map((d) => [d.id, d.localKey])),
  });
}

function changed() {
  for (const listener of listeners) listener();
}

function qrSvg(data: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  return qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}
