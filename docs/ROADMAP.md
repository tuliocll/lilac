# Roadmap

What's missing, what we found out and what we want. Order within each section = priority.
Want to pick something up? Open an issue first so we can line it up.

## Before going public

- [x] **The backend's networking on txiki** — `npm run test:txiki` runs `tuya-core` + the txiki transport inside `tjs`
      (txiki 26.6, Linux) against fake 3.3/3.4 devices: UDP discovery, status, control, concurrent commands, connection and
      auth errors. All green.
- [x] **Validate the app on real tinyjs (Windows).** Used every day since v1.0: real `tiny`, bundled txiki, app icon in the
      build. The tray icon path is relative to the folder the app was *opened from*, so the PNG is now embedded and written
      to the app's data folder at startup. macOS is used daily by a contributor; Linux is still untested.
- [ ] **Local control with a real device** (3.4 — e.g. Wi-Fi bulbs/breakers). It passes against the fake device and tinytuya,
      but has never switched on a real light.
- [ ] **Our own clientId.** We currently use Home Assistant's (fine for testing, not for distribution).
- [ ] **Name and address:** check that "lilac" is free on npm, should we ever publish packages.
- [x] **Clear instructions for SmartScreen (Windows) and Gatekeeper (macOS)** — in the README's Download section.
- [ ] **Signed builds** (a code-signing certificate on Windows, Developer ID + notarization on macOS).
- [ ] **Human code review** of the risky areas: secrets and session (`cloud/*`, `vault.js`, CLI), network decoders
      (`frame.ts`, `discovery.ts`), concurrency (`local/device.ts`, `backend/control.ts`).

## Cloud and infrared

- [x] **Infrared air conditioners through the cloud** — power, temperature, mode, fan; state remembered by the app.
- [x] **LG air conditioners (LG ThinQ)** — through LG's official ThinQ Connect API with a personal access token
      (`packages/thinq`, a port of the official `thinqconnect` SDK). Mapped from real profiles of two models.
- [ ] **Confirm LG control on real units** (the read side is confirmed; temperature goes to the current mode's target,
      as in Home Assistant — heat and auto still to try) and decide on more LG devices
      (the ThinQ API also covers washers, dryers, fridges…). Live updates would come through LG's MQTT push.
- [ ] **Confirm on a real AC** what each `M` number does (today: 0 cool · 1 heat · 2 auto · 3 fan · 4 dry), and whether the
      cloud "detail" carries any state after a change made in the Smart Life app (that would give us the initial state).
- [ ] **TV, fan, humidifier** — a button grid built from the function list (confirm with `--inspect`).
- [ ] **"DIY"/learned remotes** (`infrared_diy`) — buttons with the names the user recorded.
- [ ] **Fall back to the cloud when local fails** (next up). A device that announces itself but refuses TCP (separate Wi-Fi, AP
      isolation — it happened with a real IR blaster) times out today. It should use the cloud and say why, quietly.
      The CLI too.
