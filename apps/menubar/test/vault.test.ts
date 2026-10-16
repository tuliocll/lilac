/**
 * Cofre da página (ui/vault.js): local keys agrupadas em poucos itens do
 * Keychain — cada item lido ou regravado por outro executável é um pedido de
 * senha no macOS — sem nunca perder uma chave no caminho.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(join(import.meta.dirname, '..', 'src', 'frontend', 'ui', 'vault.js'), 'utf8');

interface Disk {
  secrets: Map<string, string>;
  store: Map<string, unknown>;
}
const emptyDisk = (): Disk => ({ secrets: new Map(), store: new Map() });
const tick = () => new Promise((r) => setTimeout(r, 1));

/**
 * Abre o vault.js sobre um "disco" (cofre + store) com um `tiny` falso:
 * cada operação é assíncrona e fica registrada em `ops`; `deny` faz uma
 * operação falhar como um pedido de senha negado (ex.: 'get keys:1').
 */
function openVault(disk: Disk, { macOS = true, deny = new Set<string>() } = {}) {
  const ops: string[] = [];
  const op = async <T>(name: string, run: () => T): Promise<T> => {
    ops.push(name);
    await tick();
    if (deny.has(name)) throw new Error(`negado: ${name}`);
    return run();
  };
  const tiny = {
    app: {
      secrets: {
        get: (k: string) => op(`get ${k}`, () => disk.secrets.get(k) ?? null),
        set: (k: string, v: string) => op(`set ${k}`, () => void disk.secrets.set(k, v)),
        delete: (k: string) => op(`delete ${k}`, () => void disk.secrets.delete(k)),
      },
    },
    store: { get: async (k: string) => disk.store.get(k) ?? null, set: async (k: string, v: unknown) => void disk.store.set(k, v) },
    system: { isMacOS: () => macOS },
  };
  const ctx: any = { Lilac: {}, tiny, TextEncoder };
  vm.runInNewContext(source, ctx);
  return { vault: ctx.Lilac.vault as { read(): Promise<any>; write(data: any): Promise<void> }, ops };
}

/** Objetos do vm.Context têm outro protótipo: compara pelo conteúdo. */
const plain = (x: unknown) => JSON.parse(JSON.stringify(x));
const idOf = (i: number) => `eb${String(i).padStart(4, '0')}c0f725df3a2deek`;
const keysFor = (from: number, to: number) => Object.fromEntries(Array.from({ length: to - from }, (_, i) => [idOf(from + i), `k3y-${from + i}`.padEnd(16, 'x')]));
const inventoryOf = (keys: Record<string, string>, homeId = '1') => Object.keys(keys).map((id) => ({ id, name: id, homeId }));
const session = { uid: 'u' };

async function saved(keys: Record<string, string>, disk = emptyDisk()) {
  await openVault(disk).vault.write({ session, inventory: inventoryOf(keys), keys });
  return disk;
}
const reopen = async (disk: Disk, options?: Parameters<typeof openVault>[1]) => plain((await openVault(disk, options).vault.read()).keys);

test('cem aparelhos cabem em poucos itens, cada um abaixo do limite do Windows', async () => {
  const keys = keysFor(0, 100);
  const disk = await saved(keys);
  const groups = [...disk.secrets.keys()].filter((k) => k.startsWith('keys:'));
  assert.ok(groups.length <= 3, `${groups.length} itens`);
  for (const g of groups) assert.ok(new TextEncoder().encode(disk.secrets.get(g)!).length <= 2560);
  assert.equal(disk.store.get('keyGroups'), groups.length);
  assert.deepEqual(await reopen(disk), keys);
});

test('grava e lê de volta; sincronizar sem mudança não regrava nada', async () => {
  const keys = keysFor(0, 30);
  const disk = await saved(keys);
  const { vault, ops } = openVault(disk);
  const r = await vault.read();
  assert.deepEqual(plain(r.keys), keys);
  assert.deepEqual(plain(r.session), session);
  assert.deepEqual(ops, ['get session', 'get keys:0'], 'dois itens lidos = no máximo dois pedidos de senha');

  ops.length = 0;
  await vault.write({ session, inventory: inventoryOf(keys), keys });
  assert.deepEqual(ops, []);
});

test('duas gravações ao mesmo tempo entram em fila: vale a última', async () => {
  const keys = keysFor(0, 100);
  const disk = await saved(keys);
  const { vault } = openVault(disk);
  await vault.read();
  // renovação de token (sem chaves da nuvem ainda) e a sincronização (com elas), juntas
  const first = vault.write({ session, inventory: inventoryOf(keys), keys: {} });
  const second = vault.write({ session, inventory: inventoryOf(keysFor(0, 1)), keys: keysFor(0, 1) });
  await Promise.all([first, second]);
  assert.deepEqual(await reopen(disk), keysFor(0, 1));
  assert.equal(disk.store.get('keyGroups'), 1);
});

test('chave que chega vazia não apaga a guardada, enquanto o aparelho existir', async () => {
  const keys = keysFor(0, 10);
  const disk = await saved(keys);
  const { vault } = openVault(disk);
  await vault.read();
  await vault.write({ session, inventory: inventoryOf(keys), keys: {} });
  assert.deepEqual(await reopen(disk), keys);
});

