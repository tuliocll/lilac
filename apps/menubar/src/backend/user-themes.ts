/**
 * Temas instalados pelo usuário em <dados do app>/themes/<id>/{manifest.json,theme.css}.
 * Ver apps/menubar/THEMING.md.
 */
import { app } from './app.ts';
import { listDir, makeDir, readText } from './files.ts';

export interface UserTheme {
  id: string;
  name: string;
  author?: string;
  description?: unknown;
  swatches?: string[];
  css: string;
}

export async function loadUserThemes(): Promise<{ dir: string; themes: UserTheme[]; error?: string }> {
  const dir = `${app().paths?.data ?? '.'}/themes`;
  const themes: UserTheme[] = [];
  try {
    await makeDir(dir);
    for (const name of await listDir(dir)) {
      const theme = await readTheme(`${dir}/${name}`, name).catch(() => null); // pasta inválida: ignora
      if (theme) themes.push(theme);
    }
    return { dir, themes };
  } catch (error) {
    return { dir, themes, error: (error as Error).message };
  }
}

async function readTheme(folder: string, fallbackId: string): Promise<UserTheme | null> {
  const manifest = JSON.parse(await readText(`${folder}/manifest.json`));
  const id = String(manifest.id ?? fallbackId).replace(/[^a-z0-9-]/gi, '');
  if (!id) return null;
  return {
    id,
    name: String(manifest.name ?? id),
    author: manifest.author,
    description: manifest.description,
    swatches: Array.isArray(manifest.swatches) ? manifest.swatches.map(String) : undefined,
    css: await readText(`${folder}/theme.css`),
  };
}
