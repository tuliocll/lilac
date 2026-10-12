/**
 * Controle de um aparelho: escolhe a rota, mantém a conexão e avisa a página.
 *
 *   rota local  aparelho anunciando na rede + local key + protocolo suportado
 *   rota nuvem  sub-dispositivos de gateway, ares por infravermelho, protocolo
 *               ainda não suportado, ou quando a rota local falha
 *
 * Enquanto a página de um aparelho está aberta a conexão fica viva
 * (heartbeat, reconexão com espera crescente, IP novo quando o roteador troca).
 * Ao fechar, a conexão ainda dura 30 s — voltar à página fica instantâneo.
 */
import { createLocalDevice, isLocalVersionSupported, LocalError, type CloudDevice, type Dps, type LocalDevice } from '@tuyabar/core';
import { onlySupported, resolve, toDisplay, toRaw, type ResolvedGadget } from '@tuyabar/gadgets';
import { cloudClient, findDevice } from './account.ts';
import { push } from './app.ts';
import { deviceTcpPort, locate, networkTransport } from './network.ts';

export type Route = 'local' | 'cloud';
/** por que um aparelho não está sendo controlado (ou está pela nuvem) */
export type Reason = 'offline' | 'sub' | 'nokey' | 'version' | 'auth' | 'error' | 'unknown';
type Values = Record<string, unknown>;

export interface OpenResult {
  gadget: ResolvedGadget | null;
  values: Values;
  route: Route | null;
  /** com route=null: por que não dá para controlar; com route='cloud': por que não foi pela rede local */
  reason?: Reason;
  version?: string;
  error?: string;
}

interface Session {
  device: CloudDevice;
  route: Route;
  /** todos os controles do modelo (para traduzir dpId → código) */
  full: ResolvedGadget;
  /** só os que este aparelho reporta */
  gadget: ResolvedGadget;
  values: Values;
  seen: Set<string>;
  local?: LocalDevice;
  ip?: string;
  /** a página está mostrando este aparelho */
  watched: boolean;
  timers: { idle?: Timer; poll?: Timer; reconnect?: Timer };
  reconnectAttempts: number;
}
type Timer = ReturnType<typeof setTimeout>;

const IDLE_CLOSE_MS = 30_000;
const CLOUD_POLL_MS = 10_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

const sessions = new Map<string, Session>();
/** aberturas em andamento: a bandeja e a página podem pedir o mesmo aparelho ao mesmo tempo */
const opening = new Map<string, Promise<OpenResult>>();
/** último valor conhecido de cada aparelho (para a bandeja) */
const lastKnown = new Map<string, Values>();

// ============================================================== API do módulo

export async function openDevice(id: string, { watch = true } = {}): Promise<OpenResult> {
  const device = findDevice(id);
  if (!device) return { gadget: null, values: {}, route: null, reason: 'unknown' };

  const inProgress = opening.get(id);
  if (inProgress) await inProgress.catch(() => {});

  const known = sessions.get(id);
  if (known) {
    if (watch) {
      clearTimeout(known.timers.idle);
      known.watched = true;
    }
    const outcome = await refresh(known);
    if (outcome.ok) return describe(known);
    return { ...describe(known), route: null, reason: outcome.reason, error: outcome.error };
  }

  const open = openNew(device, watch).finally(() => opening.delete(id));
  opening.set(id, open);
  return open;
}

async function openNew(device: CloudDevice, watch: boolean): Promise<OpenResult> {
  const choice = chooseRoute(device);
  if (!choice.route) return readOnly(device, choice.reason, choice.version);

  const session = createSession(device, choice.route, watch);
  let outcome = await refresh(session);
  let cloudBecause: Reason | undefined = choice.route === 'cloud' ? choice.reason : undefined;
  let localError: string | undefined;

  // a rede local falhou por algo que não é a chave? a nuvem ainda pode resolver
  if (!outcome.ok && session.route === 'local' && outcome.reason !== 'auth' && hasCloud(device)) {
    cloudBecause = outcome.reason;
    localError = outcome.error;
    switchToCloud(session);
    outcome = await refresh(session);
  }
  if (!outcome.ok) {
    dispose(session);
    return readOnly(device, outcome.reason, choice.version, outcome.error);
  }
  return { ...describe(session), reason: cloudBecause, version: choice.version, error: localError };
}

