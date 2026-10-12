/**
 * Transporte para txiki.js (o runtime do backend do tinyjs).
 *
 * O txiki mudou a API de sockets entre versões; detectamos as duas:
 *   nova    (estilo Direct Sockets) `new UDPSocket({…})` / `new TCPSocket(host, port)`
 *           → `await socket.opened` → { readable, writable }
 *   antiga  `tjs.listen('udp', …)` / `tjs.connect('tcp', …)` → recv/send, read/write
 *
 * UDP com broadcast já foi validado no Windows; o TCP é o que o controle local usa.
 */
import type { RemoteInfo, TcpConnectOptions, TcpSocket, Transport, UdpBindOptions, UdpSocket } from '@tuyabar/core';

declare const tjs: any;

export function createTxikiTransport(): Transport {
  return { bindUdp, connectTcp };
}

/** Chama todos os ouvintes; um ouvinte com erro não pode matar o laço de leitura. */
function emit<A extends unknown[]>(listeners: Iterable<(...args: A) => void>, ...args: A) {
  for (const listener of listeners) {
    try {
      listener(...args);
    } catch (error) {
      console.error('[transport] ouvinte falhou:', error);
    }
  }
}

/** Lê um ReadableStream até o fim chamando `onChunk` (txiki não tem `for await` em streams). */
async function pump<T>(reader: ReadableStreamDefaultReader<T>, onChunk: (chunk: T) => void, isClosed: () => boolean) {
  while (!isClosed()) {
    const { value, done } = await reader.read();
    if (done) return;
    if (value !== undefined) onChunk(value);
  }
}

// ============================================================================ UDP

async function bindUdp(options: UdpBindOptions): Promise<UdpSocket> {
  const UDPSocket = (globalThis as any).UDPSocket ?? (typeof tjs !== 'undefined' ? tjs.UDPSocket : undefined);
  if (UDPSocket) return bindUdpModern(UDPSocket, options);
  if (typeof tjs !== 'undefined' && typeof tjs.listen === 'function') return bindUdpLegacy(options);
  throw new Error('este runtime não expõe UDP (nem UDPSocket nem tjs.listen)');
}

async function bindUdpModern(UDPSocket: any, options: UdpBindOptions): Promise<UdpSocket> {
  const socket = new UDPSocket({
    localAddress: options.address ?? '0.0.0.0',
    localPort: options.port,
    reuseAddr: options.reuseAddr ?? true,
    broadcast: options.broadcast ?? false,
  });
  const { readable, writable } = await socket.opened;
  const reader = readable.getReader();
  const writer = writable.getWriter();
  const listeners: ((data: Uint8Array, remote: RemoteInfo) => void)[] = [];
  let closed = false;

  pump<{ data: Uint8Array; remoteAddress?: string; remotePort?: number }>(
    reader,
    (m) => emit(listeners, m.data, { address: m.remoteAddress ?? '', port: m.remotePort ?? 0 }),
    () => closed,
  ).catch(() => {}); // socket fechado

  return {
    onMessage: (listener) => void listeners.push(listener),
    send: (data, port, address) => writer.write({ data, remoteAddress: address, remotePort: port }),
    async close() {
      closed = true;
      await reader.cancel().catch(() => {});
      socket.close();
    },
  };
}

async function bindUdpLegacy(options: UdpBindOptions): Promise<UdpSocket> {
  const socket = await tjs.listen('udp', options.address ?? '0.0.0.0', options.port, { reuseAddr: options.reuseAddr ?? true });
  if (options.broadcast && typeof socket.setBroadcast === 'function') socket.setBroadcast(true);
  const listeners: ((data: Uint8Array, remote: RemoteInfo) => void)[] = [];
  let closed = false;

  (async () => {
    const buffer = new Uint8Array(2048);
    while (!closed) {
      const r = await socket.recv(buffer);
      if (!r) continue;
      // formatos vistos: { nread, addr: { ip, port } } ou { data, addr }
      const data: Uint8Array = r.data ?? buffer.slice(0, r.nread);
      emit(listeners, data, { address: r.addr?.ip ?? '', port: r.addr?.port ?? 0 });
    }
  })().catch(() => {}); // socket fechado

  return {
    onMessage: (listener) => void listeners.push(listener),
    send: async (data, port, address) => {
      await socket.send(data, { ip: address, port });
    },
    async close() {
      closed = true;
      socket.close();
    },
  };
}

// ============================================================================ TCP

async function connectTcp({ host, port, timeoutMs = 5000 }: TcpConnectOptions): Promise<TcpSocket> {
  const attempt = openTcp(host, port);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // se a conexão abrir depois do prazo, fecha para não vazar
      attempt.then((socket) => socket.close()).catch(() => {});
      reject(new Error('tempo esgotado ao conectar'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([attempt, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function openTcp(host: string, port: number): Promise<TcpSocket> {
  const TCPSocket = (globalThis as any).TCPSocket;
  if (TCPSocket) {
    const socket = new TCPSocket(host, port, { noDelay: true });
    const { readable, writable } = await socket.opened;
    return wrapTcpStreams(socket, readable, writable);
  }
  const socket = await tjs.connect('tcp', host, port, { noDelay: true });
  if (socket.opened) {
    const { readable, writable } = await socket.opened;
    return wrapTcpStreams(socket, readable, writable);
  }
  return wrapTcpLegacy(socket);
}

/** Estado e ouvintes comuns às duas APIs de TCP. */
function tcpEvents() {
  const dataListeners: ((data: Uint8Array) => void)[] = [];
  const closeListeners: ((error?: Error) => void)[] = [];
  let closed = false;
  return {
    isClosed: () => closed,
    data(chunk: Uint8Array) {
      if (chunk.length) emit(dataListeners, chunk);
    },
    /** encerra uma vez só; `notify` = foi o outro lado (ou um erro) que fechou */
    finish(notify: boolean, error?: Error) {
      if (closed) return false;
      closed = true;
      if (notify) emit(closeListeners, error);
      return true;
    },
    onData: (listener: (data: Uint8Array) => void) => void dataListeners.push(listener),
    onClose: (listener: (error?: Error) => void) => void closeListeners.push(listener),
  };
}

function wrapTcpStreams(socket: any, readable: ReadableStream<Uint8Array>, writable: WritableStream<Uint8Array>): TcpSocket {
  const reader = readable.getReader();
  const writer = writable.getWriter();
  const events = tcpEvents();

  pump(reader, events.data, events.isClosed).then(
    () => events.finish(true),
    (error) => events.finish(true, error as Error),
  );

  return {
    onData: events.onData,
    onClose: events.onClose,
    write: (data) => writer.write(data),
    async close() {
      if (!events.finish(false)) return;
      await reader.cancel().catch(() => {});
      try {
        socket.close();
      } catch {
        // já fechado
      }
    },
  };
}

function wrapTcpLegacy(socket: any): TcpSocket {
  const events = tcpEvents();

  (async () => {
    const buffer = new Uint8Array(4096);
    while (!events.isClosed()) {
      const n = await socket.read(buffer);
      if (!n) return;
      events.data(buffer.slice(0, n));
    }
  })().then(
    () => events.finish(true),
    (error) => events.finish(true, error as Error),
  );

  return {
    onData: events.onData,
    onClose: events.onClose,
    write: async (data) => {
      await socket.write(data);
    },
    async close() {
      if (!events.finish(false)) return;
      try {
        socket.close();
      } catch {
        // já fechado
      }
    },
  };
}
