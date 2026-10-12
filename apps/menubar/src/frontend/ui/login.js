// Login por QR no Smart Life: código de usuário → QR → confirmação no celular.
(() => {
  const { $ } = TuyaBar.dom;
  const { t } = TuyaBar.i18n;
  const status = TuyaBar.status;

  let countdown = null;
  let expiresAt = 0;

  function showError(message) {
    $('login-error').textContent = message;
    $('login-error').hidden = !message;
  }

  function reset() {
    clearInterval(countdown);
    $('login-form').hidden = false;
    $('qr-step').hidden = true;
    $('qr-btn').disabled = false;
    $('qr').replaceChildren();
    TuyaBar.panel.keepOpen('qr', false);
  }

  function tick() {
    const seconds = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('qr-timer').textContent = seconds ? t('login.expires', { time }) : t('login.expired');
  }

  function open() {
    showError('');
    reset();
    TuyaBar.nav.go('login');
    $('user-code').focus();
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userCode = $('user-code').value.trim();
    if (!userCode) return;
    showError('');
    $('qr-btn').disabled = true;
    const done = status.busy();
    try {
      const { svg, expiresInMs } = await tiny.api.call('loginStart', { userCode });
      $('qr').innerHTML = svg; // SVG gerado pelo nosso backend (qrcode-generator), sem conteúdo externo
      $('login-form').hidden = true;
      $('qr-step').hidden = false;
      // o usuário está olhando para o celular: o painel não pode sumir agora
      TuyaBar.panel.keepOpen('qr', true);
      expiresAt = Date.now() + expiresInMs;
      tick();
      countdown = setInterval(tick, 1000);
      status.show('status.waitingApp');
    } catch (error) {
      showError(t('login.qrError', { error: error.message ?? error }));
      $('qr-btn').disabled = false;
    } finally {
      done();
    }
  });

  $('qr-cancel').addEventListener('click', () => {
    tiny.api.call('loginCancel');
    reset();
    status.show('status.loginCancelled');
  });

  $('skip').addEventListener('click', () => {
    tiny.api.call('loginCancel');
    reset();
    TuyaBar.nav.go('devices', { replace: true });
  });

  tiny.api.on('login-ok', ({ username }) => {
    reset();
    TuyaBar.nav.go('devices', { replace: true });
    status.show('status.connectedAs', { user: username });
  });

  tiny.api.on('login-error', (message) => {
    reset();
    showError(message);
  });

  TuyaBar.i18n.onChange(() => !$('qr-step').hidden && tick());
  TuyaBar.nav.onLeave('login', reset);

  TuyaBar.login = { open };
})();
