import dgram from 'node:dgram';
import type { RemoteInfo, Transport, UdpBindOptions, UdpSocket } from '@tuyabar/core';

/** Transporte para Node.js (CLI, testes, futuro daemon). */
export function createNodeTransport(): Transport {
  return {
    bindUdp(opts: UdpBindOptions): Promise<UdpSocket> {
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
    },
  };
}
