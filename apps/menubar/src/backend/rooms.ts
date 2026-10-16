/**
 * Cômodos. Os do Smart Life vêm com o aparelho (CloudDevice.room). Quem a
 * nuvem não põe em cômodo nenhum (chaves importadas, aparelho fora de cômodo
 * no app) entra pelo nome — "Luz da sala" vai para Sala — ou pela escolha do
 * usuário na página do aparelho, que vale mais que tudo. As escolhas ficam no
 * tiny.store, pela chave do cômodo (id da casa + id do cômodo: renomear não perde nada).
 */
import type { CloudDevice, CloudRoom } from '@lilac/core';
import { devices } from './account.ts';
import { app } from './app.ts';

export interface PlacedRoom extends CloudRoom {
  /** casa do Smart Life onde o cômodo fica */
  homeId: string;
  /** nome da casa, só para mostrar */
  home: string;
}

/** de onde veio o cômodo do aparelho */
export type RoomSource = 'chosen' | 'cloud' | 'name' | 'none';

/** id do aparelho → chave do cômodo escolhido, ou 'none' (sem cômodo, por escolha) */
let choices: Record<string, string> = {};

export async function loadRoomChoices() {
  const saved = await app().store.get('roomChoices').catch(() => null);
  choices = saved && typeof saved === 'object' ? { ...(saved as Record<string, string>) } : {};
}

export const roomKey = (room: PlacedRoom) => `${room.homeId}:${room.id}`;

/** Os cômodos que existem: os que o Smart Life informou, na ordem do app do celular. */
export function knownRooms(): PlacedRoom[] {
  const byKey = new Map<string, PlacedRoom>();
  for (const d of devices()) {
    if (!d.room) continue;
    const room = { ...d.room, homeId: d.homeId, home: d.homeName };
    byKey.set(roomKey(room), room);
  }
  return [...byKey.values()].sort((a, b) => a.home.localeCompare(b.home) || a.order - b.order || a.name.localeCompare(b.name));
}

/**
 * O cômodo sem contar a escolha do usuário: o da nuvem, ou o que aparece no
 * nome — procurado na casa do próprio aparelho; quem não tem casa com cômodos
 * (chaves importadas) procura em todas.
 */
function automaticRoom(device: CloudDevice, rooms: PlacedRoom[]): { room?: PlacedRoom; source: RoomSource } {
  if (device.room) return { room: { ...device.room, homeId: device.homeId, home: device.homeName }, source: 'cloud' };
  const sameHome = rooms.filter((r) => r.homeId === device.homeId);
  const room = roomByName(device.name, sameHome.length ? sameHome : rooms);
  return room ? { room, source: 'name' } : { source: 'none' };
}

export function roomOf(device: CloudDevice, rooms = knownRooms()): { room?: PlacedRoom; source: RoomSource } {
  const choice = choices[device.id];
  if (choice === 'none') return { source: 'chosen' };
  const chosen = choice && rooms.find((r) => roomKey(r) === choice);
  if (chosen) return { room: chosen, source: 'chosen' };
  return automaticRoom(device, rooms); // sem escolha, ou o cômodo escolhido sumiu da conta
}

/** O que a página do aparelho mostra no seletor de cômodo. */
export function roomOptions(device: CloudDevice) {
  const rooms = knownRooms();
  const homes = new Set(rooms.map((r) => r.homeId));
  const auto = automaticRoom(device, rooms);
  return {
    choice: choices[device.id] ?? 'auto',
    /** para onde o "automático" levaria */
    auto: { room: auto.room?.name ?? null, source: auto.source },
    rooms: rooms.map((r) => ({ key: roomKey(r), name: r.name, home: homes.size > 1 ? r.home : '' })),
  };
}

/** 'auto' volta ao automático; 'none' tira de qualquer cômodo; senão, a chave de um cômodo. */
export async function chooseRoom(id: string, choice: string) {
  if (choice === 'auto') delete choices[id];
  else choices[id] = String(choice);
  await app().store.set('roomChoices', choices).catch(() => {});
}

// ------------------------------------------------------------ pelo nome

const words = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * O cômodo cujo nome aparece, palavra por palavra, no nome do aparelho
 * ("Ar-condicionado Sala de Estar" → "Sala de Estar" antes de "Sala").
 * Sem acento nem maiúscula: "escritório" casa com "Escritorio".
 */
export function roomByName(name: string, rooms: PlacedRoom[]): PlacedRoom | undefined {
  const device = words(name);
  const contains = (room: string[]) => room.length > 0 && device.some((_, i) => room.every((w, j) => device[i + j] === w));
  let best: PlacedRoom | undefined;
  let bestLength = 0;
  for (const room of rooms) {
    const w = words(room.name);
    if (contains(w) && w.join(' ').length > bestLength) {
      best = room;
      bestLength = w.join(' ').length;
    }
  }
  return best;
}
