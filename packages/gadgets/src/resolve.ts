/**
 * Do perfil genérico ao aparelho real: escolhe o perfil pela categoria,
 * liga cada controle declarado ao DP que existe e converte valores
 * entre o formato do aparelho e o da tela.
 */
import type { DpSpec } from '@tuyabar/core';
import { decodeColor, encodeColor, type Route } from './color.ts';
import type { CommonLabels, ControlType, GadgetProfile, I18nText, ResolvedControl, ResolvedGadget } from './types.ts';

const WRITE_TYPES: ControlType[] = ['power', 'toggle', 'setpoint', 'slider', 'stepper', 'select', 'buttons', 'text', 'color'];

export function pickProfile(profiles: GadgetProfile[], category: string | undefined, codes: Set<string>): GadgetProfile {
  const candidates = profiles
    .filter((p) => p.match.categories.includes(category ?? '') && (p.match.requiredCodes ?? []).every((c) => codes.has(c)))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return candidates[0] ?? profiles.find((p) => p.id === 'generic')!;
}

/** "cur_power" → "Cur power" — último recurso para DPs sem rótulo. */
export function prettifyCode(code: string): string {
  const s = code.replace(/_/g, ' ').replace(/\b(v\d+)$/, '').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toNumber(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

const labelFor = (code: string, common: CommonLabels): I18nText =>
  common.codes[code] ?? { 'pt-BR': prettifyCode(code), en: prettifyCode(code) };

interface Binding {
  type: ControlType;
  slot: ResolvedControl['slot'];
  label: I18nText;
  icon?: string;
  unit?: string;
  options?: Record<string, I18nText>;
  showWhen?: Record<string, unknown>;
  display?: 'percent';
}

/** Junta o que o perfil pede (`binding`) com o que o DP real oferece (`spec`). */
function bind(spec: DpSpec, binding: Binding, common: CommonLabels, assumeWritable: boolean): ResolvedControl {
  const values = spec.values ?? {};
  const writable = spec.writable || assumeWritable;
  const range = Array.isArray(values.range) ? (values.range as unknown[]).map(String) : undefined;
  const optionLabel = (value: string) => binding.options?.[value] ?? common.options[value] ?? { 'pt-BR': value, en: value };
  return {
    code: spec.code,
    dpId: spec.dpId,
    // sem permissão de escrita, qualquer controle vira leitura
    type: writable || !WRITE_TYPES.includes(binding.type) ? binding.type : 'readout',
    slot: binding.slot,
    label: binding.label,
    icon: binding.icon,
    writable,
    dpType: spec.type,
    min: toNumber(values.min),
    max: toNumber(values.max),
    step: toNumber(values.step),
    scale: toNumber(values.scale) ?? 0,
    unit: binding.unit ?? (typeof values.unit === 'string' && values.unit ? values.unit : undefined),
    options: range?.map((value) => ({ value, label: optionLabel(value) })),
    showWhen: binding.showWhen,
    display: binding.display,
  };
}

function autoType(spec: DpSpec, writable: boolean): ControlType | null {
  const t = spec.type.toLowerCase();
  if (!writable) return ['boolean', 'integer', 'value', 'enum', 'string'].includes(t) ? 'readout' : null;
  if (t === 'boolean' || t === 'bool') return 'toggle';
  if (t === 'integer' || t === 'value') return 'slider';
  if (t === 'enum') return 'select';
  if (t === 'string') return 'text';
  return null; // Raw / Json / Bitmap: fora do escopo da UI genérica
}

/**
 * Casa o perfil com os DPs reais do aparelho: cada controle declarado se liga
 * ao primeiro código presente; DPs que sobram viram controles "avançados".
 */
export function resolveGadget(
  profiles: GadgetProfile[],
  common: CommonLabels,
  device: { category?: string; dps: DpSpec[]; writableKnown?: boolean },
): ResolvedGadget {
  const byCode = new Map(device.dps.map((d) => [d.code, d]));
  const profile = pickProfile(profiles, device.category, new Set(byCode.keys()));
  // Sem a lista de DPs graváveis (a nuvem falhou), só os controles que o perfil
  // declara são tentados como graváveis; os automáticos ficam como leitura.
  const writableKnown = device.writableKnown ?? device.dps.some((d) => d.writable);
  const assumeWritable = !writableKnown && device.dps.length > 0;
  const used = new Set<string>();
  const controls: ResolvedControl[] = [];

  for (const def of profile.controls) {
    const codes = Array.isArray(def.code) ? def.code : [def.code];
    const spec = codes.map((c) => byCode.get(c)).find((s) => s && !used.has(s.code));
    if (!spec) continue;
    used.add(spec.code);
    controls.push(bind(spec, { ...def, label: def.label ?? labelFor(spec.code, common) }, common, assumeWritable));
  }

  for (const spec of device.dps) {
    if (used.has(spec.code)) continue;
    const type = autoType(spec, spec.writable);
    if (!type) continue;
    controls.push(bind(spec, { type, slot: 'advanced', label: labelFor(spec.code, common) }, common, false));
  }

  const { id, name, tone, layout, note } = profile;
  return { profile: { id, name, tone, layout, note }, controls };
}

/**
 * Mantém só os controles cujo DP este aparelho realmente reporta.
 *
 * A especificação da nuvem é por *modelo*; alguns aparelhos (ou firmwares)
 * declaram DPs que nunca usam. `seen` = códigos que apareceram no status da
 * nuvem e/ou na leitura local. Se nada foi visto ainda, não filtra.
 */
export function onlySupported(g: ResolvedGadget, seen: Iterable<string>): ResolvedGadget {
  const set = new Set(seen);
  if (!set.size) return g;
  return { ...g, controls: g.controls.filter((c) => set.has(c.code)) };
}

// --------------------------------------------------------------- valores

type Convertible = Pick<ResolvedControl, 'code' | 'type' | 'scale' | 'dpType' | 'min' | 'max' | 'step'>;

/** Valor bruto do aparelho → valor de tela (escala aplicada; cor vira { h, s, v }). */
export function toDisplay(c: Convertible, raw: unknown): unknown {
  if (c.type === 'color') return decodeColor(c.code, raw);
  if (typeof raw === 'number' && c.scale > 0) return raw / 10 ** c.scale;
  return raw;
}

/** Valor de tela → bruto, respeitando min/max/step. `route` importa para cor (local e nuvem escrevem diferente). */
export function toRaw(c: Convertible, value: unknown, route: Route = 'local'): unknown {
  if (c.type === 'color') return encodeColor(c.code, value as { h: number; s: number; v: number }, route);
  const t = c.dpType.toLowerCase();
  if (t === 'boolean' || t === 'bool') return value === true || value === 'true' || value === 1;
  if (t === 'integer' || t === 'value') {
    if (!Number.isFinite(Number(value))) throw new Error(`valor inválido para ${c.code}: ${value}`);
    let n = Math.round(Number(value) * 10 ** c.scale);
    if (c.step && c.step > 1) n = Math.round(n / c.step) * c.step;
    if (c.min !== undefined) n = Math.max(c.min, n);
    if (c.max !== undefined) n = Math.min(c.max, n);
    return n;
  }
  return String(value);
}
