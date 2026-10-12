import { td } from './bytes.ts';
import { aesEcbDecrypt, UDP_KEY } from './crypto.ts';
import { decode55AA, decode6699, detectPrefix, FrameError } from './frame.ts';
import type { RemoteInfo, Transport, UdpSocket } from './transport.ts';

/**
 * Portas onde os dispositivos Tuya anunciam presença (broadcast a cada ~5s):
 *  - 6666: v3.1, JSON em texto puro
 *  - 6667: v3.2+ cifrado com UDP_KEY (ECB em frames 55AA, GCM em frames 6699/v3.5)
 *  - 7000: dispositivos mais novos respondendo/anunciando em modo "app"
 */
export const DISCOVERY_PORTS = [6666, 6667, 7000] as const;

/** Anúncio cru, como o dispositivo envia. */
export interface TuyaBroadcast {
  ip: string;
  gwId: string;
  active?: number;
  ability?: number;
  mode?: number;
  encrypt?: boolean;
  productKey?: string;
  version?: string;
  token?: boolean;
  wf_cfg?: boolean;
  [k: string]: unknown;
}

export interface DiscoveredDevice {
  id: string;
  ip: string;
  version: string;
  productKey?: string;
  encrypted: boolean;
  /** porta UDP em que o anúncio chegou */
  port: number;
  /** formato do frame recebido */
  frame: '55aa' | '6699' | 'raw';
  firstSeen: number;
  lastSeen: number;
  raw: TuyaBroadcast;
}

export class BroadcastParseError extends Error {}

/** Decodifica um datagrama de broadcast. Lança BroadcastParseError se não for Tuya. */
export function parseBroadcast(data: Uint8Array): { msg: TuyaBroadcast; frame: DiscoveredDevice['frame'] } {
  const kind = detectPrefix(data);
  let payload: Uint8Array;
  let frame: DiscoveredDevice['frame'];

  try {
    if (kind === '55aa') {
      payload = decode55AA(data).payload;
      frame = '55aa';
      // v3.1 manda JSON puro; v3.3/3.4 manda ciphertext ECB.
      if (payload[0] !== 0x7b /* { */) payload = aesEcbDecrypt(UDP_KEY, payload);
    } else if (kind === '6699') {
      payload = decode6699(data, UDP_KEY).payload;
      frame = '6699';
    } else {
      // alguns firmwares mandam só o ciphertext, sem frame
      payload = data[0] === 0x7b ? data : aesEcbDecrypt(UDP_KEY, data);
      frame = 'raw';
    }
  } catch (e) {
    if (e instanceof FrameError) throw new BroadcastParseError(e.message);
    throw new BroadcastParseError(`não foi possível decifrar: ${(e as Error).message}`);
  }

  let msg: unknown;
  try {
    msg = JSON.parse(td.decode(payload));
  } catch {
    throw new BroadcastParseError('payload não é JSON');
  }
  if (!msg || typeof msg !== 'object' || typeof (msg as TuyaBroadcast).gwId !== 'string') {
    throw new BroadcastParseError('JSON sem gwId');
  }
  return { msg: msg as TuyaBroadcast, frame };
}

export interface WatchOptions {
  ports?: readonly number[];
  /** a cada anúncio decodificado; `isNew` na primeira vez que o aparelho aparece */
  onDevice: (device: DiscoveredDevice, isNew: boolean) => void;
  /** datagrama que não pôde ser decodificado (útil para depurar firmwares novos) */
  onUnknown?: (data: Uint8Array, remote: RemoteInfo, port: number, error: Error) => void;
  /** porta que falhou ao abrir (ocupada, sem permissão…); a escuta segue nas outras */
  onBindError?: (port: number, error: Error) => void;
}

export interface BroadcastWatcher {
  /** aparelhos vistos desde o início da escuta */
  devices(): DiscoveredDevice[];
  stop(): Promise<void>;
}

/**
 * Escuta os anúncios continuamente. Os aparelhos anunciam a cada ~5 s, então
 * isso mantém IPs e presença sempre atualizados. Não precisa de credencial:
 * a local key só é necessária para *controlar*.
 */
export async function watchBroadcasts(transport: Transport, options: WatchOptions): Promise<BroadcastWatcher> {
  const { ports = DISCOVERY_PORTS } = options;
  const seen = new Map<string, DiscoveredDevice>();
  const sockets: UdpSocket[] = [];

  for (const port of ports) {
    try {
      const socket = await transport.bindUdp({ port, broadcast: true, reuseAddr: true });
      socket.onMessage((data, remote) => {
        let parsed: ReturnType<typeof parseBroadcast>;
        try {
          parsed = parseBroadcast(data);
        } catch (error) {
          options.onUnknown?.(data, remote, port, error as Error);
          return;
        }
        const { msg, frame } = parsed;
        const now = Date.now();
        const previous = seen.get(msg.gwId);
        const device: DiscoveredDevice = {
          id: msg.gwId,
          ip: msg.ip || remote.address,
          version: String(msg.version ?? (port === 6666 ? '3.1' : '?')),
          productKey: msg.productKey,
          encrypted: Boolean(msg.encrypt ?? port !== 6666),
          port,
          frame,
          firstSeen: previous?.firstSeen ?? now,
          lastSeen: now,
          raw: msg,
        };
        seen.set(device.id, device);
        options.onDevice(device, !previous);
      });
      sockets.push(socket);
    } catch (error) {
      options.onBindError?.(port, error as Error);
    }
  }
  if (!sockets.length) throw new Error(`nenhuma porta de descoberta pôde ser aberta (${ports.join(', ')})`);

  return {
    devices: () => [...seen.values()],
    stop: async () => {
      await Promise.allSettled(sockets.map((s) => s.close()));
    },
  };
}

export interface DiscoverOptions extends Partial<WatchOptions> {
  /** tempo escutando, em ms. Aparelhos anunciam a cada ~5 s; 6–10 s é seguro. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Escuta por um tempo e devolve o que encontrou. */
export async function discover(transport: Transport, options: DiscoverOptions = {}): Promise<DiscoveredDevice[]> {
  const { timeoutMs = 8000, signal } = options;
  const watcher = await watchBroadcasts(transport, { ...options, onDevice: options.onDevice ?? (() => {}) });
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  await watcher.stop();
  return watcher.devices();
}
