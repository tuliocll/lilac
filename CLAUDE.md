# Lilac — notes for whoever (human or agent) touches the code

- npm workspaces monorepo: `packages/tuya-core` (protocol, no runtime dependency), `packages/gadgets` (per-device-type
  profiles), `packages/transport-*`, `apps/cli`, `apps/menubar` (tinyjs).
- `tuya-core` imports nothing from Node/txiki: networking comes in through the `Transport` interface.
- Style: functions and closures, no class hierarchies (exception: `Error` subclasses with a `code`).
  Factories like `createLocalDevice()` / `createSharingClient()` return objects with a small, explicit API.
- Code comments and UI strings are in Brazilian Portuguese; docs exist in English (`*.md`) and Portuguese (`*.pt-BR.md`) —
  keep both in sync.
- App: `src/main.ts` is only the API and the tinyjs events; logic lives in `src/backend/*` (each module owns its state).
  The UI lives in `src/frontend/ui/*`, one module per screen, all hanging off `window.Lilac` (`<script>` order = dependency order).
- UI: **every change must support every theme and language** — read `apps/menubar/THEMING.md`.
  No literal colour/font/shadow outside `themes/`; no hard-coded text outside `i18n.js`.
- New gadgets: `packages/gadgets/gadgets/<id>/{gadget.json,icon.svg}` (see the README there).
- After touching icons, fonts or gadgets: `npm run assets`. Always: `npm test` and `npm run typecheck`.
- The local protocol is validated against tinytuya (`pip install tinytuya`) in `packages/tuya-core/test/local.test.ts`.
- Never print local keys or session tokens (the CLI masks them; `--inspect` hides them).
