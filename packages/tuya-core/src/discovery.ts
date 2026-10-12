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

export interface DiscoverOptions {
  /** Tempo total escutando, em ms. Dispositivos anunciam a cada ~5s; 6–10s é seguro. */
  timeoutMs?: number;
  ports?: readonly number[];
  onDevice?: (d: DiscoveredDevice, isNew: boolean) => void;
  /** Datagrama que não pôde ser decodificado (útil para depurar firmwares novos). */
  onUnknown?: (data: Uint8Array, remote: RemoteInfo, port: number, err: Error) => void;
  /** Porta que falhou ao abrir (ocupada, sem permissão…). A descoberta segue nas outras. */
  onBindError?: (port: number, err: Error) => void;
  signal?: AbortSignal;
}

/**
 * Escuta os broadcasts por `timeoutMs` e devolve os dispositivos encontrados.
 * Não precisa de credencial nenhuma — a local key só é necessária para
 * *controlar*, não para descobrir.
 */
export async function discover(transport: Transport, opts: DiscoverOptions = {}): Promise<DiscoveredDevice[]> {
  const { timeoutMs = 8000, ports = DISCOVERY_PORTS } = opts;
  const found = new Map<string, DiscoveredDevice>();
  const sockets: UdpSocket[] = [];

  for (const port of ports) {
    try {
      const s = await transport.bindUdp({ port, broadcast: true, reuseAddr: true });
      s.onMessage((data, remote) => {
        let parsed;
        try {
          parsed = parseBroadcast(data);
        } catch (e) {
          opts.onUnknown?.(data, remote, port, e as Error);
          return;
        }
        const { msg, frame } = parsed;
        const now = Date.now();
        const prev = found.get(msg.gwId);
        const dev: DiscoveredDevice = {
          id: msg.gwId,
          ip: msg.ip || remote.address,
          version: String(msg.version ?? (port === 6666 ? '3.1' : '?')),
          productKey: msg.productKey,
          encrypted: Boolean(msg.encrypt ?? port !== 6666),
          port,
          frame,
          firstSeen: prev?.firstSeen ?? now,
          lastSeen: now,
          raw: msg,
        };
        found.set(dev.id, dev);
        opts.onDevice?.(dev, !prev);
      });
      sockets.push(s);
    } catch (e) {
      opts.onBindError?.(port, e as Error);
    }
  }

  if (sockets.length === 0) throw new Error(`nenhuma porta de descoberta pôde ser aberta (${ports.join(', ')})`);

  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, timeoutMs);
    opts.signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

  await Promise.allSettled(sockets.map((s) => s.close()));
  return [...found.values()];
}
