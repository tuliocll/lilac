// Idiomas do TuyaBar. Para adicionar um: copie o bloco "en", traduza e
// inclua em LANGS. O teste de i18n garante que todos têm as mesmas chaves.
//
// No HTML: data-i18n="chave" (texto), data-i18n-html (texto com <b>),
// data-i18n-placeholder, data-i18n-title, data-i18n-aria.

window.I18N = (() => {
  const DICT = {
    'pt-BR': {
      'lang.name': 'Português (Brasil)',
      'title.onboarding': 'Bem-vindo',
      'title.login': 'Conectar Smart Life',
      'title.devices': 'Dispositivos',
      'title.settings': 'Configurações',
      'title.about': 'Sobre',

      'wc.minimize': 'Minimizar',
      'wc.close': 'Fechar painel',
      'action.scan': 'Procurar',
      'action.sync': 'Sincronizar com a nuvem',
      'action.settings': 'Configurações',
      'action.back': 'Voltar',
      'action.quit': 'Fechar app',
      'action.quit.title': 'Encerrar o TuyaBar',
      'action.next': 'Próximo',
      'action.skip': 'Pular',
      'action.send': 'Enviar',
      'action.layoutGrid': 'Ver em grade',
      'action.layoutList': 'Ver em lista',

      'ob.1.title': 'Sua casa na barra de tarefas',
      'ob.1.body': 'Ligue luzes, tomadas e o ar-condicionado Tuya/Smart Life direto daqui — conversando com os aparelhos <b>pela sua rede</b>, sem esperar a nuvem.',
      'ob.2.title': 'Por que conectar o Smart Life?',
      'ob.2.body': 'Cada aparelho tem uma chave secreta (a <b>local key</b>) que só a nuvem da Tuya conhece. Sem ela dá para ver quem está na rede, mas não controlar.',
      'ob.2.b1': 'Login por QR code — sem digitar senha',
      'ob.2.b2': 'As chaves ficam no cofre do seu sistema',
      'ob.2.b3': 'Depois disso, funciona até sem internet',
      'ob.3.title': 'Como conectar',
      'ob.3.s1': 'No app <b>Smart Life</b>, vá em <b>Eu</b> → ⚙ <b>Configurações</b> → <b>Conta e segurança</b>',
      'ob.3.s2': 'Copie o <b>Código de usuário</b> e cole aqui',
      'ob.3.s3': 'Escaneie o QR code com o próprio Smart Life e confirme',
      'ob.connect': 'Conectar agora',
      'ob.explore': 'Só explorar a rede',

      'login.lead': 'Cole o código de usuário do Smart Life para gerar o QR code.',
      'login.where': 'Onde fica: <b>Eu</b> → ⚙ <b>Configurações</b> → <b>Conta e segurança</b> → <b>Código de usuário</b>',
      'login.code': 'Código de usuário',
      'login.placeholder': 'ex.: Ab12Cd',
      'login.generate': 'Gerar QR code',
      'login.skip': 'Agora não — só procurar na rede',
      'login.scan': 'No Smart Life, toque no ícone de <b>escanear</b> (canto superior direito da tela inicial) e confirme.',
      'login.expires': 'Expira em {time}',
      'login.expired': 'QR expirado',
      'login.cancel': 'Cancelar',
      'login.qrError': 'Não deu para gerar o QR: {error}. Confira o código de usuário.',
      'login.qrAria': 'QR code de login',

      'devices.empty.title': 'Nada por aqui ainda',
      'devices.empty.body': 'Clique em <b>Procurar</b> para escutar os anúncios Tuya na sua rede.',
      'devices.connect.title': 'Conecte sua conta Smart Life',
      'devices.connect.body': 'para ver nomes e liberar o controle local',
      'badge.local': 'local · v{version}',
      'badge.experimental': 'v{version} · experimental',
      'badge.nokey': 'sem chave',
      'badge.sub': 'via gateway',
      'badge.away': 'fora da rede',
      'type.unknown': 'Desconhecido',

      'device.connecting': 'Conectando…',
      'device.on': 'Ligado',
      'device.off': 'Desligado',
      'device.advanced': 'Avançado',
      'device.reason.offline': 'Este aparelho não está anunciando na rede agora. Mostrando o último estado conhecido da nuvem.',
      'device.reason.sub': 'Este aparelho fala por um gateway/controle IR. Controle via gateway ainda não é suportado — mostrando o estado da nuvem.',
      'device.reason.nokey': 'Sem local key para este aparelho. Sincronize com a nuvem (↻) ou reconecte a conta.',
      'device.reason.version': 'Protocolo v{version} ainda não é suportado no controle local.',
      'device.reason.error': 'Não consegui falar com o aparelho: {error}',
      'device.reason.unknown': 'Este aparelho não está na sua conta Smart Life, então não temos a chave para controlá-lo.',
      'device.noControls': 'Nenhum controle disponível para este aparelho.',
      'device.setError': 'Não aplicou: {error}',
      'device.min': 'mín.',
      'device.max': 'máx.',

      'settings.appearance': 'Aparência',
      'settings.language': 'Idioma',
      'settings.language.auto': 'Automático (sistema)',
      'settings.userThemes': '{count} tema(s) instalado(s)',
      'settings.noUserThemes': 'Nenhum tema extra instalado',
      'settings.themesUnavailable': 'Temas extras indisponíveis',
      'settings.themesDir': 'Pasta de temas',
      'settings.account': 'Conta',
      'settings.notConnected': 'Não conectado',
      'settings.logout': 'Sair da conta',
      'settings.connect': 'Conectar',
      'settings.more': 'Mais',
      'settings.intro': 'Ver introdução de novo',
      'settings.about': 'Sobre e créditos',

      'about.tagline': 'Controle local de dispositivos Tuya, direto da barra de tarefas.',
      'about.version': 'Versão {version}',
      'about.by': 'Criado por {author}',
      'about.vibe': 'Vibecodado com o Claude — e revisado por humanos curiosos.',
      'about.repo': 'Código no GitHub',
      'about.credits': 'Créditos',
      'about.disclaimer': 'Projeto independente, sem vínculo com a Tuya. Smart Life e Tuya são marcas de seus donos.',

      'status.loading': 'Carregando…',
      'status.scanning': 'Escutando a rede por {s}s…',
      'status.foundLocal': '{count} dispositivo(s) na rede',
      'status.noneLocal': 'Nenhum dispositivo respondeu na rede',
      'status.inAccount': '{count} dispositivo(s) na conta',
      'status.cloudError': 'Nuvem: {error}',
      'status.waitingApp': 'Aguardando confirmação no app…',
      'status.loginCancelled': 'Login cancelado',
      'status.connectedAs': 'Conectado como {user}',
      'status.loggedOut': 'Conta desconectada',
      'status.vaultError': 'Não consegui salvar no cofre do sistema',
    },

    en: {
      'lang.name': 'English',
      'title.onboarding': 'Welcome',
      'title.login': 'Connect Smart Life',
      'title.devices': 'Devices',
      'title.settings': 'Settings',
      'title.about': 'About',

      'wc.minimize': 'Minimize',
      'wc.close': 'Close panel',
      'action.scan': 'Scan',
      'action.sync': 'Sync with the cloud',
      'action.settings': 'Settings',
      'action.back': 'Back',
      'action.quit': 'Quit app',
      'action.quit.title': 'Quit TuyaBar',
      'action.next': 'Next',
      'action.skip': 'Skip',
      'action.send': 'Send',
      'action.layoutGrid': 'Grid view',
      'action.layoutList': 'List view',

      'ob.1.title': 'Your home in the menu bar',
      'ob.1.body': 'Switch Tuya/Smart Life lights, plugs and air conditioners right from here — talking to them <b>over your own network</b>, no cloud round-trip.',
      'ob.2.title': 'Why connect Smart Life?',
      'ob.2.body': 'Each device has a secret key (the <b>local key</b>) that only Tuya’s cloud knows. Without it we can see who’s on the network, but not control them.',
      'ob.2.b1': 'QR code login — no password typing',
      'ob.2.b2': 'Keys live in your system’s vault',
      'ob.2.b3': 'After that, it works even offline',
      'ob.3.title': 'How to connect',
      'ob.3.s1': 'In the <b>Smart Life</b> app, open <b>Me</b> → ⚙ <b>Settings</b> → <b>Account and Security</b>',
      'ob.3.s2': 'Copy the <b>User Code</b> and paste it here',
      'ob.3.s3': 'Scan the QR code with Smart Life itself and confirm',
      'ob.connect': 'Connect now',
      'ob.explore': 'Just explore the network',

      'login.lead': 'Paste your Smart Life user code to generate the QR code.',
      'login.where': 'Where: <b>Me</b> → ⚙ <b>Settings</b> → <b>Account and Security</b> → <b>User Code</b>',
      'login.code': 'User code',
      'login.placeholder': 'e.g. Ab12Cd',
      'login.generate': 'Generate QR code',
      'login.skip': 'Not now — just scan the network',
      'login.scan': 'In Smart Life, tap the <b>scan</b> icon (top-right of the home screen) and confirm.',
      'login.expires': 'Expires in {time}',
      'login.expired': 'QR expired',
      'login.cancel': 'Cancel',
      'login.qrError': 'Couldn’t generate the QR: {error}. Check your user code.',
      'login.qrAria': 'Login QR code',

      'devices.empty.title': 'Nothing here yet',
      'devices.empty.body': 'Click <b>Scan</b> to listen for Tuya devices on your network.',
      'devices.connect.title': 'Connect your Smart Life account',
      'devices.connect.body': 'to see names and unlock local control',
      'badge.local': 'local · v{version}',
      'badge.experimental': 'v{version} · experimental',
      'badge.nokey': 'no key',
      'badge.sub': 'via gateway',
      'badge.away': 'not on network',
      'type.unknown': 'Unknown',

      'device.connecting': 'Connecting…',
      'device.on': 'On',
      'device.off': 'Off',
      'device.advanced': 'Advanced',
      'device.reason.offline': 'This device isn’t announcing on the network right now. Showing the last state known by the cloud.',
      'device.reason.sub': 'This device talks through a gateway/IR blaster. Control through gateways isn’t supported yet — showing the cloud state.',
      'device.reason.nokey': 'No local key for this device. Sync with the cloud (↻) or reconnect your account.',
      'device.reason.version': 'Protocol v{version} isn’t supported for local control yet.',
      'device.reason.error': 'Couldn’t reach the device: {error}',
      'device.reason.unknown': 'This device isn’t in your Smart Life account, so we don’t have its key.',
      'device.noControls': 'No controls available for this device.',
      'device.setError': 'Not applied: {error}',
      'device.min': 'min',
      'device.max': 'max',

      'settings.appearance': 'Appearance',
      'settings.language': 'Language',
      'settings.language.auto': 'Automatic (system)',
      'settings.userThemes': '{count} theme(s) installed',
      'settings.noUserThemes': 'No extra themes installed',
      'settings.themesUnavailable': 'Extra themes unavailable',
      'settings.themesDir': 'Themes folder',
      'settings.account': 'Account',
      'settings.notConnected': 'Not connected',
      'settings.logout': 'Sign out',
      'settings.connect': 'Connect',
      'settings.more': 'More',
      'settings.intro': 'Show the introduction again',
      'settings.about': 'About & credits',

      'about.tagline': 'Local control for Tuya devices, right from your menu bar.',
      'about.version': 'Version {version}',
      'about.by': 'Made by {author}',
      'about.vibe': 'Vibe-coded with Claude — and reviewed by curious humans.',
      'about.repo': 'Code on GitHub',
      'about.credits': 'Credits',
      'about.disclaimer': 'Independent project, not affiliated with Tuya. Smart Life and Tuya are trademarks of their owners.',

      'status.loading': 'Loading…',
      'status.scanning': 'Listening to the network for {s}s…',
      'status.foundLocal': '{count} device(s) on the network',
      'status.noneLocal': 'No device answered on the network',
      'status.inAccount': '{count} device(s) in your account',
      'status.cloudError': 'Cloud: {error}',
      'status.waitingApp': 'Waiting for confirmation in the app…',
      'status.loginCancelled': 'Login cancelled',
      'status.connectedAs': 'Connected as {user}',
      'status.loggedOut': 'Signed out',
      'status.vaultError': 'Couldn’t save to the system vault',
    },
  };

  const LANGS = Object.keys(DICT);
  let lang = 'pt-BR';
  let preference = 'auto';
  const listeners = [];

  function detect() {
    for (const l of navigator.languages ?? [navigator.language]) {
      if (DICT[l]) return l;
      const base = l.split('-')[0];
      const hit = LANGS.find((x) => x.split('-')[0] === base);
      if (hit) return hit;
    }
    return 'en';
  }

  function t(key, vars) {
    let s = DICT[lang]?.[key] ?? DICT.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }

  /** Texto de dados com tradução embutida ({ "pt-BR": …, en: … }). */
  function pick(text) {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[lang] ?? text[lang.split('-')[0]] ?? text.en ?? text['pt-BR'] ?? Object.values(text)[0] ?? '';
  }

  function apply(root = document) {
    document.documentElement.lang = lang;
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    // só strings nossas (dicionário acima) passam por innerHTML
    for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
    for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
    for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
    for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }

  async function init() {
    try {
      preference = (await tiny.store.get('language')) || 'auto';
    } catch {}
    lang = preference === 'auto' ? detect() : preference;
    apply();
  }

  async function set(pref) {
    preference = pref;
    lang = pref === 'auto' ? detect() : pref;
    try {
      await tiny.store.set('language', pref);
    } catch {}
    apply();
    for (const l of listeners) l(lang);
  }

  return {
    DICT,
    LANGS,
    t,
    pick,
    apply,
    init,
    set,
    get lang() {
      return lang;
    },
    get preference() {
      return preference;
    },
    onChange: (fn) => listeners.push(fn),
  };
})();
