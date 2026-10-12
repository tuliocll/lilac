/**
 * Backend do TuyaBar (txiki.js dentro do tinyjs).
 * Aqui só ficam a API chamada pela página e os eventos do tinyjs;
 * a lógica mora em ./backend/*.
 *
 *   account    conta Smart Life, inventário, login por QR, chaves importadas
 *   network    presença na rede (anúncios UDP)
 *   control    rota local/nuvem, conexão, reconexão, valores
 *   view       a lista que a página mostra
 *   favorites  favoritos   ·   tray  menu da bandeja   ·   user-themes  temas extras
 *   windows    janela expandida e quem está olhando cada aparelho
 */
import * as account from './backend/account.ts';
import { push, setApp, type TinyApp } from './backend/app.ts';
import * as control from './backend/control.ts';
import { findDevice } from './backend/account.ts';
import { loadFavorites, reorderFavorites, toggleFavorite } from './backend/favorites.ts';
import { loadQuickActions, MAX_QUICK_ACTIONS, quickActionsFor, quickModeFor, saveQuickActions, type QuickAction } from './backend/quick-actions.ts';
import { readText } from './backend/files.ts';
import { onNetworkChange, restartListening, startListening } from './backend/network.ts';
import { FAVORITE_PREFIX, renderTray, setTrayLabels, type TrayLabels } from './backend/tray.ts';
import { loadUserThemes } from './backend/user-themes.ts';
import { deviceList } from './backend/view.ts';
import * as windows from './backend/windows.ts';

const warn = (message: string) => push('warn', message);
const pushDevices = () => push('devices', deviceList());

/** Muitas mudanças em sequência (vários STATUS) viram uma atualização só da lista. */
let pushTimer: ReturnType<typeof setTimeout> | undefined;
const pushDevicesSoon = () => {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushDevices, 150);
};

/** Inicia uma vez só; chamadas simultâneas esperam a mesma inicialização. */
let starting: Promise<void> | null = null;
function start(app: TinyApp) {
  setApp(app);
  starting ??= (async () => {
    app.setHideOnClose(true);
    await Promise.all([loadFavorites(), loadQuickActions()]);
    renderTray();
    onNetworkChange(pushDevices);
    control.onValuesChange(() => {
      pushDevicesSoon();
      renderTray();
    });
    account.onInventoryChange(() => {
      pushDevices();
      renderTray();
    });
    await startListening(warn);
  })();
  return starting;
}

/** Quem chamou: o tinyjs informa a janela de origem. */
type Meta = { window?: string } | undefined;
const windowOf = (meta: Meta) => meta?.window ?? 'main';

/** Garante que o backend iniciou antes de qualquer chamada da página. */
function withStart<Params>(handler: (params: Params, app: TinyApp, meta: Meta) => unknown) {
  return async (params: Params, app: TinyApp, meta?: Meta) => {
    await start(app);
    return handler(params ?? ({} as Params), app, meta);
  };
}

type Id = { id: string };

export const api = {
  // ---- inicialização e conta
  restore: withStart((saved: Parameters<typeof account.restore>[0]) => {
    const result = account.restore(saved);
    pushDevices();
    if (result.loggedIn) account.sync();
    return result;
  }),
  loginStart: withStart(({ userCode }: { userCode: string }) => account.startLogin(String(userCode ?? ''))),
  loginCancel: withStart(() => account.cancelLogin()),
  logout: withStart(async () => {
    control.closeAllDevices();
    await account.logout();
  }),
  sync: withStart(async () => {
    await account.sync();
    control.closeAllDevices(); // chaves e IPs podem ter mudado
  }),
  importKeys: withStart(async ({ path }: { path: string }) => ({ count: account.importKeys(JSON.parse(await readText(path))) })),

  // ---- rede
  scan: withStart(async () => {
    push('scan-start');
    await restartListening(warn);
    await sleep(6000); // tempo para os anúncios chegarem antes de dizer "pronto"
    push('scan-end');
  }),

  // ---- aparelhos
  devices: withStart(() => deviceList()),
  openDevice: withStart(({ id }: Id, _app, meta) => {
    windows.watch(id, windowOf(meta));
    return control.openDevice(id);
  }),
  setControl: withStart(({ id, code, value }: Id & { code: string; value: unknown }) => control.setControl(id, code, value)),
  closeDevice: withStart(({ id }: Id, _app, meta) => {
    if (windows.unwatch(id, windowOf(meta))) control.releaseDevice(id);
  }),
  toggleFavorite: withStart(async ({ id }: Id) => {
    const favorite = await toggleFavorite(id);
    pushDevices();
    renderTray();
    return { favorite };
  }),
  reorderFavorites: withStart(async ({ order }: { order: string[] }) => {
    const ids = await reorderFavorites(Array.isArray(order) ? order : []);
    pushDevices();
    renderTray();
    return { order: ids };
  }),

  // ---- ações rápidas
  /** O que dá para virar ação rápida neste aparelho, e o que já está escolhido. */
  quickActionOptions: withStart(({ id }: Id) => {
    const device = findDevice(id);
    if (!device) return { chosen: [], candidates: [], max: 0 };
    const gadget = control.supportedGadget(device);
    const candidates = gadget.controls.flatMap((c) => {
      const mode = quickModeFor(c);
      return mode ? [{ code: c.code, mode, control: c }] : [];
    });
    return { chosen: quickActionsFor(id, gadget), candidates, max: MAX_QUICK_ACTIONS };
  }),
  setQuickActions: withStart(async ({ id, actions }: Id & { actions: QuickAction[] }) => {
    const device = findDevice(id);
    if (!device) return { actions: [] };
    const saved = await saveQuickActions(id, Array.isArray(actions) ? actions : [], control.supportedGadget(device));
    pushDevices();
    return { actions: saved };
  }),
  runQuickAction: withStart(async ({ id, index }: Id & { index: number }) => {
    const action = deviceList().find((d) => d.id === id)?.quick[index];
    if (!action) throw new Error('ação rápida não encontrada');
    await control.runAction(id, action);
    pushDevices();
  }),

  // ---- interface
  trayLabels: withStart((labels: TrayLabels) => setTrayLabels(labels)),
  /** Para uma janela que abriu depois: a conta já carregada (o painel é quem restaura do cofre). */
  session: withStart(() => ({ account: account.accountInfo() })),
  openWindow: withStart(() => windows.openExpanded()),
  /** Tema, idioma ou atalho mudou numa janela: as outras releem do store. */
  prefsChanged: withStart(({ kind }: { kind: string }, _app, meta) => push('prefs', { kind, from: windowOf(meta) })),
  userThemes: withStart(() => loadUserThemes()),
  quit: withStart((_params: unknown, app: TinyApp) => app.quit()),
};

export async function onWindowClosed(id: string, app: TinyApp) {
  await start(app);
  for (const deviceId of windows.windowClosed(id)) control.releaseDevice(deviceId);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function init(app: TinyApp) {
  await start(app);
}

export async function onTray(id: string | null, app: TinyApp) {
  await start(app);
  if (id === 'quit') return app.quit();
  if (id === 'window') return windows.openExpanded();
  if (id?.startsWith(FAVORITE_PREFIX)) {
    const on = await control.togglePower(id.slice(FAVORITE_PREFIX.length)).catch((error: Error) => warn(error.message));
    renderTray();
    if (on === undefined) push('open', {}); // não deu para alternar daqui: mostra o painel
    return;
  }
  push('open', { scan: id === 'scan' });
}
