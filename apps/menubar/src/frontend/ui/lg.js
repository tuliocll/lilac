// Conta LG ThinQ: a tela de conexão (do onboarding ou do aviso na lista) e o
// pedido de conexão em si, que as Configurações também usam.
(() => {
  const { $ } = Lilac.dom;
  const { t } = Lilac.i18n;
  const status = Lilac.status;

  /** Conecta com o token; devolve quantos ares vieram. Falha com uma mensagem para mostrar. */
  async function connect(token, country) {
    const done = status.busy();
    try {
      const { count, error } = await tiny.api.call('lgConnect', { token, country });
      if (error === 'country') throw new Error(t('lg.error.country'));
      if (error === 'token') throw new Error(t('lg.error.token'));
      status.show('settings.lg.ok', { count });
      return count;
    } finally {
      done();
    }
  }

  /** País do sistema (pt-BR → BR) como sugestão; a pessoa troca se a conta LG for de outro. */
  const systemCountry = () => (navigator.language.split('-')[1] ?? '').toUpperCase();

  function showError(message) {
    $('lg-login-error').textContent = message;
    $('lg-login-error').hidden = !message;
  }

  function open() {
    showError('');
    if (!$('lg-login-country').value) $('lg-login-country').value = systemCountry();
    Lilac.nav.go('lg-login');
    // o token é copiado do navegador: o painel não pode sumir ao perder o foco
    Lilac.panel.keepOpen('lg', true);
    $('lg-login-token').focus();
  }

  $('lg-login-site').addEventListener('click', () => tiny.app.shell.open(Lilac.config.lgTokenUrl));

  $('lg-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    $('lg-login-connect').disabled = true;
    try {
      await connect($('lg-login-token').value, $('lg-login-country').value);
      $('lg-login-token').value = '';
      Lilac.nav.go('devices', { replace: true });
    } catch (error) {
      showError(t('settings.lg.error', { error: error.message ?? error }));
    } finally {
      $('lg-login-connect').disabled = false;
    }
  });

  $('lg-login-skip').addEventListener('click', () => Lilac.nav.go('devices', { replace: true }));
  Lilac.nav.onLeave('lg-login', () => Lilac.panel.keepOpen('lg', false));

  Lilac.lg = { open, connect };
})();
