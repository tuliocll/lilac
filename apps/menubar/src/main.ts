/**
 * Backend do app de bandeja (roda em txiki.js dentro do tinyjs).
 * Spike: descobre dispositivos Tuya na LAN e empurra para a UI.
 */
import { discover, type DiscoveredDevice } from '@tuyabar/core';
import { createTxikiTransport } from '@tuyabar/transport-txiki';

type App = any; // handle do tinyjs (sem tipos publicados ainda)

const transport = createTxikiTransport();
let scanning: Promise<DiscoveredDevice[]> | null = null;

async function scan(app: App, timeoutMs = 8000): Promise<DiscoveredDevice[]> {
  if (scanning) return scanning; // um scan por vez — as portas são compartilhadas
  app.push('scan-start', { timeoutMs });
  scanning = discover(transport, {
    timeoutMs,
    onDevice: (d, isNew) => app.push('device', { device: d, isNew }),
    onBindError: (port, err) => app.push('warn', `porta ${port}: ${err.message}`),
  })
    .catch((e: Error) => {
      app.push('warn', e.message);
      return [];
    })
    .finally(() => {
      scanning = null;
    });
  const result = await scanning;
  app.push('scan-end', { count: result.length });
  return result;
}

export const api = {
  scan: ({ timeoutMs }: { timeoutMs?: number } = {}, app: App) => scan(app, timeoutMs),
  quit: (_: unknown, app: App) => app.quit(),
};

export function init(app: App) {
  app.setHideOnClose(true);
  app.tray.set({
    title: 'Tuya',
    tooltip: 'TuyaBar',
    primaryAction: true, // clique esquerdo abre o painel; menu no botão direito
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
  // a página posiciona a janela sob o ícone e se mostra
  app.push('open', { scan: id === 'scan' });
}
