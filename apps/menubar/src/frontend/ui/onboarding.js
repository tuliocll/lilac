// Boas-vindas em quatro passos: o que é, por que conectar, escolher o visual, qual conta conectar
// (Smart Life por QR ou LG ThinQ por token).
(() => {
  const { $ } = Lilac.dom;
  const LAST = 4;
  let step = 1;

  function show(n) {
    step = n;
    for (const s of document.querySelectorAll('.ob-step')) s.hidden = s.dataset.step !== String(n);
    for (const d of document.querySelectorAll('.step-dots i')) d.classList.toggle('on', d.dataset.dot === String(n));
    for (const a of document.querySelectorAll('[data-for-step]')) a.hidden = !a.dataset.forStep.split(' ').includes(String(n));
  }

  /** `step`: abrir direto num passo (o aviso "conecte sua conta" abre na escolha da conta). */
  function open(step = 1) {
    Lilac.settings.renderThemes(); // o passo 3 usa a mesma grade de temas das configurações
    show(step);
    Lilac.nav.go('onboarding');
    Lilac.status.clear();
  }

  async function finish(next) {
    await tiny.store.set('onboarded', true).catch(() => {});
    if (next === 'login') Lilac.login.open();
    else if (next === 'lg') Lilac.lg.open();
    else Lilac.nav.go('devices', { replace: true });
  }

  $('ob-next').addEventListener('click', () => show(Math.min(LAST, step + 1)));
  $('ob-skip').addEventListener('click', () => show(LAST));
  $('ob-tuya').addEventListener('click', () => finish('login'));
  $('ob-lg').addEventListener('click', () => finish('lg'));
  $('ob-explore').addEventListener('click', () => finish('devices'));

  const wasSeen = async () => Boolean(await tiny.store.get('onboarded').catch(() => false));

  Lilac.onboarding = { open, wasSeen, LAST };
})();
