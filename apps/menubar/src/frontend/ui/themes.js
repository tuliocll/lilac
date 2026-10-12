// Gerenciador de temas: carrega as folhas de estilo, aplica `data-theme`
// no <html> e lembra a escolha. Temas do usuário chegam do backend como CSS.
// Contrato e como criar um tema: apps/menubar/THEMING.md
(() => {
  const DEFAULT = 'moonlight';
  const themes = new Map();
  const listeners = [];
  let current = DEFAULT;

  function register(theme) {
    themes.set(theme.id, theme);
    for (const href of [].concat(theme.href ?? [])) addStylesheet(theme.id, href);
    if (theme.css) addInlineStyle(theme.id, theme.css);
  }

  function addStylesheet(id, href) {
    if (document.querySelector(`link[data-theme-id="${id}"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.themeId = id;
    document.head.append(link);
  }

  function addInlineStyle(id, css) {
    let style = document.querySelector(`style[data-theme-id="${id}"]`);
    if (!style) {
      style = document.createElement('style');
      style.dataset.themeId = id;
      document.head.append(style);
    }
    style.textContent = css;
  }

  function apply(id) {
    current = themes.has(id) ? id : DEFAULT;
    document.documentElement.dataset.theme = current;
    for (const listener of listeners) listener(current);
  }

  const saved = () => tiny.store.get('theme').catch(() => null);

  async function init() {
    for (const theme of TuyaBar.builtinThemes) register(theme);
    apply((await saved()) || DEFAULT);
  }

  async function select(id) {
    apply(id);
    await tiny.store.set('theme', id).catch(() => {});
    tiny.api.call('prefsChanged', { kind: 'theme' }).catch(() => {});
  }

  /** Outra janela trocou o tema: relê do store. */
  async function reload() {
    apply((await saved()) || DEFAULT);
  }

  /** Temas da pasta do usuário: ficam disponíveis e, se um deles era o escolhido, é aplicado. */
  async function addUserThemes(list) {
    for (const theme of list) register({ ...theme, user: true });
    const choice = await saved();
    if (choice && choice !== current && themes.has(choice)) apply(choice);
  }

  TuyaBar.themes = {
    init,
    select,
    reload,
    addUserThemes,
    list: () => [...themes.values()],
    current: () => current,
    onChange: (fn) => listeners.push(fn),
  };
})();
