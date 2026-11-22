// Prints dos temas para o README: abre o frontend num Chromium sem janela com um
// `tiny` falso (aparelhos de exemplo, perfis reais de @lilac/gadgets) e salva
// docs/screenshots/themes/<tema>.png e <tema>.pt-BR.png (360×560 a 2x).
//
//   npm run screenshots                       (todos os temas, tela da lista)
//   npm run screenshots -- luna cutelight     (só esses)
//   npm run screenshots -- luna --screen settings --out /tmp/prints
//     --screen: list (padrão) | settings | ac1 | light1 | plug1 | sw1 | ac2 (página do aparelho)
//
// Na primeira vez: npx playwright-core install chromium

import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { resolve, profileFor } from '@lilac/gadgets';

const here = dirname(fileURLToPath(import.meta.url));
const front = join(here, '..', 'src', 'frontend');
const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { screen: { type: 'string', default: 'list' }, out: { type: 'string', default: join(here, '..', '..', '..', 'docs', 'screenshots', 'themes') } },
});

const builtin = (() => {
  const ctx = { Lilac: {} as { builtinThemes?: { id: string }[] } };
  vm.runInNewContext(readFileSync(join(front, 'themes', 'index.js'), 'utf8'), ctx);
  return ctx.Lilac.builtinThemes!.map((t) => t.id);
})();
const themes = positionals.length ? positionals : builtin;
for (const id of themes) if (!builtin.includes(id)) throw new Error(`tema desconhecido: ${id}`);
const SCREENS = ['list', 'settings', 'ac1', 'light1', 'plug1', 'sw1', 'ac2'];
if (!SCREENS.includes(opts.screen!)) throw new Error(`--screen desconhecida: ${opts.screen} (use ${SCREENS.join(' | ')})`);

// ---- aparelhos de exemplo, resolvidos pelos perfis de verdade

const int = (code: string, min: number, max: number, unit = '', scale = 0) => ({ dpId: 0, code, type: 'Integer', writable: true, values: { min, max, step: 1, unit, scale } });
const bool = (code: string) => ({ dpId: 0, code, type: 'Boolean', writable: true });
const enm = (code: string, range: string[]) => ({ dpId: 0, code, type: 'Enum', writable: true, values: { range } });
const ro = <T>(dp: T) => ({ ...dp, writable: false });

const SAMPLES = {
  ac: { category: 'kt', dps: [bool('switch'), int('temp_set', 16, 30, '℃'), ro(int('temp_current', 0, 50, '℃')), enm('mode', ['cold', 'hot', 'wet', 'wind', 'auto']), enm('windspeed', ['low', 'mid', 'high', 'auto'])], values: { switch: true, temp_set: 22, temp_current: 25, mode: 'cold', windspeed: 'auto' } },
  light: { category: 'dj', dps: [bool('switch_led'), enm('work_mode', ['white', 'colour']), int('bright_value_v2', 10, 1000), int('temp_value_v2', 0, 1000)], values: { switch_led: true, work_mode: 'white', bright_value_v2: 700, temp_value_v2: 400 } },
  plug: { category: 'cz', dps: [bool('switch_1'), ro(int('cur_power', 0, 50000, 'W', 1)), int('countdown_1', 0, 86400, 's')], values: { switch_1: false, cur_power: 0, countdown_1: 0 } },
  breaker: { category: 'kg', dps: [bool('switch'), ro(int('cur_power', 0, 50000, 'W', 1)), ro(int('cur_voltage', 0, 3000, 'V', 1))], values: { switch: true, cur_power: 1234, cur_voltage: 2201 } },
};
const data = Object.fromEntries(
  Object.entries(SAMPLES).map(([k, s]) => {
    const gadget = resolve({ category: s.category, dps: s.dps, writableKnown: true });
    const profile = profileFor(s.category, s.dps.map((d) => d.code));
    const power = gadget.controls.find((c) => c.type === 'power');
    return [k, { gadget, values: s.values, profile: { id: profile.id, tone: profile.tone }, power, poweredOn: power ? Boolean((s.values as Record<string, unknown>)[power.code]) : undefined }];
  }),
);

// ---- o `tiny` falso, injetado antes dos scripts do app (roda no navegador)

