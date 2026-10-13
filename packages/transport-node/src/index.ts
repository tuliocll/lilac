/** Transporte para Node.js (CLI, testes e um futuro daemon). */
import dgram from 'node:dgram';
import net from 'node:net';
import type { RemoteInfo, TcpConnectOptions, TcpSocket, Transport, UdpBindOptions, UdpSocket } from '@lilac/core';

export function createNodeTransport(): Transport {
  return { bindUdp, connectTcp };
}

/** Um ouvinte com erro não pode derrubar o processo (exceção dentro de um EventEmitter). */
function emit<A extends unknown[]>(listeners: Iterable<(...args: A) => void>, ...args: A) {
  for (const listener of listeners) {
    try {
      listener(...args);
    } catch (error) {
      console.error('[transport] ouvinte falhou:', error);
    }
  }
}

const asBytes = (b: Buffer) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength);

function bindUdp(options: UdpBindOptions): Promise<UdpSocket> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: options.reuseAddr ?? true });
    const listeners: ((data: Uint8Array, remote: RemoteInfo) => void)[] = [];

    socket.once('error', reject);
    socket.on('message', (msg, rinfo) => emit(listeners, asBytes(msg), { address: rinfo.address, port: rinfo.port }));

    socket.bind(options.port, options.address ?? '0.0.0.0', () => {
      socket.off('error', reject);
      socket.on('error', () => {}); // erros depois do bind não derrubam o processo
      if (options.broadcast) socket.setBroadcast(true);
      resolve({
        onMessage: (listener) => void listeners.push(listener),
        send: (data, port, address) => new Promise((ok, fail) => socket.send(data, port, address, (error) => (error ? fail(error) : ok()))),
        close: () => new Promise((done) => socket.close(() => done())),
      });
    });
  });
}

function connectTcp({ host, port, timeoutMs = 5000 }: TcpConnectOptions): Promise<TcpSocket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.setNoDelay(true);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('tempo esgotado ao conectar'));
    }, timeoutMs);

    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    socket.once('connect', () => {
      clearTimeout(timer);
      socket.removeAllListeners('error');
      const dataListeners: ((data: Uint8Array) => void)[] = [];
      const closeListeners: ((error?: Error) => void)[] = [];
      let lastError: Error | undefined;
      let closedByUs = false;

      socket.on('data', (chunk) => emit(dataListeners, asBytes(chunk)));
      socket.on('error', (error) => (lastError = error));
      socket.on('close', () => !closedByUs && emit(closeListeners, lastError));

      resolve({
        onData: (listener) => void dataListeners.push(listener),
        onClose: (listener) => void closeListeners.push(listener),
        write: (data) => new Promise((ok, fail) => socket.write(data, (error) => (error ? fail(error) : ok()))),
        close: () =>
          new Promise((done) => {
            closedByUs = true;
            if (socket.destroyed) return done();
            socket.once('close', () => done());
            socket.end();
            setTimeout(() => socket.destroy(), 500).unref();
          }),
      });
    });
  });
}
