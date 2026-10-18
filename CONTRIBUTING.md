# Contributing to Lilac

🇧🇷 [Leia em português](CONTRIBUTING.pt-BR.md)

Thanks for stopping by. Lilac is a small project and help of any size is welcome: a device report, a gadget profile, a theme,
a translation or code.

## The quickest help: "my device doesn't work"

Open an issue with the [“My device doesn't work”](https://github.com/tuliocll/lilac/issues/new/choose) template and paste
the output of:

```bash
npm run control -- "<device name>" --inspect   # Tuya / Smart Life
npm run lg -- --inspect                        # LG ThinQ
```

Keys and tokens are hidden in that output. Infrared air conditioners became supported exactly this way.

## Running it

You need **Node 22+**, and [tinyjs](https://tinyjs.app) for the tray app.

```bash
git clone https://github.com/tuliocll/lilac && cd lilac
npm install
npm test && npm run typecheck

npm run fake-device                  # three fake devices announcing on your LAN (no hardware needed)
npm run discover                     # who's announcing
cd apps/menubar && tinyjs dev        # the tray app
```

The CLI (`login`, `devices`, `control`, `lg`) is the easiest way to poke at the protocol without the UI.

## Before opening a PR

- `npm run assets` if you touched icons, fonts, gadgets or `assets/tray.png`; then `npm test` and `npm run typecheck`.
- Touched networking? Also `npm run test:txiki` (needs txiki.js's `tjs` in your PATH, or `TJS=/path/to/tjs`).
- **Every UI change must work in every theme and every language.** The contract tests check for literal colours, missing
  translations and missing theme tokens. Read [THEMING.md](apps/menubar/THEMING.md) before touching the interface.
- Code style is in [CLAUDE.md](CLAUDE.md): plain functions and closures, code comments and UI strings in Brazilian Portuguese,
  docs in English (`*.md`) and Portuguese (`*.pt-BR.md`) kept in sync.
- Never print local keys or tokens, not even in a debug log.
- Commit messages: a short title and a body that explains *why*. Portuguese or English are both fine.

## Where things live

- **New gadget type** (icon, name, colours, controls): a folder in `packages/gadgets/gadgets/`, no code needed —
  see [its README](packages/gadgets/gadgets/README.md).
- **New theme**: a folder in `apps/menubar/src/frontend/themes/` — see [THEMING.md](apps/menubar/THEMING.md). Users can also
  drop a theme into the themes folder without rebuilding.
- **New language**: copy the `en` block in `apps/menubar/src/frontend/ui/i18n.js`.
- **Protocol**: `packages/tuya-core` (Tuya, no runtime dependency) and `packages/thinq` (LG ThinQ Connect).
- **App backend**: `apps/menubar/src/backend/*`, one module per concern, each owning its state.

The full map is in the README's [Project layout](README.md#project-layout).

## Areas that deserve an extra pair of eyes

Most of Lilac was written with an AI and reviewed by a human. These parts carry the most risk, so reviews and tests there
are especially welcome:

- secrets and sessions: `packages/tuya-core/src/cloud/*`, `apps/menubar/src/frontend/ui/vault.js`, the CLI store;
- decoders of network data: `frame.ts`, `discovery.ts`;
- concurrency: `local/device.ts`, `apps/menubar/src/backend/control.ts`.

AI-assisted PRs are fine. Say so in the description, and make sure you have read and run what you send.

## Releasing (maintainers)

Push a `v*` tag. The app version comes from the tag, and the short note shown in the in-app update prompt is the tag message:

```bash
git tag -a v1.2.3 -m "- what changed"
git push origin v1.2.3
```

Without a message, the note is the commit titles since the previous tag. CI builds Windows, macOS and Linux, writes the
`manifest.json` the updater reads and publishes the release (not as a pre-release, or `releases/latest` won't see it).
