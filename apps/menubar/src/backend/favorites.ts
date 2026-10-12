/**
 * Favoritos: aparecem primeiro na lista (na ordem que o usuário escolher)
 * e ganham atalho no menu da bandeja. Guardados no tiny.store como uma
 * lista de ids — a posição na lista é a ordem.
 */
import { app } from './app.ts';

let ids: string[] = [];

export const favorites = () => ids;

export async function loadFavorites() {
  const saved = await app().store.get('favorites').catch(() => null);
  ids = Array.isArray(saved) ? [...new Set(saved.map(String))] : [];
}

/** Liga/desliga a estrela. Favorito novo vai para o fim da fila. */
export async function toggleFavorite(id: string): Promise<boolean> {
  const isFavorite = !ids.includes(id);
  ids = isFavorite ? [...ids, id] : ids.filter((x) => x !== id);
  await save();
  return isFavorite;
}

/**
 * Nova ordem vinda da interface. Só aceita quem já é favorito; algum que
 * ficou de fora (ex.: favoritado em outra janela) vai para o fim.
 */
export async function reorderFavorites(order: string[]): Promise<string[]> {
  const current = new Set(ids);
  const ordered = [...new Set(order.map(String))].filter((id) => current.has(id));
  ids = [...ordered, ...ids.filter((id) => !ordered.includes(id))];
  await save();
  return ids;
}

async function save() {
  await app().store.set('favorites', ids).catch(() => {});
}
