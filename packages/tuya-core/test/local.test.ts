import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createNodeTransport } from '../../transport-node/src/index.ts';
import { createLocalDevice } from '../src/index.ts';
import { startFakeDevice } from './fake-local-device.ts';

const KEY = 'abcdef0123456789';
const ID = 'eb8bc0f725df3a2deek6uu';
const transport = createNodeTransport();

for (const version of ['3.3', '3.4'] as const) {
  test(`v${version}: status() e set() contra o aparelho falso`, async () => {
    const fake = await startFakeDevice({ id: ID, localKey: KEY, version, dps: { '1': false, '2': 22, '4': 'cold' } });
    const dev = createLocalDevice({ id: ID, ip: '127.0.0.1', port: fake.port, localKey: KEY, version, transport, timeoutMs: 2000 });
    try {
      assert.deepEqual(await dev.status(), { '1': false, '2': 22, '4': 'cold' });
      const pushed: unknown[] = [];
      dev.onStatus((d: unknown) => pushed.push(d));
      const applied = await dev.set({ '1': true, '2': 24 });
      assert.deepEqual(applied, { '1': true, '2': 24 });
      assert.equal(fake.dps['2'], 24);
      assert.ok(pushed.length >= 1, 'STATUS chega também como evento');
      if (version === '3.4') {
        assert.equal(fake.log[1]?.body, true, 'HMAC do FINISH conferiu no aparelho');
      }
    } finally {
      await dev.close();
      await fake.close();
    }
  });
}

for (const version of ['3.3', '3.4'] as const) {
  test(`v${version}: comandos em paralelo não trocam respostas`, async () => {
    const fake = await startFakeDevice({ id: ID, localKey: KEY, version, dps: { '1': false, '2': 20, '3': 'a' } });
    const dev = createLocalDevice({ id: ID, ip: '127.0.0.1', port: fake.port, localKey: KEY, version, transport, timeoutMs: 2000 });
    try {
      const [a, b, st] = await Promise.all([dev.set({ '1': true }), dev.set({ '2': 25 }), dev.status()]);
      assert.deepEqual(a, { '1': true });
      assert.deepEqual(b, { '2': 25 });
      assert.deepEqual(st, { '1': true, '2': 25, '3': 'a' });
    } finally {
      await dev.close();
      await fake.close();
    }
  });

  test(`v${version}: heartbeat mantém a conexão e reconecta depois de cair`, async () => {
    const fake = await startFakeDevice({ id: ID, localKey: KEY, version, dps: { '1': false } });
    const dev = createLocalDevice({ id: ID, ip: '127.0.0.1', port: fake.port, localKey: KEY, version, transport, timeoutMs: 1000, heartbeatMs: 50 });
    try {
      await dev.status();
      await new Promise((r) => setTimeout(r, 180));
      assert.ok(fake.log.filter((l) => l.cmd === 9).length >= 2, 'enviou heartbeats');
      assert.equal(dev.isConnected(), true);

      let closed = false;
      dev.onClose(() => (closed = true));
      fake.dropClients();
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(closed, true, 'avisou que caiu');
      assert.deepEqual(await dev.status(), { '1': false }, 'reconecta sozinho no próximo comando');
    } finally {
      await dev.close();
      await fake.close();
    }
  });
}

test('aparelho que não manda "ack" (só STATUS) também funciona', async () => {
  const fake = await startFakeDevice({ id: ID, localKey: KEY, version: '3.4', dps: { '1': false }, noAck: true });
  const dev = createLocalDevice({ id: ID, ip: '127.0.0.1', port: fake.port, localKey: KEY, version: '3.4', transport, timeoutMs: 800 });
  try {
    const started = Date.now();
    assert.deepEqual(await dev.set({ '1': true }), { '1': true });
    assert.ok(Date.now() - started < 500, 'não espera o prazo do ack');
  } finally {
    await dev.close();
    await fake.close();
  }
});

test('v3.3 device22: cai para CONTROL_NEW pedindo DPs', async () => {
  const fake = await startFakeDevice({ id: ID, localKey: KEY, version: '3.3', dps: { '1': true }, device22: true });
  const dev = createLocalDevice({ id: ID, ip: '127.0.0.1', port: fake.port, localKey: KEY, version: '3.3', transport, timeoutMs: 2000 });
  try {
    assert.deepEqual(await dev.status(), { '1': true });
  } finally {
    await dev.close();
    await fake.close();
  }
});

test('v3.4 com local key errada falha com erro de autenticação', async () => {
  const fake = await startFakeDevice({ id: ID, localKey: KEY, version: '3.4', dps: { '1': true } });
  const dev = createLocalDevice({ id: ID, ip: '127.0.0.1', port: fake.port, localKey: 'XXXXXXXXXXXXXXXX', version: '3.4', transport, timeoutMs: 1000 });
  try {
    await assert.rejects(dev.status(), (e: any) => ['auth', 'timeout', 'closed'].includes(e.code));
  } finally {
    await dev.close();
    await fake.close();
  }
});

// ---------------------------------------------------------------------------
// Interop: o cliente do tinytuya (implementação de referência em Python)
// conversando com o nosso aparelho falso. Se passar, o aparelho falso fala o
// protocolo de verdade — e portanto os testes acima validam o nosso cliente.

const hasTinytuya = spawnSync('python3', ['-c', 'import tinytuya'], { stdio: 'ignore' }).status === 0;

for (const version of ['3.3', '3.4'] as const) {
  test(`interop tinytuya → aparelho falso v${version}`, { skip: !hasTinytuya && 'tinytuya não instalado (pip install tinytuya)' }, async () => {
    const fake = await startFakeDevice({ id: ID, localKey: KEY, version, dps: { '1': false, '2': 22 } });
    try {
      const dir = mkdtempSync(join(tmpdir(), 'tt-'));
      const script = join(dir, 'client.py');
      writeFileSync(
        script,
        `import json, tinytuya
d = tinytuya.Device("${ID}", "127.0.0.1", "${KEY}", version=${version}, port=${fake.port}, connection_timeout=3)
d.set_socketRetryLimit(1)
s = d.status()
r = d.set_value(2, 26)
print(json.dumps({"status": s, "set": r}))
`,
      );
      // spawn assíncrono: o aparelho falso roda neste mesmo processo
      const { spawn } = await import('node:child_process');
      const out = await new Promise<string>((res, rej) => {
        const p = spawn('python3', ['-I', script]);
        let o = '';
        let e = '';
        p.stdout.on('data', (d) => (o += d));
        p.stderr.on('data', (d) => (e += d));
        p.on('close', (code) => (code === 0 ? res(o) : rej(new Error(e || `exit ${code}`))));
      });
      const r = JSON.parse(out.trim().split('\n').pop()!);
      assert.deepEqual(r.status.dps, { '1': false, '2': 22 }, JSON.stringify(r));
      assert.equal(r.set.dps['2'], 26, JSON.stringify(r));
      assert.equal(fake.dps['2'], 26);
    } finally {
      await fake.close();
    }
  });
}
