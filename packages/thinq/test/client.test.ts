import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createThinqClient, regionOf, ThinqError } from '../src/index.ts';

/** fetch falso: guarda a chamada e devolve o envelope da LG ({ messageId, timestamp, response | error }). */
function fakeFetch(reply: { status?: number; json: unknown }) {
  const calls: { url: string; init: any }[] = [];
  const fetchFn = (async (url: string, init: any) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(reply.json), { status: reply.status ?? 200 });
  }) as typeof fetch;
  return { fetchFn, calls };
}

test('região pelo país', () => {
  assert.equal(regionOf('BR'), 'aic');
  assert.equal(regionOf('kr'), 'kic');
  assert.equal(regionOf('DE'), 'eic');
  assert.equal(regionOf('XX'), null);
});

test('país sem servidor ThinQ falha já na criação', () => {
  assert.throws(() => createThinqClient({ token: 't', country: 'XX', clientId: 'c' }), ThinqError);
});

test('lista aparelhos com os cabeçalhos da LG, no servidor da região', async () => {
  const { fetchFn, calls } = fakeFetch({
    json: {
      messageId: 'm',
      response: [
        { deviceId: 'ac1', deviceInfo: { deviceType: 'DEVICE_AIR_CONDITIONER', modelName: 'S4-W12', alias: 'Ar da sala', reportable: true, groupId: 'g1' } },
        { deviceId: 'wm1', deviceInfo: { deviceType: 'DEVICE_WASHER', modelName: 'F4', alias: 'Lavadora' } },
      ],
    },
  });
  const lg = createThinqClient({ token: 'pat', country: 'br', clientId: 'cid', fetch: fetchFn });
  assert.deepEqual(await lg.devices(), [
    { deviceId: 'ac1', alias: 'Ar da sala', deviceType: 'DEVICE_AIR_CONDITIONER', modelName: 'S4-W12', groupId: 'g1' },
    { deviceId: 'wm1', alias: 'Lavadora', deviceType: 'DEVICE_WASHER', modelName: 'F4' },
  ]);
  const { url, init } = calls[0]!;
  assert.equal(url, 'https://api-aic.lgthinq.com/devices');
  assert.equal(init.headers.Authorization, 'Bearer pat');
  assert.equal(init.headers['x-country'], 'BR');
  assert.equal(init.headers['x-client-id'], 'cid');
  assert.equal(init.headers['x-service-phase'], 'OP');
  assert.match(init.headers['x-api-key'], /^\w{40}$/);
  assert.match(init.headers['x-message-id'], /^[\w-]{22}$/);
});

test('comando vai como JSON, com controle condicional', async () => {
  const { fetchFn, calls } = fakeFetch({ json: { response: {} } });
  const lg = createThinqClient({ token: 'pat', country: 'BR', clientId: 'cid', fetch: fetchFn });
  await lg.control('ac1', { operation: { airConOperationMode: 'POWER_ON' } });
  const { url, init } = calls[0]!;
  assert.equal(url, 'https://api-aic.lgthinq.com/devices/ac1/control');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-conditional-control'], 'true');
  assert.deepEqual(JSON.parse(init.body), { operation: { airConOperationMode: 'POWER_ON' } });
});

test('erro da LG vira ThinqError com o código dela', async () => {
  const { fetchFn } = fakeFetch({ status: 401, json: { error: { code: '1103', message: 'Invalid token' } } });
  const lg = createThinqClient({ token: 'velho', country: 'BR', clientId: 'cid', fetch: fetchFn });
  await assert.rejects(lg.devices(), (e: unknown) => e instanceof ThinqError && e.code === '1103');
});
