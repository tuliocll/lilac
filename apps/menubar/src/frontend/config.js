// Namespace único da interface: cada arquivo em ui/ pendura seu módulo aqui
// (window.Lilac.dom, .i18n, .themes…). A ordem dos <script> no index.html
// é a ordem de dependência.
window.Lilac = {
  config: {
    repo: 'https://github.com/tuliocalil/lilac',
    author: 'Tulio Calil',
    authorUrl: 'https://tuliocalil.com',
    /** atalho global para abrir o painel (quando ligado nas configurações) */
    hotkey: 'ctrl+alt+t',
    panel: { width: 360, height: 560 },
  },
};
