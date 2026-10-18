/** O manifest.json do atualizador, montado no CI a partir do `tinyjs publish` de cada sistema. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filesIn, mergeManifests } from '../../../.github/scripts/release-manifest.mjs';

// o que o `tinyjs publish` escreve em dist/publish/manifest.json em cada sistema
const fragments = {
  macos: { version: '1.0.8', url: 'https://YOUR-HOST/updates/lilac-1.0.8.zip', sha256: 'mac' },
  windows: { version: '1.0.8', win: { url: 'https://x/latest/download/lilac-1.0.8-win.zip', sha256: 'win' } },
  linux: { version: '1.0.8', linux: { x86_64: { url: 'https://x/lilac-1.0.8-linux-x86_64.tar.gz', sha256: 'lin' } } },
};

test('cada sistema fica no seu bloco, com a versão dentro dele', () => {
  const m = mergeManifests({ fragments, tag: 'v1.0.8', repo: 'tuliocll/lilac', notes: '- Atualização dentro do app\n' });
  const base = 'https://github.com/tuliocll/lilac/releases/download/v1.0.8/';
  assert.deepEqual(m, {
    version: '1.0.8',
    url: `${base}lilac-1.0.8.zip`,
    sha256: 'mac',
    win: { version: '1.0.8', url: `${base}lilac-1.0.8-win.zip`, sha256: 'win' },
    linux: { x86_64: { version: '1.0.8', url: `${base}lilac-1.0.8-linux-x86_64.tar.gz`, sha256: 'lin' } },
    notes: '- Atualização dentro do app',
  });
  assert.deepEqual(filesIn(m), ['lilac-1.0.8.zip', 'lilac-1.0.8-win.zip', 'lilac-1.0.8-linux-x86_64.tar.gz']);
});

test('sistema que não buildou fica de fora (o app dele vê "sem atualização")', () => {
  const m = mergeManifests({ fragments: { windows: fragments.windows }, tag: 'v1.0.8', repo: 'tuliocll/lilac' });
  assert.equal(m.url, undefined);
  assert.equal(m.linux, undefined);
  assert.equal(m.notes, undefined);
  assert.ok(m.win.url.endsWith('/v1.0.8/lilac-1.0.8-win.zip'));
});
