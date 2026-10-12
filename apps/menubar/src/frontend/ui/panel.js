// A janela como popover da bandeja: abre colada ao ícone, some ao perder o
// foco, atalho global opcional.
(() => {
  const { config } = TuyaBar;
  const { width: W, height: H } = config.panel;

  /** Algo na tela precisa que o painel continue aberto (ex.: QR do login). */
  const keepOpenReasons = new Set();

  async function open() {
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

  window.addEventListener('blur', () => keepOpenReasons.size === 0 && hide());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
  for (const b of document.querySelectorAll('[data-action="hide"]')) b.addEventListener('click', hide);

  TuyaBar.panel = { open, hide, keepOpen, setHotkey, size: { W, H } };
})();
