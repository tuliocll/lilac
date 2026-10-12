/**
 * Lista os aparelhos da conta (nuvem) cruzando com a descoberta na rede.
 *   npm run devices
 *   npm run devices -- --keys     (mostra as local keys)
 *   npm run devices -- --dps      (mostra os DPs de cada um)
 */
import { categoryLabel, createSharingClient, discover, HOME_ASSISTANT_CREDENTIALS, type CloudDevice, type SharingSession } from '@tuyabar/core';
import { createNodeTransport } from '@tuyabar/transport-node';
import { load, save } from './store.ts';

const showKeys = process.argv.includes('--keys');
const showDps = process.argv.includes('--dps');

const session = await load<SharingSession>('session.json');
if (!session) {
  console.error('Sem sessão. Rode primeiro: npm run login');
  process.exit(1);
}

const cloud = createSharingClient(session, {
  app: HOME_ASSISTANT_CREDENTIALS,
  onSessionUpdate: (updated) => void save('session.json', updated),
});

console.log('Buscando aparelhos na nuvem e escutando a rede por 8 s…');
const [inventory, onNetwork] = await Promise.all([cloud.inventory(), discover(createNodeTransport(), { timeoutMs: 8000 })]);
await save('inventory.json', inventory);

const localById = new Map(onNetwork.map((d) => [d.id, d]));
const mask = (key: string) => (!key ? '—' : showKeys ? key : `${key.slice(0, 2)}…${key.slice(-2)}`);

console.table(
  inventory.map((device: CloudDevice) => {
    const local = localById.get(device.id);
    return {
      nome: device.name,
      tipo: categoryLabel(device.category),
      ip: local?.ip ?? (device.sub ? '(via gateway)' : '—'),
      versao: local?.version ?? '',
      key: mask(device.localKey),
      id: device.id,
    };
  }),
);

const strangers = onNetwork.filter((d) => !inventory.some((i) => i.id === d.id));
if (strangers.length) console.log(`${strangers.length} aparelho(s) na rede fora desta conta:`, strangers.map((d) => d.ip).join(', '));

if (showDps) {
  for (const device of inventory) {
    console.log(`\n${device.name} (${device.category})`);
    for (const dp of device.dps) {
      const access = dp.writable ? 'rw' : 'r ';
      console.log(`  dp ${String(dp.dpId).padStart(3)} ${access} ${dp.code.padEnd(22)} ${dp.type.padEnd(8)} ${JSON.stringify(dp.values ?? {})}`);
    }
  }
}
