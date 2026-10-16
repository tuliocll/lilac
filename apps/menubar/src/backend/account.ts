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
} from '@lilac/core';
import qrcode from 'qrcode-generator';
import { push } from './app.ts';
import { connectThinq, disconnectThinq, isLg, thinqConfig, thinqConnected, thinqInventory, tokenRefused, useThinq, type ThinqConfig } from './thinq.ts';

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
export function restore(saved: {
  session?: SharingSession | null;
  inventory?: Omit<CloudDevice, 'localKey'>[] | null;
  keys?: Record<string, string>;
  thinq?: ThinqConfig | null;
}) {
  inventory = (saved.inventory ?? []).map((d) => ({ ...d, localKey: saved.keys?.[d.id] ?? '' }));
  if (saved.session) useSession(saved.session);
  if (saved.thinq) {
    useThinq(saved.thinq);
    pushThinq();
  }
  changed();
  // só LG também conta: a lista abre direto, sem pedir o login do Smart Life
  return { loggedIn: Boolean(saved.session) || thinqConnected() };
}

function useSession(session: SharingSession) {
  cloud = createSharingClient(session, { app: APP_CREDENTIALS, onSessionUpdate: persist });
  push('account', { username: session.username ?? session.uid });
}

/**
 * Busca o inventário nas nuvens conectadas (Smart Life e LG ThinQ). A que
 * falhar mantém o que já estava salvo; a outra atualiza mesmo assim.
 */
export async function sync() {
  if (!cloud && !thinqConnected()) return;
  push('sync-start');
  const [tuya, lg] = await Promise.allSettled([cloud ? cloud.inventory() : Promise.resolve([]), thinqConnected() ? thinqInventory() : Promise.resolve([])]);
  // conta desconectada durante a busca: o que veio dela não volta para a lista
  const fresh = (r: PromiseSettledResult<CloudDevice[]>, stillConnected: boolean) => (!stillConnected ? [] : r.status === 'fulfilled' ? r.value : null);
  inventory = merge(fresh(tuya, cloud !== null), fresh(lg, thinqConnected()));
  persist();
  changed();
  if (lg.status === 'rejected' && tokenRefused(lg.reason)) {
    lgTokenRefused = true;
    pushThinq();
  }
  const failed = [tuya, lg].find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) push('sync-end', { error: (failed.reason as Error).message });
  else push('sync-end', { count: inventory.length });
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
  // chaves importadas e ares LG não vêm da conta Smart Life
  inventory = inventory.filter((d) => d.homeId === IMPORTED_HOME || isLg(d));
  persist();
  changed();
}

// ------------------------------------------------------------------ LG ThinQ

/** Conecta com o token da LG; devolve quantos ares vieram. */
export async function connectLg(token: string, country: string): Promise<number> {
  const acs = await connectThinq(token, country);
  lgTokenRefused = false;
  inventory = [...inventory.filter((d) => !isLg(d)), ...acs];
  persist();
  changed();
  pushThinq();
  return acs.length;
}

export function disconnectLg() {
  disconnectThinq();
  lgTokenRefused = false;
  inventory = inventory.filter((d) => !isLg(d));
  persist();
  changed();
  pushThinq();
}

/** A LG recusou o token na última sincronização (revogado, vencido): a interface pede outro. */
let lgTokenRefused = false;

function pushThinq() {
  const lg = thinqConfig();
  push('thinq', thinqConnected() && lg ? { country: lg.country, tokenRefused: lgTokenRefused } : null);
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

/**
 * Junta o que veio de cada nuvem (null = não buscou ou falhou: fica o que já
 * havia) com os aparelhos importados, que nenhuma conta conhece.
 */
function merge(tuya: CloudDevice[] | null, lg: CloudDevice[] | null) {
  const fresh = [...(tuya ?? []), ...(lg ?? [])];
  const ids = new Set(fresh.map((d) => d.id));
  const keep = (d: CloudDevice) => d.homeId === IMPORTED_HOME || (isLg(d) ? lg === null : tuya === null);
  return [...fresh, ...inventory.filter((d) => keep(d) && !ids.has(d.id))];
}

// ------------------------------------------------------------------ utilitários

function persist() {
  push('persist', {
    session: cloud?.session() ?? null,
    // sem as chaves: elas vão separadas para o cofre do sistema
    inventory: inventory.map(({ localKey: _key, ...rest }) => rest),
    keys: Object.fromEntries(inventory.map((d) => [d.id, d.localKey])),
    thinq: thinqConfig(),
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
