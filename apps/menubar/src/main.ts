/**
 * Backend do app de bandeja (txiki.js dentro do tinyjs).
 *
 * Estado:
 *  - sessão Smart Life (login por QR)  → persistida pela página no cofre do SO
 *  - inventário da nuvem (nomes, categorias, local keys, DPs)
 *  - descoberta na LAN (IP, versão do protocolo)
 * A UI recebe uma lista já mesclada via evento `devices`.
 */
import {
  categoryKind,
  categoryLabel,
  type DeviceKind,
  discover,
  HOME_ASSISTANT_CREDENTIALS as APP,
  isLocalVersionSupported,
  pollLogin,
  requestLoginQr,
  SharingClient,
  TuyaLocalDevice,
  type CloudDevice,
  type DiscoveredDevice,
  type SharingSession,
} from '@tuyabar/core';
import { onlySupported, profileFor, resolve, toDisplay, toRaw, type ResolvedControl, type ResolvedGadget } from '@tuyabar/gadgets';
import { createTxikiTransport } from '@tuyabar/transport-txiki';
import qrcode from 'qrcode-generator';

type App = any; // handle do tinyjs (sem tipos publicados ainda)

const transport = createTxikiTransport();

let client: SharingClient | null = null;
let inventory: CloudDevice[] = [];
const discovered = new Map<string, DiscoveredDevice>();
let scanning: Promise<void> | null = null;
let loginAbort: AbortController | null = null;

// ---------- visão mesclada para a UI ----------

export interface DeviceView {
  id: string;
  name: string;
  type: string;
  /** família visual (ícone/cor no tema) */
  kind: DeviceKind;
  /** perfil de gadget (ícone, cor semântica, layout da página) */
  gadget: string;
  tone: string;
  category?: string;
  ip?: string;
  version?: string;
  /** anunciando na LAN agora */
  local: boolean;
  /** online segundo a nuvem */
  online?: boolean;
  sub: boolean;
  hasKey: boolean;
  supportLocal: boolean;
  dpCount: number;
  known: boolean;
}

function gadgetLook(category: string | undefined, codes: string[]) {
  const p = profileFor(category, codes);
  return { gadget: p.id, tone: p.tone };
}

function view(): DeviceView[] {
  const out: DeviceView[] = [];
  for (const d of inventory) {
    const l = discovered.get(d.id);
    out.push({
      id: d.id,
      name: d.name,
      type: categoryLabel(d.category),
      kind: categoryKind(d.category),
      ...gadgetLook(d.category, d.dps.map((x) => x.code)),
      category: d.category,
      ip: l?.ip,
      version: l?.version,
      local: Boolean(l),
      online: d.online,
      sub: d.sub,
      hasKey: Boolean(d.localKey),
      supportLocal: d.supportLocal,
      dpCount: d.dps.length,
      known: true,
    });
  }
  for (const l of discovered.values()) {
    if (inventory.some((d) => d.id === l.id)) continue;
    out.push({
      id: l.id,
      name: l.productKey ?? l.id,
      type: 'Desconhecido',
      kind: 'unknown',
      gadget: 'generic',
      tone: 'neutral',
      ip: l.ip,
      version: l.version,
      local: true,
      sub: false,
      hasKey: false,
      supportLocal: false,
      dpCount: 0,
      known: false,
    });
  }
  // na LAN primeiro, depois por nome
  return out.sort((a, b) => Number(b.local) - Number(a.local) || a.name.localeCompare(b.name, 'pt-BR'));
}

const pushDevices = (app: App) => app.push('devices', view());

// ---------- controle local ----------

interface Session {
  dev: TuyaLocalDevice;
  gadget: ResolvedGadget;
  values: Record<string, unknown>; // por código, já na escala de tela
  idle?: ReturnType<typeof setTimeout>;
}
const sessions = new Map<string, Session>();

function codeOf(g: ResolvedGadget, dpId: string): ResolvedControl | undefined {
  return g.controls.find((c) => String(c.dpId) === dpId);
}

function dpsToValues(g: ResolvedGadget, dps: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dps)) {
    const c = codeOf(g, k);
    if (c) out[c.code] = toDisplay(c, v);
  }
  return out;
}

function cloudValues(g: ResolvedGadget, d: CloudDevice) {
  const out: Record<string, unknown> = {};
  for (const c of g.controls) if (c.code in d.status) out[c.code] = toDisplay(c, d.status[c.code]);
  return out;
}

