// A janela como popover da bandeja: abre colada ao ícone, some ao perder o
// foco, atalho global opcional. Na janela expandida (config.shell === 'window')
// é só uma janela comum: não some, não se posiciona e não registra atalho.
(() => {
  const { config } = TuyaBar;
  const isPanel = config.shell === 'panel';
  const { width: W, height: H } = config.panel;

  /** Algo na tela precisa que o painel continue aberto (ex.: QR do login). */
  const keepOpenReasons = new Set();

  async function open() {
    if (!isPanel) return tiny.win.show();
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

  const hide = () => tiny.win.hide();

  function keepOpen(reason, on) {
    if (on) keepOpenReasons.add(reason);
    else keepOpenReasons.delete(reason);
  }

  // ---- atalho global

  async function setHotkey(enabled) {
    if (!isPanel) return false; // o atalho é do painel; a janela avisa o painel (ver settings.js)
    try {
      if (enabled) await tiny.hotkey.register('open-panel', config.hotkey);
      else await tiny.hotkey.unregister('open-panel');
      return true;
    } catch (error) {
      tiny.log(`[hotkey] ${error?.message ?? error}`);
      return false;
    }
  }
  if (isPanel) {
    tiny.hotkey.on((id) => id === 'open-panel' && open());
    window.addEventListener('blur', () => keepOpenReasons.size === 0 && hide());
  }
  // Esc: no painel, esconde; na janela, fecha o aparelho aberto ao lado da lista
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isPanel) hide();
    else if (TuyaBar.nav.current() === 'device') TuyaBar.nav.back();
  });
  for (const b of document.querySelectorAll('[data-action="hide"]')) b.addEventListener('click', hide);

  TuyaBar.panel = { open, hide, keepOpen, setHotkey, size: { W, H } };
})();
