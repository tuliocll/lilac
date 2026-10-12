// Armazenamento da CLI (só para desenvolvimento). O app de bandeja usa o
// cofre do sistema (Keychain / Credential Manager / Secret Service).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DIR = join(homedir(), '.tuyabar');

export async function load<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(join(DIR, name), 'utf8')) as T;
  } catch {
    return null;
  }
}

export async function save(name: string, data: unknown): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, name), JSON.stringify(data, null, 2), { mode: 0o600 });
}

/**
 * Lê uma opção da linha de comando (`--dps`). No PowerShell o `--` some e o
 * npm guarda a opção como variável de ambiente (npm_config_dps) — aceitamos os dois.
 */
export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`) || process.env[`npm_config_${name}`] === 'true';
}
