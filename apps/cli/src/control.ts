/**
 * Controle local pela CLI — usa o inventário salvo pelo `npm run devices`.
 *   npm run control -- "Luz garagem"              (lê o estado)
 *   npm run control -- "Luz garagem" 1=true       (liga o DP 1)
 *   npm run control -- "Luz garagem" switch_1=false
 */
import { discover, TuyaLocalDevice, type CloudDevice, type Dps } from '@tuyabar/core';
import { createNodeTransport } from '@tuyabar/transport-node';
import { load } from './store.ts';

const [query, ...assignments] = process.argv.slice(2);
const inventory = await load<CloudDevice[]>('inventory.json');
if (!query || !inventory) {
  console.error('Uso: npm run control -- "<nome ou id>" [dp=valor ...]   (rode npm run devices antes)');
  process.exit(1);
}
const q = query.toLowerCase();
const dev = inventory.find((d) => d.id === query || d.name.toLowerCase() === q) ?? inventory.find((d) => d.name.toLowerCase().includes(q));
if (!dev) {
  console.error(`Nenhum dispositivo casa com "${query}".`);
  process.exit(1);
}

const transport = createNodeTransport();
console.log(`Procurando ${dev.name} na rede…`);
const found = (await discover(transport, { timeoutMs: 7000, onDevice: () => {} })).find((d) => d.id === dev.id);
if (!found) {
  console.error('Não apareceu na rede (dispositivo a bateria, sub-dispositivo de gateway ou fora da LAN).');
  process.exit(1);
}

const local = new TuyaLocalDevice({ id: dev.id, ip: found.ip, localKey: dev.localKey, version: found.version, transport });
const byCode = new Map(dev.dps.map((d) => [d.code, d.dpId]));
const parse = (v: string): unknown => (v === 'true' ? true : v === 'false' ? false : /^-?\d+$/.test(v) ? Number(v) : v);
const named = (dps: Dps) =>
  Object.fromEntries(Object.entries(dps).map(([k, v]) => [dev.dps.find((d) => String(d.dpId) === k)?.code ?? k, v]));

try {
  if (assignments.length) {
    const dps: Dps = {};
    for (const a of assignments) {
      const [k, v = ''] = a.split('=');
      dps[String(byCode.get(k!) ?? k)] = parse(v);
    }
    console.log('Enviando', dps);
    console.log('Aplicado:', named(await local.set(dps)));
  } else {
    console.log(`v${found.version} @ ${found.ip}`);
    console.table(named(await local.status()));
  }
} catch (e) {
  console.error(`Falhou: ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  await local.close();
}
