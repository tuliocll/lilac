/**
 * Teste do transporte txiki: sobe aparelhos falsos (3.3 e 3.4) e anúncios UDP
 * no Node, empacota smoke/in-txiki.ts e roda dentro do `tjs`.
 *
 *   npm run test:txiki                 (usa o `tjs` do PATH)
 *   TJS=/caminho/para/tjs npm run test:txiki
 *
 * Sem `tjs` instalado, avisa e sai sem falhar (o CI comum não tem txiki).
 * Para compilar: git clone --recursive https://github.com/saghul/txiki.js && make (≈2 min).
 */
import { spawnSync } from 'node:child_process';
import dgram from 'node:dgram';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { aesEcbEncrypt, encode55AA, te, UDP_KEY } from '@lilac/core';
import { startFakeDevice } from '../../tuya-core/test/fake-local-device.ts';

const tjs = process.env.TJS || 'tjs';
if (spawnSync(tjs, ['--version']).status !== 0) {
  console.log(`tjs não encontrado (${tjs}) — teste do txiki pulado.`);
  process.exit(0);
}

const KEY = 'abcdef0123456789';
const d33 = await startFakeDevice({ id: 'fake33', localKey: KEY, version: '3.3', dps: { '1': false, '2': 22 } });
const d34 = await startFakeDevice({ id: 'fake34', localKey: KEY, version: '3.4', dps: { '1': false, '19': 486 } });

// anúncio da 3.4 em 127.0.0.1:6667, como um aparelho faria na rede
const udp = dgram.createSocket('udp4');
const json = te.encode(JSON.stringify({ ip: '127.0.0.1', gwId: 'fake34', version: '3.4', encrypt: true, productKey: 'pk' }));
const frame = encode55AA({ seq: 1, cmd: 0x13, retcode: 0, payload: aesEcbEncrypt(UDP_KEY, json) });
const announcing = setInterval(() => udp.send(frame, 6667, '127.0.0.1'), 300);

const out = join(mkdtempSync(join(tmpdir(), 'lilac-txiki-')), 'in-txiki.js');
await build({
  entryPoints: [new URL('./in-txiki.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  mainFields: ['module', 'main'],
  outfile: out,
  logLevel: 'warning',
});

// assíncrono: os aparelhos falsos precisam continuar respondendo enquanto o tjs roda
const { spawn } = await import('node:child_process');
const child = spawn(tjs, ['run', out, String(d33.port), String(d34.port), KEY], { stdio: 'inherit' });
const code: number = await new Promise((resolve) => child.on('exit', (c) => resolve(c ?? 1)));

clearInterval(announcing);
udp.close();
await Promise.all([d33.close(), d34.close()]);
process.exit(code);
