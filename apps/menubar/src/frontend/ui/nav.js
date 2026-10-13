// Navegação entre telas: cada tela é uma <section class="view" data-for="…">
// e o CSS mostra a que bate com body[data-view]. "Voltar" usa uma pilha.
(() => {
  const { $ } = Lilac.dom;
  const { t } = Lilac.i18n;

  const TITLES = {
    onboarding: 'title.onboarding',
    login: 'title.login',
    devices: 'title.devices',
    settings: 'title.settings',
    about: 'title.about',
  };

  let current = 'loading';
  let stack = [];
  let customTitle = null;
  const leaveListeners = new Map();

  function renderTitle() {
    $('title').textContent = customTitle ?? t(TITLES[current] ?? 'title.devices');
  }

  function show(view, title = null) {
    if (view !== current) leaveListeners.get(current)?.();
    current = view;
    customTitle = title;
    document.body.dataset.view = view;
    renderTitle();
  }

  /** Vai para uma tela. `replace` limpa o histórico (ex.: depois do login). */
  function go(view, { replace = false, title = null } = {}) {
    if (replace) stack = [];
    else if (view !== current && current !== 'loading') stack.push(current);
    show(view, title);
  }

  function back() {
    show(stack.pop() ?? 'devices');
  }

  /** Executa `fn` sempre que a tela `view` for deixada. */
  const onLeave = (view, fn) => leaveListeners.set(view, fn);

  for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', back);
  Lilac.i18n.onChange(renderTitle);

  Lilac.nav = { go, back, onLeave, current: () => current };
})();
