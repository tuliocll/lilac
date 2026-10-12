/**
 * Menu da bandeja: favoritos com liga/desliga direto, sem abrir o painel.
 * Os rótulos vêm da página (no idioma escolhido) via setTrayLabels.
 */
import { findDevice } from './account.ts';
import { app, type TrayMenuItem } from './app.ts';
import { knownPower } from './control.ts';
import { favorites } from './favorites.ts';

export interface TrayLabels {
  open: string;
  scan: string;
  quit: string;
  /** cabeçalho da seção de favoritos */
  favorites: string;
}

let labels: TrayLabels = { open: 'Abrir painel', scan: 'Procurar aparelhos', quit: 'Sair', favorites: 'Favoritos' };

export const FAVORITE_PREFIX = 'fav:';

export function setTrayLabels(next: TrayLabels) {
  labels = next;
  renderTray();
}

export function renderTray() {
  const favoriteItems: TrayMenuItem[] = favorites()
    .map((id) => findDevice(id))
    .filter((device) => device !== undefined)
    .map((device) => ({ id: FAVORITE_PREFIX + device.id, label: device.name, checked: knownPower(device.id) === true }));

  const menu: TrayMenuItem[] = [
    ...(favoriteItems.length ? [{ id: 'favorites-title', label: labels.favorites, enabled: false }, ...favoriteItems, { separator: true }] : []),
    { id: 'open', label: labels.open },
    { id: 'scan', label: labels.scan },
    { separator: true },
    { id: 'quit', label: labels.quit },
  ];
  app().tray.set({ title: 'Tuya', tooltip: 'TuyaBar', primaryAction: true, menu });
}
