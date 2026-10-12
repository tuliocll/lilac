import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unwatch, watch, windowClosed } from '../src/backend/windows.ts';

test('aparelho aberto em duas janelas só é solto quando a última sai', () => {
  watch('luz', 'main');
  watch('luz', 'expanded');
  assert.equal(unwatch('luz', 'main'), false, 'a janela expandida ainda está olhando');
  assert.equal(unwatch('luz', 'expanded'), true);
});

test('fechar a janela solta só os aparelhos que só ela olhava', () => {
  watch('ar', 'expanded');
  watch('tv', 'expanded');
  watch('tv', 'main');
  assert.deepEqual(windowClosed('expanded'), ['ar']);
  assert.equal(unwatch('tv', 'main'), true);
});
