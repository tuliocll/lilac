import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decryptPayload,
  deriveSecret,
  encryptPayload,
  fromBase64,
  hashKey,
  restfulSign,
  SharingClient,
  toBase64,
  type SharingSession,
} from '../src/index.ts';
import { gcm } from '@noble/ciphers/aes';

// Vetores gerados com o tuya_sharing/customerapi.py oficial (nonce fixo "ABCDEFGHJKMN").
const V = {
  rid: '3f2b8c1e-1d2a-4c55-9a7e-0b6f1c2d3e4f',
  rt: 'refreshTOKEN123',
  hk: 'cfe22a3c064c20b3b07790d1a0eac227',
  sec: '482bc8ada59d8990',
  secSid: 'a573c0d643a15eec',
  q: 'QUJDREVGR0hKS01OEkmiAvtU2yij64ZM7IhmmEzlQ8fY+uewZ5gSAtEy4op1Twc=',
  sign: '20430a10de85508c16c4439b4b0af9a0c1798ceccb8fe69f766528f807f0f829',
  resp: 'Tk9OQ0UxMjM0NTY3Xb9NNAJU8Sj2juzCD8Qt3QwpZQyzVFkC04ULb403tOS6M0PVwiCeMAl+oUBgCQ==',
};

test('base64 ida e volta', () => {
  for (const n of [0, 1, 2, 3, 15, 16, 17, 100]) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 37) & 0xff);
    assert.equal(toBase64(b), Buffer.from(b).toString('base64'));
    assert.deepEqual(fromBase64(toBase64(b)), b);
  }
});

test('hashKey / deriveSecret batem com o SDK oficial', () => {
  assert.equal(hashKey(V.rid, V.rt), V.hk);
  assert.equal(deriveSecret(V.rid, '', V.hk), V.sec);
  assert.equal(deriveSecret(V.rid, 'abcdefghijklmnopqrst', V.hk), V.secSid);
});

test('encryptPayload bate com o SDK oficial (nonce fixo)', () => {
  assert.equal(encryptPayload('{"homeId":"123456"}', V.sec, 'ABCDEFGHJKMN'), V.q);
});

test('restfulSign bate com o SDK oficial', () => {
  const headers = { 'X-appKey': 'HA_x', 'X-requestId': V.rid, 'X-sid': '', 'X-time': '1760000000000', 'X-token': 'acc' };
  assert.equal(restfulSign(V.hk, V.q, '', headers), V.sign);
});

test('decryptPayload abre resposta no formato do servidor', () => {
  assert.equal(decryptPayload(V.resp, V.sec), '[{"ownerId":42,"name":"Casa"}]');
});

/** Servidor falso: valida assinatura, decifra params e responde cifrado — como a Tuya. */
function fakeCloud(session: SharingSession) {
  const calls: { path: string; params?: any }[] = [];
  const seal = (obj: unknown, secret: string) => {
    const nonce = new TextEncoder().encode('SERVERNONCE1');
    const ct = gcm(new TextEncoder().encode(secret), nonce).encrypt(new TextEncoder().encode(JSON.stringify(obj)));
    const all = new Uint8Array(12 + ct.length);
    all.set(nonce);
    all.set(ct, 12);
    return toBase64(all);
  };
  const fetchFn = (async (input: string, init: any) => {
    const url = new URL(input);
    const h = init.headers as Record<string, string>;
    const hk = hashKey(h['X-requestId']!, session.refreshToken);
    const secret = deriveSecret(h['X-requestId']!, '', hk);
    const enc = url.searchParams.get('encdata') ?? '';
    assert.equal(h['X-sign'], restfulSign(hk, enc, '', h), 'assinatura inválida');
    const params = enc ? JSON.parse(decryptPayload(enc, secret)) : undefined;
    calls.push({ path: url.pathname, params });

    let result: unknown;
    if (url.pathname === '/v1.0/m/life/users/homes') result = [{ ownerId: 42, name: 'Casa' }];
    else if (url.pathname === '/v1.0/m/life/ha/home/devices')
      result = [
        { id: 'eb8bc0f725df3a2deek6uu', name: 'Ar do quarto', local_key: 'k3y!', category: 'kt', product_id: 'p', product_name: 'AC', sub: false, online: true, status: [{ code: 'switch', value: false }] },
      ];
    else if (url.pathname.endsWith('/status'))
      result = {
        productKey: 'p',
        dpStatusRelationDTOS: [
          { dpId: 1, statusCode: 'switch', valueType: 'Boolean', valueDesc: '{}', supportLocal: true },
          { dpId: 2, statusCode: 'temp_set', valueType: 'Integer', valueDesc: '{"min":16,"max":32,"step":1}', supportLocal: true },
        ],
      };
    return new Response(JSON.stringify({ success: true, t: Date.now(), result: seal(result, secret) }));
  }) as typeof fetch;
  return { fetchFn, calls };
}

test('SharingClient.inventory: assina, cifra params e monta dispositivos com DPs', async () => {
  const session: SharingSession = {
    uid: 'u',
    accessToken: 'acc',
    refreshToken: 'ref',
    expiresAt: Date.now() + 3600_000,
    endpoint: 'https://apigw.example.com',
    terminalId: 't',
    userCode: 'abc',
  };
  const { fetchFn, calls } = fakeCloud(session);
  const client = new SharingClient(session, { app: { clientId: 'X', schema: 'y' }, fetch: fetchFn });
  const inv = await client.inventory();
  assert.equal(inv.length, 1);
  const d = inv[0]!;
  assert.equal(d.name, 'Ar do quarto');
  assert.equal(d.localKey, 'k3y!');
  assert.equal(d.homeName, 'Casa');
  assert.equal(d.supportLocal, true);
  assert.deepEqual(d.dps.map((x) => [x.dpId, x.code]), [[1, 'switch'], [2, 'temp_set']]);
  assert.deepEqual(d.dps[1]!.values, { min: 16, max: 32, step: 1 });
  assert.deepEqual(calls.find((c) => c.path.endsWith('/home/devices'))!.params, { homeId: '42' });
});
