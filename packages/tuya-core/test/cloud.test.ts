import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decryptPayload,
  deriveSecret,
  encryptPayload,
  fromBase64,
  hashKey,
  restfulSign,
  createSharingClient,
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
function fakeCloud(session: SharingSession, { expiredTokens = new Set<string>(), refuseRooms = false, roomErrorFor = '' } = {}) {
  const calls: { path: string; params?: any; body?: any; token?: string }[] = [];
  let refreshes = 0;
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
    const bodyEnc = init.body ? JSON.parse(init.body).encdata : '';
    assert.equal(h['X-sign'], restfulSign(hk, enc, bodyEnc, h), 'assinatura inválida');
    const params = enc ? JSON.parse(decryptPayload(enc, secret)) : undefined;
    const body = bodyEnc ? JSON.parse(decryptPayload(bodyEnc, secret)) : undefined;
    calls.push({ path: url.pathname, params, body, token: h['X-token'] });
    if (h['X-token'] && expiredTokens.has(h['X-token'])) {
      return new Response(JSON.stringify({ success: false, code: 1010, msg: 'token is expired', t: Date.now() }));
    }

    let result: unknown;
    if (url.pathname.endsWith('/room')) {
      if (refuseRooms) return new Response(JSON.stringify({ success: false, code: 2008, msg: 'app param is invalid', t: Date.now() }));
      if (roomErrorFor && url.pathname.includes(roomErrorFor)) return new Response('', { status: 503 });
      // aparelho sem cômodo: resultado vazio, sem cifrar
      if (!url.pathname.includes('eb8bc0f725df3a2deek6uu')) return new Response(JSON.stringify({ success: true, t: Date.now(), result: '' }));
      result = { id: 7, name: 'Quarto', displayOrder: 2 };
    } else if (url.pathname === '/v1.0/m/life/users/homes') result = [{ ownerId: 42, name: 'Casa' }];
    else if (url.pathname === '/v1.0/m/life/ha/home/devices')
      result = [
        { id: 'eb8bc0f725df3a2deek6uu', name: 'Ar do quarto', local_key: 'k3y!', category: 'kt', product_id: 'p', product_name: 'AC', sub: false, online: true, status: [{ code: 'switch', value: false }] },
        { id: 'ir-ac-1', name: 'Ar escritório', category: 'infrared_ac', product_id: 'q', product_name: 'IR AC', sub: true, online: true, status: [{ code: 'temp', value: 24 }] },
        { id: 'ir-real', name: 'Ar quarto', category: 'infrared_ac', product_id: '1n02zg', product_name: 'Air Conditioner', sub: true, online: true, status: [] },
      ];
    else if (url.pathname.endsWith('/specifications') && url.pathname.includes('ir-real'))
      // resposta real (Smart Life, out/2026)
      result = {
        category: 'infrared_ac',
        functions: [
          { code: 'F', type: 'ENUM', values: '{"min":0,"max":3,"scale":0,"step":1,"type":"Integer"}' },
          { code: 'M', type: 'ENUM', values: '{"min":0,"max":4,"scale":0,"step":1,"type":"Integer"}' },
          { code: 'PowerOff', type: 'STRING', values: 'PowerOff' },
          { code: 'PowerOn', type: 'STRING', values: 'PowerOn' },
          { code: 'T', type: 'ENUM', values: '{"min":16,"max":30,"scale":0,"step":1,"type":"Integer"}' },
        ],
        status: [{ code: 'power', type: 'BOOLEAN', values: '{}' }],
      };
    else if (url.pathname.endsWith('/status') && url.pathname.includes('ir-real')) result = { dpStatusRelationDTOS: [{ supportLocal: false }], productKey: '1n02zg' };
    else if (url.pathname.endsWith('/specifications'))
      result = url.pathname.includes('ir-ac')
        ? {
            functions: [
              { code: 'switch', type: 'Boolean', values: '{}' },
              { code: 'temp', type: 'Integer', values: '{"min":16,"max":30,"step":1}' },
            ],
            status: [{ code: 'temp', type: 'Integer', values: '{"min":16,"max":30,"step":1}' }],
          }
        : { category: 'kt', functions: [{ code: 'switch' }, { code: 'temp_set' }], status: [] };
    else if (url.pathname.endsWith('/status') && url.pathname.includes('ir-ac')) result = { dpStatusRelationDTOS: [] };
    else if (url.pathname === '/v1.0/m/life/ha/devices/detail') result = [{ id: 'x', online: true, status: [{ code: 'switch', value: true }] }];
    else if (url.pathname.startsWith('/v1.1/m/thing/')) result = true;
    else if (url.pathname.startsWith('/v1.0/m/token/')) {
      refreshes++;
      result = { uid: 'u', accessToken: 'acc2', refreshToken: 'ref2', expireTime: 7200 };
    }
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
  return { fetchFn, calls, refreshes: () => refreshes };
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
  const client = createSharingClient(session, { app: { clientId: 'X', schema: 'y' }, fetch: fetchFn });
  const inv = await client.inventory();
  assert.equal(inv.length, 3);
  const d = inv.find((x) => x.id === 'eb8bc0f725df3a2deek6uu')!;
  assert.equal(d.name, 'Ar do quarto');
  assert.equal(d.localKey, 'k3y!');
  assert.equal(d.homeName, 'Casa');
  assert.equal(d.supportLocal, true);
  assert.deepEqual(d.dps.map((x: { dpId: number; code: string }) => [x.dpId, x.code]), [[1, 'switch'], [2, 'temp_set']]);
  assert.deepEqual(d.dps[1]!.values, { min: 16, max: 32, step: 1 });
  assert.equal(d.dps[1]!.writable, true);
  assert.deepEqual(calls.find((c) => c.path.endsWith('/home/devices'))!.params, { homeId: '42' });
  assert.deepEqual(d.room, { id: '7', name: 'Quarto', order: 2 });

  // ar por infravermelho: sem estratégia local, os DPs vêm da especificação (por código)
  const ir = inv.find((x) => x.id === 'ir-ac-1')!;
  assert.equal(ir.localKey, '');
  assert.equal(ir.sub, true);
  assert.deepEqual(ir.dps.map((x) => [x.code, x.writable]).sort(), [['switch', true], ['temp', true]]);
  assert.deepEqual(ir.status, { temp: 24 });
  assert.equal(ir.room, undefined, 'sem cômodo');

  // ar IR de verdade: estratégia local com item sem código (ignorado) e comandos PowerOn/T/M/F
  const real = inv.find((x) => x.id === 'ir-real')!;
  assert.deepEqual(real.dps.map((x) => x.code), ['power', 'temp', 'mode', 'wind']);
  assert.equal(real.writableKnown, true);
});

