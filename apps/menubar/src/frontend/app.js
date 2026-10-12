// Inicialização do TuyaBar e eventos gerais do backend.
// As telas moram em ui/*.js; a ordem dos <script> no index.html é a de dependência.
//
// Duas janelas rodam este mesmo código. O painel da bandeja ('main') é o dono
// do cofre, da bandeja e do atalho; a janela expandida só mostra e controla.
(() => {
  const { $, logError } = TuyaBar.dom;
  const { t } = TuyaBar.i18n;
  const status = TuyaBar.status;
  const isPanel = TuyaBar.config.shell === 'panel';

  // ---- eventos do backend

  if (isPanel) {
    tiny.api.on('persist', (data) =>
      TuyaBar.vault.write(data).catch((error) => {
        logError('vault')(error);
        status.show('status.vaultError', undefined, { warn: true });
      }),
    );

    tiny.api.on('open', async ({ scan }) => {
      await TuyaBar.panel.open();
      if (scan) tiny.api.call('scan');
    });
  }

  // tema, idioma ou atalho mudou na outra janela
  tiny.api.on('prefs', async ({ kind, from }) => {
    if (from === (tiny.win.id ?? 'main')) return;
    if (kind === 'theme') await TuyaBar.themes.reload();
    if (kind === 'language') await TuyaBar.i18n.reload();
    if (kind === 'hotkey') {
      if (isPanel) await TuyaBar.panel.setHotkey(await TuyaBar.settings.hotkeyEnabled());
      TuyaBar.settings.renderHotkey();
    }
  });

  tiny.api.on('scan-start', () => {
    $('scan').disabled = true;
    status.show('status.searching');
  });

  tiny.api.on('scan-end', () => {
    $('scan').disabled = false;
    const reachable = TuyaBar.devices.all().filter((d) => d.route === 'local').length;
    status.show('status.foundLocal', { count: reachable });
  });

  let syncing = null;
  tiny.api.on('sync-start', () => {
    syncing = status.busy();
    $('sync').disabled = true;
  });
  tiny.api.on('sync-end', ({ count, error }) => {
    syncing?.();
    $('sync').disabled = false;
    if (error) status.show('status.cloudError', { error }, { warn: true });
    else status.show('status.inAccount', { count });
  });

  tiny.api.on('warn', (message) => {
    tiny.log(`[warn] ${message}`);
    status.showText(message, { warn: true });
  });

  $('scan').addEventListener('click', () => tiny.api.call('scan').catch(logError('scan')));
  $('sync').addEventListener('click', () => tiny.api.call('sync').catch(logError('sync')));
  $('quit').addEventListener('click', () => tiny.api.call('quit'));

  // ---- menu da bandeja no idioma escolhido

  const sendTrayLabels = () =>
    tiny.api
      .call('trayLabels', {
        open: t('tray.open'),
        window: t('tray.window'),
        scan: t('tray.scan'),
        quit: t('tray.quit'),
        favorites: t('tray.favorites'),
      })
      .catch(logError('trayLabels'));
  if (isPanel) TuyaBar.i18n.onChange(sendTrayLabels);

  // ---- boot

  /** Painel: lê o cofre e entrega ao backend. Devolve se há conta. */
  async function restoreFromVault() {
    tiny.win.setSize(TuyaBar.panel.size.W, TuyaBar.panel.size.H);
    sendTrayLabels();
    if (await TuyaBar.settings.hotkeyEnabled()) TuyaBar.panel.setHotkey(true);
    const saved = await TuyaBar.vault.read();
    const { loggedIn } = await tiny.api.call('restore', saved);
    return loggedIn;
  }

  /** Janela expandida: o backend já está carregado; só pergunta quem está conectado. */
  async function joinSession() {
    const { account } = await tiny.api.call('session');
    TuyaBar.settings.setAccount(account);
    return Boolean(account);
  }

  async function boot() {
    // tema e idioma antes de mostrar a janela: nada de "piscar"
    await Promise.all([TuyaBar.themes.init(), TuyaBar.i18n.init()]);
    await TuyaBar.devices.init();
    const loggedIn = await (isPanel ? restoreFromVault() : joinSession());
    TuyaBar.settings.renderAccount();

    status.clear();
    if (loggedIn) TuyaBar.nav.go('devices', { replace: true });
    else if (await TuyaBar.onboarding.wasSeen()) TuyaBar.login.open();
    else TuyaBar.onboarding.open();

    TuyaBar.panel.open(); // em `tinyjs dev` a janela aparece direto
    TuyaBar.settings.loadUserThemes();
  }

  boot().catch((error) => {
    logError('boot')(error);
    status.showText(String(error?.message ?? error), { warn: true });
  });
})();
