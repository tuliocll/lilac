// Gera CSS com ícones e fontes embutidos como data: URI, e o ícone da bandeja
// embutido no backend.
//
// Por quê: cada tema vira um arquivo só, sem caminho relativo para resolver (o
// mesmo vale para temas da pasta do usuário). O ícone da bandeja vai dentro do
// backend porque o app compilado não leva a pasta assets/ junto (ver tray.ts).
//
//   node scripts/build-assets.mjs          (gera)
//   node scripts/build-assets.mjs --check  (falha se algo estiver desatualizado)

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const front = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'frontend');
const check = process.argv.includes('--check');
const outputs = [];

// ---- ícones: src/frontend/icons/*.svg → icons.css (variáveis --i-<nome>)
{
  const dir = join(front, 'icons');
  const lines = ['/* GERADO por scripts/build-assets.mjs — não edite. Fontes: icons/<nome>.svg e packages/gadgets/gadgets/<id>/icon.svg */', ':root {'];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
    const svg = readFileSync(join(dir, f), 'utf8').trim();
    lines.push(`  --i-${basename(f, '.svg')}: url("data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}");`);
  }
  // ícones dos gadgets: packages/gadgets/gadgets/<id>/icon.svg → --i-gadget-<id>
  const gdir = join(front, '..', '..', '..', '..', 'packages', 'gadgets', 'gadgets');
  for (const id of readdirSync(gdir).sort()) {
    const f = join(gdir, id, 'icon.svg');
    if (!existsSync(f)) continue;
    const svg = readFileSync(f, 'utf8').trim();
    lines.push(`  --i-gadget-${id}: url("data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}");`);
  }
  lines.push('}', '');
  outputs.push([join(front, 'icons.css'), lines.join('\n')]);
}

// ---- fontes de cada tema: themes/<id>/fonts.json → themes/<id>/fonts.css
for (const id of readdirSync(join(front, 'themes'))) {
  const spec = join(front, 'themes', id, 'fonts.json');
  if (!existsSync(spec)) continue;
  const faces = JSON.parse(readFileSync(spec, 'utf8'));
  const css = ['/* GERADO por scripts/build-assets.mjs a partir de fonts.json — não edite. */'];
  for (const face of faces) {
    const data = readFileSync(join(front, 'themes', id, face.file)).toString('base64');
    css.push(
      `@font-face { font-family: "${face.family}"; src: url(data:font/woff2;base64,${data}) format("woff2"); font-weight: ${face.weight}; font-style: normal; font-display: block; }`,
    );
  }
  css.push('');
  outputs.push([join(front, 'themes', id, 'fonts.css'), css.join('\n')]);
}

// ---- ícone da bandeja: assets/tray.png → src/backend/tray-icon.gen.ts
{
  const png = readFileSync(join(front, '..', '..', 'assets', 'tray.png')).toString('base64');
  outputs.push([
    join(front, '..', 'backend', 'tray-icon.gen.ts'),
    `// GERADO por scripts/build-assets.mjs a partir de assets/tray.png — não edite.\nexport const TRAY_PNG_BASE64 =\n  '${png}';\n`,
  ]);
}

let stale = 0;
for (const [file, content] of outputs) {
  const cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (cur === content) continue;
  if (check) {
    console.error(`desatualizado: ${file}`);
    stale++;
  } else {
    writeFileSync(file, content);
    console.log(`gerado: ${file}`);
  }
}
if (stale) {
  console.error('Rode: npm run assets');
  process.exit(1);
}
