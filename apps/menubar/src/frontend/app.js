// UI do TuyaBar. Sem framework por enquanto — o React entra junto com os
// cards de controle (clima, luz, tomada…).

const $ = (id) => document.getElementById(id);
const W = 360;
const H = 520;

// ---------------------------------------------------------------- helpers

function setView(v) {
  document.body.dataset.view = v;
}

function setStatus(text, warn = false) {
  $('status').textContent = text;
  $('status').classList.toggle('warn', warn);
}

let busy = 0;
function setBusy(delta) {
  busy = Math.max(0, busy + delta);
  document.body.classList.toggle('busy', busy > 0);
}

function showLoginError(msg) {
  $('login-error').textContent = msg;
  $('login-error').hidden = !msg;
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
    setStatus('Não consegui salvar no cofre do sistema', true);
  }
}

// ---------------------------------------------------------------- dispositivos

function badgeFor(d) {
  if (d.sub) return ['via gateway', ''];
  if (!d.local) return ['fora da rede', ''];
  if (!d.known) return [`v${d.version}`, ''];
  if (!d.hasKey || !d.supportLocal) return ['sem controle local', 'warn'];
  return [`local · v${d.version}`, 'ok'];
}

function renderDevices(list) {
  const ul = $('list');
  ul.replaceChildren(
    ...list.map((d) => {
      const li = document.createElement('li');
      li.className = 'device' + (d.local || d.sub ? '' : ' away');
      const [label, tone] = badgeFor(d);
      const meta = [d.type, d.ip].filter(Boolean).join(' · ');
      li.innerHTML = `<span class="name"></span><span class="badge ${tone}"></span><span class="meta"></span>`;
      li.querySelector('.name').textContent = d.name;
      li.querySelector('.badge').textContent = label;
      li.querySelector('.meta').textContent = meta || d.id;
      li.title = d.id;
      return li;
    }),
  );
  document.body.classList.toggle('has-devices', list.length > 0);
}

// ---------------------------------------------------------------- login

let qrTimer = null;

function resetLogin() {
  clearInterval(qrTimer);
  $('login-form').hidden = false;
  $('qr-step').hidden = true;
  $('qr-btn').disabled = false;
  $('qr').replaceChildren();
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
    $('qr').innerHTML = svg;
    $('login-form').hidden = true;
    $('qr-step').hidden = false;
    const end = Date.now() + expiresInMs;
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      $('qr-timer').textContent = s ? `Expira em ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'QR expirado';
    };
    tick();
    qrTimer = setInterval(tick, 1000);
    setStatus('Aguardando confirmação no app…');
  } catch (err) {
    showLoginError(`Não deu para gerar o QR: ${err.message || err}. Confira o código de usuário.`);
    $('qr-btn').disabled = false;
  } finally {
    setBusy(-1);
  }
});

$('qr-cancel').addEventListener('click', () => {
  tiny.api.call('loginCancel');
  resetLogin();
  setStatus('Login cancelado');
});

$('skip').addEventListener('click', () => {
  tiny.api.call('loginCancel');
  resetLogin();
  setView('devices');
  $('connect').hidden = false;
});

$('connect').addEventListener('click', () => {
  showLoginError('');
  setView('login');
  $('user-code').focus();
});

$('logout').addEventListener('click', async () => {
  await tiny.api.call('logout');
  $('logout').hidden = true;
  $('sync').hidden = true;
  setView('login');
  setStatus('Conta desconectada');
});

// ---------------------------------------------------------------- eventos do backend

tiny.api.on('devices', renderDevices);
tiny.api.on('persist', writeVault);

tiny.api.on('account', ({ username }) => {
  $('logout').hidden = false;
  $('logout').title = username;
  $('sync').hidden = false;
  $('connect').hidden = true;
});

tiny.api.on('login-ok', ({ username }) => {
  resetLogin();
  setView('devices');
  setStatus(`Conectado como ${username}`);
});

tiny.api.on('login-error', (msg) => {
  resetLogin();
  showLoginError(msg);
});

tiny.api.on('scan-start', ({ timeoutMs }) => {
  setBusy(1);
  $('scan').disabled = true;
  setStatus(`Escutando a rede por ${Math.round(timeoutMs / 1000)}s…`);
});

tiny.api.on('scan-end', ({ local }) => {
  setBusy(-1);
  $('scan').disabled = false;
  setStatus(local ? `${local} dispositivo(s) na rede` : 'Nenhum dispositivo respondeu na rede', !local);
});

tiny.api.on('sync-start', () => {
  setBusy(1);
  $('sync').disabled = true;
});

tiny.api.on('sync-end', ({ count, error }) => {
  setBusy(-1);
  $('sync').disabled = false;
  if (error) setStatus(`Nuvem: ${error}`, true);
  else setStatus(`${count} dispositivo(s) na conta`);
});

tiny.api.on('warn', (msg) => {
  tiny.log(`[warn] ${msg}`);
  setStatus(msg, true);
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
  if (document.body.dataset.view === 'login' && !$('qr-step').hidden) return;
  tiny.win.hide();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && tiny.win.hide());

$('scan').addEventListener('click', () => tiny.api.call('scan'));
$('sync').addEventListener('click', () => tiny.api.call('sync'));
$('quit').addEventListener('click', () => tiny.api.call('quit'));

// ---------------------------------------------------------------- boot

(async () => {
  tiny.win.setSize(W, H);
  const vault = await readVault();
  const { loggedIn } = await tiny.api.call('restore', vault);
  setView(loggedIn ? 'devices' : 'login');
  if (!loggedIn) $('connect').hidden = false;
  openPanel(); // em `tinyjs dev` a janela aparece direto
})();