- [ ] **Protocol 3.5** (6699 frames). New devices ship with it; today they only work through the cloud.
- [ ] **Live cloud updates** (the push channel Home Assistant's integration uses). Without it, changes made on the phone only
      show up when the app asks again.
- [ ] **Real state for infrared ACs.** IR is one-way, so a change made with the physical remote leaves Lilac out of sync.
      Optional "state source" per AC: a power-metering plug (on above N watts) or a contact sensor fixes on/off; reading
      temperature/mode/fan would need an IR receiver next to the unit (AC remotes send the whole state on every press).

## Themes

- [ ] **Use the transparent window** — Past Dream's hard shadow as a real offset shadow, rounded corners where a theme wants them
      (keep `--window-margin` small and test on Windows and macOS).

## Features

- [ ] **Automations tied to the computer** — screen locked → desk light off; unlocked → on; PC asleep → AC off.
      (Depends on tinyjs exposing those events.)
- [ ] **Scenes** — "Leaving home", "Movie night"… and trigger the *tap-to-run* scenes that already exist in Smart Life.
- [ ] **Global hotkey per action** — e.g. `Ctrl+Alt+L` toggles the desk light.
- [ ] **Integration with other tools** — `lilac://toggle/garage-light` or a local server
      (Stream Deck, Raycast, AutoHotkey, scripts).
- [ ] **Timer** — "turn the AC off in 1 h" (the device's countdown when it has one; otherwise the app schedules it).
- [x] **Group by room** — the list follows the Smart Life rooms (`/v1.0/m/thing/ha/{id}/room`, one call per device,
      as in `tuya_sharing` 0.2.13+). Confirmed on a real account (Brazil, Oct 2026); still to confirm on more regions: the Tuya forum reported `2008 app param
      is invalid` on that path, and when the cloud refuses, Lilac just keeps the flat list. Devices without a cloud room
      (imported keys, devices outside any room in the app) join a room by name or by the user's choice on the device page.
- [x] **Favorites' state on the tray icon** — hover shows "Office AC: on, 23 °C · Desk light: off" (Windows/macOS tooltip).
- [ ] **State *in* the menu bar** — on macOS, text next to the icon ("❄ 23°"); on Windows, an icon that changes.
- [ ] **"What's new" after an update** — show the release notes once, after the app restarts on a new version.
- [ ] **Notifications** (needs live updates) — door opened, Zigbee button pressed, leak.
- [ ] **Plug energy use** — current power + a small chart of the last hours.

## Community

- [x] **Issue templates** — "My device doesn't work" (asks for `--inspect`), bug report and feature idea.
- [x] **CONTRIBUTING.md** (English and Portuguese) — running it, where things live, the risky areas, releasing.
- [ ] **Missing gadgets** — robot vacuum; wireless button (`wxkg`: read-only or hide).

## Code

- [ ] **Fuzz tests for the decoders** (`frame.ts`, `discovery.ts`): random bytes from the network must not crash or hang the app.
- [x] **CLI secrets on Windows** — documented as a development-only copy (README → Privacy & security). Moving the CLI to the
      OS vault is still possible if someone wants it.
- [ ] **Split `backend/control.ts`** (sessions × route choice) — together with the cloud fallback.
- [ ] **One JSON file per language** (today `ui/i18n.js` has everything in one file).
- [ ] **txiki test in CI** — build txiki (≈2 min, cacheable) and run `npm run test:txiki`; and decide whether the old txiki
      socket API (`tjs.listen`/`tjs.connect` with read/write) still needs supporting — txiki 26.6 has the new one.

## Done (Oct 2026)

- [x] New name: **Lilac** · icon (a lilac cluster made of hexagons) for the app, tray, README and About page.
- [x] New themes: Frutiger Aero, CassiUI, Cutelight, BoringLight (seven in total) · theme picker in the welcome tour
      · themes section in the README · compact grid in Settings.
- [x] The cloud session no longer dies after ~2 h (the refresh was sent with the expired token).
- [x] "Shortcuts in the list" at the bottom of the device page (instead of the ⚡ nobody understood).
- [x] Past Dream without the blue frame around it; the hard shadow drawn as a border. (We thought Windows windows couldn't
      be transparent; they can — `chrome.transparent` is on since then, so real shadows and round corners are possible.)
- [x] Frutiger Inferno, the evil twin of Frutiger Aero, and ConfusedPast, a mixed-media collage (nine themes now).
- [x] Updates inside the app: optional reminder with short release notes (*Not now* / *Don't remind me*), a manual check
      in Settings, and CI publishing the `manifest.json` tinyjs' updater reads. Releases are no longer pre-releases.
- [x] Download section in the README for people who don't code (which file, the two `.exe` on Windows, SmartScreen).
- [x] Built app: tray icon embedded, no browser context menu (Back/Reload/Inspect), transparent window.
- [x] Pin the panel; pinned, minimize folds it to the title bar and restore brings back the size the user chose
      (the size is remembered across launches). Minimize used to just hide the panel, like ✕.
- [x] LG air conditioners (ThinQ Connect), rooms from Smart Life and fewer Keychain prompts on macOS
      (keys grouped in a few items) — contributed by Wilker Gaudencio.
- [x] Screenshots redone (rooms, LG AC, every theme in both languages).
- [x] Docs in English and Portuguese; repository at [github.com/tuliocll/lilac](https://github.com/tuliocll/lilac).

## Dropped (and why)

- **Expanded window** (sidebar, list and device side by side) — built and reverted: the tray panel is enough; the extra space
  wasn't worth the complexity.
