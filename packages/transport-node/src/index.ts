import dgram from 'node:dgram';
import net from 'node:net';
import type { RemoteInfo, TcpConnectOptions, TcpSocket, Transport, UdpBindOptions, UdpSocket } from '@tuyabar/core';

/** Transporte para Node.js (CLI, testes, futuro daemon). */
export function createNodeTransport(): Transport {
  return { bindUdp, connectTcp };
}

function bindUdp(opts: UdpBindOptions): Promise<UdpSocket> {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: opts.reuseAddr ?? true });
    const listeners: ((d: Uint8Array, r: RemoteInfo) => void)[] = [];

    sock.once('error', reject);
    sock.on('message', (msg, rinfo) => {
      const data = new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength);
      for (const l of listeners) l(data, { address: rinfo.address, port: rinfo.port });
    });

    sock.bind(opts.port, opts.address ?? '0.0.0.0', () => {
      sock.off('error', reject);
      sock.on('error', () => {}); // erros após o bind não derrubam o processo
      if (opts.broadcast) sock.setBroadcast(true);
      resolve({
        onMessage: (cb) => void listeners.push(cb),
        send: (data, port, address) =>
          new Promise((res, rej) => sock.send(data, port, address, (err) => (err ? rej(err) : res()))),
        close: () => new Promise((res) => sock.close(() => res())),
      });
    });
  });
}

function connectTcp({ host, port, timeoutMs = 5000 }: TcpConnectOptions): Promise<TcpSocket> {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port });
    sock.setNoDelay(true);
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error('tempo esgotado ao conectar'));
    }, timeoutMs);
    sock.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    sock.once('connect', () => {
      clearTimeout(timer);
      sock.removeAllListeners('error');
      const dataL: ((d: Uint8Array) => void)[] = [];
      const closeL: ((e?: Error) => void)[] = [];
      let lastErr: Error | undefined;
      sock.on('data', (b) => {
        const d = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
        for (const l of dataL) l(d);
      });
      sock.on('error', (e) => (lastErr = e));
      sock.on('close', () => {
        for (const l of closeL) l(lastErr);
      });
      resolve({
        onData: (cb) => void dataL.push(cb),
        onClose: (cb) => void closeL.push(cb),
        write: (data) => new Promise((res, rej) => sock.write(data, (err) => (err ? rej(err) : res()))),
        close: () =>
          new Promise((res) => {
            if (sock.destroyed) return res();
            sock.once('close', () => res());
            sock.end();
            setTimeout(() => sock.destroy(), 500);
          }),
      });
    });
  });
}