test('grupo que não deu para ler (pedido negado) não é regravado: nada se perde', async () => {
  const keys = keysFor(0, 100);
  const disk = await saved(keys);
  const { vault } = openVault(disk, { deny: new Set(['get keys:1']) });
  const r = await vault.read();
  assert.ok(Object.keys(r.keys).length < 100, 'o grupo negado não veio');
  await vault.write({ session, inventory: inventoryOf(keys), keys: r.keys });
  assert.deepEqual(await reopen(disk), keys);
});

test('aparelho novo não muda ninguém de grupo: gravação interrompida no meio não perde chaves', async () => {
  const keys = keysFor(0, 100);
  const disk = await saved(keys);
  const lastGroup = (disk.store.get('keyGroups') as number) - 1;
  const { vault } = openVault(disk, { deny: new Set([`set keys:${lastGroup}`]) });
  await vault.read();
  const more = { ...keys, aa000000000000000000new: 'newkey-123456789' };
  await assert.rejects(vault.write({ session, inventory: inventoryOf(more), keys: more }));
  assert.deepEqual(await reopen(disk), keys, 'as antigas continuam lá; a nova volta na próxima gravação');
});

test('aparelho removido sai do cofre; grupos que sobraram saem depois da contagem nova', async () => {
  const keys = keysFor(0, 100);
  const disk = await saved(keys);
  const { vault, ops } = openVault(disk);
  await vault.read();
  const one = keysFor(0, 1);
  await vault.write({ session, inventory: inventoryOf(one), keys: one });
  assert.equal(disk.store.get('keyGroups'), 1);
  assert.deepEqual([...disk.secrets.keys()].filter((k) => k.startsWith('keys:')), ['keys:0']);
  assert.deepEqual(await reopen(disk), one);
  assert.ok(ops.indexOf('delete keys:1') > ops.indexOf('set keys:0'));
});

test('chave nova de um aparelho (re-pareado) troca no lugar', async () => {
  const keys = keysFor(0, 50);
  const disk = await saved(keys);
  const { vault } = openVault(disk);
  await vault.read();
  const rotated = { ...keys, [idOf(7)]: 'novachave1234567' };
  await vault.write({ session, inventory: inventoryOf(rotated), keys: rotated });
  assert.deepEqual(await reopen(disk), rotated);
});

/** Disco no formato antigo: um item `key:<id>` por aparelho. */
function legacyDisk(keys: Record<string, string>, imported: Record<string, string>) {
  const disk = emptyDisk();
  disk.secrets.set('session', JSON.stringify(session));
  for (const [id, k] of Object.entries({ ...keys, ...imported })) disk.secrets.set(`key:${id}`, k);
  disk.store.set('inventory', [...inventoryOf(keys), ...inventoryOf(imported, 'imported')]);
  return disk;
}

test('macOS com conta: do formato antigo só lê os importados (a sincronização traz o resto)', async () => {
  const keys = keysFor(0, 30);
  const imported = { importado1: 'kimp-56789abcdef' };
  const disk = legacyDisk(keys, imported);
  const { vault, ops } = openVault(disk, { macOS: true });
  const r = await vault.read();
  assert.deepEqual(plain(r.keys), imported);
  assert.deepEqual(ops, ['get session', 'get key:importado1'], 'um pedido, não trinta');

  // a sincronização devolve as chaves; o item antigo lido sai, os outros ficam (apagar pediria senha um a um)
  const all = { ...keys, ...imported };
  await vault.write({ session, inventory: disk.store.get('inventory'), keys: all });
  assert.equal(disk.secrets.has('key:importado1'), false);
  assert.equal(disk.secrets.has(`key:${idOf(0)}`), true);
  assert.deepEqual(await reopen(disk), all);
});

test('fora do macOS: lê tudo do formato antigo (funciona sem internet) e apaga os itens velhos', async () => {
  const keys = keysFor(0, 30);
  const imported = { importado1: 'kimp-56789abcdef' };
  const disk = legacyDisk(keys, imported);
  const { vault } = openVault(disk, { macOS: false });
  const r = await vault.read();
  assert.deepEqual(plain(r.keys), { ...keys, ...imported });
  await vault.write({ session, inventory: disk.store.get('inventory'), keys: r.keys });
  assert.deepEqual([...disk.secrets.keys()].filter((k) => k.startsWith('key:')), []);
  assert.deepEqual(await reopen(disk, { macOS: false }), { ...keys, ...imported });
});

test('logout: a sessão sai e só ficam as chaves dos importados', async () => {
  const keys = keysFor(0, 10);
  const imported = { importado1: 'kimp-56789abcdef' };
  const disk = emptyDisk();
  await openVault(disk).vault.write({ session, inventory: [...inventoryOf(keys), ...inventoryOf(imported, 'imported')], keys: { ...keys, ...imported } });
  const { vault } = openVault(disk);
  await vault.read();
  await vault.write({ session: null, inventory: inventoryOf(imported, 'imported'), keys: imported });
  assert.equal(disk.secrets.has('session'), false);
  assert.deepEqual(await reopen(disk), imported);
});
