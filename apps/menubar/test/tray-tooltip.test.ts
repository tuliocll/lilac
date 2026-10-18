/** Tooltip do ícone da bandeja: o estado dos favoritos numa linha só. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOLTIP_MAX, trayTooltip } from '../src/backend/tray-tooltip.ts';

const words = { on: 'ligado', off: 'desligado' };

test('sem favoritos, só o nome do app', () => {
  assert.equal(trayTooltip([], words), 'Lilac');
});

test('estado e leitura; desligado esconde a leitura; sem estado conhecido, só o nome', () => {
  const text = trayTooltip(
    [
      { name: 'Ar escritório', power: true, reading: '23 °C' },
      { name: 'Luz garagem', power: false, reading: '80 %' },
      { name: 'Sensor sala', reading: '24,5 °C' },
      { name: 'Gateway' },
    ],
    words,
  );
  assert.equal(text, 'Ar escritório: ligado, 23 °C · Luz garagem: desligado · Sensor sala: 24,5 °C · Gateway');
});

test('o que não cabe vira +N, sem passar do limite do Windows', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ name: `Tomada ${i + 1}`, power: i % 2 === 0 }));
  const text = trayTooltip(many, words);
  assert.ok(text.length <= TOOLTIP_MAX, text);
  assert.match(text, /^Tomada 1: ligado · .* · \+\d+$/);
  const shown = text.split(' · ').filter((p) => !p.startsWith('+')).length;
  assert.equal(Number(text.match(/\+(\d+)$/)![1]) + shown, 12);
});

test('um nome enorme é cortado com reticências', () => {
  const text = trayTooltip([{ name: 'x'.repeat(300), power: true }], words);
  assert.equal(text.length, TOOLTIP_MAX);
  assert.ok(text.endsWith('…'));
});
