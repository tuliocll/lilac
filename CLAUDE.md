# TuyaBar — notas para quem (humano ou agente) for mexer no código

- Monorepo npm workspaces: `packages/tuya-core` (protocolo, sem dependência de runtime),
  `packages/gadgets` (perfis por tipo de dispositivo), `packages/transport-*`, `apps/cli`, `apps/menubar` (tinyjs).
- `tuya-core` não importa nada de Node/txiki: rede entra pela interface `Transport`.
- Interface: **toda mudança precisa suportar todos os temas e idiomas** — leia `apps/menubar/THEMING.md`.
  Nada de cor/fonte/sombra literal fora de `themes/`; nada de texto fixo fora de `i18n.js`.
- Gadgets novos: `packages/gadgets/gadgets/<id>/{gadget.json,icon.svg}` (ver o README de lá).
- Depois de mexer em ícones, fontes ou gadgets: `npm run assets`. Sempre: `npm test` e `npm run typecheck`.
- O protocolo local é validado contra o tinytuya (`pip install tinytuya`) em `packages/tuya-core/test/local.test.ts`.
