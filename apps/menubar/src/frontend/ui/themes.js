// Gerenciador de temas: carrega folhas de estilo, aplica `data-theme`
// e lembra a escolha. Temas do usuário chegam do backend como texto CSS.

window.Themes = (() => {
  const themes = new Map();
  let current = 'moonlight';
  const listeners = [];

  function register(theme) {
    themes.set(theme.id, theme);
    if (theme.href && !document.querySelector(`link[data-theme-id="${theme.id}"]`)) {
      for (const href of [].concat(theme.href)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.themeId = theme.id;
        document.head.append(link);
      }
    }
    if (theme.css) {
      let style = document.querySelector(`style[data-theme-id="${theme.id}"]`);
      if (!style) {
        style = document.createElement('style');
        style.dataset.themeId = theme.id;
        document.head.append(style);
      }
      style.textContent = theme.css;
    }
  }

  function apply(id) {
    if (!themes.has(id)) id = 'moonlight';
    current = id;
    document.documentElement.dataset.theme = id;
    for (const l of listeners) l(id);
    return id;
  }

  async function select(id) {
    apply(id);
    try {
      await tiny.store.set('theme', id);
    } catch {}
  }

  async function init() {
    for (const t of window.BUILTIN_THEMES) register(t);
    let saved = null;
    try {
      saved = await tiny.store.get('theme');
    } catch {}
    apply(saved || 'moonlight');
  }

  /** Temas da pasta do usuário: ficam disponíveis e reaplicam a escolha salva. */
  async function loadUserThemes(list) {
    for (const t of list) register({ ...t, user: true });
    let saved = null;
    try {
      saved = await tiny.store.get('theme');
    } catch {}
    if (saved && themes.has(saved) && saved !== current) apply(saved);
  }

  return {
    init,
    loadUserThemes,
    select,
    list: () => [...themes.values()],
    get current() {
      return current;
    },
    onChange: (fn) => listeners.push(fn),
  };
})();
