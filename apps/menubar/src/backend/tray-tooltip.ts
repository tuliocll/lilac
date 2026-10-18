/** Tooltip do ícone da bandeja (função pura, sem depender do resto do backend). */

/**
 * O Windows corta o tooltip da bandeja em 127 caracteres, e o tinyjs junta as
 * linhas numa só. Então: uma linha, favoritos separados por " · ", e o que não
 * couber vira "+N".
 */
export const TOOLTIP_MAX = 120;

export interface TrayEntry {
  name: string;
  power?: boolean;
  /** leitura principal já formatada, ex.: "23 °C" */
  reading?: string;
}

export function trayTooltip(entries: TrayEntry[], words: { on: string; off: string }, max = TOOLTIP_MAX): string {
  const parts = entries.map(({ name, power, reading }) => {
    const state = [power === undefined ? null : power ? words.on : words.off, power === false ? null : reading].filter(Boolean);
    return state.length ? `${name}: ${state.join(', ')}` : name;
  });
  if (!parts.length) return 'Lilac';
  let text = '';
  for (let i = 0; i < parts.length; i++) {
    const rest = parts.length - i - 1;
    const next = text ? `${text} · ${parts[i]}` : parts[i]!;
    const tail = rest ? ` · +${rest}` : '';
    if (next.length + tail.length > max) return text ? `${text} · +${parts.length - i}` : `${next.slice(0, max - 1)}…`;
    text = next;
  }
  return text;
}
