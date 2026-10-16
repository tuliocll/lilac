// Configurações: aparência, idioma, comportamento (abrir com o sistema,
// atalho global) e conta (sair, conectar, importar chaves).
(() => {
  const { $, h, button, glyph, logError } = Lilac.dom;
  const { t, pick } = Lilac.i18n;
  const status = Lilac.status;

  let account = null;
  let userThemes = { dir: null, count: 0, error: null };

  // ------------------------------------------------------------ aparência

  /** Toda grade de temas (configurações e boas-vindas) — escolher aplica na hora. */
  function renderThemes() {
    for (const list of document.querySelectorAll('.theme-list')) list.replaceChildren(...Lilac.themes.list().map(themeOption));
    $('user-themes-info').textContent = userThemes.error
      ? t('settings.themesUnavailable')
      : userThemes.count
        ? t('settings.userThemes', { count: userThemes.count })
        : t('settings.noUserThemes');
  }

  function themeOption(theme) {
    const b = button('card theme-option');
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(theme.id === Lilac.themes.current()));
    const swatches = h('span', 'swatches');
    swatches.setAttribute('aria-hidden', 'true');
    // amostras = dados do manifesto do tema (não são cores da interface)
    for (const color of (theme.swatches ?? []).slice(0, 5)) {
      const i = h('i');
      i.style.background = color;
      swatches.append(i);
    }
    const name = h('span', 'name', pick(theme.name) + (theme.user ? ' ✦' : ''));
    name.append(glyph('check')); // escolhido: além do anel, um ✓ (não depende só de cor)
    name.lastChild.classList.add('check');
    // grade compacta: nome e cores; a descrição fica no "title" (passar o mouse) e no leitor de tela
    const desc = pick(theme.description) || theme.author || '';
    b.title = desc;
    b.setAttribute('aria-description', desc);
    b.append(name, swatches);
    b.addEventListener('click', () => Lilac.themes.select(theme.id));
    return b;
  }

  async function loadUserThemes() {
    try {
      const { dir, themes, error } = await tiny.api.call('userThemes');
      userThemes = { dir, count: themes.length, error };
      await Lilac.themes.addUserThemes(themes);
      if (error) tiny.log(`[themes] ${error}`);
    } catch (error) {
      userThemes.error = String(error.message ?? error);
    }
    renderThemes();
  }

  $('open-themes-dir').addEventListener('click', () => userThemes.dir && tiny.app.shell.open(userThemes.dir));
  Lilac.themes.onChange(renderThemes);

  // ------------------------------------------------------------ idioma

  function renderLanguages() {
    const select = $('language');
    const auto = h('option', '', t('settings.language.auto'));
    auto.value = 'auto';
    const languages = Lilac.i18n.LANGS.map((code) => {
      const option = h('option', '', Lilac.i18n.DICT[code]['lang.name']);
      option.value = code;
      return option;
    });
    select.replaceChildren(auto, ...languages);
    select.value = Lilac.i18n.preference();
  }
  $('language').addEventListener('change', (e) => Lilac.i18n.set(e.target.value));

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
    $('hotkey-label').textContent = t('settings.hotkey', { keys: Lilac.config.hotkey.toUpperCase().replaceAll('+', ' + ') });
  }

  $('hotkey').addEventListener('click', async () => {
    const enable = !(await hotkeyEnabled());
    await tiny.store.set('hotkey', enable).catch(() => {});
    await Lilac.panel.setHotkey(enable);
    renderHotkey();
  });

  // ------------------------------------------------------------ conta
  // (inclui o que muda fora daqui conforme há conta: ↻ na lista e o convite para conectar)

  function renderAccount() {
    $('account-name').textContent = account ? account.username : t('settings.notConnected');
    $('logout').hidden = !account;
    $('login-from-settings').hidden = Boolean(account);
    $('sync').hidden = !account && !lg; // ↻ busca nas duas contas
    $('connect').hidden = Boolean(account) || Boolean(lg);
    // token recusado pela LG: continua "conectada", mas pede um token novo
    $('lg-name').textContent = !lg ? t('settings.notConnected') : lg.tokenRefused ? t('settings.lg.tokenRefused') : t('settings.lg.connected', { country: lg.country });
    $('lg-disconnect').hidden = !lg || lg.tokenRefused;
    $('lg-open').hidden = Boolean(lg) && !lg.tokenRefused;
  }

  $('logout').addEventListener('click', async () => {
    await tiny.api.call('logout').catch(logError('logout'));
    account = null;
    renderAccount();
    status.show('status.loggedOut');
    Lilac.login.open();
  });

  $('login-from-settings').addEventListener('click', () => Lilac.login.open());
  // o aviso na lista leva à escolha da conta (Smart Life ou LG), o último passo das boas-vindas
  $('connect').addEventListener('click', () => Lilac.onboarding.open(Lilac.onboarding.LAST));

  $('import-keys').addEventListener('click', async () => {
    // o diálogo tira o foco da janela; sem isso o painel sumiria
    Lilac.panel.keepOpen('dialog', true);
    const path = await tiny.dialog.openFile({ types: ['json'] }).catch(() => null);
    Lilac.panel.keepOpen('dialog', false);
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

  // ------------------------------------------------------------ LG ThinQ

  let lg = null;

  // a mesma tela das boas-vindas: tem o passo a passo do token e segura o painel aberto
  $('lg-open').addEventListener('click', () => Lilac.lg.open());

  $('lg-disconnect').addEventListener('click', async () => {
    await tiny.api.call('lgDisconnect').catch(logError('lgDisconnect'));
    status.show('settings.lg.disconnected');
  });

  tiny.api.on('thinq', (value) => {
    lg = value;
    renderAccount();
  });

  // ------------------------------------------------------------ tela

  function open() {
    renderThemes();
    renderLanguages();
    renderStartup();
    renderHotkey();
    Lilac.nav.go('settings');
  }

  $('open-settings').addEventListener('click', open);
  $('open-intro').addEventListener('click', () => Lilac.onboarding.open());
  $('open-about').addEventListener('click', () => Lilac.about.open());

  Lilac.i18n.onChange(() => {
    renderAccount();
    renderThemes();
    renderLanguages();
    renderHotkey();
  });

  Lilac.settings = { renderThemes, loadUserThemes, renderAccount, hotkeyEnabled };
})();
