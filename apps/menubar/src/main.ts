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
 */
import * as account from './backend/account.ts';
import { push, setApp, type TinyApp } from './backend/app.ts';
import * as control from './backend/control.ts';
import { loadFavorites, toggleFavorite } from './backend/favorites.ts';
import { readText } from './backend/files.ts';
import { onNetworkChange, restartListening, startListening } from './backend/network.ts';
import { FAVORITE_PREFIX, renderTray, setTrayLabels, type TrayLabels } from './backend/tray.ts';
import { loadUserThemes } from './backend/user-themes.ts';
import { deviceList } from './backend/view.ts';

const warn = (message: string) => push('warn', message);
const pushDevices = () => push('devices', deviceList());

/** Inicia uma vez só; chamadas simultâneas esperam a mesma inicialização. */
let starting: Promise<void> | null = null;
function start(app: TinyApp) {
  setApp(app);
  starting ??= (async () => {
    app.setHideOnClose(true);
    await loadFavorites();
    renderTray();
    onNetworkChange(pushDevices);
    account.onInventoryChange(() => {
      pushDevices();
      renderTray();
    });
    await startListening(warn);
  })();
  return starting;
}

/** Garante que o backend iniciou antes de qualquer chamada da página. */
function withStart<Params>(handler: (params: Params, app: TinyApp) => unknown) {
  return async (params: Params, app: TinyApp) => {
    await start(app);
    return handler(params ?? ({} as Params), app);
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
  openDevice: withStart(({ id }: Id) => control.openDevice(id)),
  setControl: withStart(({ id, code, value }: Id & { code: string; value: unknown }) => control.setControl(id, code, value)),
  closeDevice: withStart(({ id }: Id) => control.releaseDevice(id)),
  toggleFavorite: withStart(async ({ id }: Id) => {
    const favorite = await toggleFavorite(id);
    pushDevices();
    renderTray();
    return { favorite };
  }),

  // ---- interface
  trayLabels: withStart((labels: TrayLabels) => setTrayLabels(labels)),
  userThemes: withStart(() => loadUserThemes()),
  quit: withStart((_params: unknown, app: TinyApp) => app.quit()),
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function init(app: TinyApp) {
  await start(app);
}

export async function onTray(id: string | null, app: TinyApp) {
  await start(app);
  if (id === 'quit') return app.quit();
  if (id?.startsWith(FAVORITE_PREFIX)) {
    const on = await control.togglePower(id.slice(FAVORITE_PREFIX.length)).catch((error: Error) => warn(error.message));
    renderTray();
    if (on === undefined) push('open', {}); // não deu para alternar daqui: mostra o painel
    return;
  }
  push('open', { scan: id === 'scan' });
}
