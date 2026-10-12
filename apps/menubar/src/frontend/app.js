// Orquestra as telas do TuyaBar. Todo visual vem do tema (ver THEMING.md) e
// todo texto vem do I18N — aqui só há estrutura, estado e classes semânticas.

const $ = (id) => document.getElementById(id);
const { t, pick } = I18N;
const W = 360;
const H = 560;

let view = 'loading';
let navStack = [];
let account = null;
let devices = [];
let lastStatus = { key: 'status.loading', vars: undefined, warn: false };

// ---------------------------------------------------------------- navegação

const TITLE_KEYS = {
  onboarding: 'title.onboarding',
  login: 'title.login',
  devices: 'title.devices',
  settings: 'title.settings',
  about: 'title.about',
};

function renderTitle() {
  $('title').textContent = view === 'device' ? currentDevice?.name ?? '' : t(TITLE_KEYS[view] ?? 'title.devices');
}

function go(v, { push = true } = {}) {
  if (push && view !== v && view !== 'loading') navStack.push(view);
  if (view === 'loading') setStatusText('');
  if (view === 'device' && v !== 'device') closeDevicePage();
  view = v;
  document.body.dataset.view = v;
  renderTitle();
}

function back() {
  go(navStack.pop() ?? 'devices', { push: false });
}
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', back);

// status com chave de i18n: re-traduz ao trocar de idioma
function setStatus(key, vars, warn = false) {
  lastStatus = { key, vars, warn };
  $('status').textContent = t(key, vars);
  $('status').classList.toggle('warn', warn);
}
function setStatusText(text, warn = false) {
  lastStatus = { text, warn };
  $('status').textContent = text;
  $('status').classList.toggle('warn', warn);
}

let busy = 0;
function setBusy(delta) {
  busy = Math.max(0, busy + delta);
  document.body.classList.toggle('busy', busy > 0);
}

function glyph(name) {
  const i = document.createElement('i');
  i.className = 'glyph';
  if (name) i.dataset.g = name;
  return i;
}

// ---------------------------------------------------------------- cofre do SO
// Sessão e local keys vão para o Keychain / Credential Manager / Secret Service.
// O inventário (sem chaves) vai para o tiny.store, que é um JSON comum.

const secrets = tiny.app.secrets;

async function readVault() {
  let session = null;
  let inventory = null;
  const keys = {};
  try {
    const s = await secrets.get('session');
    session = s ? JSON.parse(s) : null;
  } catch {}
  try {
    inventory = await tiny.store.get('inventory');
  } catch {}
  for (const d of inventory ?? []) {
    try {
      const k = await secrets.get(`key:${d.id}`);
      if (k) keys[d.id] = k;
    } catch {}
  }
  return { session, inventory, keys };
}

async function writeVault({ session, inventory, keys }) {
  try {
    if (session) await secrets.set('session', JSON.stringify(session));
    else await secrets.delete('session');
    const old = (await tiny.store.get('inventory')) ?? [];
    await tiny.store.set('inventory', inventory);
    for (const [id, key] of Object.entries(keys)) if (key) await secrets.set(`key:${id}`, key);
    for (const d of old) if (!(d.id in keys)) await secrets.delete(`key:${d.id}`);
  } catch (e) {
    tiny.log(`[vault] ${e.message || e}`);
    setStatus('status.vaultError', undefined, true);
  }
}

// ---------------------------------------------------------------- lista de dispositivos

function badgeFor(d) {
  if (d.local) {
    if (!d.known) return [`v${d.version}`, ''];
    if (!d.hasKey) return [t('badge.nokey'), 'warn'];
    if (!d.supportLocal) return [t('badge.experimental', { version: d.version }), 'warn'];
    return [t('badge.local', { version: d.version }), 'ok'];
  }
  if (d.sub) return [t('badge.sub'), ''];
  return [t('badge.away'), ''];
}

function renderDevices() {
  $('list').replaceChildren(
    ...devices.map((d) => {
      const li = document.createElement('li');
      li.className = 'device' + (d.local || d.sub ? '' : ' away');
      li.title = d.id;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');

      const icon = document.createElement('span');
      icon.className = 'device-icon';
      icon.dataset.tone = d.tone || 'neutral';
      icon.style.setProperty('--glyph', `var(--i-gadget-${d.gadget || 'generic'})`);
      icon.append(glyph());

      const name = document.createElement('span');
      name.className = 'device-name';
      name.textContent = d.name;

      const meta = document.createElement('span');
      meta.className = 'device-meta';
      meta.textContent = [d.known ? d.type : t('type.unknown'), d.ip].filter(Boolean).join(' · ') || d.id;

      const [label, tone] = badgeFor(d);
      const badge = document.createElement('span');
      badge.className = 'badge';
      if (tone) badge.dataset.tone = tone;
      badge.textContent = label;

      li.append(icon, name, meta, badge);
      const open = () => openDevicePage(d);
      li.addEventListener('click', open);
      li.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && open());
      return li;
    }),
  );
  document.body.classList.toggle('has-devices', devices.length > 0);
}

