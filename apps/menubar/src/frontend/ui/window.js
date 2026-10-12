// Janela expandida: menu lateral e o que só faz sentido nela.
// No painel da bandeja este arquivo só liga o botão "abrir em janela".
(() => {
  const { $, logError } = TuyaBar.dom;
  const { nav } = TuyaBar;

  $('open-window').addEventListener('click', () => tiny.api.call('openWindow').catch(logError('openWindow')));

  if (TuyaBar.config.shell !== 'window') return;

  // ---- menu lateral: cada item é uma tela "raiz" (sem pilha de voltar)

  const OPEN = {
    devices: () => nav.go('devices', { replace: true }),
    settings: () => {
      TuyaBar.settings.open();
      nav.go('settings', { replace: true });
    },
    about: () => {
      TuyaBar.about.open();
      nav.go('about', { replace: true });
    },
  };

  /** O aparelho aberto aparece ao lado da lista, então "Aparelhos" segue marcado. */
  const sectionOf = (view) => (view === 'device' ? 'devices' : view);

  function markCurrent(view) {
    for (const item of document.querySelectorAll('[data-side]')) {
      if (item.dataset.side === sectionOf(view)) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  for (const item of document.querySelectorAll('[data-side]')) item.addEventListener('click', () => OPEN[item.dataset.side]());
  nav.onChange(markCurrent);

  // já aberta e chamada de novo (bandeja, botão do painel): volta para a frente
  tiny.api.on('raise', () => {
    tiny.win.restore?.();
    tiny.win.show();
  });
})();
