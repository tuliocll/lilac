// Boas-vindas em quatro passos: o que é, por que conectar, escolher o visual, como conectar.
(() => {
  const { $ } = TuyaBar.dom;
  const LAST = 4;
  let step = 1;

  function show(n) {
    step = n;
    for (const s of document.querySelectorAll('.ob-step')) s.hidden = s.dataset.step !== String(n);
    for (const d of document.querySelectorAll('.step-dots i')) d.classList.toggle('on', d.dataset.dot === String(n));
    for (const a of document.querySelectorAll('[data-for-step]')) a.hidden = !a.dataset.forStep.split(' ').includes(String(n));
  }

  function open() {
    TuyaBar.settings.renderThemes(); // o passo 3 usa a mesma grade de temas das configurações
    show(1);
    TuyaBar.nav.go('onboarding');
    TuyaBar.status.clear();
  }

  async function finish(next) {
    await tiny.store.set('onboarded', true).catch(() => {});
    if (next === 'login') TuyaBar.login.open();
    else TuyaBar.nav.go('devices', { replace: true });
  }

  $('ob-next').addEventListener('click', () => show(Math.min(LAST, step + 1)));
  $('ob-skip').addEventListener('click', () => show(LAST));
  $('ob-connect').addEventListener('click', () => finish('login'));
  $('ob-explore').addEventListener('click', () => finish('devices'));

  const wasSeen = async () => Boolean(await tiny.store.get('onboarded').catch(() => false));

  TuyaBar.onboarding = { open, wasSeen };
})();
