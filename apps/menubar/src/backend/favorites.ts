/**
 * Favoritos: aparecem primeiro na lista e ganham atalho no menu da bandeja.
 * Guardados no tiny.store (lido na inicialização).
 */
import { app } from './app.ts';

let ids: string[] = [];

export const favorites = () => ids;

export async function loadFavorites() {
  const saved = await app().store.get('favorites').catch(() => null);
  ids = Array.isArray(saved) ? saved.map(String) : [];
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const isFavorite = !ids.includes(id);
  ids = isFavorite ? [...ids, id] : ids.filter((x) => x !== id);
  await app().store.set('favorites', ids).catch(() => {});
  return isFavorite;
}
