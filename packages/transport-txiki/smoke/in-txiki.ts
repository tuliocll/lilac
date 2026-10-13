// Roda DENTRO do txiki (tjs): o tuya-core e o transporte do app falando com
// aparelhos falsos de verdade por UDP e TCP. Quem sobe os falsos e chama o tjs
// é o run.ts ao lado (npm run test:txiki).
import { createLocalDevice, LocalError, watchBroadcasts } from '@lilac/core';
import { createTxikiTransport } from '../src/index.ts';
declare const tjs: any;
const [p33, p34, key] = tjs.args.slice(-3);
const transport = createTxikiTransport();
let failed = 0;
const ok = (name: string, cond: boolean, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!cond) failed++; };
async function step(name: string, fn: () => Promise<void>) {
  try { await fn(); } catch (e) { ok(name, false, String((e as Error)?.stack ?? e)); }
}
console.log('txiki', tjs.version, '· UDPSocket:', typeof (globalThis as any).UDPSocket, '· TCPSocket:', typeof (globalThis as any).TCPSocket, '· tjs.connect:', typeof tjs.connect);

await step('UDP: escuta anúncios na 6667', async () => {
  const w = await watchBroadcasts(transport, { ports: [6667], onDevice: () => {}, onBindError: (p, e) => console.log('bind', p, e.message) });
  await new Promise((r) => setTimeout(r, 1500));
  const seen = w.devices().map((d: any) => d.id);
  await w.stop();
  ok('UDP: escuta anúncios na 6667', seen.includes('fake34'), JSON.stringify(seen));
});

for (const [version, port, dp] of [['3.3', p33, '1'], ['3.4', p34, '1']] as const) {
  await step(`TCP ${version}`, async () => {
    const dev = createLocalDevice({ id: version === '3.3' ? 'fake33' : 'fake34', ip: '127.0.0.1', port: Number(port), localKey: key, version, transport, timeoutMs: 3000, heartbeatMs: 0 });
    const st = await dev.status();
    ok(`TCP ${version}: lê o estado`, st[dp] === false, JSON.stringify(st));
    const on = await dev.set({ [dp]: true });
    ok(`TCP ${version}: liga`, on[dp] === true, JSON.stringify(on));
    const [a, b] = await Promise.all([dev.set({ [dp]: false }), dev.status()]);
    ok(`TCP ${version}: comandos simultâneos`, a[dp] === false && b[dp] === false, JSON.stringify([a, b]));
    await dev.close();
  });
}

await step('TCP: porta fechada falha rápido com erro de conexão', async () => {
  const dev = createLocalDevice({ id: 'x', ip: '127.0.0.1', port: 1, localKey: key, version: '3.3', transport, timeoutMs: 2000, heartbeatMs: 0 });
  const t0 = Date.now();
  try { await dev.status(); ok('TCP: porta fechada', false, 'não deu erro'); }
  catch (e) { ok('TCP: porta fechada falha rápido com erro de conexão', e instanceof LocalError && (e as any).code === 'connect' && Date.now() - t0 < 2500, `${(e as any).code} em ${Date.now() - t0} ms`); }
  await dev.close();
});

await step('TCP 3.4: chave errada vira erro de autenticação', async () => {
  const dev = createLocalDevice({ id: 'fake34', ip: '127.0.0.1', port: Number(p34), localKey: 'XXXXXXXXXXXXXXXX', version: '3.4', transport, timeoutMs: 2000, heartbeatMs: 0 });
  try { await dev.status(); ok('TCP 3.4: chave errada', false, 'não deu erro'); }
  catch (e) { ok('TCP 3.4: chave errada vira erro de autenticação', (e as any).code === 'auth', String((e as any).code)); }
  await dev.close();
});

console.log(failed ? `\n${failed} falha(s)` : '\ntudo certo');
tjs.exit(failed ? 1 : 0);
