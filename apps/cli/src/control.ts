/**
 * Controla um aparelho pela CLI — pela rede local quando dá, senão pela nuvem.
 * Usa o inventário salvo pelo `npm run devices`.
 *
 *   npm run control -- "Luz garagem"               (lê o estado)
 *   npm run control -- "Luz garagem" switch_1=true (escreve por código…)
 *   npm run control -- "Luz garagem" 1=false       (…ou por número do DP)
 *   npm run control -- "Ar escritório" temp=23 --cloud   (força a nuvem)
 */
import {
  createLocalDevice,
  createSharingClient,
  discover,
  HOME_ASSISTANT_CREDENTIALS,
  isLocalVersionSupported,
  type CloudDevice,
  type Dps,
  type SharingSession,
} from '@tuyabar/core';
import { createNodeTransport } from '@tuyabar/transport-node';
import { flag, load, save } from './store.ts';

const forceCloud = flag('cloud');
const [query, ...assignments] = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const inventory = await load<CloudDevice[]>('inventory.json');
if (!query || !inventory) {
  console.error('Uso: npm run control -- "<nome ou id>" [codigo=valor ...] [--cloud]   (rode npm run devices antes)');
  process.exit(1);
}

const device = findDevice(inventory, query);
if (!device) {
  console.error(`Nenhum aparelho casa com "${query}".`);
  process.exit(1);
}

const changes = parseAssignments(device, assignments);
const transport = createNodeTransport();

const onNetwork = forceCloud ? undefined : (await discover(transport, { timeoutMs: 7000 })).find((d) => d.id === device.id);
const canUseLocal = onNetwork && device.localKey && isLocalVersionSupported(onNetwork.version);

try {
  if (canUseLocal) await runLocal(onNetwork.ip, onNetwork.version);
  else await runCloud();
} catch (error) {
  console.error(`Falhou: ${(error as Error).message}`);
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------

async function runLocal(ip: string, version: string) {
  console.log(`Pela rede local: v${version} @ ${ip}`);
  const local = createLocalDevice({ id: device!.id, ip, localKey: device!.localKey, version, transport, heartbeatMs: 0 });
  try {
    if (changes.length) {
      const dps = Object.fromEntries(changes.map((c) => [String(c.dpId), c.value]));
      console.log('Aplicado:', namedByCode(await local.set(dps)));
    } else {
      console.table(namedByCode(await local.status()));
    }
  } finally {
    await local.close();
  }
}

async function runCloud() {
  const session = await load<SharingSession>('session.json');
  if (!session) throw new Error('não está na rede local e não há sessão da nuvem (npm run login)');
  console.log('Pela nuvem (o aparelho não está acessível pela rede local).');
  const cloud = createSharingClient(session, { app: HOME_ASSISTANT_CREDENTIALS, onSessionUpdate: (s) => void save('session.json', s) });
  if (changes.length) await cloud.sendCommands(device!.id, changes.map(({ code, value }) => ({ code, value })));
  const { [device!.id]: current } = await cloud.statusOf([device!.id]);
  console.table(current?.status ?? {});
}

function findDevice(list: CloudDevice[], text: string) {
  const lower = text.toLowerCase();
  return (
    list.find((d) => d.id === text || d.name.toLowerCase() === lower) ?? list.find((d) => d.name.toLowerCase().includes(lower))
  );
}

/** "switch_1=true" ou "1=true" → { code, dpId, value } */
function parseAssignments(target: CloudDevice, items: string[]) {
  return items.map((item) => {
    const [key = '', raw = ''] = item.split('=');
    const spec = target.dps.find((dp) => dp.code === key || String(dp.dpId) === key);
    return { code: spec?.code ?? key, dpId: spec?.dpId ?? Number(key), value: parseValue(raw) };
  });
}

function parseValue(text: string): unknown {
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
}

function namedByCode(dps: Dps) {
  return Object.fromEntries(
    Object.entries(dps).map(([dpId, value]) => [device!.dps.find((d) => String(d.dpId) === dpId)?.code ?? dpId, value]),
  );
}
