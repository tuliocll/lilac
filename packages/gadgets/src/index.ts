import type { DpSpec } from '@tuyabar/core';
import { COMMON, PROFILES } from './registry.gen.ts';
import { resolveGadget } from './resolve.ts';

export * from './types.ts';
export { onlySupported, pickProfile, prettifyCode, toDisplay, toRaw, pickText } from './resolve.ts';
export { COMMON, PROFILES };

/** Atalho com o registro embutido. */
export function resolve(device: { category?: string; dps: DpSpec[]; writableKnown?: boolean }) {
  return resolveGadget(PROFILES, COMMON, device);
}

export function profileFor(category: string | undefined, codes: string[] = []) {
  const set = new Set(codes);
  const p =
    PROFILES.filter((x) => x.match.categories.includes(category ?? '') && (x.match.requiredCodes ?? []).every((c) => set.has(c))).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    )[0] ?? PROFILES.find((x) => x.id === 'generic')!;
  return p;
}
