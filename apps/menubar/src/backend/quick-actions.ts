/**
 * Ações rápidas: até 3 botões por aparelho direto na lista.
 *
 *   { code: 'switch_1', mode: 'toggle' }          alterna um liga/desliga
 *   { code: 'mode', mode: 'set', value: 'cold' }  fixa um valor ("Modo: Frio", "22 °C")
 *
 * Sem escolha salva, o aparelho ganha o liga/desliga principal (se tiver).
 * Uma lista vazia salva significa "o usuário tirou todas" — respeitamos.
 */
import type { ResolvedControl, ResolvedGadget } from '@lilac/gadgets';
import { app } from './app.ts';

export interface QuickAction {
  code: string;
  mode: 'toggle' | 'set';
  value?: unknown;
}

export const MAX_QUICK_ACTIONS = 3;

/** controles que fazem sentido como botão de um clique */
const TOGGLEABLE = new Set<ResolvedControl['type']>(['power', 'toggle']);
const SETTABLE = new Set<ResolvedControl['type']>(['select', 'buttons', 'setpoint', 'slider', 'stepper']);

let saved: Record<string, QuickAction[]> = {};

export async function loadQuickActions() {
  const stored = await app().store.get('quickActions').catch(() => null);
  saved = stored && typeof stored === 'object' ? (stored as Record<string, QuickAction[]>) : {};
}

/** As ações do aparelho, só as que ainda batem com os controles dele. */
export function quickActionsFor(id: string, gadget: ResolvedGadget): QuickAction[] {
  const chosen = saved[id] ?? defaultActions(gadget);
  return chosen.filter((action) => isValid(action, gadget)).slice(0, MAX_QUICK_ACTIONS);
}

export async function saveQuickActions(id: string, actions: QuickAction[], gadget: ResolvedGadget) {
  saved = { ...saved, [id]: actions.filter((a) => isValid(a, gadget)).slice(0, MAX_QUICK_ACTIONS) };
  await app().store.set('quickActions', saved).catch(() => {});
  return saved[id]!;
}

/** Como uma ação pode ser montada a partir de um controle (null = não serve). */
export function quickModeFor(control: ResolvedControl): QuickAction['mode'] | null {
  if (!control.writable) return null;
  if (TOGGLEABLE.has(control.type)) return 'toggle';
  if (SETTABLE.has(control.type)) return 'set';
  return null;
}

function defaultActions(gadget: ResolvedGadget): QuickAction[] {
  const power = gadget.controls.find((c) => c.type === 'power' && c.writable);
  return power ? [{ code: power.code, mode: 'toggle' }] : [];
}

function isValid(action: QuickAction, gadget: ResolvedGadget) {
  const control = gadget.controls.find((c) => c.code === action?.code);
  if (!control || quickModeFor(control) !== action.mode) return false;
  return action.mode === 'toggle' || action.value !== undefined;
}
