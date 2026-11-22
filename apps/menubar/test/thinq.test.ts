/**
 * Ares LG no backend do app: inventário, rota pela nuvem da LG, comandos,
 * conta conectada e desconectada. A API da LG é simulada (fetch falso) com
 * perfis e estados reais de dois modelos (packages/thinq/test/fixtures).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { lgAcDps, ThinqError, type ThinqClient } from '@lilac/thinq';
import * as account from '../src/backend/account.ts';
import { setApp, type TinyApp } from '../src/backend/app.ts';
import * as control from '../src/backend/control.ts';
import { thinqInventory } from '../src/backend/thinq.ts';
import { deviceList } from '../src/backend/view.ts';

const pushes: { event: string; data: any }[] = [];
const store = new Map<string, unknown>();
const fakeApp: TinyApp = {
  push: (event, data) => pushes.push({ event, data }),
  quit() {},
  setHideOnClose() {},
  tray: { set: () => {} },
  store: { get: async (k) => store.get(k), set: async (k, v) => void store.set(k, v) },
};
setApp(fakeApp);

after(() => {
  control.closeAllDevices();
  // os timers de presença do módulo network mantêm o processo vivo (igual ao backend.test.ts)
  setTimeout(() => process.exit(0), 50).unref();
});

test('ar LG: abre, lê o estado e manda comandos pela nuvem da LG (não pela Tuya)', async () => {
  const fixture = JSON.parse(readFileSync(join(import.meta.dirname, '../../../packages/thinq/test/fixtures/ac-rac.json'), 'utf8'));
  const calls: { url: string; body?: any }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: any) => {
    calls.push({ url, body: init.body && JSON.parse(init.body) });
    const response = url.endsWith('/state') ? fixture.state : url.endsWith('/control') ? {} : null;
    return new Response(JSON.stringify({ messageId: 'm', response }));
  }) as typeof fetch;
  try {
    const lgAc = {
      id: 'lgac1',
      name: 'Ar da suíte',
      category: 'kt',
      productId: 'RAC_056905_WW',
      productName: 'RAC_056905_WW',
      sub: false,
      online: true,
      homeId: 'lg',
      homeName: 'LG ThinQ',
      status: {},
      dps: lgAcDps(fixture.profile),
      supportLocal: false,
      writableKnown: true,
    };
    const { loggedIn } = account.restore({ inventory: [lgAc], thinq: { token: 'pat', country: 'BR', clientId: 'cid' } });
    assert.equal(loggedIn, true, 'só a LG já basta para abrir a lista');
    assert.equal(deviceList()[0]!.route, 'cloud');
    assert.equal(deviceList()[0]!.reason, undefined, 'não é "pela nuvem porque a rede falhou"');

    const opened = await control.openDevice('lgac1');
    assert.equal(opened.route, 'cloud');
    assert.equal(opened.values.mode, 'cold');
    assert.ok(calls[0]!.url.startsWith('https://api-aic.lgthinq.com/devices/lgac1/state'));

    await control.setControl('lgac1', 'temp_set', 22.5);
    const sent = calls.find((c) => c.url.endsWith('/control'))!;
    assert.deepEqual(sent.body, { temperatureInUnits: { coolTargetTemperature: 22.5, unit: 'C' } }, 'no modo frio, o alvo de resfriar');

    // logout do Smart Life não leva os ares LG
    await account.logout();
    assert.deepEqual(account.devices().map((d) => d.id), ['lgac1']);
    const persisted = pushes.filter((p) => p.event === 'persist').at(-1)!.data;
    assert.deepEqual(persisted.thinq, { token: 'pat', country: 'BR', clientId: 'cid' });

    // desconectar tira os ares e o token, mas guarda o clientId (a LG bloqueia quem cria clientes demais)
    account.disconnectLg();
    assert.deepEqual(account.devices(), []);
    assert.deepEqual(pushes.filter((p) => p.event === 'persist').at(-1)!.data.thinq, { clientId: 'cid' });
    assert.equal(account.restore({ thinq: { clientId: 'cid' } }).loggedIn, false);

    // configuração salva estragada (país que a LG não atende) não derruba a inicialização
    assert.equal(account.restore({ thinq: { token: 'pat', country: 'XX', clientId: 'cid' } }).loggedIn, false);
  } finally {
    control.closeAllDevices();
    globalThis.fetch = realFetch;
  }
});

test('ar LG que a LG não descreve fica de fora; os outros entram', async () => {
  const fixture = JSON.parse(readFileSync(join(import.meta.dirname, '../../../packages/thinq/test/fixtures/ac-cst.json'), 'utf8'));
  const ac = (deviceId: string, alias: string) => ({ deviceId, alias, deviceType: 'DEVICE_AIR_CONDITIONER', modelName: 'CST_570004_WW' });
  const lg: ThinqClient = {
    devices: async () => [ac('ok', 'Ar da sala'), ac('estranho', 'Ar novo'), { deviceId: 'w', alias: 'Lavadora', deviceType: 'DEVICE_WASHER', modelName: 'F' }],
    profile: async (id) => {
      if (id === 'estranho') throw new ThinqError('LG 2101: modelo sem suporte', '2101');
      return fixture.profile;
    },
    state: async () => fixture.state,
    control: async () => ({}),
  };
  const acs = await thinqInventory(lg);
  assert.deepEqual(acs.map((d) => d.name), ['Ar da sala'], 'a lavadora também não entra: por enquanto, só ares');
  assert.equal(acs[0]!.homeId, 'lg');
  assert.equal(acs[0]!.category, 'kt');
});

const rac = () => JSON.parse(readFileSync(join(import.meta.dirname, '../../../packages/thinq/test/fixtures/ac-rac.json'), 'utf8'));
const lgDevice = (id: string, fixture: any) => ({
  id,
  name: `Ar ${id}`,
  category: 'kt',
  productId: 'RAC_056905_WW',
  productName: 'RAC_056905_WW',
  sub: false,
  online: true,
  homeId: 'lg',
  homeName: 'LG ThinQ',
  status: {},
  dps: lgAcDps(fixture.profile),
  supportLocal: false,
  writableKnown: true,
});
const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
};

test('re-sincronizar: a conta que falhou mantém o que havia, a outra atualiza, importados ficam', async () => {
  const fixture = rac();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (!url.includes('lgthinq.com')) throw new Error('Smart Life fora do ar');
    const response = url.endsWith('/devices')
      ? [{ deviceId: 'lg-novo', deviceInfo: { alias: 'Ar novo', deviceType: 'DEVICE_AIR_CONDITIONER', modelName: 'RAC_056905_WW' } }]
      : url.endsWith('/profile')
        ? fixture.profile
        : null;
    return new Response(JSON.stringify({ messageId: 'm', response }));
  }) as typeof fetch;
  try {
    const tuya = { ...lgDevice('tuya-salvo', fixture), homeId: '1', homeName: 'Casa', category: 'cz', dps: [] };
    const imported = { ...tuya, id: 'importado', homeId: 'imported' };
    account.restore({
      inventory: [tuya, imported, lgDevice('lg-velho', fixture)],
      session: { uid: 'u', accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000, endpoint: 'https://apigw.example.com', terminalId: 't', userCode: 'c' },
      thinq: { token: 'pat', country: 'BR', clientId: 'cid' },
    });
    pushes.length = 0;
    await Promise.all([account.sync(), account.sync()]);
    assert.deepEqual(account.devices().map((d) => d.id).sort(), ['importado', 'lg-novo', 'tuya-salvo']);
    assert.equal(pushes.filter((p) => p.event === 'sync-start').length, 1, 'duas chamadas juntas = uma busca');
    assert.equal(pushes.filter((p) => p.event === 'sync-end').length, 1);
  } finally {
    await account.logout();
    account.disconnectLg();
    globalThis.fetch = realFetch;
  }
});

test('ar LG: a página continua atualizando depois de um clique na bandeja e de uma consulta que falha', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fixture = rac();
  let states = 0;
  let fail = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url.endsWith('/state')) {
      states++;
      if (fail) return new Response(JSON.stringify({ error: { code: '9999', message: 'instável' } }), { status: 500 });
    }
    const response = url.endsWith('/state') ? fixture.state : {};
    return new Response(JSON.stringify({ messageId: 'm', response }));
  }) as typeof fetch;
  try {
    account.restore({ inventory: [lgDevice('lgac2', fixture)], thinq: { token: 'pat', country: 'BR', clientId: 'cid' } });
    await control.openDevice('lgac2'); // a página
    await control.togglePower('lgac2'); // a bandeja, com a página aberta
    const before = states;

    fail = true;
    t.mock.timers.tick(30_000);
    await flush();
    assert.equal(states, before + 1, 'a página segue consultando depois do clique na bandeja');

    fail = false;
    t.mock.timers.tick(30_000);
    await flush();
    assert.equal(states, before + 2, 'e depois da falha');

    control.releaseDevice('lgac2');
    t.mock.timers.tick(30_000);
    await flush();
    assert.equal(states, before + 2, 'saiu da página: para de consultar');
  } finally {
    control.closeAllDevices();
    account.disconnectLg();
    globalThis.fetch = realFetch;
  }
});
