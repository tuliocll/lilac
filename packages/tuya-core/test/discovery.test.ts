import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aesEcbEncrypt,
  BroadcastParseError,
  discover,
  encode55AA,
  encode6699,
  parseBroadcast,
  te,
  UDP_KEY,
  type RemoteInfo,
  type Transport,
  type UdpSocket,
} from '../src/index.ts';

const info = (version: string, gwId: string) =>
  te.encode(JSON.stringify({ ip: '10.0.0.5', gwId, active: 2, encrypt: true, productKey: 'pk', version }));

test('parseBroadcast: v3.1 texto puro', () => {
  const r = parseBroadcast(encode55AA({ seq: 0, cmd: 0, retcode: 0, payload: info('3.1', 'a') }));
  assert.equal(r.msg.gwId, 'a');
  assert.equal(r.frame, '55aa');
});

test('parseBroadcast: v3.3 ECB', () => {
  const r = parseBroadcast(encode55AA({ seq: 0, cmd: 0x13, retcode: 0, payload: aesEcbEncrypt(UDP_KEY, info('3.3', 'b')) }));
  assert.equal(r.msg.version, '3.3');
});

test('parseBroadcast: v3.5 GCM (frame 6699)', () => {
  const r = parseBroadcast(encode6699({ seq: 0, cmd: 0x13, retcode: 0, payload: info('3.5', 'c') }, UDP_KEY, new Uint8Array(12).fill(1)));
  assert.equal(r.msg.gwId, 'c');
  assert.equal(r.frame, '6699');
});

test('parseBroadcast: lixo é rejeitado', () => {
  assert.throws(() => parseBroadcast(te.encode('olá mundo, não sou tuya')), BroadcastParseError);
});

/** Transporte em memória: permite injetar datagramas sem rede. */
function memoryTransport() {
  const sockets = new Map<number, (d: Uint8Array, r: RemoteInfo) => void>();
  const transport: Transport = {
    async bindUdp({ port }): Promise<UdpSocket> {
      if (port === 7000) throw new Error('EADDRINUSE');
      return {
        onMessage: (cb) => void sockets.set(port, cb),
        send: async () => {},
        close: async () => void sockets.delete(port),
      };
    },
  };
  const inject = (port: number, data: Uint8Array) => sockets.get(port)?.(data, { address: '10.0.0.5', port: 50000 });
  return { transport, inject, sockets };
}

test('discover: deduplica por gwId, ignora lixo e segue se uma porta falha', async () => {
  const { transport, inject, sockets } = memoryTransport();
  const bindErrors: number[] = [];
  const unknown: number[] = [];
  const p = discover(transport, {
    timeoutMs: 50,
    onBindError: (port) => bindErrors.push(port),
    onUnknown: (_d, _r, port) => unknown.push(port),
  });
  await new Promise((r) => setTimeout(r, 5));
  const pkt = encode55AA({ seq: 0, cmd: 0x13, retcode: 0, payload: aesEcbEncrypt(UDP_KEY, info('3.3', 'dev1')) });
  inject(6667, pkt);
  inject(6667, pkt);
  inject(6666, encode55AA({ seq: 0, cmd: 0, retcode: 0, payload: info('3.1', 'dev2') }));
  inject(6667, te.encode('ruído'));
  const devices = await p;
  assert.deepEqual(devices.map((d) => d.id).sort(), ['dev1', 'dev2']);
  assert.deepEqual(bindErrors, [7000]);
  assert.deepEqual(unknown, [6667]);
  assert.equal(sockets.size, 0, 'sockets fechados ao final');
});
