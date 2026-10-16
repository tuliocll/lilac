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
import { createLocalDevice, irAcCommands, isLocalVersionSupported, LocalError, type CloudCommand, type CloudDevice, type Dps, type LocalDevice } from '@lilac/core';
import { onlySupported, resolve, toDisplay, toRaw, type ResolvedGadget } from '@lilac/gadgets';
import { cloudClient, findDevice } from './account.ts';
import { push } from './app.ts';
import { deviceTcpPort, locate, networkTransport } from './network.ts';
import { remember, rememberedValues, remembersState } from './remembered.ts';
import { isLg, thinqConnected, thinqSend, thinqStatus } from './thinq.ts';

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
  /** o aparelho não informa estado: os valores são os últimos que o app enviou */
  remembered?: boolean;
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
/** a LG limita as chamadas por conta: o estado dos ares LG é consultado com mais calma */
const LG_POLL_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

const sessions = new Map<string, Session>();
/** aberturas em andamento: a bandeja e a página podem pedir o mesmo aparelho ao mesmo tempo */
const opening = new Map<string, Promise<OpenResult>>();
/** último valor conhecido de cada aparelho (para a bandeja) */
const lastKnown = new Map<string, Values>();
const valueListeners = new Set<(id: string) => void>();

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
    await sendToCloud(session, code, toRaw(control, value, 'cloud'));
    applyValues(session, { [code]: value });
    // a nuvem demora a refletir; confere daqui a pouco
    if (!remembersState(session.device)) {
      setTimeout(() => {
        if (sessions.has(id)) pollCloud(session).catch(() => {});
      }, 1500);
    }
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

/**
 * Executa uma ação de um clique (ação rápida da lista, favorito da bandeja)
 * sem a página aberta. `toggle` lê o estado atual antes de inverter.
 */
export async function runAction(id: string, action: { code: string; mode: 'toggle' | 'set'; value?: unknown }): Promise<Values> {
  try {
    const opened = await openDevice(id, { watch: false });
    if (!opened.route) throw new Error(opened.error ?? `aparelho indisponível (${opened.reason})`);
    const value = action.mode === 'toggle' ? !opened.values[action.code] : action.value;
    return await setControl(id, action.code, value);
  } finally {
    releaseDevice(id);
  }
}

/** Liga/desliga pelo controle principal de energia (favoritos na bandeja). */
export async function togglePower(id: string): Promise<boolean | undefined> {
  const device = findDevice(id);
  const power = device && resolveDevice(device).controls.find((c) => c.type === 'power');
  if (!power) return undefined;
  const values = await runAction(id, { code: power.code, mode: 'toggle' });
  return Boolean(values[power.code]);
}

/** Avisa quando valores de um aparelho mudam (a lista mostra o estado nas ações rápidas). */
export function onValuesChange(listener: (id: string) => void) {
  valueListeners.add(listener);
  return () => valueListeners.delete(listener);
}

/** Últimos valores conhecidos (sessão, lembrados, ou o status que a nuvem mandou no inventário). */
export function currentValues(device: CloudDevice): Values {
  if (lastKnown.has(device.id)) return lastKnown.get(device.id)!;
  if (remembersState(device)) return rememberedValues(device.id);
  return cloudValues(resolveDevice(device), device.status);
}

/** Controles que este aparelho reporta (para lista, ações rápidas e bandeja). */
export function supportedGadget(device: CloudDevice): ResolvedGadget {
  const seen = new Set([...Object.keys(device.status), ...Object.keys(lastKnown.get(device.id) ?? {})]);
  return filterSupported(device, resolveDevice(device), seen);
}

/**
 * Só os controles que o aparelho reporta. Quem não informa estado (IR) não
 * "reporta" nada: aí vale a especificação inteira.
 */
function filterSupported(device: CloudDevice, gadget: ResolvedGadget, seen: Iterable<string>): ResolvedGadget {
  return remembersState(device) ? gadget : onlySupported(gadget, seen);
}

