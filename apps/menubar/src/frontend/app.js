// UI do spike. Sem framework de propósito — o React entra quando houver
// controle de dispositivo de verdade (cards de clima, luz, tomada…).

const $ = (id) => document.getElementById(id);
const list = $('list');
const statusEl = $('status');
const scanBtn = $('scan');
const devices = new Map();
const W = 360;
const H = 480;

function setStatus(text, warn = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('warn', warn);
}

function render(d) {
  let li = list.querySelector(`[data-id="${d.id}"]`);
  if (!li) {
    li = document.createElement('li');
    li.className = 'device';
    li.dataset.id = d.id;
    list.append(li);
  }
  const v = String(d.version);
  li.innerHTML = `
    <span class="name"></span>
    <span class="ver ${v === '3.5' ? 'v35' : ''}">v${v}</span>
    <span class="meta"></span>`;
  li.querySelector('.name').textContent = d.productKey || d.id;
  li.querySelector('.meta').textContent = `${d.ip} · ${d.id}`;
  document.body.classList.add('has-devices');
}

async function scan() {
  scanBtn.disabled = true;
  try {
    await tiny.api.call('scan', { timeoutMs: 8000 });
  } catch (e) {
    setStatus(String(e.message || e), true);
  } finally {
    scanBtn.disabled = false;
  }
}

// Abre a janela colada ao ícone da bandeja. No Windows a barra fica embaixo,
// então se o ícone estiver na metade de baixo da tela, abrimos para cima.
async function openPanel() {
  try {
    const p = await tiny.tray.position();
    if (p) {
      const s = await tiny.win.getState();
      const screenH = s?.screen?.height ?? 1080;
      const x = Math.round(p.x + p.width / 2 - W / 2);
      const y = p.y > screenH / 2 ? Math.round(p.y - H - 8) : Math.round(p.y + p.height + 6);
      tiny.win.setPosition(Math.max(8, x), Math.max(8, y));
    } else {
      tiny.win.center();
    }
  } catch {
    tiny.win.center();
  }
  tiny.win.show();
}

tiny.api.on('open', async ({ scan: doScan }) => {
  await openPanel();
  if (doScan) scan();
});
tiny.api.on('scan-start', ({ timeoutMs }) => {
  document.body.classList.add('scanning');
  setStatus(`Escutando a rede por ${Math.round(timeoutMs / 1000)}s…`);
});
tiny.api.on('scan-end', ({ count }) => {
  document.body.classList.remove('scanning');
  setStatus(count ? `${count} dispositivo(s)` : 'Nenhum dispositivo respondeu', !count);
});
tiny.api.on('device', ({ device }) => {
  devices.set(device.id, device);
  render(device);
});
tiny.api.on('warn', (msg) => {
  tiny.log(`[warn] ${msg}`);
  setStatus(msg, true);
});

// popover: some ao perder o foco
window.addEventListener('blur', () => tiny.win.hide());
document.addEventListener('keydown', (e) => e.key === 'Escape' && tiny.win.hide());

scanBtn.addEventListener('click', scan);
$('quit').addEventListener('click', () => tiny.api.call('quit'));

// em `tinyjs dev` a janela aparece direto; útil para iterar na UI
openPanel();