// ---------------------------------------------------------------- página do gadget

let currentDevice = null;
let page = null;

async function openDevicePage(d) {
  currentDevice = d;
  go('device');
  const container = $('device-page');
  container.replaceChildren();
  $('device-header').replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'muted center';
  loading.textContent = t('device.connecting');
  container.append(loading);
  setBusy(1);
  try {
    const data = await tiny.api.call('openDevice', { id: d.id });
    if (currentDevice?.id !== d.id) return; // usuário já saiu
    page = Controls.renderPage(container, data, {
      headerSlot: $('device-header'),
      onSet: (code, value) => tiny.api.call('setControl', { id: d.id, code, value }),
      onError: (msg) => setStatusText(msg, true),
    });
  } catch (e) {
    loading.textContent = t('device.reason.error', { error: e.message || e });
  } finally {
    setBusy(-1);
  }
}

function closeDevicePage() {
  if (currentDevice) tiny.api.call('closeDevice', { id: currentDevice.id });
  currentDevice = null;
  page = null;
}

tiny.api.on('state', ({ id, values }) => {
  if (page && currentDevice?.id === id) page.update(values);
});

// ---------------------------------------------------------------- onboarding

let obStep = 1;
function showStep(n) {
  obStep = n;
  for (const s of document.querySelectorAll('.ob-step')) s.hidden = s.dataset.step !== String(n);
  for (const d of document.querySelectorAll('.step-dots i')) d.classList.toggle('on', d.dataset.dot === String(n));
  for (const a of document.querySelectorAll('[data-for-step]')) a.hidden = !a.dataset.forStep.split(' ').includes(String(n));
}

async function finishOnboarding(next) {
  try {
    await tiny.store.set('onboarded', true);
  } catch {}
  navStack = [];
  if (next === 'login') {
    go('login', { push: false });
    $('user-code').focus();
  } else go('devices', { push: false });
}

$('ob-next').addEventListener('click', () => showStep(Math.min(3, obStep + 1)));
$('ob-skip').addEventListener('click', () => showStep(3));
$('ob-connect').addEventListener('click', () => finishOnboarding('login'));
$('ob-explore').addEventListener('click', () => finishOnboarding('devices'));
$('open-intro').addEventListener('click', () => {
  showStep(1);
  go('onboarding');
});

// ---------------------------------------------------------------- configurações

function renderThemes() {
  $('theme-list').replaceChildren(
    ...Themes.list().map((th) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card theme-option';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(th.id === Themes.current));
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = th.name + (th.user ? ' ✦' : '');
      const desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = pick(th.description) || (th.author ? th.author : '');
      const sw = document.createElement('span');
      sw.className = 'swatches';
      sw.setAttribute('aria-hidden', 'true');
      // amostras = dados do manifesto do tema, não estilo da interface
      for (const c of (th.swatches ?? []).slice(0, 5)) {
        const i = document.createElement('i');
        i.style.background = c;
        sw.append(i);
      }
      b.append(name, sw, desc);
      b.addEventListener('click', () => Themes.select(th.id));
      return b;
    }),
  );
}
Themes.onChange(renderThemes);

let userThemes = { count: 0, error: null, dir: null };
function renderUserThemesInfo() {
  $('user-themes-info').textContent = userThemes.error
    ? t('settings.themesUnavailable')
    : userThemes.count
      ? t('settings.userThemes', { count: userThemes.count })
      : t('settings.noUserThemes');
}
async function loadUserThemes() {
  try {
    const { dir, themes, error } = await tiny.api.call('userThemes');
    userThemes = { count: themes.length, error, dir };
    await Themes.loadUserThemes(themes);
    if (error) tiny.log(`[themes] ${error}`);
  } catch (e) {
    userThemes.error = String(e.message || e);
  }
  renderUserThemesInfo();
  renderThemes();
}

function renderLanguages() {
  const sel = $('language');
  sel.replaceChildren();
  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = t('settings.language.auto');
  sel.append(auto);
  for (const l of I18N.LANGS) {
    const o = document.createElement('option');
    o.value = l;
    o.textContent = I18N.DICT[l]['lang.name'];
    sel.append(o);
  }
  sel.value = I18N.preference;
}
$('language').addEventListener('change', (e) => I18N.set(e.target.value));

