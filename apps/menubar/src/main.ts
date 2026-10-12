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
  categoryLabel,
  discover,
  HOME_ASSISTANT_CREDENTIALS as APP,
  pollLogin,
  requestLoginQr,
  SharingClient,
  type CloudDevice,
  type DiscoveredDevice,
  type SharingSession,
} from '@tuyabar/core';
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

function view(): DeviceView[] {
  const out: DeviceView[] = [];
  for (const d of inventory) {
    const l = discovered.get(d.id);
    out.push({
      id: d.id,
      name: d.name,
      type: categoryLabel(d.category),
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

  scan: (_: unknown, app: App) => scan(app),
  sync: (_: unknown, app: App) => syncCloud(app),
  quit: (_: unknown, app: App) => app.quit(),
};

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
