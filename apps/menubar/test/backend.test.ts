/**
 * Backend do app de ponta a ponta: inventário → presença na rede → controle
 * local contra o aparelho falso (o mesmo validado contra o tinytuya).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { aesEcbEncrypt, encode55AA, te, UDP_KEY, type CloudDevice, type RemoteInfo, type Transport } from '@tuyabar/core';
import { createNodeTransport } from '../../../packages/transport-node/src/index.ts';
import { startFakeDevice } from '../../../packages/tuya-core/test/fake-local-device.ts';
import * as account from '../src/backend/account.ts';
import { setApp, type TinyApp } from '../src/backend/app.ts';
import * as control from '../src/backend/control.ts';
import { loadFavorites, reorderFavorites, toggleFavorite } from '../src/backend/favorites.ts';
import { renderTray } from '../src/backend/tray.ts';
import { configureNetwork, restartListening } from '../src/backend/network.ts';
import { deviceList } from '../src/backend/view.ts';

const KEY = 'abcdef0123456789';
const pushes: { event: string; data: any }[] = [];
let trayMenu: { id?: string; label?: string }[] = [];
const store = new Map<string, unknown>();
const fakeApp: TinyApp = {
  push: (event, data) => pushes.push({ event, data }),
  quit() {},
  setHideOnClose() {},
  tray: { set: (spec) => void (trayMenu = spec.menu ?? []) },
  store: { get: async (k) => store.get(k), set: async (k, v) => void store.set(k, v) },
};

// Transporte híbrido: TCP real (Node) + UDP em memória, onde injetamos anúncios.
const udpListeners: ((data: Uint8Array, remote: RemoteInfo) => void)[] = [];
const node = createNodeTransport();
const transport: Transport = {
  connectTcp: node.connectTcp,
  bindUdp: async () => ({ onMessage: (cb) => void udpListeners.push(cb), send: async () => {}, close: async () => {} }),
};
const announce = (id: string, version: string) => {
  const json = te.encode(JSON.stringify({ ip: '127.0.0.1', gwId: id, version, encrypt: true, productKey: 'pk' }));
  const frame = encode55AA({ seq: 1, cmd: 0x13, retcode: 0, payload: aesEcbEncrypt(UDP_KEY, json) });
  for (const l of udpListeners) l(frame, { address: '127.0.0.1', port: 50000 });
};

const device = (id: string, overrides: Partial<CloudDevice> = {}): Omit<CloudDevice, 'localKey'> => ({
  id,
  name: `Disjuntor ${id}`,
  category: 'tdq',
  productId: 'p',
  productName: 'Breaker',
  sub: false,
  online: true,
  homeId: '1',
  homeName: 'Casa',
  status: { switch_1: false, cur_power: 0 },
  dps: [
    { dpId: 1, code: 'switch_1', type: 'Boolean', writable: true },
    { dpId: 19, code: 'cur_power', type: 'Integer', values: { scale: 1, unit: 'W' }, writable: false },
    { dpId: 99, code: 'never_reported', type: 'Boolean', writable: true },
  ],
  supportLocal: true,
  writableKnown: true,
  ...overrides,
});

let fake34: Awaited<ReturnType<typeof startFakeDevice>>;

before(async () => {
  fake34 = await startFakeDevice({ id: 'dev34', localKey: KEY, version: '3.4', dps: { '1': false, '19': 486 } });
  setApp(fakeApp);
  configureNetwork({ transport, tcpPort: fake34.port });
  await restartListening(() => {});
  account.restore({ inventory: [device('dev34'), device('wrongkey'), device('away')], keys: { dev34: KEY, wrongkey: 'XXXXXXXXXXXXXXXX', away: KEY } });
  announce('dev34', '3.4');
  announce('wrongkey', '3.4');
});

after(async () => {
  control.closeAllDevices();
  await fake34.close();
  // os timers de presença do módulo network mantêm o processo vivo
  setTimeout(() => process.exit(0), 50).unref();
});

test('a lista mostra rota local para quem anuncia e motivo para quem não', () => {
  const list = deviceList();
  const byId = Object.fromEntries(list.map((d) => [d.id, d]));
  assert.equal(byId.dev34!.route, 'local');
  assert.equal(byId.dev34!.ip, '127.0.0.1');
  assert.equal(byId.away!.route, null);
  assert.equal(byId.away!.reason, 'offline');
});

test('abre pela rede local, só com os controles que o aparelho reporta, e liga', async () => {
  const opened = await control.openDevice('dev34');
  assert.equal(opened.route, 'local');
  assert.deepEqual(opened.values, { switch_1: false, cur_power: 48.6 });
  const codes = opened.gadget!.controls.map((c) => c.code);
  assert.ok(codes.includes('switch_1'));
  assert.ok(!codes.includes('never_reported'), 'DP do modelo que este aparelho nunca reportou fica de fora');

  const values = await control.setControl('dev34', 'switch_1', true);
  assert.equal(values.switch_1, true);
  assert.equal(fake34.dps['1'], true);
  assert.ok(pushes.some((p) => p.event === 'state' && p.data.id === 'dev34'));
  control.releaseDevice('dev34');
});

test('liga/desliga pela bandeja e lembra o último estado', async () => {
  const before = fake34.dps['1'];
  const on = await control.togglePower('dev34');
  assert.equal(on, !before);
  assert.equal(control.knownPower('dev34'), on);
});

test('a conexão cai e a página reconecta sozinha', async () => {
  await control.openDevice('dev34');
  pushes.length = 0;
  fake34.dropClients();
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(pushes.some((p) => p.event === 'device-trouble' && p.data.reason === null), 'reconectou');
  control.releaseDevice('dev34');
});

test('chave errada vira motivo "auth" (a página oferece re-sincronizar)', async () => {
  const opened = await control.openDevice('wrongkey');
  assert.equal(opened.route, null);
  assert.equal(opened.reason, 'auth');
});

test('sem rede local nem conta: só leitura, com o motivo', async () => {
  const opened = await control.openDevice('away');
  assert.equal(opened.route, null);
  assert.equal(opened.reason, 'offline');
  assert.deepEqual(opened.values, { switch_1: false, cur_power: 0 });
});

test('importa chaves no formato do tinytuya', () => {
  const count = account.importKeys([
    { id: 'tt1', key: '0123456789abcdef', name: 'Tomada importada', mapping: { '1': { code: 'switch_1', type: 'Boolean', values: {} } } },
    { id: 'semchave', key: '' },
  ]);
  assert.equal(count, 1);
  const imported = account.findDevice('tt1')!;
  assert.equal(imported.localKey, '0123456789abcdef');
  assert.deepEqual(imported.dps.map((d) => d.code), ['switch_1']);
});

test('bandeja e página abrindo o mesmo aparelho juntas compartilham uma sessão', async () => {
  const [a, b] = await Promise.all([control.openDevice('dev34'), control.openDevice('dev34')]);
  assert.equal(a.route, 'local');
  assert.equal(b.route, 'local');
  control.releaseDevice('dev34');
});

test('favoritos: aparecem primeiro, na ordem escolhida, na lista e na bandeja', async () => {
  await loadFavorites();
  await toggleFavorite('away');
  await toggleFavorite('dev34');
  await toggleFavorite('wrongkey');
  const order = () => deviceList().filter((d) => d.favorite).map((d) => d.id);
  assert.deepEqual(order(), ['away', 'dev34', 'wrongkey'], 'ordem em que foram favoritados');

  await reorderFavorites(['wrongkey', 'away', 'inexistente', 'wrongkey']);
  assert.deepEqual(order(), ['wrongkey', 'away', 'dev34'], 'ids inválidos e repetidos são ignorados; quem faltou vai pro fim');
  assert.deepEqual(deviceList().slice(0, 3).map((d) => d.id), ['wrongkey', 'away', 'dev34'], 'favoritos no topo da lista');

  renderTray();
  const trayFavorites = trayMenu.filter((i) => i.id?.startsWith('fav:')).map((i) => i.id!.slice(4));
  assert.deepEqual(trayFavorites, ['wrongkey', 'away', 'dev34']);
  assert.deepEqual([...store.get('favorites') as string[]], ['wrongkey', 'away', 'dev34'], 'ordem salva');
});
