// Namespace único da interface: cada arquivo em ui/ pendura seu módulo aqui
// (window.TuyaBar.dom, .i18n, .themes…). A ordem dos <script> no index.html
// é a ordem de dependência.
// O mesmo index.html serve às duas janelas: o painel da bandeja ('main') e a
// janela expandida. `shell` diz qual é esta; o CSS usa :root[data-shell].
const shell = window.tiny?.win?.id && window.tiny.win.id !== 'main' ? 'window' : 'panel';
document.documentElement.dataset.shell = shell;

window.TuyaBar = {
  config: {
    shell,
    repo: 'https://github.com/tuliocalil/tuyabar',
    author: 'Tulio Calil',
    authorUrl: 'https://tuliocalil.com',
    /** atalho global para abrir o painel (quando ligado nas configurações) */
    hotkey: 'ctrl+alt+t',
    panel: { width: 360, height: 560 },
  },
};
