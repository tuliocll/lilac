// Namespace único da interface: cada arquivo em ui/ pendura seu módulo aqui
// (window.Lilac.dom, .i18n, .themes…). A ordem dos <script> no index.html
// é a ordem de dependência.
window.Lilac = {
  config: {
    repo: 'https://github.com/tuliocll/lilac',
    author: 'Tulio Calil',
    authorUrl: 'https://tuliocalil.com',
    /** atalho global para abrir o painel (quando ligado nas configurações) */
    hotkey: 'ctrl+alt+t',
    panel: { width: 360, height: 560 },
    /** onde a LG gera o Personal Access Token da ThinQ Connect */
    lgTokenUrl: 'https://connect-pat.lgthinq.com',
  },
};
