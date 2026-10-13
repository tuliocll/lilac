import assert from 'node:assert/strict';
import { test } from 'node:test';
import { irAcCommands, irAcDps, isIrAc } from '../src/cloud/infrared.ts';

// a especificação real de um ar IR (Smart Life, out/2026), já com `values` parseado
const FUNCTIONS = [
  { code: 'F', values: { min: 0, max: 3, scale: 0, step: 1, type: 'Integer' } },
  { code: 'M', values: { min: 0, max: 4, scale: 0, step: 1, type: 'Integer' } },
  { code: 'PowerOff' },
  { code: 'PowerOn' },
  { code: 'T', values: { min: 16, max: 30, scale: 0, step: 1, type: 'Integer' } },
];

test('reconhece o conjunto de instruções de ar IR', () => {
  assert.equal(isIrAc('infrared_ac', FUNCTIONS.map((f) => f.code)), true);
  assert.equal(isIrAc('infrared_ac', ['switch']), false);
  assert.equal(isIrAc('kt', FUNCTIONS.map((f) => f.code)), false);
});

test('comandos viram DPs comuns, com os limites do aparelho', () => {
  const dps = Object.fromEntries(irAcDps(FUNCTIONS).map((d) => [d.code, d]));
  assert.deepEqual(Object.keys(dps), ['power', 'temp', 'mode', 'wind']);
  assert.ok(Object.values(dps).every((d) => d.writable));
  assert.equal(dps.temp!.values!.min, 16);
  assert.equal(dps.temp!.values!.max, 30);
  assert.deepEqual(dps.mode!.values!.range, ['cold', 'hot', 'auto', 'wind', 'wet']);
  assert.deepEqual(dps.wind!.values!.range, ['auto', 'low', 'mid', 'high']);
});

test('ar com menos modos e velocidades: as listas encolhem', () => {
  const dps = irAcDps([{ code: 'PowerOn' }, { code: 'PowerOff' }, { code: 'M', values: { max: 2 } }, { code: 'F', values: { max: 1 } }]);
  assert.deepEqual(dps.find((d) => d.code === 'mode')!.values!.range, ['cold', 'hot', 'auto']);
  assert.deepEqual(dps.find((d) => d.code === 'wind')!.values!.range, ['auto', 'low']);
  assert.equal(dps.some((d) => d.code === 'temp'), false);
});

test('cada mudança vira o comando que a nuvem aceitou no teste real', () => {
  assert.deepEqual(irAcCommands('power', true), [{ code: 'PowerOn', value: 'PowerOn' }]);
  assert.deepEqual(irAcCommands('power', false), [{ code: 'PowerOff', value: 'PowerOff' }]);
  assert.deepEqual(irAcCommands('temp', 23), [{ code: 'T', value: 23 }]);
  assert.deepEqual(irAcCommands('mode', 'cold'), [{ code: 'M', value: 0 }]);
  assert.deepEqual(irAcCommands('mode', 'wet'), [{ code: 'M', value: 4 }]);
  assert.deepEqual(irAcCommands('wind', 'high'), [{ code: 'F', value: 3 }]);
  assert.throws(() => irAcCommands('mode', 'turbo'), /inválido/);
  assert.throws(() => irAcCommands('swing', true), /não tem/);
});
