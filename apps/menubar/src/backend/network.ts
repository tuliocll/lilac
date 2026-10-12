/**
 * Presença na rede: escuta os anúncios UDP o tempo todo.
 * Os aparelhos anunciam a cada ~5 s, então IP, versão e "está na rede?"
 * ficam sempre atualizados — inclusive quando o roteador troca um IP.
 */
import { watchBroadcasts, type BroadcastWatcher, type DiscoveredDevice, type Transport } from '@tuyabar/core';
import { createTxikiTransport } from '@tuyabar/transport-txiki';

let transport: Transport = createTxikiTransport();
let tcpPort = 6668;

export const networkTransport = () => transport;
export const deviceTcpPort = () => tcpPort;

/** Troca o transporte (os testes usam o de Node e uma porta TCP aleatória). */
export function configureNetwork(options: { transport?: Transport; tcpPort?: number }) {
  transport = options.transport ?? transport;
  tcpPort = options.tcpPort ?? tcpPort;
}

/** sem anúncio por este tempo, consideramos que saiu da rede */
const STALE_AFTER_MS = 30_000;

const seen = new Map<string, DiscoveredDevice>();
const listeners = new Set<() => void>();
let watcher: BroadcastWatcher | null = null;

export async function startListening(onError: (message: string) => void) {
  if (watcher) return;
  try {
    watcher = await watchBroadcasts(transport, {
      onDevice(device, isNew) {
        const previous = seen.get(device.id);
        seen.set(device.id, device);
        if (isNew || previous?.ip !== device.ip || !isFresh(previous)) notify();
      },
      onBindError: (port, error) => onError(`porta ${port}: ${error.message}`),
    });
  } catch (error) {
    onError((error as Error).message);
  }
}

/** Esquece o que foi visto e volta a escutar do zero (botão "Procurar"). */
export async function restartListening(onError: (message: string) => void) {
  await watcher?.stop();
  watcher = null;
  seen.clear();
  notify();
  await startListening(onError);
}

/** Onde o aparelho está agora (ou undefined, se não anunciou recentemente). */
export function locate(id: string): DiscoveredDevice | undefined {
  const device = seen.get(id);
  return device && isFresh(device) ? device : undefined;
}

export function presentDevices(): DiscoveredDevice[] {
  return [...seen.values()].filter(isFresh);
}

export function onNetworkChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isFresh(device: DiscoveredDevice | undefined) {
  return device !== undefined && Date.now() - device.lastSeen < STALE_AFTER_MS;
}

function notify() {
  for (const listener of listeners) listener();
}

// Aparelhos que somem não mandam "tchau": de tempos em tempos vemos quem
// deixou de anunciar e avisamos só se a lista mudou.
let lastPresence = '';
setInterval(() => {
  const presence = presentDevices()
    .map((d) => d.id)
    .sort()
    .join();
  if (presence !== lastPresence) {
    lastPresence = presence;
    notify();
  }
}, STALE_AFTER_MS / 3);