const baseSession = (over: Partial<SharingSession> = {}): SharingSession => ({
  uid: 'u',
  accessToken: 'acc',
  refreshToken: 'ref',
  expiresAt: Date.now() + 3600_000,
  endpoint: 'https://apigw.example.com',
  terminalId: 't',
  userCode: 'abc',
  ...over,
});

test('SharingClient.inventory: nuvem recusando cômodos não derruba o inventário nem insiste', async () => {
  const session = baseSession();
  const { fetchFn, calls } = fakeCloud(session, { refuseRooms: true });
  const client = createSharingClient(session, { app: { clientId: 'X', schema: 'y' }, fetch: fetchFn });
  const inv = await client.inventory({ concurrency: 1 });
  assert.equal(inv.length, 3);
  assert.ok(inv.every((d) => d.room === undefined));
  assert.equal(calls.filter((c) => c.path.endsWith('/room')).length, 1);
});

test('SharingClient.inventory: depois de um cômodo dar certo, um erro vale só para aquele aparelho', async () => {
  const session = baseSession();
  const { fetchFn, calls } = fakeCloud(session, { roomErrorFor: 'ir-ac-1' });
  const client = createSharingClient(session, { app: { clientId: 'X', schema: 'y' }, fetch: fetchFn });
  const inv = await client.inventory({ concurrency: 1 });
  assert.equal(inv.find((d) => d.id === 'eb8bc0f725df3a2deek6uu')!.room?.name, 'Quarto');
  assert.equal(inv.find((d) => d.id === 'ir-ac-1')!.room, undefined);
  assert.equal(calls.filter((c) => c.path.endsWith('/room')).length, 3, 'continua perguntando dos outros');
});

test('status e comandos pela nuvem (caminho dos ares por infravermelho)', async () => {
  const session = baseSession();
  const { fetchFn, calls } = fakeCloud(session);
  const client = createSharingClient(session, { app: { clientId: 'X', schema: 'y' }, fetch: fetchFn });
  assert.deepEqual(await client.statusOf(['x']), { x: { online: true, status: { switch: true } } });
  await client.sendCommands('x', [{ code: 'switch', value: false }]);
  assert.deepEqual(calls.at(-1), { path: '/v1.1/m/thing/x/commands', params: undefined, body: { commands: [{ code: 'switch', value: false }] }, token: 'acc' });
});

test('token vencido: chamadas simultâneas esperam uma única renovação', async () => {
  const session = baseSession({ expiresAt: Date.now() - 1 });
  const cloud = fakeCloud(session, { expiredTokens: new Set(['acc']) });
  let saved: SharingSession | null = null;
  const client = createSharingClient(session, { app: { clientId: 'X', schema: 'y' }, fetch: cloud.fetchFn, onSessionUpdate: (s) => (saved = s) });
  // o servidor falso assina com o refreshToken deste objeto; usamos o mesmo valor que a renovação devolve
  session.refreshToken = 'ref2';
  await Promise.all([client.statusOf(['x']), client.statusOf(['x']), client.statusOf(['x'])]).catch(() => {});
  assert.equal(cloud.refreshes(), 1);
  assert.equal(saved!.accessToken, 'acc2');
  assert.ok(client.session().expiresAt > Date.now());
  // a renovação vai sem o token velho (com ele, a Tuya responde 1010)
  assert.equal(cloud.calls.find((c) => c.path.startsWith('/v1.0/m/token/'))!.token, undefined);
});

test('token recusado antes da hora (PC dormiu): renova e repete a chamada uma vez', async () => {
  const session = baseSession(); // pelo nosso relógio ainda vale
  const cloud = fakeCloud(session, { expiredTokens: new Set(['acc']) });
  const client = createSharingClient(session, { app: { clientId: 'X', schema: 'y' }, fetch: cloud.fetchFn });
  session.refreshToken = 'ref2';
  assert.deepEqual(await client.statusOf(['x']), { x: { online: true, status: { switch: true } } });
  assert.equal(cloud.refreshes(), 1);
  assert.deepEqual(cloud.calls.map((c) => c.token), ['acc', undefined, 'acc2']);
});
