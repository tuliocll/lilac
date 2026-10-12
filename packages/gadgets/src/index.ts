/**
 * Perfis de gadgets: ícone, nome, tom, layout e controles por tipo de aparelho.
 * Os perfis ficam em ../gadgets/<id>/gadget.json e viram registry.gen.ts no build.
 */
import type { DpSpec } from '@tuyabar/core';
import { COMMON, PROFILES } from './registry.gen.ts';
import { pickProfile, resolveGadget } from './resolve.ts';

export * from './types.ts';
export { decodeColor, encodeColor, type Hsv, type Route } from './color.ts';
export { onlySupported, pickProfile, prettifyCode, toDisplay, toRaw } from './resolve.ts';
export { COMMON, PROFILES };

/** Resolve um aparelho com o registro embutido. */
export function resolve(device: { category?: string; dps: DpSpec[]; writableKnown?: boolean }) {
  return resolveGadget(PROFILES, COMMON, device);
}

/** Só o perfil (para a lista: ícone e tom). */
export function profileFor(category: string | undefined, codes: string[] = []) {
  return pickProfile(PROFILES, category, new Set(codes));
}
