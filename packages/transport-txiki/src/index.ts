import type { RemoteInfo, Transport, UdpBindOptions, UdpSocket } from '@tuyabar/core';

/*
 * Transporte para txiki.js (o runtime do backend do tinyjs).
 *
 * O txiki mudou a API de sockets entre versões, então detectamos as duas:
 *  - nova (estilo Direct Sockets): `new UDPSocket({...})` → `await sock.opened`
 *    → { readable: ReadableStream<{data, remoteAddress, remotePort}>, writable }
 *  - antiga: `await tjs.listen('udp', host, port)` → `sock.recv()` / `sock.send()`
 *
 * Validar qual delas o tinyjs embarca é justamente um dos objetivos do spike.
 */

declare const tjs: any;

interface UdpMessage {
  data: Uint8Array;
  remoteAddress?: string;
  remotePort?: number;
}

export function createTxikiTransport(): Transport {
  return { bindUdp };
}

async function bindUdp(opts: UdpBindOptions): Promise<UdpSocket> {
  const g = globalThis as any;
  const Ctor = g.UDPSocket ?? (typeof tjs !== 'undefined' ? tjs.UDPSocket : undefined);
  if (Ctor) return bindModern(Ctor, opts);
  if (typeof tjs !== 'undefined' && typeof tjs.listen === 'function') return bindLegacy(opts);
  throw new Error('este runtime não expõe UDP (nem UDPSocket nem tjs.listen)');
}

async function bindModern(Ctor: any, opts: UdpBindOptions): Promise<UdpSocket> {
  const sock = new Ctor({
    localAddress: opts.address ?? '0.0.0.0',
    localPort: opts.port,
    reuseAddr: opts.reuseAddr ?? true,
    broadcast: opts.broadcast ?? false,
  });
  const { readable, writable } = await sock.opened;
  const reader = readable.getReader();
  const writer = writable.getWriter();
  const listeners: ((d: Uint8Array, r: RemoteInfo) => void)[] = [];
  let closed = false;

  // txiki não suporta `for await` em streams — loop manual com reader.
  (async () => {
    while (!closed) {
      let res: { value?: UdpMessage; done: boolean };
      try {
        res = await reader.read();
      } catch {
        break;
      }
      if (res.done) break;
      const m = res.value!;
      const remote = { address: m.remoteAddress ?? '', port: m.remotePort ?? 0 };
      for (const l of listeners) l(m.data, remote);
    }
  })();

  return {
    onMessage: (cb) => void listeners.push(cb),
    send: (data, port, address) => writer.write({ data, remoteAddress: address, remotePort: port }),
    async close() {
      closed = true;
      try {
        await reader.cancel();
      } catch {}
      sock.close();
    },
  };
}

async function bindLegacy(opts: UdpBindOptions): Promise<UdpSocket> {
  const sock = await tjs.listen('udp', opts.address ?? '0.0.0.0', opts.port, { reuseAddr: opts.reuseAddr ?? true });
  if (opts.broadcast && typeof sock.setBroadcast === 'function') sock.setBroadcast(true);
  const listeners: ((d: Uint8Array, r: RemoteInfo) => void)[] = [];
  let closed = false;

  (async () => {
    const buf = new Uint8Array(2048);
    while (!closed) {
      let r: any;
      try {
        r = await sock.recv(buf);
      } catch {
        break;
      }
      if (!r) continue;
      // formatos vistos: { nread, addr: { ip, port } } ou { data, addr }
      const data: Uint8Array = r.data ?? buf.slice(0, r.nread);
      const remote = { address: r.addr?.ip ?? '', port: r.addr?.port ?? 0 };
      for (const l of listeners) l(data, remote);
    }
  })();

  return {
    onMessage: (cb) => void listeners.push(cb),
    send: async (data, port, address) => {
      await sock.send(data, { ip: address, port });
    },
    async close() {
      closed = true;
      sock.close();
    },
  };
}
