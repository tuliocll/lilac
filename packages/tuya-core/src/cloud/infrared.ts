/**
 * Ares-condicionados por infravermelho (controles virtuais criados no Smart Life).
 *
 * A nuvem fala com eles por um "conjunto de instruções" próprio, igual para
 * qualquer marca de ar e qualquer emissor:
 *
 *   PowerOn / PowerOff   liga, desliga (o valor é o próprio nome)
 *   T                    temperatura (ex.: 16–30)
 *   M                    modo:  0 frio · 1 quente · 2 auto · 3 ventilar · 4 secar
 *   F                    vento: 0 auto · 1 baixo · 2 médio · 3 alto
 *
 * e não informa estado nenhum. Aqui esses comandos viram DPs comuns
 * (power, temp, mode, wind) — o resto do app não precisa saber que é IR —
 * e cada mudança vira o comando certo.
 */
import type { CloudCommand, DpSpec } from './sharing.ts';

export const IR_AC_CATEGORY = 'infrared_ac';

/** Na ordem dos números que a Tuya usa em `M` e `F`. */
const MODES = ['cold', 'hot', 'auto', 'wind', 'wet'];
const WIND = ['auto', 'low', 'mid', 'high'];

/** A especificação tem o conjunto de instruções de ar IR? */
export function isIrAc(category: string | undefined, functionCodes: Iterable<string>): boolean {
  const codes = new Set(functionCodes);
  return category === IR_AC_CATEGORY && codes.has('PowerOn') && codes.has('PowerOff');
}

/**
 * DPs "normais" a partir das funções da especificação. Os limites (temperatura
 * mínima/máxima, quantos modos, quantas velocidades) vêm de cada aparelho.
 */
export function irAcDps(functions: { code: string; values?: Record<string, unknown> }[]): DpSpec[] {
  const byCode = new Map(functions.map((f) => [f.code, f.values ?? {}]));
  const max = (code: string, fallback: number) => {
    const n = Number(byCode.get(code)?.max);
    return Number.isFinite(n) ? n : fallback;
  };
  const dps: DpSpec[] = [{ dpId: 0, code: 'power', type: 'Boolean', values: {}, writable: true }];
  if (byCode.has('T')) {
    const t = byCode.get('T')!;
    dps.push({ dpId: 0, code: 'temp', type: 'Integer', values: { min: t.min ?? 16, max: t.max ?? 30, step: 1, scale: 0, unit: '°C' }, writable: true });
  }
  if (byCode.has('M')) dps.push({ dpId: 0, code: 'mode', type: 'Enum', values: { range: MODES.slice(0, max('M', 4) + 1) }, writable: true });
  if (byCode.has('F')) dps.push({ dpId: 0, code: 'wind', type: 'Enum', values: { range: WIND.slice(0, max('F', 3) + 1) }, writable: true });
  return dps;
}

/** Uma mudança de DP → o comando que a nuvem entende. */
export function irAcCommands(code: string, value: unknown): CloudCommand[] {
  switch (code) {
    case 'power':
      return value ? [{ code: 'PowerOn', value: 'PowerOn' }] : [{ code: 'PowerOff', value: 'PowerOff' }];
    case 'temp':
      return [{ code: 'T', value: Number(value) }];
    case 'mode':
      return [{ code: 'M', value: indexIn(MODES, value, code) }];
    case 'wind':
      return [{ code: 'F', value: indexIn(WIND, value, code) }];
    default:
      throw new Error(`ar IR não tem o controle ${code}`);
  }
}

function indexIn(list: string[], value: unknown, code: string): number {
  const index = list.indexOf(String(value));
  if (index < 0) throw new Error(`valor inválido para ${code}: ${value}`);
  return index;
}
