/**
 * Ares-condicionados LG pela ThinQ Connect, traduzidos para o vocabulário do
 * Lilac: viram DPs comuns (switch, temp_set, temp_current, mode,
 * fan_speed_enum, switch_vertical, eco) — o resto do app usa a mesma página
 * dos ares Tuya e não precisa saber que é LG.
 *
 * Cada modelo declara no perfil o que aceita (modos, faixa e passo da
 * temperatura, velocidades), então os limites vêm sempre do perfil do aparelho.
 * Temperaturas sempre em °C (a entrada em °C de `temperatureInUnits`, mesmo em
 * conta configurada em °F) e em décimos (scale 1): os ares LG andam de 0,5 em 0,5.
 */
import type { CloudCommand, DpSpec } from '@lilac/core';

export const LG_AC_TYPE = 'DEVICE_AIR_CONDITIONER';

/** modo LG ↔ modo Lilac (os rótulos de _common.json), na ordem em que aparecem na página */
const MODES: [lg: string, lilac: string][] = [
  ['COOL', 'cold'],
  ['HEAT', 'hot'],
  ['AUTO', 'auto'],
  ['FAN', 'wind'],
  ['AIR_DRY', 'wet'],
];
const WIND: [lg: string, lilac: string][] = [
  ['AUTO', 'auto'],
  ['LOW', 'low'],
  ['MID', 'mid'],
  ['HIGH', 'high'],
  ['POWER', 'strong'],
];

type Spec = { type?: string; mode?: string[]; value?: { r?: unknown; w?: unknown } };
const writable = (spec: Spec | undefined) => Boolean(spec?.mode?.includes('w'));
const writableValues = (spec: Spec | undefined): unknown[] => (Array.isArray(spec?.value?.w) ? (spec!.value!.w as unknown[]) : []);

/** O alvo que cada modo grava (como a integração oficial do Home Assistant); os demais modos usam o de resfriar. */
const TARGET_BY_MODE: Record<string, string> = { cold: 'coolTargetTemperature', hot: 'heatTargetTemperature', auto: 'autoTargetTemperature' };
const TARGETS = Object.values(TARGET_BY_MODE);

/**
 * A faixa de temperatura em °C: do menor mínimo ao maior máximo entre os alvos
 * de resfriar, aquecer e automático. Sem a entrada em °C, o alvo único de
 * `temperature` — só se o aparelho disser que ele é em °C.
 */
function temperatureRange(property: any): { min: number; max: number; step: number } | null {
  const inC = (property?.temperatureInUnits as any[] | undefined)?.find((t) => t?.unit === 'C');
  const onlyCelsius = JSON.stringify(property?.temperature?.unit?.value?.r) === '["C"]';
  const ranges = (inC ? TARGETS.map((target) => inC[target]) : onlyCelsius ? [property.temperature.targetTemperature] : [])
    .map((spec) => spec?.value?.w)
    .filter((r) => r && Number.isFinite(r.min) && Number.isFinite(r.max));
  if (!ranges.length) return null;
  return {
    min: Math.min(...ranges.map((r) => r.min)),
    max: Math.max(...ranges.map((r) => r.max)),
    step: Math.min(...ranges.map((r) => Number(r.step) || 1)),
  };
}

/** DPs a partir do perfil (`GET devices/{id}/profile`). */
export function lgAcDps(profile: any): DpSpec[] {
  const p = profile?.property ?? {};
  const dps: DpSpec[] = [];
  const dp = (code: string, type: string, values: Record<string, unknown>, canWrite: boolean) =>
    dps.push({ dpId: 0, code, type, values, writable: canWrite });

  const power = p.operation?.airConOperationMode as Spec | undefined;
  if (writableValues(power).includes('POWER_ON')) dp('switch', 'Boolean', {}, true);

  const t = temperatureRange(p);
  if (t) dp('temp_set', 'Integer', { min: tenths(t.min), max: tenths(t.max), step: tenths(t.step), scale: 1, unit: '°C' }, true);
  if (p.temperature?.currentTemperature || p.temperatureInUnits) dp('temp_current', 'Integer', { scale: 1, unit: '°C' }, false);

  const modes = writableValues(p.airConJobMode?.currentJobMode);
  const modeRange = MODES.filter(([lg]) => modes.includes(lg)).map(([, lilac]) => lilac);
  if (modeRange.length) dp('mode', 'Enum', { range: modeRange }, true);

  const winds = writableValues(p.airFlow?.windStrength);
  const windRange = WIND.filter(([lg]) => winds.includes(lg)).map(([, lilac]) => lilac);
  if (windRange.length) dp('fan_speed_enum', 'Enum', { range: windRange }, true);

  if (writable(p.windDirection?.rotateUpDown)) dp('switch_vertical', 'Boolean', {}, true);
  if (writable(p.powerSave?.powerSaveEnabled)) dp('eco', 'Boolean', {}, true);
  return dps;
}

/** Estado (`GET devices/{id}/state`) → valores crus por código, como a nuvem Tuya devolve. */
export function lgAcStatus(state: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const op = state?.operation?.airConOperationMode;
  if (op) out.switch = op === 'POWER_ON';

  const inC = (state?.temperatureInUnits as any[] | undefined)?.find((t) => t?.unit === 'C');
  const temps = inC ?? (state?.temperature?.unit !== 'F' ? state?.temperature : undefined);
  if (Number.isFinite(temps?.targetTemperature)) out.temp_set = tenths(temps.targetTemperature);
  if (Number.isFinite(temps?.currentTemperature)) out.temp_current = tenths(temps.currentTemperature);

  const mode = MODES.find(([lg]) => lg === state?.airConJobMode?.currentJobMode);
  if (mode) out.mode = mode[1];
  const wind = WIND.find(([lg]) => lg === state?.airFlow?.windStrength);
  if (wind) out.fan_speed_enum = wind[1];
  if (typeof state?.windDirection?.rotateUpDown === 'boolean') out.switch_vertical = state.windDirection.rotateUpDown;
  if (typeof state?.powerSave?.powerSaveEnabled === 'boolean') out.eco = state.powerSave.powerSaveEnabled;
  return out;
}

/**
 * Uma mudança de DP → corpo do `POST devices/{id}/control`. A temperatura chega
 * em décimos (como o Lilac guarda), vai em °C e no alvo do modo atual
 * (`mode`, já no vocabulário do Lilac: 'cold', 'hot', 'auto'…).
 */
export function lgAcPayload({ code, value }: CloudCommand, mode?: unknown): object {
  switch (code) {
    case 'switch':
      return { operation: { airConOperationMode: value ? 'POWER_ON' : 'POWER_OFF' } };
    case 'temp_set': {
      const target = TARGET_BY_MODE[String(mode)] ?? TARGET_BY_MODE.cold!;
      return { temperatureInUnits: { [target]: Number(value) / 10, unit: 'C' } };
    }
    case 'mode':
      return { airConJobMode: { currentJobMode: lgName(MODES, value) } };
    case 'fan_speed_enum':
      return { airFlow: { windStrength: lgName(WIND, value) } };
    case 'switch_vertical':
      return { windDirection: { rotateUpDown: Boolean(value) } };
    case 'eco':
      return { powerSave: { powerSaveEnabled: Boolean(value) } };
    default:
      throw new Error(`O ar LG não tem o controle "${code}"`);
  }
}

const tenths = (celsius: number) => Math.round(celsius * 10);

function lgName(table: [string, string][], lilac: unknown): string {
  const hit = table.find(([, l]) => l === lilac);
  if (!hit) throw new Error(`Valor desconhecido para o ar LG: ${String(lilac)}`);
  return hit[0];
}
