/**
 * Aparelhos LG ThinQ (ares-condicionados Wi-Fi da LG etc.).
 *   npm run lg                      lista os aparelhos da conta LG
 *   npm run lg -- --inspect         + perfil e estado crus de cada um (para mapear controles)
 *   npm run lg -- --login           pede o token de novo (vencido, revogado, outra conta)
 *
 * Na primeira vez pede o Personal Access Token, gerado em https://connect-pat.lgthinq.com,
 * e o país da conta. Fica em ~/.lilac/thinq.json (0600), como a sessão da Tuya.
 */
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { createThinqClient, regionOf, ThinqError } from '@lilac/thinq';
import { flag, load, save } from './store.ts';

interface ThinqConfig {
  token: string;
  country: string;
  clientId: string;
}

let config = await load<ThinqConfig>('thinq.json');
if (!config || flag('login')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('Gere um token em https://connect-pat.lgthinq.com (entre com a conta do app LG ThinQ).');
  const token = (await rl.question('Personal Access Token: ')).trim();
  const country = ((await rl.question('País da conta LG [BR]: ')).trim() || 'BR').toUpperCase();
  rl.close();
  if (!token || !regionOf(country)) {
    console.error(!token ? 'Sem token.' : `A LG ThinQ não atende o país "${country}".`);
    process.exit(1);
  }
  config = { token, country, clientId: config?.clientId ?? randomUUID() };
  await save('thinq.json', config);
}

const lg = createThinqClient(config);
const devices = await lg.devices().catch((error) => {
  console.error(`Erro: ${(error as Error).message}`);
  if (error instanceof ThinqError && ['1103', '1218', '1302'].includes(error.code)) console.error('O token não vale mais. Gere outro e rode: npm run lg -- --login');
  process.exit(1);
});
console.table(devices.map((d) => ({ nome: d.alias, tipo: d.deviceType.replace(/^DEVICE_/, ''), modelo: d.modelName, id: d.deviceId })));

if (flag('inspect')) {
  for (const d of devices) {
    console.log(`\n=== ${d.alias} (${d.deviceType})`);
    for (const [label, call] of [['perfil', lg.profile], ['estado', lg.state]] as const) {
      try {
        console.log(`--- ${label}\n${JSON.stringify(await call(d.deviceId), null, 2)}`);
      } catch (error) {
        console.log(`--- ${label}: erro: ${(error as Error).message}`);
      }
    }
  }
}