function renderAccount() {
  $('account-name').textContent = account ? account.username : t('settings.notConnected');
  $('logout').hidden = !account;
  $('login-from-settings').hidden = Boolean(account);
  $('sync').hidden = !account;
  $('connect').hidden = Boolean(account);
}

$('open-settings').addEventListener('click', () => {
  renderThemes();
  renderLanguages();
  go('settings');
});
$('open-themes-dir').addEventListener('click', () => userThemes.dir && tiny.app.shell.open(userThemes.dir));
$('open-about').addEventListener('click', () => go('about'));

// ---------------------------------------------------------------- sobre / créditos

const CREDITS = [
  { name: 'tinyjs', what: { 'pt-BR': 'janela nativa + backend JS em ~6 MB', en: 'native window + JS backend in ~6 MB' }, lic: 'MIT', url: 'https://tinyjs.app' },
  { name: 'txiki.js', what: { 'pt-BR': 'runtime JavaScript do backend', en: 'backend JavaScript runtime' }, lic: 'MIT', url: 'https://github.com/saghul/txiki.js' },
  { name: 'tuya-device-sharing-sdk', what: { 'pt-BR': 'referência do login por QR (Tuya)', en: 'QR login reference (Tuya)' }, lic: 'MIT', url: 'https://github.com/tuya/tuya-device-sharing-sdk' },
  { name: 'tinytuya', what: { 'pt-BR': 'referência do protocolo local', en: 'local protocol reference' }, lic: 'MIT', url: 'https://github.com/jasonacox/tinytuya' },
  { name: '@noble/ciphers · @noble/hashes', what: { 'pt-BR': 'criptografia em JS puro', en: 'pure-JS cryptography' }, lic: 'MIT', url: 'https://paulmillr.com/noble/' },
  { name: 'qrcode-generator', what: { 'pt-BR': 'QR code do login', en: 'login QR code' }, lic: 'MIT', url: 'https://github.com/kazuhikoarase/qrcode-generator' },
  { name: 'Pixelify Sans', what: { 'pt-BR': 'fonte do tema Past Dream', en: 'Past Dream theme font' }, lic: 'OFL-1.1', url: 'https://github.com/eifetx/Pixelify-Sans' },
];

function renderAbout() {
  const cfg = window.TUYABAR;
  $('about-by').textContent = t('about.by', { author: cfg.author });
  $('credits').replaceChildren(
    ...CREDITS.map((c) => {
      const li = document.createElement('li');
      const link = document.createElement('button');
      link.type = 'button';
      link.textContent = c.name;
      link.addEventListener('click', () => tiny.app.shell.open(c.url));
      const lic = document.createElement('span');
      lic.className = 'lic';
      lic.textContent = c.lic;
      const what = document.createElement('span');
      what.className = 'what';
      what.textContent = pick(c.what);
      li.append(link, lic, what);
      return li;
    }),
  );
  tiny.app
    .info()
    .then((i) => ($('about-version').textContent = t('about.version', { version: i.version ?? '0.0.1' })))
    .catch(() => ($('about-version').textContent = t('about.version', { version: '0.0.1' })));
}
$('open-repo').addEventListener('click', () => tiny.app.shell.open(window.TUYABAR.repo));

// ---------------------------------------------------------------- login

let qrTimer = null;
let qrEnd = 0;

function showLoginError(msg) {
  $('login-error').textContent = msg;
  $('login-error').hidden = !msg;
}

function resetLogin() {
  clearInterval(qrTimer);
  $('login-form').hidden = false;
  $('qr-step').hidden = true;
  $('qr-btn').disabled = false;
  $('qr').replaceChildren();
}

function goLogin() {
  showLoginError('');
  go('login');
  $('user-code').focus();
}

function tickQr() {
  const s = Math.max(0, Math.round((qrEnd - Date.now()) / 1000));
  $('qr-timer').textContent = s ? t('login.expires', { time: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }) : t('login.expired');
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const userCode = $('user-code').value.trim();
  if (!userCode) return;
  showLoginError('');
  $('qr-btn').disabled = true;
  setBusy(1);
  try {
    const { svg, expiresInMs } = await tiny.api.call('loginStart', { userCode });
    $('qr').innerHTML = svg; // SVG gerado pelo nosso backend (qrcode-generator)
    $('login-form').hidden = true;
    $('qr-step').hidden = false;
    qrEnd = Date.now() + expiresInMs;
    tickQr();
    qrTimer = setInterval(tickQr, 1000);
    setStatus('status.waitingApp');
  } catch (err) {
    showLoginError(t('login.qrError', { error: err.message || err }));
    $('qr-btn').disabled = false;
  } finally {
    setBusy(-1);
  }
});

$('qr-cancel').addEventListener('click', () => {
  tiny.api.call('loginCancel');
  resetLogin();
  setStatus('status.loginCancelled');
});