async function openDevice(app: App, id: string) {
  const d = inventory.find((x) => x.id === id);
  const l = discovered.get(id);
  const deviceView = view().find((x) => x.id === id);
  if (!d) return { device: deviceView, gadget: null, values: {}, local: false, reason: 'unknown' };
  // controles = DPs do *modelo* (nuvem) ∩ DPs que *este aparelho* já reportou
  const full = resolve({ category: d.category, dps: d.dps, writableKnown: d.writableKnown });
  const seen = new Set(Object.keys(d.status));
  const supported = () => onlySupported(full, seen);
  let gadget = supported();
  const base = { device: deviceView, gadget, values: cloudValues(gadget, d) };

  if (!l) return { ...base, local: false, reason: d.sub ? 'sub' : 'offline' };
  if (!d.localKey) return { ...base, local: false, reason: 'nokey' };
  if (!isLocalVersionSupported(l.version)) return { ...base, local: false, reason: 'version', version: l.version };

  let s = sessions.get(id);
  if (!s) {
    const dev = new TuyaLocalDevice({ id, ip: l.ip, localKey: d.localKey, version: l.version, transport, timeoutMs: 4000 });
    s = { dev, gadget: full, values: base.values };
    const sess = s;
    dev.onStatus((dps) => {
      Object.assign(sess.values, dpsToValues(sess.gadget, dps));
      app.push('state', { id, values: sess.values });
    });
    dev.onClose(() => sessions.delete(id));
    sessions.set(id, s);
  }
  if (s.idle) clearTimeout(s.idle);
  try {
    const dps = await s.dev.status();
    for (const k of Object.keys(dps)) {
      const code = d.dps.find((x) => String(x.dpId) === k)?.code;
      if (code) seen.add(code);
    }
    gadget = supported();
    s.gadget = gadget;
    Object.assign(s.values, dpsToValues(full, dps));
    return { device: deviceView, gadget, values: s.values, local: true };
  } catch (e) {
    sessions.delete(id);
    await s.dev.close();
    return { ...base, local: false, reason: 'error', error: (e as Error).message };
  }
}

async function setControl(app: App, id: string, code: string, value: unknown) {
  const s = sessions.get(id) ?? (await openDevice(app, id), sessions.get(id));
  if (!s) throw new Error('dispositivo indisponível na rede local');
  const c = s.gadget.controls.find((x) => x.code === code);
  if (!c) throw new Error(`controle desconhecido: ${code}`);
  const applied = await s.dev.set({ [String(c.dpId)]: toRaw(c, value) });
  Object.assign(s.values, dpsToValues(s.gadget, applied));
  return s.values;
}

function releaseDevice(id: string) {
  const s = sessions.get(id);
  if (!s) return;
  if (s.idle) clearTimeout(s.idle);
  // mantém a conexão um pouco: voltar à página fica instantâneo
  s.idle = setTimeout(() => {
    sessions.delete(id);
    s.dev.close();
  }, 30_000);
}

// ---------- persistência (a página guarda no cofre do SO) ----------

function persist(app: App) {
  app.push('persist', {
    session: client?.session ?? null,
    // sem local keys aqui: elas vão separadas para o cofre
    inventory: inventory.map(({ localKey: _k, ...rest }) => rest),
    keys: Object.fromEntries(inventory.map((d) => [d.id, d.localKey])),
  });
}

function useSession(app: App, session: SharingSession) {
  client = new SharingClient(session, { app: APP, onSessionUpdate: () => persist(app) });
  app.push('account', { username: session.username ?? session.uid, endpoint: session.endpoint });
}

// ---------- operações ----------

async function scan(app: App, timeoutMs = 8000) {
  if (scanning) return scanning;
  app.push('scan-start', { timeoutMs });
  scanning = discover(transport, {
    timeoutMs,
    onDevice: (d) => {
      discovered.set(d.id, d);
      pushDevices(app);
    },
    onBindError: (port, err) => app.push('warn', `porta ${port}: ${err.message}`),
  })
    .then(() => undefined)
    .catch((e: Error) => void app.push('warn', e.message))
    .finally(() => {
      scanning = null;
      app.push('scan-end', { local: discovered.size });
    });
  return scanning;
}

