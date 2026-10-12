import type { DpSpec } from '@tuyabar/core';
import type { CommonLabels, ControlType, GadgetProfile, I18nText, ResolvedControl, ResolvedGadget } from './types.ts';

const WRITE_TYPES: ControlType[] = ['power', 'toggle', 'setpoint', 'slider', 'stepper', 'select', 'buttons', 'text'];

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

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function bind(
  spec: DpSpec,
  type: ControlType,
  slot: ResolvedControl['slot'],
  label: I18nText,
  common: CommonLabels,
  extra: { icon?: string; unit?: string; options?: Record<string, I18nText>; showWhen?: Record<string, unknown>; display?: 'percent' },
  assumeWritable: boolean,
): ResolvedControl {
  const v = spec.values ?? {};
  const writable = spec.writable || assumeWritable;
  const range = Array.isArray(v.range) ? (v.range as unknown[]).map(String) : undefined;
  return {
    code: spec.code,
    dpId: spec.dpId,
    // sem permissão de escrita, qualquer controle vira leitura
    type: writable || !WRITE_TYPES.includes(type) ? type : 'readout',
    slot,
    label,
    icon: extra.icon,
    writable,
    dpType: spec.type,
    min: num(v.min),
    max: num(v.max),
    step: num(v.step),
    scale: num(v.scale) ?? 0,
    unit: extra.unit ?? (typeof v.unit === 'string' && v.unit ? v.unit : undefined),
    options: range?.map((value) => ({ value, label: extra.options?.[value] ?? common.options[value] ?? { 'pt-BR': value, en: value } })),
    showWhen: extra.showWhen,
    display: extra.display,
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
  device: { category?: string; dps: DpSpec[] },
): ResolvedGadget {
  const byCode = new Map(device.dps.map((d) => [d.code, d]));
  const profile = pickProfile(profiles, device.category, new Set(byCode.keys()));
  // sem especificação de escrita (nuvem falhou?), tenta tudo como gravável
  const assumeWritable = device.dps.length > 0 && device.dps.every((d) => !d.writable);
  const used = new Set<string>();
  const controls: ResolvedControl[] = [];

  for (const def of profile.controls) {
    const codes = Array.isArray(def.code) ? def.code : [def.code];
    const spec = codes.map((c) => byCode.get(c)).find((s) => s && !used.has(s.code));
    if (!spec) continue;
    used.add(spec.code);
    const label = def.label ?? common.codes[spec.code] ?? { 'pt-BR': prettifyCode(spec.code), en: prettifyCode(spec.code) };
    controls.push(bind(spec, def.type, def.slot, label, common, def, assumeWritable));
  }

  for (const spec of device.dps) {
    if (used.has(spec.code)) continue;
    const writable = spec.writable || assumeWritable;
    const type = autoType(spec, writable);
    if (!type) continue;
    const label = common.codes[spec.code] ?? { 'pt-BR': prettifyCode(spec.code), en: prettifyCode(spec.code) };
    controls.push(bind(spec, type, 'advanced', label, common, {}, assumeWritable));
  }

  const { id, name, tone, layout, note } = profile;
  return { profile: { id, name, tone, layout, note }, controls };
}

// --------------------------------------------------------------- valores

/** bruto do aparelho → valor de tela (aplica escala). */
export function toDisplay(c: Pick<ResolvedControl, 'scale' | 'dpType'>, raw: unknown): unknown {
  if (typeof raw === 'number' && c.scale > 0) return raw / 10 ** c.scale;
  return raw;
}

/** valor de tela → bruto, respeitando min/max/step. */
export function toRaw(c: Pick<ResolvedControl, 'scale' | 'dpType' | 'min' | 'max' | 'step'>, value: unknown): unknown {
  const t = c.dpType.toLowerCase();
  if (t === 'boolean' || t === 'bool') return value === true || value === 'true' || value === 1;
  if (t === 'integer' || t === 'value') {
    let n = Math.round(Number(value) * 10 ** c.scale);
    if (c.step && c.step > 1) n = Math.round(n / c.step) * c.step;
    if (c.min !== undefined) n = Math.max(c.min, n);
    if (c.max !== undefined) n = Math.min(c.max, n);
    return n;
  }
  return String(value);
}

export function pickText(t: I18nText | undefined, lang: string): string {
  if (!t) return '';
  return t[lang] ?? t[lang.split('-')[0]!] ?? t['en'] ?? t['pt-BR'] ?? Object.values(t)[0] ?? '';
}
