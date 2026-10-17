/**
 * O que a lista de aparelhos mostra: inventário + presença na rede + favoritos.
 */
import { categoryKind, categoryLabel, type DeviceKind, type DiscoveredDevice } from '@lilac/core';
import { profileFor, type ResolvedControl } from '@lilac/gadgets';
import type { CloudDevice, CloudRoom } from '@lilac/core';
import { devices } from './account.ts';
import { chooseRoute, currentValues, supportedGadget, type Reason, type Route } from './control.ts';
import { favorites } from './favorites.ts';
import { quickActionsFor, type QuickAction } from './quick-actions.ts';
import { locate, presentDevices } from './network.ts';
import { knownRooms, roomOf } from './rooms.ts';

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
  /** cômodo (do Smart Life, pelo nome ou escolhido) — a lista agrupa por ele */
  room?: CloudRoom;
  /** casa do cômodo; sem cômodo, a do aparelho (vazio para importados) */
  home: string;
  /** id dessa casa — a lista agrupa por ele (nomes de casa podem repetir) */
  homeId: string;
  /** botões de um clique na lista */
  quick: QuickActionView[];
}

export interface QuickActionView extends QuickAction {
  /** o controle por trás da ação (rótulo, ícone, opções, unidade — para a página formatar) */
  control: ResolvedControl;
  /** a ação está "acesa" agora: toggle ligado, ou o valor fixado é o atual */
  active?: boolean;
}

export function deviceList(): DeviceView[] {
  const favoriteOrder = favorites();
  const favs = new Set(favoriteOrder);
  const inventory = devices();
  const known = new Set(inventory.map((d) => d.id));
  const rooms = knownRooms();

  const views: DeviceView[] = inventory.map((device) => {
    const choice = chooseRoute(device);
    const profile = profileFor(device.category, device.dps.map((dp) => dp.code));
    const { room } = roomOf(device, rooms);
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
      room: room && { id: room.id, name: room.name, order: room.order },
      home: room?.home ?? device.homeName,
      homeId: room?.homeId ?? device.homeId,
      quick: quickActionViews(device),
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
    home: '',
    homeId: '',
    quick: [],
  };
}

function quickActionViews(device: CloudDevice): QuickActionView[] {
  const gadget = supportedGadget(device);
  const values = currentValues(device);
  return quickActionsFor(device.id, gadget).map((action) => {
    const control = gadget.controls.find((c) => c.code === action.code)!;
    const current = values[action.code];
    const active = current === undefined ? undefined : action.mode === 'toggle' ? current === true : current === action.value;
    return { ...action, control, active };
  });
}
