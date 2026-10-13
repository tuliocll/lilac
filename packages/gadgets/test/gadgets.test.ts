import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { DpSpec } from '@lilac/core';
import { COMMON, decodeColor, encodeColor, onlySupported, PROFILES, resolve, toDisplay, toRaw } from '../src/index.ts';

const LANGS = ['pt-BR', 'en'];
const TONES = ['sun', 'sky', 'mint', 'peach', 'lilac', 'pink', 'neutral'];
const ICONS = join(import.meta.dirname, '../../../apps/menubar/src/frontend/icons');

test('registry.gen.ts está em dia com gadgets/', () => {
  execFileSync('node', [join(import.meta.dirname, '../scripts/build.mjs'), '--check']);
});

test('todo gadget tem nome nos dois idiomas, tom válido, ícone e controles conhecidos', () => {
  assert.ok(PROFILES.some((p) => p.id === 'generic'), 'precisa existir o perfil generic');
  for (const p of PROFILES) {
    for (const l of LANGS) assert.ok(p.name[l], `${p.id}: name.${l}`);
    if (p.note) for (const l of LANGS) assert.ok(p.note[l], `${p.id}: note.${l}`);
    assert.ok(TONES.includes(p.tone), `${p.id}: tone ${p.tone}`);
    assert.ok(p.iconSvg?.startsWith('<svg'), `${p.id}: falta icon.svg`);
    assert.doesNotMatch(JSON.stringify(p.controls), /#[0-9a-f]{3,8}\b/i, `${p.id}: cor literal — use "tone"`);
    for (const c of p.controls) {
      if (c.icon) assert.ok(existsSync(join(ICONS, `${c.icon}.svg`)), `${p.id}: ícone de controle "${c.icon}" não existe em icons/`);
      if (c.label) for (const l of LANGS) assert.ok(c.label[l], `${p.id}/${c.code}: label.${l}`);
      for (const [v, t] of Object.entries(c.options ?? {})) for (const l of LANGS) assert.ok(t[l], `${p.id}/${c.code}: opção ${v}.${l}`);
    }
  }
  for (const [k, t] of [...Object.entries(COMMON.codes), ...Object.entries(COMMON.options)])
    for (const l of LANGS) assert.ok(t[l], `_common: ${k}.${l}`);
});

const dp = (dpId: number, code: string, type: string, values: Record<string, unknown> = {}, writable = true): DpSpec => ({ dpId, code, type, values, writable });

test('ar-condicionado: perfil climate, slots e escala', () => {
  const g = resolve({
    category: 'kt',
    dps: [
      dp(1, 'switch', 'Boolean'),
      dp(2, 'temp_set', 'Integer', { min: 160, max: 320, scale: 1, step: 10, unit: '℃' }),
      dp(3, 'temp_current', 'Integer', { min: -20, max: 50, scale: 0 }, false),
      dp(4, 'mode', 'Enum', { range: ['cold', 'hot', 'wind'] }),
      dp(5, 'windspeed', 'Enum', { range: ['low', 'high'] }),
      dp(101, 'mystery_flag', 'Boolean'),
      dp(102, 'raw_blob', 'Raw'),
    ],
  });
  assert.equal(g.profile.id, 'climate');
  const by = Object.fromEntries(g.controls.map((c) => [c.code, c]));
  assert.equal(by.switch!.slot, 'header');
  assert.equal(by.temp_set!.type, 'setpoint');
  assert.equal(by.temp_set!.unit, '°C', 'unidade do perfil vence a do DP');
  assert.equal(by.temp_current!.slot, 'aside');
  assert.equal(by.windspeed!.slot, 'chips', 'código alternativo');
  assert.deepEqual(by.mode!.options!.map((o) => o.label['pt-BR']), ['Frio', 'Quente', 'Ventilar']);
  assert.equal(by.mystery_flag!.slot, 'advanced');
  assert.equal(by.mystery_flag!.type, 'toggle');
  assert.equal(by.raw_blob, undefined, 'Raw não vira controle');

  assert.equal(toDisplay(by.temp_set!, 225), 22.5);
  assert.equal(toRaw(by.temp_set!, 22.4), 220, 'arredonda para o step');
  assert.equal(toRaw(by.temp_set!, 99), 320, 'respeita o máximo');
});

test('DP sem escrita vira leitura; categoria desconhecida cai no generic', () => {
  const g = resolve({ category: 'xyz', dps: [dp(1, 'switch', 'Boolean', {}, true), dp(2, 'level', 'Integer', {}, false)] });
  assert.equal(g.profile.id, 'generic');
  assert.equal(g.controls.find((c) => c.code === 'level')!.type, 'readout');
});

test('disjuntor (tdq) usa o perfil switch com leituras de energia', () => {
  const g = resolve({
    category: 'tdq',
    dps: [dp(1, 'switch_1', 'Boolean'), dp(19, 'cur_power', 'Integer', { scale: 1, unit: 'W' }, false), dp(20, 'cur_voltage', 'Integer', { scale: 1, unit: 'V' }, false)],
  });
  assert.equal(g.profile.id, 'switch');
  assert.equal(g.controls.find((c) => c.code === 'switch_1')!.type, 'power');
  assert.equal(g.controls.filter((c) => c.slot === 'readouts').length, 2);
});

test('dois ares diferentes: cada um só ganha os controles dos seus DPs', () => {
  const base = [dp(1, 'switch', 'Boolean'), dp(2, 'temp_set', 'Integer', { min: 16, max: 30 }), dp(4, 'mode', 'Enum', { range: ['cold', 'wind'] })];
  const simples = resolve({ category: 'kt', dps: base });
  const completo = resolve({
    category: 'kt',
    dps: [...base, dp(5, 'windspeed', 'Enum', { range: ['low', 'high'] }), dp(8, 'sleep', 'Boolean'), dp(20, 'eco', 'Boolean')],
  });
  assert.deepEqual(simples.controls.map((c) => c.code).sort(), ['mode', 'switch', 'temp_set']);
  assert.deepEqual(completo.controls.map((c) => c.code).sort(), ['eco', 'mode', 'sleep', 'switch', 'temp_set', 'windspeed']);
  // as opções também são as do aparelho, não uma lista genérica
  assert.deepEqual(simples.controls.find((c) => c.code === 'mode')!.options!.map((o) => o.value), ['cold', 'wind']);
});

test('onlySupported remove DPs que o modelo declara mas este aparelho nunca reportou', () => {
  const g = resolve({ category: 'kt', dps: [dp(1, 'switch', 'Boolean'), dp(8, 'sleep', 'Boolean'), dp(20, 'eco', 'Boolean')] });
  assert.deepEqual(onlySupported(g, ['switch', 'sleep']).controls.map((c) => c.code), ['switch', 'sleep']);
  assert.equal(onlySupported(g, []).controls.length, 3, 'sem nada visto ainda, não filtra');
});

test('sem lista de graváveis: perfil tenta escrever, extras ficam só leitura', () => {
  const g = resolve({ category: 'kt', writableKnown: false, dps: [dp(1, 'switch', 'Boolean', {}, false), dp(99, 'mystery', 'Boolean', {}, false)] });
  assert.equal(g.controls.find((c) => c.code === 'switch')!.type, 'power');
  assert.equal(g.controls.find((c) => c.code === 'mystery')!.type, 'readout');
});

test('cor: local em hex, nuvem em JSON, ida e volta', () => {
  const red = { h: 0, s: 1, v: 1 };
  assert.equal(encodeColor('colour_data_v2', red, 'local'), '000003e803e8');
  assert.equal(encodeColor('colour_data_v2', { h: 240, s: 0.5, v: 0.25 }, 'cloud'), '{"h":240,"s":500,"v":250}');
  assert.deepEqual(decodeColor('colour_data_v2', '00f001f400fa'), { h: 240, s: 0.5, v: 0.25 });
  assert.deepEqual(decodeColor('colour_data_v2', '{"h":240,"s":500,"v":250}'), { h: 240, s: 0.5, v: 0.25 });
  assert.equal(encodeColor('colour_data', red, 'local'), 'ff00000000ffff');
  assert.deepEqual(decodeColor('colour_data', 'ff00000000ffff'), red);
  assert.equal(decodeColor('colour_data_v2', 'lixo'), null);
});

test('lâmpada colorida ganha controle de cor que só aparece no modo cor', () => {
  const g = resolve({ category: 'dj', dps: [dp(20, 'switch_led', 'Boolean'), dp(21, 'work_mode', 'Enum', { range: ['white', 'colour'] }), dp(24, 'colour_data_v2', 'Json')] });
  const color = g.controls.find((c) => c.code === 'colour_data_v2')!;
  assert.equal(color.type, 'color');
  assert.deepEqual(color.showWhen, { work_mode: 'colour' });
  assert.deepEqual(toDisplay(color, '000003e803e8'), { h: 0, s: 1, v: 1 });
  assert.equal(toRaw(color, { h: 0, s: 1, v: 1 }, 'cloud'), '{"h":0,"s":1000,"v":1000}');
});

test('ar por infravermelho usa o perfil de clima com os códigos da nuvem', () => {
  const g = resolve({ category: 'infrared_ac', dps: [dp(0, 'power', 'Boolean'), dp(0, 'temp', 'Integer', { min: 16, max: 30 }), dp(0, 'wind', 'Enum', { range: ['0', '1', '2'] })] });
  assert.equal(g.profile.id, 'climate');
  const types = Object.fromEntries(g.controls.map((c) => [c.code, [c.type, c.slot]]));
  assert.deepEqual(types, { power: ['power', 'header'], temp: ['setpoint', 'hero'], wind: ['select', 'chips'] });
});

test('ar IR: os DPs traduzidos montam a página de ar completa e gravável', async () => {
  const { irAcDps } = await import('@lilac/core');
  const dps = irAcDps([{ code: 'PowerOn' }, { code: 'PowerOff' }, { code: 'T', values: { min: 16, max: 30 } }, { code: 'M', values: { max: 4 } }, { code: 'F', values: { max: 3 } }]);
  const g = resolve({ category: 'infrared_ac', dps, writableKnown: true });
  assert.equal(g.profile.id, 'climate');
  const byCode = Object.fromEntries(g.controls.map((c) => [c.code, c]));
  assert.equal(byCode.power!.type, 'power');
  assert.equal(byCode.temp!.type, 'setpoint');
  assert.equal(byCode.temp!.min, 16);
  assert.equal(byCode.mode!.type, 'select');
  assert.equal(byCode.wind!.type, 'select');
  assert.equal(byCode.wind!.options!.length, 4);
  assert.ok(g.controls.every((c) => c.writable));
  // valores de tela → brutos que irAcCommands espera
  assert.equal(toRaw(byCode.temp!, 23, 'cloud'), 23);
  assert.equal(toRaw(byCode.mode!, 'cold', 'cloud'), 'cold');
  assert.equal(toRaw(byCode.power!, true, 'cloud'), true);
});