function fakeTiny(D: typeof data, theme: string, lang: string) {
  const pt = lang === 'pt-BR';
  const room = (id: string, name: string, order: number) => ({ id, name, order });
  const living = room('r1', pt ? 'Sala' : 'Living room', 1);
  const bed = room('r2', pt ? 'Quarto' : 'Bedroom', 2);
  const office = room('r3', pt ? 'Escritório' : 'Office', 3);
  const dev = (id: string, name: string, type: string, k: keyof typeof D, extra: object) => {
    const d = D[k]!;
    return {
      id, name, type, kind: 'tuya', gadget: d.profile.id, tone: d.profile.tone, ip: `192.168.0.${10 + id.length}`, version: '3.4',
      route: 'local', experimental: false, favorite: false, known: true, home: 'Home', homeId: 'h1', _k: k,
      quick: d.power ? [{ code: d.power.code, mode: 'toggle', control: d.power, active: d.poweredOn }] : [],
      ...extra,
    };
  };
  const list = [
    dev('ac1', pt ? 'Ar do escritório' : 'Office AC', pt ? 'Ar-condicionado' : 'Air conditioner', 'ac', { favorite: true, room: office }),
    dev('light1', pt ? 'Luz da mesa' : 'Desk light', pt ? 'Luz' : 'Light', 'light', { favorite: true, room: office, route: 'cloud' }),
    dev('plug1', pt ? 'Tomada da TV' : 'TV plug', pt ? 'Tomada' : 'Plug', 'plug', { room: living }),
    dev('sw1', pt ? 'Luz da sala' : 'Living room light', pt ? 'Disjuntor' : 'Breaker', 'breaker', { room: living }),
    dev('ac2', pt ? 'Ar do quarto (LG)' : 'Bedroom AC (LG)', pt ? 'Ar-condicionado' : 'Air conditioner', 'ac', { room: bed, kind: 'lg', route: 'cloud' }),
  ];
  const handlers: Record<string, ((v: unknown) => void)[]> = {};
  const emit = (name: string, value: unknown) => handlers[name]?.forEach((h) => h(value));
  const store: Record<string, unknown> = { theme, language: lang, onboarded: true, deviceLayout: 'list' };
  const calls: Record<string, (a: any) => unknown> = {
    restore: () => {
      setTimeout(() => { emit('devices', list); emit('account', { username: 'demo' }); });
      return { loggedIn: true };
    },
    openDevice: ({ id }) => {
      const device = list.find((x) => x.id === id)!;
      const d = D[device._k]!;
      return { gadget: d.gadget, values: d.values, route: device.route };
    },
    userThemes: () => [],
    quickActionOptions: () => [],
    roomOptions: () => null,
  };
  // qualquer outra coisa (win.*, tray.*, secrets…) vira uma função que resolve vazio
  const any = (): any => new Proxy(function () {}, { get: (_, k) => (k === 'then' ? undefined : any()), apply: () => Promise.resolve(undefined) });
  const known: Record<string, unknown> = {
    api: { on: (n: string, f: (v: unknown) => void) => (handlers[n] ??= []).push(f), call: async (n: string, a: unknown) => calls[n]?.(a) },
    store: { get: async (k: string) => store[k] ?? null, set: async (k: string, v: unknown) => { store[k] = v; } },
    win: new Proxy({}, { get: (_, m) => async () => (m === 'getState' ? { x: 0, y: 0, width: 360, height: 560, visible: true } : undefined) }),
    app: { info: async () => ({ version: '1.0.0', platform: 'linux' }), shell: { open: async () => {} }, launchAtLogin: { get: async () => false, set: async () => {} }, secrets: any() },
    log: (...a: unknown[]) => console.log('[tiny]', ...a),
  };
  (window as any).tiny = new Proxy({}, { get: (_, k: string) => known[k] ?? any() });
}

// ---- prints

mkdirSync(opts.out!, { recursive: true });
const html = readFileSync(join(front, 'index.html'), 'utf8');
const browser = await chromium.launch();
try {
  for (const theme of themes) {
    for (const lang of ['en', 'pt-BR']) {
      const page = await browser.newPage({ viewport: { width: 360, height: 560 }, deviceScaleFactor: 2 });
      page.on('pageerror', (e) => console.error(`[${theme} ${lang}]`, e.message));
      // o tsx embrulha funções em __name(); no navegador ele não existe
      const mock = `var __name = (f) => f; (${fakeTiny.toString()})(${JSON.stringify(data)}, ${JSON.stringify(theme)}, ${JSON.stringify(lang)});`;
      await page.route('**/index.html', (route) =>
        route.fulfill({ contentType: 'text/html', body: html.replace('<script src="config.js">', `<script>${mock}</script><script src="config.js">`) }),
      );
      await page.goto(pathToFileURL(join(front, 'index.html')).href);
      // shortcut: esperas fixas para animações e fontes; trocar por um sinal do app se ficarem instáveis
      await page.waitForTimeout(800);
      if (opts.screen === 'settings') await page.click('#open-settings');
      else if (opts.screen !== 'list') await page.click(`[data-id="${opts.screen}"] .device-name`);
      if (opts.screen !== 'list') await page.waitForTimeout(800);

      const suffix = opts.screen === 'list' ? '' : `-${opts.screen}`;
      const file = join(opts.out!, `${theme}${suffix}${lang === 'en' ? '' : `.${lang}`}.png`);
      await page.screenshot({ path: file });
      console.log(file);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
