// Configurações: aparência, idioma, comportamento (abrir com o sistema,
// atalho global) e conta (sair, conectar, importar chaves).
(() => {
  const { $, h, button, logError } = TuyaBar.dom;
  const { t, pick } = TuyaBar.i18n;
  const status = TuyaBar.status;

  let account = null;
  let userThemes = { dir: null, count: 0, error: null };

  // ------------------------------------------------------------ aparência

  function renderThemes() {
    $('theme-list').replaceChildren(...TuyaBar.themes.list().map(themeOption));
    $('user-themes-info').textContent = userThemes.error
      ? t('settings.themesUnavailable')
      : userThemes.count
        ? t('settings.userThemes', { count: userThemes.count })
        : t('settings.noUserThemes');
  }

  function themeOption(theme) {
    const b = button('card theme-option');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(theme.id === TuyaBar.themes.current()));
    const swatches = h('span', 'swatches');
    swatches.setAttribute('aria-hidden', 'true');
    // amostras = dados do manifesto do tema (não são cores da interface)
    for (const color of (theme.swatches ?? []).slice(0, 5)) {
      const i = h('i');
      i.style.background = color;
      swatches.append(i);
    }
    b.append(h('span', 'name', pick(theme.name) + (theme.user ? ' ✦' : '')), swatches, h('span', 'desc', pick(theme.description) || theme.author || ''));
    b.addEventListener('click', () => TuyaBar.themes.select(theme.id));
    return b;
  }

  async function loadUserThemes() {
    try {
      const { dir, themes, error } = await tiny.api.call('userThemes');
      userThemes = { dir, count: themes.length, error };
      await TuyaBar.themes.addUserThemes(themes);
      if (error) tiny.log(`[themes] ${error}`);
    } catch (error) {
      userThemes.error = String(error.message ?? error);
    }
    renderThemes();
  }

  $('open-themes-dir').addEventListener('click', () => userThemes.dir && tiny.app.shell.open(userThemes.dir));
  TuyaBar.themes.onChange(renderThemes);

  // ------------------------------------------------------------ idioma

  function renderLanguages() {
    const select = $('language');
    const auto = h('option', '', t('settings.language.auto'));
    auto.value = 'auto';
    const languages = TuyaBar.i18n.LANGS.map((code) => {
      const option = h('option', '', TuyaBar.i18n.DICT[code]['lang.name']);
      option.value = code;
      return option;
    });
    select.replaceChildren(auto, ...languages);
    select.value = TuyaBar.i18n.preference();
  }
  $('language').addEventListener('change', (e) => TuyaBar.i18n.set(e.target.value));

  // ------------------------------------------------------------ comportamento

  async function renderStartup() {
    const sw = $('startup');
    const state = await tiny.app.launchAtLogin.get().catch(() => 'unsupported');
    // em `tinyjs dev` não existe app instalado para abrir com o sistema
    const unsupported = state === 'unsupported';
    sw.disabled = unsupported;
    sw.setAttribute('aria-checked', String(state === 'enabled' || state === 'requires-approval'));
    $('startup-hint').hidden = !unsupported;
  }

  $('startup').addEventListener('click', async () => {
    const enable = $('startup').getAttribute('aria-checked') !== 'true';
    await tiny.app.launchAtLogin.set(enable).catch(logError('launchAtLogin'));
    renderStartup();
  });

  async function hotkeyEnabled() {
    return (await tiny.store.get('hotkey').catch(() => null)) !== false; // ligado por padrão
  }

  async function renderHotkey() {
    $('hotkey').setAttribute('aria-checked', String(await hotkeyEnabled()));
    $('hotkey-label').textContent = t('settings.hotkey', { keys: TuyaBar.config.hotkey.toUpperCase().replaceAll('+', ' + ') });
  }

  $('hotkey').addEventListener('click', async () => {
    const enable = !(await hotkeyEnabled());
    await tiny.store.set('hotkey', enable).catch(() => {});
    await TuyaBar.panel.setHotkey(enable);
    renderHotkey();
  });

  // ------------------------------------------------------------ conta
  // (inclui o que muda fora daqui conforme há conta: ↻ na lista e o convite para conectar)

  function renderAccount() {
    $('account-name').textContent = account ? account.username : t('settings.notConnected');
    $('logout').hidden = !account;
    $('login-from-settings').hidden = Boolean(account);
    $('sync').hidden = !account;
    $('connect').hidden = Boolean(account);
  }

  $('logout').addEventListener('click', async () => {
    await tiny.api.call('logout').catch(logError('logout'));
    account = null;
    renderAccount();
    status.show('status.loggedOut');
    TuyaBar.login.open();
  });

  $('login-from-settings').addEventListener('click', () => TuyaBar.login.open());
  $('connect').addEventListener('click', () => TuyaBar.login.open());

  $('import-keys').addEventListener('click', async () => {
    // o diálogo tira o foco da janela; sem isso o painel sumiria
    TuyaBar.panel.keepOpen('dialog', true);
    const path = await tiny.dialog.openFile({ types: ['json'] }).catch(() => null);
    TuyaBar.panel.keepOpen('dialog', false);
    if (!path) return;
    try {
      const { count } = await tiny.api.call('importKeys', { path });
      status.show('settings.imported', { count });
    } catch (error) {
      status.show('settings.importError', { error: error.message ?? error }, { warn: true });
    }
  });

  tiny.api.on('account', (value) => {
    account = value;
    renderAccount();
  });

  // ------------------------------------------------------------ tela

  function open() {
    renderThemes();
    renderLanguages();
    renderStartup();
    renderHotkey();
    TuyaBar.nav.go('settings');
  }

  $('open-settings').addEventListener('click', open);
  $('open-intro').addEventListener('click', () => TuyaBar.onboarding.open());
  $('open-about').addEventListener('click', () => TuyaBar.about.open());

  TuyaBar.i18n.onChange(() => {
    renderAccount();
    renderThemes();
    renderLanguages();
    renderHotkey();
  });

  TuyaBar.settings = { loadUserThemes, renderAccount, hotkeyEnabled };
})();
