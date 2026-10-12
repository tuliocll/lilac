/**
 * O que a lista de aparelhos mostra: inventário + presença na rede + favoritos.
 */
import { categoryKind, categoryLabel, type DeviceKind, type DiscoveredDevice } from '@tuyabar/core';
import { profileFor } from '@tuyabar/gadgets';
import { devices } from './account.ts';
import { chooseRoute, type Reason, type Route } from './control.ts';
import { favorites } from './favorites.ts';
import { locate, presentDevices } from './network.ts';

export interface DeviceView {
  id: string;
  name: string;
  /** "Ar-condicionado", "Tomada"… */
  type: string;
  kind: DeviceKind;
  /** perfil do gadget: define ícone, tom e layout da página */
  gadget: string;
  tone: string;
  ip?: string;
  version?: string;
  /** como seria controlado agora */
  route: Route | null;
  /** por que não é pela rede local */
  reason?: Reason;
  /** o produto não declara suporte local — funciona em muitos casos, mas sem garantia */
  experimental: boolean;
  favorite: boolean;
  /** está na conta (ou foi importado); false = só visto na rede */
  known: boolean;
}

export function deviceList(): DeviceView[] {
  const favoriteOrder = favorites();
  const favs = new Set(favoriteOrder);
  const inventory = devices();
  const known = new Set(inventory.map((d) => d.id));

  const views: DeviceView[] = inventory.map((device) => {
    const choice = chooseRoute(device);
    const profile = profileFor(device.category, device.dps.map((dp) => dp.code));
    return {
      id: device.id,
      name: device.name,
      type: categoryLabel(device.category),
      kind: categoryKind(device.category),
      gadget: profile.id,
      tone: profile.tone,
      ip: locate(device.id)?.ip,
      version: choice.version,
      route: choice.route,
      reason: choice.reason,
      experimental: choice.route === 'local' && !device.supportLocal,
      favorite: favs.has(device.id),
      known: true,
    };
  });

  for (const seen of presentDevices()) {
    if (!known.has(seen.id)) views.push(stranger(seen));
  }

  // favoritos primeiro, na ordem escolhida; depois quem está acessível; depois por nome
  const rank = (v: DeviceView) => (v.favorite ? 0 : v.route ? 1 : 2);
  const favoritePosition = (v: DeviceView) => (v.favorite ? favoriteOrder.indexOf(v.id) : 0);
  return views.sort((a, b) => rank(a) - rank(b) || favoritePosition(a) - favoritePosition(b) || a.name.localeCompare(b.name));
}

/** Aparelho anunciando na rede que não está na conta (sem chave, não dá para controlar). */
function stranger(seen: DiscoveredDevice): DeviceView {
  return {
    id: seen.id,
    name: seen.productKey ?? seen.id,
    type: '',
    kind: 'unknown',
    gadget: 'generic',
    tone: 'neutral',
    ip: seen.ip,
    version: seen.version,
    route: null,
    reason: 'unknown',
    experimental: false,
    favorite: false,
    known: false,
  };
}
