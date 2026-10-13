/**
 * Estado lembrado de aparelhos que não informam o próprio estado (ares por
 * infravermelho): guardamos o último valor que o app enviou. Se alguém usar o
 * controle remoto físico, isto fica desatualizado — a página avisa.
 */
import { IR_AC_CATEGORY, type CloudDevice } from '@lilac/core';
import { app } from './app.ts';

type Values = Record<string, unknown>;

const KEY = 'rememberedState';
let state: Record<string, Values> = {};

/** Este aparelho só tem o estado que o app lembra? */
export const remembersState = (device: CloudDevice) => device.category === IR_AC_CATEGORY;

export async function loadRemembered() {
  const saved = await app().store.get(KEY).catch(() => null);
  state = saved && typeof saved === 'object' ? (saved as Record<string, Values>) : {};
}

export const rememberedValues = (id: string): Values => ({ ...state[id] });

export function remember(id: string, values: Values) {
  state = { ...state, [id]: { ...values } };
  app().store.set(KEY, state).catch(() => {});
}
