// A janela como popover da bandeja: abre colada ao ícone, some ao perder o
// foco, atalho global opcional. Fixada (alfinete), vira um painel flutuante:
// fica por cima das outras janelas, não some ao perder o foco e lembra onde foi deixada.
(() => {
  const { config } = Lilac;
  const { width: W, height: H } = config.panel;
  const { t } = Lilac.i18n;
  const { $ } = Lilac.dom;

  /** Algo na tela precisa que o painel continue aberto (ex.: QR do login). */
  const keepOpenReasons = new Set();

  let pinned = false;
  /** Onde o painel fixado foi deixado ({ x, y }), para reabrir no mesmo lugar. */
  let pinnedAt = null;

  async function open() {
    if (pinned && (await placePinned())) return tiny.win.show();
    try {
      const icon = await tiny.tray.position();
      if (!icon) throw new Error('sem posição da bandeja');
      const state = await tiny.win.getState();
      const screenHeight = state?.screen?.height ?? 1080;
      const x = Math.round(icon.x + icon.width / 2 - W / 2);
      // No Windows a barra fica embaixo: se o ícone está na metade de baixo, abre para cima.
      const y = icon.y > screenHeight / 2 ? Math.round(icon.y - H - 8) : Math.round(icon.y + icon.height + 6);
      tiny.win.setPosition(Math.max(8, x), Math.max(8, y));
    } catch {
      tiny.win.center();
    }
    tiny.win.show();
  }

  const hide = () => {
    if (pinned) rememberPosition();
    tiny.win.hide();
  };

  function keepOpen(reason, on) {
    if (on) keepOpenReasons.add(reason);
    else keepOpenReasons.delete(reason);
  }

  // ---- fixar o painel

  const logPin = (error) => tiny.log(`[pin] ${error?.message ?? error}`);
  const validPoint = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /**
   * Põe o painel fixado onde ele foi deixado. Já visível, fica onde está (pode
   * ter sido arrastado agora). Em outro monitor vale a posição como está; se
   * esse monitor sumiu, o tinyjs traz a janela para a tela mais próxima.
   */
  async function placePinned() {
    try {
      if ((await tiny.win.getState()).visible) return true;
      if (!validPoint(pinnedAt)) return false;
      await tiny.win.setPosition(pinnedAt.x, pinnedAt.y);
      await tiny.win.ensureOnScreen();
      return true;
    } catch {
      return false;
    }
  }

  /** Guarda onde o painel está — só com ele na tela (escondido ou minimizado, x/y não dizem nada). */
  async function rememberPosition() {
    try {
      const { x, y, visible, minimized } = await tiny.win.getState();
      if (!visible || minimized || (pinnedAt?.x === x && pinnedAt?.y === y)) return;
      pinnedAt = { x, y };
      await tiny.store.set('pinnedAt', pinnedAt);
    } catch (error) {
      logPin(error);
    }
  }

  /** O nome do botão é fixo ("Fixar painel"); aria-pressed diz se está fixado. */
  function renderPinButton() {
    const b = $('pin');
    b.setAttribute('aria-pressed', String(pinned));
    b.title = t(pinned ? 'wc.unpin' : 'wc.pin');
  }

  async function setPinned(on, { save = true } = {}) {
    pinned = on;
    renderPinButton();
    // 'floating': continua visível quando outro app ganha o foco.
    // acceptsFirstMouse: o primeiro clique no painel já age, sem só focar.
    await tiny.win.setLevel(on ? 'floating' : 'normal').catch(logPin);
    await tiny.win.setChrome({ acceptsFirstMouse: on }).catch(logPin);
    if (on && save) await rememberPosition(); // no boot, vale a posição salva
    // o valor atual, não o pedido: dois cliques rápidos não podem gravar fora de ordem
    if (save) await tiny.store.set('pinned', pinned).catch(() => {});
  }

  async function initPin() {
    try {
      const saved = await tiny.store.get('pinnedAt');
      pinnedAt = validPoint(saved) ? saved : null;
      if (await tiny.store.get('pinned')) await setPinned(true, { save: false });
    } catch {}
  }

  // ---- atalho global

  async function setHotkey(enabled) {
    try {
      if (enabled) await tiny.hotkey.register('open-panel', config.hotkey);
      else await tiny.hotkey.unregister('open-panel');
      return true;
    } catch (error) {
      tiny.log(`[hotkey] ${error?.message ?? error}`);
      return false;
    }
  }
  tiny.hotkey.on((id) => id === 'open-panel' && open());

  window.addEventListener('blur', () => {
    if (pinned) rememberPosition(); // o usuário pode ter arrastado o painel antes de clicar fora
    else if (keepOpenReasons.size === 0) hide();
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
  for (const b of document.querySelectorAll('[data-action="hide"]')) b.addEventListener('click', hide);
  $('pin').addEventListener('click', () => setPinned(!pinned));
  Lilac.i18n.onChange(renderPinButton);
  renderPinButton();

  Lilac.panel = { open, hide, keepOpen, setHotkey, initPin, size: { W, H } };
})();
