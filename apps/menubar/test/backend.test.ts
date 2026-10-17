/**
 * Backend do app de ponta a ponta: inventário → presença na rede → controle
 * local contra o aparelho falso (o mesmo validado contra o tinytuya).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { aesEcbEncrypt, encode55AA, te, UDP_KEY, type CloudDevice, type RemoteInfo, type Transport } from '@lilac/core';
import { createNodeTransport } from '../../../packages/transport-node/src/index.ts';
import { startFakeDevice } from '../../../packages/tuya-core/test/fake-local-device.ts';
import * as account from '../src/backend/account.ts';
import { setApp, type TinyApp } from '../src/backend/app.ts';
import * as control from '../src/backend/control.ts';
import { loadFavorites, reorderFavorites, toggleFavorite } from '../src/backend/favorites.ts';
import { renderTray } from '../src/backend/tray.ts';
import { configureNetwork, restartListening } from '../src/backend/network.ts';
import { deviceList } from '../src/backend/view.ts';
import { chooseRoom, loadRoomChoices, roomByName, roomOptions } from '../src/backend/rooms.ts';

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
  account.restore({ inventory: [device('dev34', { room: { id: '7', name: 'Sala', order: 1 } }), device('wrongkey'), device('away')], keys: { dev34: KEY, wrongkey: 'XXXXXXXXXXXXXXXX', away: KEY } });
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

test('a lista leva o cômodo e a casa do Smart Life (a interface agrupa por eles)', () => {
  const list = deviceList();
  assert.deepEqual(list.find((d) => d.id === 'dev34')!.room, { id: '7', name: 'Sala', order: 1 });
  assert.equal(list.find((d) => d.id === 'away')!.room, undefined);
  assert.equal(list.find((d) => d.id === 'away')!.home, 'Casa');
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

test('ações rápidas: padrão é o liga/desliga; dá para fixar valores e executar da lista', async () => {
  const { loadQuickActions, saveQuickActions, quickActionsFor } = await import('../src/backend/quick-actions.ts');
  await loadQuickActions();
  const device = account.findDevice('dev34')!;
  const gadget = control.supportedGadget(device);

  const before = deviceList().find((d) => d.id === 'dev34')!;
  assert.deepEqual(before.quick.map((q) => [q.code, q.mode]), [['switch_1', 'toggle']], 'padrão: liga/desliga');

  // controle somente leitura e código inexistente são descartados; no máximo 3
  const saved = await saveQuickActions(
    'dev34',
    [
      { code: 'switch_1', mode: 'toggle' },
      { code: 'cur_power', mode: 'set', value: 1 },
      { code: 'nao_existe', mode: 'toggle' },
    ],
    gadget,
  );
  assert.deepEqual(saved, [{ code: 'switch_1', mode: 'toggle' }]);
  assert.deepEqual(quickActionsFor('dev34', gadget).length, 1);

  const was = fake34.dps['1'];
  await control.runAction('dev34', { code: 'switch_1', mode: 'toggle' });
  assert.equal(fake34.dps['1'], !was, 'executou pela rede local');
  const after = deviceList().find((d) => d.id === 'dev34')!;
  assert.equal(after.quick[0]!.active, !was, 'a lista mostra o estado novo');

  await saveQuickActions('dev34', [], gadget);
  assert.deepEqual(deviceList().find((d) => d.id === 'dev34')!.quick, [], 'lista vazia é respeitada');
});

test('cômodo pelo nome: palavra inteira, sem acento, o nome mais longo ganha', () => {
  const room = (id: string, name: string) => ({ id, name, order: 0, homeId: '1', home: 'Casa' });
  const rooms = [room('1', 'Sala'), room('2', 'Sala de Estar'), room('3', 'Escritório')];
  assert.equal(roomByName('Ar-condicionado Sala de Estar', rooms)?.id, '2');
  assert.equal(roomByName('Ar-condicionado Sala', rooms)?.id, '1');
  assert.equal(roomByName('Ar-condicionado escritorio Wil', rooms)?.id, '3');
  assert.equal(roomByName('Salamandra', rooms), undefined, 'pedaço de palavra não conta');
  assert.equal(roomByName('Ar-condicionado Suite', rooms), undefined);
});

test('aparelho sem cômodo na nuvem: entra pelo nome, e a escolha do usuário manda', async () => {
  await loadRoomChoices();
  // dev34 está na "Sala" do Smart Life; um importado com "sala" no nome vai para lá
  account.importKeys([{ id: 'imp-sala', key: 'fedcba9876543210', name: 'Luz da sala' }]);
  const view = () => deviceList().find((d) => d.id === 'imp-sala')!;
  assert.deepEqual(view().room, { id: '7', name: 'Sala', order: 1 });
  assert.equal(view().home, 'Casa', 'agrupa com o cômodo da casa do Smart Life');
  assert.deepEqual(roomOptions(account.findDevice('imp-sala')!).auto, { room: 'Sala', source: 'name' });

  await chooseRoom('imp-sala', 'none');
  assert.equal(view().room, undefined);
  assert.equal(roomOptions(account.findDevice('imp-sala')!).choice, 'none');

  // escolha manda até sobre o cômodo da nuvem
  await chooseRoom('dev34', 'none');
  assert.equal(deviceList().find((d) => d.id === 'dev34')!.room, undefined);

  // de volta ao automático; e escolhas sobrevivem a reiniciar o app
  await chooseRoom('dev34', 'auto');
  await chooseRoom('imp-sala', '1:7'); // chave = id da casa + id do cômodo
  await loadRoomChoices();
  assert.equal(deviceList().find((d) => d.id === 'dev34')!.room?.name, 'Sala');
  assert.equal(view().room?.name, 'Sala');
  assert.equal(roomOptions(account.findDevice('imp-sala')!).choice, '1:7');
  await chooseRoom('imp-sala', 'auto');
});

test('duas casas com uma "Sala": pelo nome, o aparelho fica na sala da própria casa', async () => {
  const sala = (id: string) => ({ id, name: 'Sala', order: 1 });
  account.restore({
    inventory: [
      device('apto-tv', { name: 'TV', homeId: '1', homeName: 'Apartamento', room: sala('7') }),
      device('praia-tv', { name: 'TV', homeId: '2', homeName: 'Praia', room: sala('9') }),
      device('praia-luz', { name: 'Luz da sala', homeId: '2', homeName: 'Praia' }),
    ],
  });
  const luz = deviceList().find((d) => d.id === 'praia-luz')!;
  assert.deepEqual([luz.room?.id, luz.home, luz.homeId], ['9', 'Praia', '2']);
});
