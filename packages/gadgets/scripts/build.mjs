// Junta gadgets/<id>/{gadget.json, icon.svg} + gadgets/_common.json em
// src/registry.gen.ts (importável por qualquer runtime, sem import de JSON).
//   node scripts/build.mjs          gera
//   node scripts/build.mjs --check  falha se estiver desatualizado
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'gadgets');
const profiles = [];
for (const id of readdirSync(dir).sort()) {
  const f = join(dir, id, 'gadget.json');
  if (!existsSync(f)) continue;
  const p = JSON.parse(readFileSync(f, 'utf8'));
  delete p.$schema;
  if (p.id !== id) throw new Error(`gadgets/${id}: "id" precisa ser igual ao nome da pasta`);
  const icon = join(dir, id, 'icon.svg');
  if (existsSync(icon)) p.iconSvg = readFileSync(icon, 'utf8').trim();
  profiles.push(p);
}
const common = JSON.parse(readFileSync(join(dir, '_common.json'), 'utf8'));
delete common.$comment;

const out = `// GERADO por scripts/build.mjs — não edite. Edite gadgets/<id>/gadget.json.
import type { CommonLabels, GadgetProfile } from './types.ts';

export const PROFILES: GadgetProfile[] = ${JSON.stringify(profiles, null, 2)};

export const COMMON: CommonLabels = ${JSON.stringify(common, null, 2)};
`;
const target = join(root, 'src', 'registry.gen.ts');
const cur = existsSync(target) ? readFileSync(target, 'utf8') : '';
if (cur !== out) {
  if (process.argv.includes('--check')) {
    console.error('registry.gen.ts desatualizado — rode: npm run assets');
    process.exit(1);
  }
  writeFileSync(target, out);
  console.log(`gerado: ${target} (${profiles.length} gadgets)`);
}