async function syncCloud(app: App) {
  if (!client) return;
  app.push('sync-start', {});
  try {
    inventory = await client.inventory();
    persist(app);
    pushDevices(app);
    app.push('sync-end', { count: inventory.length });
  } catch (e) {
    app.push('sync-end', { error: (e as Error).message });
  }
}

function qrSvg(data: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  return qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}

export const api = {
  /** Chamado pela página na inicialização, com o que estava no cofre. */
  restore({ session, inventory: inv, keys }: { session?: SharingSession; inventory?: CloudDevice[]; keys?: Record<string, string> }, app: App) {
    if (inv) inventory = inv.map((d) => ({ ...d, localKey: keys?.[d.id] ?? '' }));
    if (session) useSession(app, session);
    pushDevices(app);
    scan(app);
    if (session) syncCloud(app); // atualiza em segundo plano; offline, segue com o cache
    return { loggedIn: Boolean(session) };
  },

  async loginStart({ userCode }: { userCode: string }, app: App) {
    loginAbort?.abort();
    const { token, qrData } = await requestLoginQr(userCode, APP);
    const ac = (loginAbort = new AbortController());
    pollLogin(token, userCode, APP, { signal: ac.signal })
      .then(async (session) => {
        useSession(app, session);
        persist(app);
        app.push('login-ok', { username: session.username ?? session.uid });
        await syncCloud(app);
      })
      .catch((e: Error) => {
        if (!ac.signal.aborted) app.push('login-error', e.message);
      });
    return { svg: qrSvg(qrData), expiresInMs: 3 * 60_000 };
  },

  loginCancel() {
    loginAbort?.abort();
    loginAbort = null;
  },

  async logout(_: unknown, app: App) {
    try {
      await client?.logout();
    } catch {
      // sem rede: apaga localmente mesmo assim
    }
    client = null;
    inventory = [];
    app.push('persist', { session: null, inventory: [], keys: {} });
    pushDevices(app);
  },

  /** Temas instalados pelo usuário em <dados do app>/themes/<id>/{manifest.json,theme.css}. */
  userThemes: (_: unknown, app: App) => loadUserThemes(app),

  openDevice: ({ id }: { id: string }, app: App) => openDevice(app, id),
  setControl: ({ id, code, value }: { id: string; code: string; value: unknown }, app: App) => setControl(app, id, code, value),
  closeDevice: ({ id }: { id: string }) => releaseDevice(id),

  scan: (_: unknown, app: App) => scan(app),
  sync: (_: unknown, app: App) => syncCloud(app),
  quit: (_: unknown, app: App) => app.quit(),
};

// ---------- temas do usuário ----------

declare const tjs: any;

export interface UserTheme {
  id: string;
  name: string;
  author?: string;
  description?: string;
  swatches?: string[];
  css: string;
  dir: string;
}

async function loadUserThemes(app: App): Promise<{ dir: string; themes: UserTheme[]; error?: string }> {
  const root = `${app.paths?.data ?? '.'}/themes`;
  const themes: UserTheme[] = [];
  try {
    await tjs.makeDir(root, { recursive: true });
    const dec = new TextDecoder();
    const read = async (p: string) => dec.decode(await tjs.readFile(p));
    for await (const entry of await tjs.readDir(root)) {
      const dir = `${root}/${entry.name}`;
      try {
        const manifest = JSON.parse(await read(`${dir}/manifest.json`));
        const css = await read(`${dir}/theme.css`);
        const id = String(manifest.id ?? entry.name).replace(/[^a-z0-9-]/gi, '');
        if (id) themes.push({ id, name: manifest.name ?? id, author: manifest.author, description: manifest.description, swatches: manifest.swatches, css, dir });
      } catch {
        // pasta sem manifest/theme.css válidos: ignora
      }
    }
    return { dir: root, themes };
  } catch (e) {
    return { dir: root, themes, error: (e as Error).message };
  }
}

export function init(app: App) {
  app.setHideOnClose(true);
  app.tray.set({
    title: 'Tuya',
    tooltip: 'TuyaBar',
    primaryAction: true,
    menu: [
      { id: 'open', label: 'Abrir painel' },
      { id: 'scan', label: 'Procurar dispositivos' },
      { separator: true },
      { id: 'quit', label: 'Sair' },
    ],
  });
}

export function onTray(id: string | null, app: App) {
  if (id === 'quit') return app.quit();
  app.push('open', { scan: id === 'scan' });
}
