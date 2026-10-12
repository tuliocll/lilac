/** Acesso a arquivos pelo runtime do tinyjs (txiki.js). */
declare const tjs: {
  makeDir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readDir(path: string): Promise<AsyncIterable<{ name: string }>>;
  readFile(path: string): Promise<Uint8Array>;
};

const decoder = new TextDecoder();

export const readText = async (path: string) => decoder.decode(await tjs.readFile(path));
export const makeDir = (path: string) => tjs.makeDir(path, { recursive: true });

export async function listDir(path: string): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of await tjs.readDir(path)) names.push(entry.name);
  return names;
}