/** O comando que a nuvem entende: igual ao DP, exceto nos ares IR (ver core/cloud/infrared.ts). */
function cloudCommands(device: CloudDevice, code: string, value: unknown): CloudCommand[] {
  return remembersState(device) ? irAcCommands(code, value) : [{ code, value }];
}

/** Cada aparelho fala com a nuvem do fabricante: Smart Life ou LG ThinQ. */
function sendToCloud({ device, values }: Session, code: string, value: unknown): Promise<void> {
  // ar LG: a temperatura vai no alvo do modo atual
  if (isLg(device)) return thinqSend(device.id, code, value, values.mode);
  return cloudClient()!.sendCommands(device.id, cloudCommands(device, code, value));
}

async function statusFromCloud(device: CloudDevice): Promise<Record<string, unknown> | null> {
  if (isLg(device)) return thinqStatus(device.id);
  const { [device.id]: current } = await cloudClient()!.statusOf([device.id]);
  return current?.status ?? null;
}

/** Todos os controles do modelo do aparelho. */
export function resolveDevice(device: CloudDevice): ResolvedGadget {
  return resolve({ category: device.category, dps: device.dps, writableKnown: device.writableKnown });
}

/** Fecha tudo — depois de re-sincronizar, as chaves e IPs podem ter mudado. */
export function closeAllDevices() {
  for (const session of [...sessions.values()]) dispose(session);
}

export function knownPower(id: string): boolean | undefined {
  const device = findDevice(id);
  if (!device) return undefined;
  const power = resolveDevice(device).controls.find((c) => c.type === 'power');
  const value = power && currentValues(device)[power.code];
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Como o aparelho seria controlado agora (também usado pela lista).
 * `reason` explica por que não é pela rede local.
 */
export function chooseRoute(device: CloudDevice): { route: Route | null; reason?: Reason; version?: string } {
  // ares LG só falam pela nuvem da LG: não é "pela nuvem porque a rede falhou"
  if (isLg(device)) return thinqConnected() ? { route: 'cloud' } : { route: null, reason: 'offline' };
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
  if (isLg(device)) return thinqConnected();
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
  const full = resolveDevice(device);
  const seen = new Set(Object.keys(device.status));
  const session: Session = {
    device,
    route,
    full,
    gadget: filterSupported(device, full, seen),
    values: remembersState(device) ? rememberedValues(device.id) : cloudValues(full, device.status),
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
  const result: OpenResult = { gadget: session.gadget, values: session.values, route: session.route };
  if (remembersState(session.device)) result.remembered = true;
  return result;
}

/** Sem rota de controle: mostra o último estado conhecido pela nuvem. */
function readOnly(device: CloudDevice, reason?: Reason, version?: string, error?: string): OpenResult {
  const gadget = filterSupported(device, resolveDevice(device), Object.keys(device.status));
  const values = remembersState(device) ? rememberedValues(device.id) : cloudValues(gadget, device.status);
  return { gadget, values, route: null, reason, version, error };
}

async function pollCloud(session: Session) {
  clearTimeout(session.timers.poll);
  if (remembersState(session.device)) return; // a nuvem não tem o que contar
  const status = await statusFromCloud(session.device);
  if (status) {
    for (const code of Object.keys(status)) session.seen.add(code);
    session.gadget = filterSupported(session.device, session.full, session.seen);
    applyValues(session, cloudValues(session.full, status));
  }
  const every = isLg(session.device) ? LG_POLL_MS : CLOUD_POLL_MS;
  if (session.watched) session.timers.poll = setTimeout(() => pollCloud(session).catch(() => {}), every);
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
  session.gadget = filterSupported(session.device, session.full, session.seen);
  applyValues(session, values);
}

function applyValues(session: Session, values: Values) {
  Object.assign(session.values, values);
  lastKnown.set(session.device.id, { ...session.values });
  if (remembersState(session.device)) remember(session.device.id, session.values);
  push('state', { id: session.device.id, values: session.values });
  for (const listener of valueListeners) listener(session.device.id);
}

function cloudValues(gadget: ResolvedGadget, status: Values): Values {
  const out: Values = {};
  for (const control of gadget.controls) if (control.code in status) out[control.code] = toDisplay(control, status[control.code]);
  return out;
}

