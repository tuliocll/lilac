// Temas que vêm com o app. Temas da comunidade entram pela pasta do usuário
// (ver THEMING.md) e são somados a estes em tempo de execução.
window.BUILTIN_THEMES = [
  {
    id: 'moonlight',
    name: 'Moonlight',
    description: { 'pt-BR': 'Escuro e discreto, o visual original', en: 'Dark and quiet, the original look' },
    css: null, // tokens já carregados como padrão (themes/moonlight/theme.css)
    swatches: ['#121212', '#1c1c1e', '#e8e3d8', '#7bd389'],
  },
  {
    id: 'past-dream',
    name: 'Past Dream',
    description: { 'pt-BR': 'Um sistema de 1996 que nunca existiu', en: 'A 1996 operating system that never was' },
    href: ['themes/past-dream/fonts.css', 'themes/past-dream/theme.css'],
    swatches: ['#2e5f7c', '#fbf6e9', '#b8a4ff', '#ffd23f', '#ff8fc4'],
  },
];
