/**
 * Contrato da interface: temas e idiomas.
 * Estes testes existem para que toda tela nova suporte tema e tradução
 * desde o primeiro commit — se falhar, leia THEMING.md.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const app = join(import.meta.dirname, '..');
const front = join(app, 'src', 'frontend');
const read = (p: string) => readFileSync(join(front, p), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const tokens = Object.keys(JSON.parse(read('themes/tokens.json')).tokens);
// variáveis internas (não são do tema)
const INTERNAL = [/^--glyph$/, /^--tone$/, /^--fill$/, /^--link-dot$/, /^--i-/];

const themeDirs = readdirSync(join(front, 'themes')).filter((d) => existsSync(join(front, 'themes', d, 'theme.css')));

const uiScripts = ['app.js', 'config.js', ...readdirSync(join(front, 'ui')).map((f) => `ui/${f}`)];

test('existem os temas moonlight, past-dream e contrast', () => {
  for (const id of ['moonlight', 'past-dream', 'contrast']) assert.ok(themeDirs.includes(id), id);
});

for (const id of themeDirs) {
  test(`tema ${id}: define todos os tokens do contrato`, () => {
    const css = stripComments(read(`themes/${id}/theme.css`));
    const selector = id === 'moonlight' ? /:root,\s*\[data-theme="moonlight"\]\s*\{/ : new RegExp(`\\[data-theme="${id}"\\]\\s*\\{`);
    assert.match(css, selector, `o bloco de tokens precisa do seletor [data-theme="${id}"]`);
    const missing = tokens.filter((t) => !new RegExp(`${t.replace(/[-]/g, '\\-')}\\s*:`).test(css));
    assert.deepEqual(missing, [], `tokens faltando em ${id}`);
  });
}

test('base.css só usa tokens do contrato', () => {
  const css = stripComments(read('base.css'));
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!));
  const unknown = [...used].filter((v) => !tokens.includes(v) && !INTERNAL.some((r) => r.test(v)));
  assert.deepEqual(unknown, [], 'adicione estes tokens em themes/tokens.json e em todos os temas');
});

test('nada de cor literal fora dos temas (base.css, index.html, *.js da interface)', () => {
  const COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black)\b(?![-\w])/i;
  for (const f of ['base.css', 'index.html', ...uiScripts]) {
    const src = f.endsWith('.css') ? stripComments(read(f)) : read(f).replace(/\/\/.*$/gm, '');
    const lines = src.split('\n').filter((l) => COLOR.test(l));
    assert.deepEqual(lines, [], `${f}: use um token do tema em vez de cor literal`);
  }
});

test('ícones e fontes embutidos estão em dia (npm run assets)', () => {
  execFileSync('node', [join(app, 'scripts', 'build-assets.mjs'), '--check']);
});

// ------------------------------------------------------------------ i18n

function loadI18n() {
  const ctx: any = { Lilac: {}, navigator: { languages: ['pt-BR'] }, document: {} };
  vm.runInNewContext(read('ui/i18n.js'), ctx);
  return ctx.Lilac.i18n as { DICT: Record<string, Record<string, string>>; LANGS: string[] };
}

test('todos os idiomas têm exatamente as mesmas chaves', () => {
  const { DICT, LANGS } = loadI18n();
  assert.ok(LANGS.includes('pt-BR') && LANGS.includes('en'));
  const base = Object.keys(DICT['pt-BR']!).sort();
  for (const l of LANGS) assert.deepEqual(Object.keys(DICT[l]!).sort(), base, `idioma ${l}`);
  for (const l of LANGS) for (const [k, v] of Object.entries(DICT[l]!)) assert.ok(v.trim(), `${l}: ${k} vazio`);
});

test('toda chave usada na interface existe no dicionário', () => {
  const { DICT } = loadI18n();
  const keys = new Set(Object.keys(DICT['pt-BR']!));
  const html = read('index.html');
  const used = new Set<string>();
  for (const m of html.matchAll(/data-i18n(?:-html|-placeholder|-title|-aria)?="([^"]+)"/g)) used.add(m[1]!);
  for (const f of uiScripts) for (const m of read(f).matchAll(/\b(?:t|show)\('([a-zA-Z0-9.]+)'/g)) used.add(m[1]!);
  // chaves montadas dinamicamente: device.reason.<motivo> e device.why.<motivo>
  for (const r of ['offline', 'sub', 'nokey', 'version', 'error', 'unknown', 'auth']) used.add(`device.reason.${r}`);
  for (const r of ['offline', 'sub', 'nokey', 'version', 'error']) used.add(`device.why.${r}`);
  const missing = [...used].filter((k) => !keys.has(k));
  assert.deepEqual(missing, []);
});

test('texto visível no HTML vem do dicionário (sem texto solto)', () => {
  const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|title)[\s\S]*?<\/\1>/g, '');
  // texto entre tags que não está num elemento com data-i18n
  const loose = [...html.matchAll(/>([^<>]*[A-Za-zÀ-ú]{3,}[^<>]*)</g)]
    .map((m) => m[1]!.trim())
    .filter((t) => t && !['Lilac'].includes(t));
  assert.deepEqual(loose, [], 'use data-i18n="chave" em vez de texto fixo');
});

test('temas embutidos descrevem-se nos dois idiomas e têm pasta', () => {
  const ctx: any = { Lilac: {} };
  vm.runInNewContext(read('themes/index.js'), ctx);
  for (const t of ctx.Lilac.builtinThemes) {
    assert.ok(t.description['pt-BR'] && t.description.en, `tema ${t.id}`);
    assert.ok(themeDirs.includes(t.id), `tema ${t.id} sem pasta`);
  }
});

test('o motivo que o backend devolve sempre tem texto na interface', () => {
  const { DICT } = loadI18n();
  const control = readFileSync(join(app, 'src', 'backend', 'control.ts'), 'utf8');
  const reasons = control.match(/export type Reason = ([^;]+);/)![1]!.match(/'([a-z]+)'/g)!.map((r) => r.slice(1, -1));
  for (const r of reasons) assert.ok(DICT['pt-BR']![`device.reason.${r}`], `device.reason.${r}`);
});

test('todo $("id") usado nos scripts existe no index.html', () => {
  const ids = new Set([...read('index.html').matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const missing = uiScripts.flatMap((f) => [...read(f).matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]!)).filter((id) => !ids.has(id));
  assert.deepEqual([...new Set(missing)], []);
});