$('skip').addEventListener('click', () => {
  tiny.api.call('loginCancel');
  resetLogin();
  navStack = [];
  go('devices', { push: false });
});

$('connect').addEventListener('click', goLogin);
$('login-from-settings').addEventListener('click', goLogin);

$('logout').addEventListener('click', async () => {
  await tiny.api.call('logout');
  account = null;
  renderAccount();
  navStack = [];
  go('login', { push: false });
  setStatus('status.loggedOut');
});

// ---------------------------------------------------------------- eventos do backend

tiny.api.on('devices', (list) => {
  devices = list;
  renderDevices();
});
tiny.api.on('persist', writeVault);

tiny.api.on('account', (a) => {
  account = a;
  renderAccount();
});

tiny.api.on('login-ok', ({ username }) => {
  resetLogin();
  navStack = [];
  go('devices', { push: false });
  setStatus('status.connectedAs', { user: username });
});

tiny.api.on('login-error', (msg) => {
  resetLogin();
  showLoginError(msg);
});

tiny.api.on('scan-start', ({ timeoutMs }) => {
  setBusy(1);
  $('scan').disabled = true;
  setStatus('status.scanning', { s: Math.round(timeoutMs / 1000) });
});

tiny.api.on('scan-end', ({ local }) => {
  setBusy(-1);
  $('scan').disabled = false;
  if (local) setStatus('status.foundLocal', { count: local });
  else setStatus('status.noneLocal', undefined, true);
});

tiny.api.on('sync-start', () => {
  setBusy(1);
  $('sync').disabled = true;
});

tiny.api.on('sync-end', ({ count, error }) => {
  setBusy(-1);
  $('sync').disabled = false;
  if (error) setStatus('status.cloudError', { error }, true);
  else setStatus('status.inAccount', { count });
});

tiny.api.on('warn', (msg) => {
  tiny.log(`[warn] ${msg}`);
  setStatusText(msg, true);
});

// ---------------------------------------------------------------- idioma

I18N.onChange(() => {
  renderTitle();
  renderDevices();
  renderAccount();
  renderThemes();
  renderLanguages();
  renderUserThemesInfo();
  renderAbout();
  if (!$('qr-step').hidden) tickQr();
  if (lastStatus.key) setStatus(lastStatus.key, lastStatus.vars, lastStatus.warn);
  // a página do gadget tem textos dinâmicos: remonta
  if (view === 'device' && currentDevice) openDevicePage(currentDevice);
});

// ---------------------------------------------------------------- janela

// Abre colada ao ícone da bandeja. No Windows a barra fica embaixo:
// se o ícone estiver na metade de baixo da tela, abrimos para cima.
async function openPanel() {
  try {
    const p = await tiny.tray.position();
    if (p) {
      const s = await tiny.win.getState();
      const screenH = s?.screen?.height ?? 1080;
      const x = Math.round(p.x + p.width / 2 - W / 2);
      const y = p.y > screenH / 2 ? Math.round(p.y - H - 8) : Math.round(p.y + p.height + 6);
      tiny.win.setPosition(Math.max(8, x), Math.max(8, y));
    } else tiny.win.center();
  } catch {
    tiny.win.center();
  }
  tiny.win.show();
}

tiny.api.on('open', async ({ scan }) => {
  await openPanel();
  if (scan) tiny.api.call('scan');
});

window.addEventListener('blur', () => {
  // não some enquanto o QR está na tela — o usuário está olhando para o celular
  if (view === 'login' && !$('qr-step').hidden) return;
  tiny.win.hide();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && tiny.win.hide());
for (const b of document.querySelectorAll('[data-action="hide"]')) b.addEventListener('click', () => tiny.win.hide());

$('scan').addEventListener('click', () => tiny.api.call('scan'));
$('sync').addEventListener('click', () => tiny.api.call('sync'));
$('quit').addEventListener('click', () => tiny.api.call('quit'));

// ---------------------------------------------------------------- boot

(async () => {
  await Promise.all([Themes.init(), I18N.init()]); // antes de mostrar a janela: sem "piscar"
  tiny.win.setSize(W, H);
  renderAbout();
  const vault = await readVault();
  const { loggedIn } = await tiny.api.call('restore', vault);
  let onboarded = false;
  try {
    onboarded = Boolean(await tiny.store.get('onboarded'));
  } catch {}
  renderAccount();
  if (loggedIn) go('devices', { push: false });
  else if (!onboarded) {
    showStep(1);
    go('onboarding', { push: false });
  } else go('login', { push: false });
  openPanel(); // em `tinyjs dev` a janela aparece direto
  loadUserThemes();
})();
