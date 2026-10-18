// Atualizações: aviso na lista quando sai versão nova (opcional) e a seção
// "Atualizações" nas configurações, para procurar na mão.
//
// Quem baixa, confere o sha256, troca os arquivos e reinicia é o tinyjs
// (update.check / update.install). Aqui só decidimos quando perguntar:
//   - "Agora não" esconde o aviso até o app abrir de novo;
//   - "Não avisar mais" desliga o aviso (dá para religar e procurar nas configurações).
(() => {
  const { $, logError } = Lilac.dom;
  const { t } = Lilac.i18n;
  const status = Lilac.status;

  const NOTIFY_KEY = 'updateNotify';
  const FIRST_CHECK_MS = 5000; // deixa a janela abrir primeiro
  const NOTES_MAX = 280; // notas curtas: o painel é pequeno

  let found = null; // { current, latest, notes } quando há versão nova
  let dismissed = false; // "Agora não" (só nesta sessão)
  let checking = false;

  async function notifyEnabled() {
    return (await tiny.store.get(NOTIFY_KEY).catch(() => null)) !== false; // ligado por padrão
  }

  const shortNotes = (notes) => {
    const text = String(notes ?? '').trim();
    return text.length > NOTES_MAX ? `${text.slice(0, NOTES_MAX).trimEnd()}…` : text;
  };

  /** Consulta o manifesto. Devolve { available, current, latest, notes }. */
  async function check() {
    const result = await tiny.api.call('update.check');
    found = result.available ? { current: result.current, latest: result.latest, notes: result.notes } : null;
    return result;
  }

  async function install(trigger) {
    if (trigger) trigger.disabled = true;
    const done = status.busy();
    status.show('update.installing');
    try {
      await tiny.api.call('update.install'); // se der certo, o app reinicia na versão nova
    } catch (error) {
      logError('update.install')(error);
      status.show('update.installError', { error: error.message ?? error }, { warn: true });
      if (trigger) trigger.disabled = false;
    } finally {
      done();
    }
  }

  // ------------------------------------------------------------ aviso na lista

  function renderBanner() {
    const show = Boolean(found) && !dismissed;
    $('update-banner').hidden = !show;
    if (!show) return;
    $('update-title').textContent = t('update.available', { version: found.latest });
    const notes = shortNotes(found.notes);
    $('update-notes').textContent = notes;
    $('update-notes').hidden = !notes;
  }

  $('update-install').addEventListener('click', (e) => install(e.currentTarget));
  $('update-later').addEventListener('click', () => {
    dismissed = true;
    renderBanner();
  });
  $('update-never').addEventListener('click', async () => {
    await tiny.store.set(NOTIFY_KEY, false).catch(() => {});
    dismissed = true;
    renderBanner();
    renderSettings();
    status.show('update.neverHint');
  });

  /** Checagem automática ao abrir: silenciosa (sem internet é normal). */
  async function autoCheck() {
    if (!(await notifyEnabled())) return;
    try {
      await check();
    } catch (error) {
      tiny.log(`[update] ${error?.message ?? error}`);
      return;
    }
    renderBanner();
    renderSettings();
  }

  // ------------------------------------------------------------ configurações

  // resultado da última busca feita na mão: 'upToDate' | 'error' | null
  let manual = null;

  async function renderSettings() {
    $('update-notify').setAttribute('aria-checked', String(await notifyEnabled()));
    const info = await tiny.app.info().catch(() => null);
    $('update-current').textContent = info?.version ? t('update.current', { version: info.version }) : '';

    const box = $('update-result');
    box.hidden = !found && !manual;
    if (box.hidden) return;
    const notes = found ? shortNotes(found.notes) : '';
    $('update-result-title').textContent = found
      ? t('update.available', { version: found.latest })
      : t(manual === 'error' ? 'update.checkError' : 'update.upToDate');
    $('update-result-notes').textContent = notes;
    $('update-result-notes').hidden = !notes;
    $('update-result-install').hidden = !found;
  }

  $('update-notify').addEventListener('click', async () => {
    const enable = !(await notifyEnabled());
    await tiny.store.set(NOTIFY_KEY, enable).catch(() => {});
    if (enable) dismissed = false;
    renderBanner();
    renderSettings();
  });

  $('update-check').addEventListener('click', async (e) => {
    if (checking) return;
    checking = true;
    const trigger = e.currentTarget;
    trigger.disabled = true;
    try {
      const result = await check();
      manual = result.available ? null : 'upToDate';
    } catch (error) {
      logError('update.check')(error);
      found = null;
      manual = 'error';
    } finally {
      checking = false;
      trigger.disabled = false;
    }
    renderBanner();
    renderSettings();
  });

  $('update-result-install').addEventListener('click', (e) => install(e.currentTarget));

  Lilac.i18n.onChange(() => {
    renderBanner();
    renderSettings();
  });

  Lilac.updates = {
    start: () => setTimeout(autoCheck, FIRST_CHECK_MS),
    renderSettings,
  };
})();
