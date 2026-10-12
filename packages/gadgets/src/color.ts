/**
 * Cor das lâmpadas Tuya. Cada formato tem um jeito de escrever:
 *
 *   colour_data_v2  local: "HHHHSSSSVVVV" (hex; h 0–360, s/v 0–1000)
 *                   nuvem: {"h":…, "s":…, "v":…} com as mesmas escalas
 *   colour_data     local: "rrggbb0hhhssvv" (hex; s/v 0–255)
 *                   nuvem: {"h":…, "s":…, "v":…} com s/v 0–255
 *
 * Na tela usamos sempre { h: 0–360, s: 0–1, v: 0–1 }.
 */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export type Route = 'local' | 'cloud';

const scaleOf = (code: string) => (code === 'colour_data' ? 255 : 1000);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

export function decodeColor(code: string, raw: unknown): Hsv | null {
  const scale = scaleOf(code);
  let h: number;
  let s: number;
  let v: number;

  if (typeof raw === 'string' && /^[0-9a-f]{12}$/i.test(raw)) {
    [h, s, v] = [0, 4, 8].map((i) => parseInt(raw.slice(i, i + 4), 16)) as [number, number, number];
  } else if (typeof raw === 'string' && /^[0-9a-f]{14}$/i.test(raw)) {
    h = parseInt(raw.slice(7, 10), 16);
    s = parseInt(raw.slice(10, 12), 16);
    v = parseInt(raw.slice(12, 14), 16);
  } else {
    const obj = typeof raw === 'string' ? safeJson(raw) : raw;
    if (!obj || typeof obj !== 'object') return null;
    ({ h, s, v } = obj as Hsv);
  }
  return { h: clamp(h, 0, 360), s: clamp(s / scale, 0, 1), v: clamp(v / scale, 0, 1) };
}

export function encodeColor(code: string, color: Hsv, route: Route): unknown {
  const scale = scaleOf(code);
  const h = Math.round(clamp(color.h, 0, 360));
  const s = Math.round(clamp(color.s, 0, 1) * scale);
  const v = Math.round(clamp(color.v, 0, 1) * scale);

  if (route === 'cloud') return JSON.stringify({ h, s, v });
  if (code === 'colour_data') {
    const hex = (n: number, width: number) => n.toString(16).padStart(width, '0');
    const [r, g, b] = hsvToRgb(h, s / scale, v / scale);
    return hex(r, 2) + hex(g, 2) + hex(b, 2) + hex(h, 4) + hex(s, 2) + hex(v, 2);
  }
  return [h, s, v].map((n) => n.toString(16).padStart(4, '0')).join('');
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return [f(5), f(3), f(1)];
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
