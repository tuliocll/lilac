/**
 * Lista os dispositivos da conta (nuvem) cruzando com a descoberta na LAN.
 *   npm run devices
 *   npm run devices -- --keys     (mostra as local keys)
 *   npm run devices -- --dps      (mostra o mapa de DPs de cada um)
 */
import {
  categoryLabel,
  discover,
  HOME_ASSISTANT_CREDENTIALS as APP,
  SharingClient,
  type CloudDevice,
  type SharingSession,
} from '@tuyabar/core';
import { createNodeTransport } from '@tuyabar/transport-node';
import { load, save } from './store.ts';

const showKeys = process.argv.includes('--keys');
const showDps = process.argv.includes('--dps');

const session = await load<SharingSession>('session.json');
if (!session) {
  console.error('Sem sessão. Rode primeiro: npm run login');
  process.exit(1);
}

const client = new SharingClient(session, { app: APP, onSessionUpdate: (s) => void save('session.json', s) });
console.log('Buscando dispositivos na nuvem e escutando a LAN por 8s…');
const [inventory, local] = await Promise.all([client.inventory(), discover(createNodeTransport(), { timeoutMs: 8000 })]);
await save('inventory.json', inventory);

const byId = new Map(local.map((d) => [d.id, d]));
const mask = (k: string) => (showKeys ? k : k ? `${k.slice(0, 2)}…${k.slice(-2)}` : '—');

console.table(
  inventory.map((d: CloudDevice) => {
    const l = byId.get(d.id);
    return {
      nome: d.name,
      tipo: categoryLabel(d.category),
      ip: l?.ip ?? (d.sub ? '(via gateway)' : '—'),
      versao: l?.version ?? '',
      local: d.supportLocal ? 'sim' : 'não',
      key: mask(d.localKey),
      id: d.id,
    };
  }),
);

const unknown = local.filter((d) => !inventory.some((i) => i.id === d.id));
if (unknown.length) console.log(`${unknown.length} dispositivo(s) na LAN que não estão nesta conta:`, unknown.map((d) => d.ip).join(', '));

if (showDps)
  for (const d of inventory) {
    console.log(`\n${d.name} (${d.category})`);
    for (const dp of d.dps) console.log(`  dp ${String(dp.dpId).padStart(3)}  ${dp.code.padEnd(22)} ${dp.type.padEnd(8)} ${JSON.stringify(dp.values ?? {})}`);
  }
