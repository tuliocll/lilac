/**
 * Login por QR no Smart Life.
 *   npm run login                 (pergunta o código de usuário)
 *   npm run login -- <userCode>
 *
 * O "código de usuário" fica no app Smart Life:
 *   Eu → ⚙ Configurações → Conta e segurança → Código de usuário
 */
import { createInterface } from 'node:readline/promises';
import { HOME_ASSISTANT_CREDENTIALS as APP, pollLogin, requestLoginQr } from '@tuyabar/core';
import { renderQr } from './qr-terminal.ts';
import { DIR, save } from './store.ts';

let userCode = process.argv[2];
if (!userCode) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('No app Smart Life: Eu → ⚙ Configurações → Conta e segurança → Código de usuário');
  userCode = (await rl.question('Código de usuário: ')).trim();
  rl.close();
}

const { token, qrData } = await requestLoginQr(userCode, APP);
console.log('\nEscaneie com o app Smart Life (ícone de escanear no canto superior direito da tela inicial):\n');
console.log(renderQr(qrData));
console.log('\nAguardando confirmação no app…');

const session = await pollLogin(token, userCode, APP);
await save('session.json', session);
console.log(`\n✔ Logado como ${session.username ?? session.uid} (${session.endpoint}).`);
console.log(`Sessão salva em ${DIR}. Agora rode: npm run devices`);
