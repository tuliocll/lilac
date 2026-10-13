/**
 * Menu da bandeja: favoritos com liga/desliga direto, sem abrir o painel.
 * Os rótulos vêm da página (no idioma escolhido) via setTrayLabels.
 */
import { findDevice } from './account.ts';
import { app, type TrayMenuItem } from './app.ts';
import { knownPower } from './control.ts';
import { favorites } from './favorites.ts';
import { makeDir, writeBytes } from './files.ts';
import { TRAY_PNG_BASE64 } from './tray-icon.gen.ts';

export interface TrayLabels {
  open: string;
  scan: string;
  quit: string;
  /** cabeçalho da seção de favoritos */
  favorites: string;
}

let labels: TrayLabels = { open: 'Abrir painel', scan: 'Procurar aparelhos', quit: 'Sair', favorites: 'Favoritos' };

export const FAVORITE_PREFIX = 'fav:';
/**
 * O tinyjs resolve um ícone relativo a partir da pasta de onde o app foi aberto.
 * No `tinyjs dev` isso é o projeto (assets/tray.png existe); no app compilado é a
 * pasta do usuário, e a pasta assets/ nem vai junto. Por isso o PNG vem embutido
 * (npm run assets) e é gravado na pasta de dados do app na inicialização.
 */
let trayIcon = 'assets/tray.png';

export async function prepareTrayIcon() {
  const dir = app().paths?.data;
  if (!dir) return;
  try {
    const bytes = Uint8Array.from(atob(TRAY_PNG_BASE64), (c) => c.charCodeAt(0));
    await makeDir(dir);
    await writeBytes(`${dir}/tray.png`, bytes);
    trayIcon = `${dir}/tray.png`;
  } catch {
    // fica no caminho relativo (funciona no modo dev)
  }
}

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
  // ícone: o cacho de lilás (assets/tray.png); no macOS vira "template" e segue o tema da barra
  app().tray.set({ icon: trayIcon, tooltip: 'Lilac', primaryAction: true, menu });
}
