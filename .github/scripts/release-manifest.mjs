// Junta os manifestos de atualização que o `tinyjs publish` gera em cada
// sistema num manifest.json só, apontando para os arquivos desta release.
//
//   node .github/scripts/release-manifest.mjs <pasta> <tag> <owner/repo> [notas.txt]
//
// <pasta> tem manifest-windows.json, manifest-macos.json e manifest-linux.json
// (os que existirem) e os zips. Cada sistema lê só o seu bloco: macOS no topo
// (url/sha256), Windows em "win", Linux em "linux.<arch>". As urls viram
// releases/download/<tag>/<arquivo>, o endereço fixo desta versão.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const fileOf = (url) => url.replace(/.*\//, '');

export function mergeManifests({ fragments, tag, repo, notes }) {
  const base = `https://github.com/${repo}/releases/download/${tag}/`;
  const at = (url) => base + fileOf(url);
  const version = tag.replace(/^v/, '');
  const manifest = { version };

  const { macos, windows, linux } = fragments;
  if (macos?.url) Object.assign(manifest, { url: at(macos.url), sha256: macos.sha256 });
  if (windows?.win) manifest.win = { version: windows.version ?? version, url: at(windows.win.url), sha256: windows.win.sha256 };
  if (linux?.linux) {
    manifest.linux = {};
    for (const [arch, entry] of Object.entries(linux.linux)) {
      manifest.linux[arch] = { version: linux.version ?? version, url: at(entry.url), sha256: entry.sha256 };
    }
  }
  const text = String(notes ?? '').trim();
  if (text) manifest.notes = text;
  return manifest;
}

/** Os arquivos que o manifesto cita (para conferir que vão subir na release). */
export const filesIn = (manifest) =>
  [manifest.url, manifest.win?.url, ...Object.values(manifest.linux ?? {}).map((l) => l.url)].filter(Boolean).map(fileOf);

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [dir, tag, repo, notesFile] = process.argv.slice(2);
  if (!dir || !tag || !repo) {
    console.error('uso: release-manifest.mjs <pasta> <tag> <owner/repo> [notas.txt]');
    process.exit(2);
  }
  const read = (name) => (existsSync(join(dir, name)) ? JSON.parse(readFileSync(join(dir, name), 'utf8')) : null);
  const fragments = { macos: read('manifest-macos.json'), windows: read('manifest-windows.json'), linux: read('manifest-linux.json') };
  const notes = notesFile && existsSync(notesFile) ? readFileSync(notesFile, 'utf8') : '';
  const manifest = mergeManifests({ fragments, tag, repo, notes });
  const missing = filesIn(manifest).filter((f) => !existsSync(join(dir, f)));
  if (missing.length) {
    console.error(`faltam na pasta: ${missing.join(', ')}`);
    process.exit(1);
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}