/** Muda um controle. Resolve com os valores atualizados. */
export async function setControl(id: string, code: string, value: unknown): Promise<Values> {
  if (!sessions.has(id)) await openDevice(id, { watch: false });
  const session = sessions.get(id);
  if (!session) throw new Error('aparelho indisponível');
  const control = session.full.controls.find((c) => c.code === code);
  if (!control) throw new Error(`controle desconhecido: ${code}`);

  if (session.route === 'local') {
    const applied = await localDevice(session).set({ [String(control.dpId)]: toRaw(control, value, 'local') });
    applyDps(session, applied);
  } else {
    await cloudClient()!.sendCommands(session.device.id, [{ code, value: toRaw(control, value, 'cloud') }]);
    applyValues(session, { [code]: value });
    // a nuvem demora a refletir; confere daqui a pouco
    setTimeout(() => {
      if (sessions.has(id)) pollCloud(session).catch(() => {});
    }, 1500);
  }
  return session.values;
}

/** A página saiu do aparelho. */
export function releaseDevice(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  session.watched = false;
  clearTimeout(session.timers.poll);
  clearTimeout(session.timers.reconnect);
  clearTimeout(session.timers.idle);
  session.timers.idle = setTimeout(() => dispose(session), IDLE_CLOSE_MS);
}

/** Liga/desliga pelo controle principal de energia (usado pela bandeja). */
export async function togglePower(id: string): Promise<boolean | undefined> {
  const opened = await openDevice(id, { watch: false });
  const power = opened.gadget?.controls.find((c) => c.type === 'power');
  if (!opened.route || !power) {
    releaseDevice(id);
    return undefined;
  }
  const next = !opened.values[power.code];
  try {
    const values = await setControl(id, power.code, next);
    return Boolean(values[power.code]);
  } finally {
    releaseDevice(id);
  }
}

/** Fecha tudo — depois de re-sincronizar, as chaves e IPs podem ter mudado. */
export function closeAllDevices() {
  for (const session of [...sessions.values()]) dispose(session);
}

export function knownPower(id: string): boolean | undefined {
  const device = findDevice(id);
  if (!device) return undefined;
  const values = lastKnown.get(id) ?? device.status;
  const full = resolve({ category: device.category, dps: device.dps });
  const power = full.controls.find((c) => c.type === 'power');
  return power && typeof values[power.code] === 'boolean' ? (values[power.code] as boolean) : undefined;
}

/**
 * Como o aparelho seria controlado agora (também usado pela lista).
 * `reason` explica por que não é pela rede local.
 */
export function chooseRoute(device: CloudDevice): { route: Route | null; reason?: Reason; version?: string } {
  const onNetwork = locate(device.id);
  const version = onNetwork?.version;

  let reason: Reason;
  if (!onNetwork) reason = device.sub ? 'sub' : 'offline';
  else if (!device.localKey) reason = 'nokey';
  else if (!isLocalVersionSupported(version)) reason = 'version';
  else return { route: 'local', version };

  return { route: hasCloud(device) ? 'cloud' : null, reason, version };
}

function hasCloud(device: CloudDevice) {
  return cloudClient() !== null && device.homeId !== 'imported';
}

// ============================================================== leitura

type Outcome = { ok: true } | { ok: false; reason: Reason; error: string };

/** Lê o estado atual pela rota da sessão. */
async function refresh(session: Session): Promise<Outcome> {
  try {
    if (session.route === 'local') {
      applyDps(session, await localDevice(session).status());
      session.reconnectAttempts = 0;
    } else {
      await pollCloud(session);
    }
    return { ok: true };
  } catch (error) {
    const reason: Reason = error instanceof LocalError && error.code === 'auth' ? 'auth' : 'error';
    return { ok: false, reason, error: (error as Error).message };
  }
}

function createSession(device: CloudDevice, route: Route, watched: boolean): Session {
  const full = resolve({ category: device.category, dps: device.dps, writableKnown: device.writableKnown });
  const seen = new Set(Object.keys(device.status));
  const session: Session = {
    device,
    route,
    full,
    gadget: onlySupported(full, seen),
    values: cloudValues(full, device.status),
    seen,
    watched,
    timers: {},
    reconnectAttempts: 0,
  };
  sessions.set(device.id, session);
  if (!watched) session.timers.idle = setTimeout(() => dispose(session), IDLE_CLOSE_MS);
  return session;
}

