/**
 * Tradução ar LG ↔ Lilac, com perfis e estados reais (out/2026) de dois modelos:
 *   CST_570004_WW — cassete: turbo ("POWER") e aleta esquerda/direita
 *   RAC_056905_WW — split: sem turbo, só aleta cima/baixo
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { lgAcDps, lgAcPayload, lgAcStatus } from '../src/index.ts';

const fixture = (name: string) => JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', `ac-${name}.json`), 'utf8'));
const cst = fixture('cst');
const rac = fixture('rac');
const byCode = (profile: unknown) => Object.fromEntries(lgAcDps(profile).map((d) => [d.code, d]));

test('perfil vira os DPs da página de ar-condicionado', () => {
  const dps = byCode(cst.profile);
  assert.deepEqual(Object.keys(dps), ['switch', 'temp_set', 'temp_current', 'mode', 'fan_speed_enum', 'switch_vertical', 'eco']);
  // 16–30 °C de 0,5 em 0,5, guardado em décimos
  assert.deepEqual(dps.temp_set!.values, { min: 160, max: 300, step: 5, scale: 1, unit: '°C' });
  assert.equal(dps.temp_current!.writable, false);
  assert.deepEqual(dps.mode!.values, { range: ['cold', 'hot', 'auto', 'wind', 'wet'] });
});

test('cada modelo mostra só o que aceita: o split não tem turbo', () => {
  assert.deepEqual(byCode(cst.profile).fan_speed_enum!.values, { range: ['auto', 'low', 'mid', 'high', 'strong'] });
  assert.deepEqual(byCode(rac.profile).fan_speed_enum!.values, { range: ['auto', 'low', 'mid', 'high'] });
});

test('estado real vira valores crus por código', () => {
  const s = lgAcStatus(cst.state);
  assert.equal(s.switch, false);
  assert.equal(s.mode, 'cold');
  assert.equal(typeof s.temp_set, 'number');
  assert.equal(Number.isInteger(s.temp_set), true, 'em décimos');
  assert.equal(s.temp_set, Math.round(cst.state.temperatureInUnits.find((t: any) => t.unit === 'C').targetTemperature * 10));
  assert.ok(['auto', 'low', 'mid', 'high', 'strong'].includes(s.fan_speed_enum as string));
  assert.equal(typeof s.switch_vertical, 'boolean');
});

test('temperatura vai no alvo do modo atual (como o Home Assistant); ventilar e secar usam o de resfriar', () => {
  const at = (mode?: string) => Object.keys((lgAcPayload({ code: 'temp_set', value: 200 }, mode) as any).temperatureInUnits)[0];
  assert.equal(at('cold'), 'coolTargetTemperature');
  assert.equal(at('hot'), 'heatTargetTemperature');
  assert.equal(at('auto'), 'autoTargetTemperature');
  assert.equal(at('wind'), 'coolTargetTemperature');
  assert.equal(at(undefined), 'coolTargetTemperature');
});

test('faixa da temperatura: do menor mínimo ao maior máximo entre os modos, sempre em °C', () => {
  // no cassete, automático vai de 18 a 30; resfriar e aquecer de 16 a 30
  assert.deepEqual(byCode(cst.profile).temp_set!.values, { min: 160, max: 300, step: 5, scale: 1, unit: '°C' });
  // conta em °F: o `temperature` antigo vem em °F e não pode virar a faixa em °C
  const fahrenheitOnly = {
    property: {
      temperature: { unit: { type: 'enum', mode: ['r'], value: { r: ['F'] } }, targetTemperature: { type: 'range', mode: ['r', 'w'], value: { w: { min: 60, max: 86, step: 1 } } } },
    },
  };
  assert.equal(byCode(fahrenheitOnly).temp_set, undefined);
});

test('só a temperatura em °C entra, mesmo com a lista em °F junto', () => {
  const s = lgAcStatus({
    temperatureInUnits: [
      { currentTemperature: 77, targetTemperature: 70, unit: 'F' },
      { currentTemperature: 25.5, targetTemperature: 22.5, unit: 'C' },
    ],
  });
  assert.deepEqual(s, { temp_set: 225, temp_current: 255 });
});

test('mudanças viram o corpo do comando da LG', () => {
  assert.deepEqual(lgAcPayload({ code: 'switch', value: true }), { operation: { airConOperationMode: 'POWER_ON' } });
  assert.deepEqual(lgAcPayload({ code: 'temp_set', value: 225 }, 'cold'), { temperatureInUnits: { coolTargetTemperature: 22.5, unit: 'C' } });
  assert.deepEqual(lgAcPayload({ code: 'mode', value: 'wet' }), { airConJobMode: { currentJobMode: 'AIR_DRY' } });
  assert.deepEqual(lgAcPayload({ code: 'fan_speed_enum', value: 'strong' }), { airFlow: { windStrength: 'POWER' } });
  assert.deepEqual(lgAcPayload({ code: 'switch_vertical', value: false }), { windDirection: { rotateUpDown: false } });
  assert.deepEqual(lgAcPayload({ code: 'eco', value: true }), { powerSave: { powerSaveEnabled: true } });
  assert.throws(() => lgAcPayload({ code: 'sleep', value: true }));
  assert.throws(() => lgAcPayload({ code: 'mode', value: 'turbo' }));
});
