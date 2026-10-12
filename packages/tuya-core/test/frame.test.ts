import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aesEcbEncrypt,
  crc32,
  decode55AA,
  decode6699,
  encode55AA,
  encode6699,
  FrameError,
  te,
  toHex,
  UDP_KEY,
} from '../src/index.ts';

test('crc32 bate com o valor de referência do zlib', () => {
  assert.equal(crc32(te.encode('123456789')), 0xcbf43926);
});

test('UDP_KEY = md5("yGAdlopoPVldABfn")', () => {
  assert.equal(toHex(UDP_KEY), '6c1ec8e2bb9bb59ab50b0daf649b410a');
});

test('55AA: encode → decode preserva seq/cmd/retcode/payload', () => {
  const payload = te.encode('{"hello":"world"}');
  const f = decode55AA(encode55AA({ seq: 7, cmd: 0x13, retcode: 0, payload }));
  assert.equal(f.seq, 7);
  assert.equal(f.cmd, 0x13);
  assert.equal(f.retcode, 0);
  assert.deepEqual(f.payload, payload);
});

test('55AA: CRC corrompido é rejeitado', () => {
  const buf = encode55AA({ seq: 1, cmd: 0, payload: te.encode('{"a":1}') });
  buf[buf.length - 6]! ^= 0xff;
  assert.throws(() => decode55AA(buf), FrameError);
});

test('6699: encode → decode com GCM', () => {
  const payload = te.encode('{"gwId":"x"}');
  const iv = new Uint8Array(12).fill(9);
  const f = decode6699(encode6699({ seq: 3, cmd: 0x13, retcode: 0, payload }, UDP_KEY, iv), UDP_KEY);
  assert.equal(f.seq, 3);
  assert.equal(f.retcode, 0);
  assert.deepEqual(f.payload, payload);
});

test('6699: chave errada falha com FrameError', () => {
  const pkt = encode6699({ seq: 1, cmd: 0, payload: te.encode('{}') }, UDP_KEY, new Uint8Array(12));
  assert.throws(() => decode6699(pkt, new Uint8Array(16)), FrameError);
});

test('ECB: payload cifrado de 55AA é múltiplo de 16', () => {
  const ct = aesEcbEncrypt(UDP_KEY, te.encode('{"gwId":"abc"}'));
  assert.equal(ct.length % 16, 0);
});