function describe(session: Session): OpenResult {
  return { gadget: session.gadget, values: session.values, route: session.route };
}

/** Sem rota de controle: mostra o último estado conhecido pela nuvem. */
function readOnly(device: CloudDevice, reason?: Reason, version?: string, error?: string): OpenResult {
  const full = resolve({ category: device.category, dps: device.dps, writableKnown: device.writableKnown });
  const gadget = onlySupported(full, Object.keys(device.status));
  return { gadget, values: cloudValues(gadget, device.status), route: null, reason, version, error };
}

async function pollCloud(session: Session) {
  clearTimeout(session.timers.poll);
  const { [session.device.id]: current } = await cloudClient()!.statusOf([session.device.id]);
  if (current) {
    for (const code of Object.keys(current.status)) session.seen.add(code);
    session.gadget = onlySupported(session.full, session.seen);
    applyValues(session, cloudValues(session.full, current.status));
  }
  if (session.watched) session.timers.poll = setTimeout(() => pollCloud(session).catch(() => {}), CLOUD_POLL_MS);
}

// ============================================================== conexão local

function localDevice(session: Session): LocalDevice {
  const where = locate(session.device.id);
  // IP mudou (DHCP): descarta a conexão antiga e usa o endereço novo
  if (session.local && where && where.ip !== session.ip) {
    session.local.close();
    session.local = undefined;
  }
  if (session.local) return session.local;

  const ip = where?.ip ?? session.ip;
  if (!ip || !where?.version) throw new LocalError('o aparelho não está anunciando na rede', 'connect');
  const local = createLocalDevice({
    id: session.device.id,
    ip,
    port: deviceTcpPort(),
    localKey: session.device.localKey,
    version: where.version,
    transport: networkTransport(),
    timeoutMs: 4000,
  });
  local.onStatus((dps) => applyDps(session, dps));
  local.onClose(() => scheduleReconnect(session));
  session.local = local;
  session.ip = ip;
  return local;
}

/** Reconecta enquanto a página estiver aberta: 1 s, 2 s, 4 s… até 30 s. */
function scheduleReconnect(session: Session) {
  if (!session.watched || session.route !== 'local' || !sessions.has(session.device.id)) return;
  clearTimeout(session.timers.reconnect);
  const delay = Math.min(1000 * 2 ** session.reconnectAttempts++, MAX_RECONNECT_DELAY_MS);
  session.timers.reconnect = setTimeout(async () => {
    const outcome = await refresh(session);
    push('device-trouble', { id: session.device.id, ...(outcome.ok ? { reason: null } : outcome) });
    if (!outcome.ok && outcome.reason !== 'auth') scheduleReconnect(session);
  }, delay);
}

function switchToCloud(session: Session) {
  session.local?.close();
  session.local = undefined;
  session.route = 'cloud';
}

function dispose(session: Session) {
  clearTimeout(session.timers.idle);
  clearTimeout(session.timers.poll);
  clearTimeout(session.timers.reconnect);
  session.watched = false;
  session.local?.close();
  sessions.delete(session.device.id);
}

// ============================================================== valores

function applyDps(session: Session, dps: Dps) {
  const values: Values = {};
  for (const [dpId, raw] of Object.entries(dps)) {
    const control = session.full.controls.find((c) => String(c.dpId) === dpId);
    if (!control) continue;
    session.seen.add(control.code);
    values[control.code] = toDisplay(control, raw);
  }
  session.gadget = onlySupported(session.full, session.seen);
  applyValues(session, values);
}

function applyValues(session: Session, values: Values) {
  Object.assign(session.values, values);
  lastKnown.set(session.device.id, { ...session.values });
  push('state', { id: session.device.id, values: session.values });
}

function cloudValues(gadget: ResolvedGadget, status: Values): Values {
  const out: Values = {};
  for (const control of gadget.controls) if (control.code in status) out[control.code] = toDisplay(control, status[control.code]);
  return out;
}

