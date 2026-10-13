// Temas que vêm com o app. Temas da comunidade entram pela pasta do usuário
// (ver THEMING.md) e são somados a estes em tempo de execução.
TuyaBar.builtinThemes = [
  {
    id: 'moonlight',
    name: 'Moonlight',
    description: { 'pt-BR': 'Escuro e discreto, o visual original', en: 'Dark and quiet, the original look' },
    // os tokens do Moonlight já são carregados como padrão no index.html
    swatches: ['#121212', '#1c1c1e', '#e8e3d8', '#7bd389'],
  },
  {
    id: 'past-dream',
    name: 'Past Dream',
    description: { 'pt-BR': 'Um sistema de 1996 que nunca existiu', en: 'A 1996 operating system that never was' },
    href: ['themes/past-dream/fonts.css', 'themes/past-dream/theme.css'],
    swatches: ['#2e5f7c', '#fbf6e9', '#b8a4ff', '#ffd23f', '#ff8fc4'],
  },
  {
    id: 'frutiger-aero',
    name: 'Frutiger Aero',
    description: { 'pt-BR': 'Vidro, bolhas e brilho — o futuro de 2007', en: 'Glass, bubbles and gloss — the future of 2007' },
    href: ['themes/frutiger-aero/fonts.css', 'themes/frutiger-aero/theme.css'],
    swatches: ['#7d8996', '#5fb8ff', '#9fd83e', '#ffe14a', '#ffffff'],
  },
  {
    id: 'cassi-ui',
    name: 'CassiUI',
    description: { 'pt-BR': 'Tela de LCD em tons de oliva, letra pixelada', en: 'An olive LCD screen with pixel type' },
    href: ['themes/cassi-ui/fonts.css', 'themes/cassi-ui/theme.css'],
    swatches: ['#9aa283', '#22261a', '#6b7258', '#7f9294', '#4a6fa5'],
  },
  {
    id: 'contrast',
    name: { 'pt-BR': 'Alto Contraste', en: 'High Contrast' },
    description: { 'pt-BR': 'Preto, branco e amarelo — legível em qualquer luz', en: 'Black, white and yellow — readable in any light' },
    href: 'themes/contrast/theme.css',
    swatches: ['#000000', '#ffffff', '#ffe600'],
  },
];
