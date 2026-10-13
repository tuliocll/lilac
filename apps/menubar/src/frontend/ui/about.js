// Sobre e créditos.
(() => {
  const { $, h, button } = Lilac.dom;
  const { t, pick } = Lilac.i18n;
  const { config } = Lilac;

  const CREDITS = [
    { name: 'tinyjs', lic: 'MIT', url: 'https://tinyjs.app', what: { 'pt-BR': 'janela nativa + backend JS em ~6 MB', en: 'native window + JS backend in ~6 MB' } },
    { name: 'txiki.js', lic: 'MIT', url: 'https://github.com/saghul/txiki.js', what: { 'pt-BR': 'runtime JavaScript do backend', en: 'backend JavaScript runtime' } },
    { name: 'tuya-device-sharing-sdk', lic: 'MIT', url: 'https://github.com/tuya/tuya-device-sharing-sdk', what: { 'pt-BR': 'referência do login por QR (Tuya)', en: 'QR login reference (Tuya)' } },
    { name: 'tinytuya', lic: 'MIT', url: 'https://github.com/jasonacox/tinytuya', what: { 'pt-BR': 'referência do protocolo local', en: 'local protocol reference' } },
    { name: '@noble/ciphers · @noble/hashes', lic: 'MIT', url: 'https://paulmillr.com/noble/', what: { 'pt-BR': 'criptografia em JS puro', en: 'pure-JS cryptography' } },
    { name: 'qrcode-generator', lic: 'MIT', url: 'https://github.com/kazuhikoarase/qrcode-generator', what: { 'pt-BR': 'QR code do login', en: 'login QR code' } },
    { name: 'Pixelify Sans', lic: 'OFL-1.1', url: 'https://github.com/eifetx/Pixelify-Sans', what: { 'pt-BR': 'fonte do tema Past Dream', en: 'Past Dream theme font' } },
    { name: 'Silkscreen', lic: 'OFL-1.1', url: 'https://github.com/googlefonts/silkscreen', what: { 'pt-BR': 'fonte do tema CassiUI', en: 'CassiUI theme font' } },
    { name: 'Nunito', lic: 'OFL-1.1', url: 'https://github.com/googlefonts/nunito', what: { 'pt-BR': 'fonte do tema Cutelight', en: 'Cutelight theme font' } },
    { name: 'Varela Round', lic: 'OFL-1.1', url: 'https://github.com/alefalefalef/Varela-Round-Hebrew', what: { 'pt-BR': 'fonte do tema Frutiger Aero', en: 'Frutiger Aero theme font' } },
  ];

  function credit({ name, lic, url, what }) {
    const link = button('', name);
    link.addEventListener('click', () => tiny.app.shell.open(url));
    const li = h('li');
    li.append(link, h('span', 'lic', lic), h('span', 'what', pick(what)));
    return li;
  }

  async function render() {
    $('about-by').textContent = t('about.by', { author: config.author });
    $('credits').replaceChildren(...CREDITS.map(credit));
    const info = await tiny.app.info().catch(() => ({}));
    $('about-version').textContent = t('about.version', { version: info.version ?? '0.0.1' });
  }

  function open() {
    render();
    Lilac.nav.go('about');
  }

  $('open-repo').addEventListener('click', () => tiny.app.shell.open(config.repo));
  Lilac.i18n.onChange(render);

  Lilac.about = { open };
})();
