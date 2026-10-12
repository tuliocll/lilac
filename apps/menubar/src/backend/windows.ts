/**
 * Janelas além do painel da bandeja e quem está olhando qual aparelho.
 *
 * O painel ('main') e a janela expandida podem estar com o mesmo aparelho
 * aberto; a conexão só é liberada quando a última janela sai dele.
 */
import { app } from './app.ts';

export const EXPANDED = 'expanded';

const openWindows = new Set<string>();

/** Abre a janela expandida — ou, se já estiver aberta, pede para ela aparecer. */
export function openExpanded() {
  if (openWindows.has(EXPANDED)) {
    app().window?.(EXPANDED)?.push('raise');
    return;
  }
  const handle = app();
  if (!handle.openWindow) throw new Error('este runtime não abre janelas extras');
  handle.openWindow(EXPANDED, {
    page: 'index.html',
    title: 'TuyaBar',
    size: '1040x700',
    minSize: '760x520',
    chrome: { frame: true, windowControls: true },
  });
  openWindows.add(EXPANDED);
}

// ------------------------------------------------------------ quem olha o quê

/** deviceId → janelas com a página dele aberta */
const watchers = new Map<string, Set<string>>();

export function watch(deviceId: string, windowId: string) {
  const set = watchers.get(deviceId) ?? new Set();
  set.add(windowId);
  watchers.set(deviceId, set);
}

/** Tira a janela da lista; `true` se ninguém mais olha o aparelho. */
export function unwatch(deviceId: string, windowId: string): boolean {
  const set = watchers.get(deviceId);
  set?.delete(windowId);
  if (set?.size) return false;
  watchers.delete(deviceId);
  return true;
}

/** A janela fechou: devolve os aparelhos que ficaram sem ninguém olhando. */
export function windowClosed(windowId: string): string[] {
  openWindows.delete(windowId);
  return [...watchers.keys()].filter((deviceId) => watchers.get(deviceId)!.has(windowId) && unwatch(deviceId, windowId));
}
