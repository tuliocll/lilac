// A janela como popover da bandeja: abre colada ao ícone, some ao perder o
// foco, atalho global opcional. Fixada (alfinete), vira um painel flutuante:
// fica por cima das outras janelas, não some ao perder o foco e lembra onde foi deixada.
// Fixada, ela também recolhe (minimizar) para só a barra de título, e volta ao
// último tamanho que o usuário deixou (o tamanho é salvo quando ele redimensiona).
(() => {
  const { config } = Lilac;
  const { width: W, height: H } = config.panel;
  /** menor tamanho que aceitamos de volta do armazenamento (contra valores estranhos) */
  const MIN_SAVED = 200;
  const { t } = Lilac.i18n;
  const { $ } = Lilac.dom;

  /** Algo na tela precisa que o painel continue aberto (ex.: QR do login). */
  const keepOpenReasons = new Set();

  let pinned = false;
  /** Onde o painel fixado foi deixado ({ x, y }), para reabrir no mesmo lugar. */
  let pinnedAt = null;
  /** Tamanho do painel: o padrão ou o último que o usuário deixou. */
  let size = { width: W, height: H };
  /** Recolhido: só a barra de título (apenas com o painel fixado). */
  let collapsed = false;

  async function open() {
    if (pinned && (await placePinned())) return tiny.win.show();
    try {
      const icon = await tiny.tray.position();
      if (!icon) throw new Error('sem posição da bandeja');
      const state = await tiny.win.getState();
      const screenHeight = state?.screen?.height ?? 1080;
      // No Windows a barra fica embaixo: se o ícone está na metade de baixo, abre para cima.
      const x = Math.round(icon.x + icon.width / 2 - size.width / 2);
      const y = icon.y > screenHeight / 2 ? Math.round(icon.y - size.height - 8) : Math.round(icon.y + icon.height + 6);
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
    if (!on && collapsed) await setCollapsed(false); // solto, o painel não fica recolhido
    renderPinButton();
    renderCollapseButtons();
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

  // ---- tamanho e recolher

  const validSize = (s) => Boolean(s) && Number.isFinite(s.width) && Number.isFinite(s.height) && s.width >= MIN_SAVED && s.height >= MIN_SAVED;

  /** No boot: volta ao último tamanho que o usuário deixou (ou ao padrão). */
  async function initSize() {
    const saved = await tiny.store.get('panelSize').catch(() => null);
    if (validSize(saved)) size = { width: Math.round(saved.width), height: Math.round(saved.height) };
    await tiny.win.setSize(size.width, size.height);
  }

  /** O usuário redimensionou (bordas da janela): guarda o tamanho novo. */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(async () => {
      if (collapsed) return; // recolhido não é um tamanho escolhido
      try {
        const { width, height, visible, minimized } = await tiny.win.getState();
        const next = { width: Math.round(width), height: Math.round(height) };
        if (!visible || minimized || !validSize(next)) return;
        if (next.width === size.width && next.height === size.height) return;
        size = next;
        await tiny.store.set('panelSize', size);
      } catch (error) {
        logPin(error);
      }
    }, 400);
  });

  /** Altura só da barra de título, nas unidades do setSize (a caixa da página). */
  function headerHeight() {
    const win = document.querySelector('.window');
    const style = getComputedStyle(win);
    const bottom = document.querySelector('.titlebar').getBoundingClientRect().bottom;
    return Math.ceil(bottom + parseFloat(style.borderBottomWidth || '0') + parseFloat(style.marginBottom || '0'));
  }

  async function setCollapsed(on) {
    if (on && !pinned) return;
    if (on === collapsed) return;
    if (on) {
      // o tamanho atual vale como "último tamanho" (pode ter mudado agora)
      try {
        const { width, height } = await tiny.win.getState();
        if (validSize({ width, height })) size = { width: Math.round(width), height: Math.round(height) };
      } catch {}
      const header = headerHeight();
      collapsed = true;
      document.body.classList.add('collapsed');
      await tiny.win.setMinSize(MIN_SAVED, header).catch(logPin);
      await tiny.win.setSize(size.width, header).catch(logPin);
    } else {
      collapsed = false;
      document.body.classList.remove('collapsed');
      await tiny.win.setSize(size.width, size.height).catch(logPin);
    }
    renderCollapseButtons();
  }

  /**
   * Minimizar: desligado (apagado) sem o alfinete; fixado, recolhe para a barra
   * de título e vira "restaurar". Nos temas que escondem os botões da janela,
   * um botão igual aparece ao lado do alfinete, só com o painel fixado.
   */
  function renderCollapseButtons() {
    const controlsShown = getComputedStyle(document.querySelector('.window-controls')).display !== 'none';
    $('collapse-alt').hidden = controlsShown || !pinned;
    for (const b of document.querySelectorAll('[data-collapse]')) {
      b.setAttribute('aria-disabled', String(!pinned));
      const label = !pinned ? t('wc.minimize.pinFirst') : collapsed ? t('wc.expand') : t('wc.minimize');
      b.title = label;
      b.setAttribute('aria-label', label);
      b.querySelector('.glyph').dataset.g = collapsed ? 'maximize' : 'minimize';
    }
  }

  for (const b of document.querySelectorAll('[data-collapse]')) {
    b.addEventListener('click', () => pinned && setCollapsed(!collapsed));
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
  Lilac.i18n.onChange(() => {
    renderPinButton();
    renderCollapseButtons();
  });
  Lilac.themes.onChange(renderCollapseButtons);
  // o CSS do tema carrega depois da troca: só então dá para saber se ele mostra os botões da janela
  document.addEventListener('load', (e) => e.target instanceof HTMLLinkElement && renderCollapseButtons(), true);
  renderPinButton();
  renderCollapseButtons();

  Lilac.panel = { open, hide, keepOpen, setHotkey, initPin, initSize };
})();
