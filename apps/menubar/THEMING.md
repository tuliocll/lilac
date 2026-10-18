# Themes, languages and the golden rule of the UI

🇧🇷 [Leia em português](THEMING.pt-BR.md)

**Every new screen, component or control must work in every theme and every language.**
The tests in `apps/menubar/test/ui-contract.test.ts` enforce it — if they fail, the change isn't done.

## How the UI is put together

```
index.html        structure + data-i18n (no loose text, no colours)
base.css          layout and components — only var(--token), no literal colour/font/shadow
device-color.css  the one exception: colours that come from the DEVICE (bulb colour, hue spectrum)
ui/*.js           one module per screen (devices, device-page, controls, settings…) — only base.css classes
app.js            boot and global events
themes/
  tokens.json     the CONTRACT: every token a theme must define
  moonlight/      default theme (also sets the base values on :root)
  past-dream/     retro OS (embedded font via fonts.json)
  frutiger-aero/  glass and gloss        cassi-ui/     olive LCD
  cutelight/      light and cute         boringlight/  lavender and indigo (no custom font)
  frutiger-inferno/  Aero's evil twin (reuses the Aero font)
  confused-past/  mixed-media collage (torn edges with clip-path)
  contrast/       high contrast
  index.js        themes that ship with the app
ui/i18n.js        pt-BR / en dictionaries
icons/*.svg       glyphs (used as masks — the colour comes from the theme)
```

## Making a theme

1. Copy `themes/past-dream/` to `themes/my-theme/`.
2. In `theme.css`, change the selector to `[data-theme="my-theme"]` and set **every** token from `tokens.json`.
   Declare your palette as variables at the top (`--ink`, `--paper`…) and build the tokens from them.
3. Tweaks that go beyond tokens live below, always prefixed with `[data-theme="my-theme"]`
   (e.g. stripes on the title bar, `::-webkit-scrollbar-button`, uppercase pixel labels).
4. Custom font? Put the `.woff2` in `fonts/` (with its licence), declare it in `fonts.json` and run `npm run assets`
   (it gets embedded in `fonts.css` as a `data:` URI). Credit it in `ui/about.js` and the README.
5. Register it in `themes/index.js` (with a `description` in pt-BR and en, and a few `swatches`) and run `npm test`.

The layout is themeable too: `--window-areas`, `--window-columns` and `--window-rows` decide whether the toolbar sits
beside the title (Moonlight) or below it (Past Dream).

### Lessons from the built-in themes

- **The window is transparent** (`"chrome": { "transparent": true }` in `tinyjs.json`). The area outside `.window`
  (`--window-margin`, painted with `--desktop-bg`) can be see-through, so real drop shadows and rounded corners are
  possible: use a transparent `--desktop-bg` and a small margin, and test on Windows and macOS. The built-in themes predate
  this and still use `--window-margin: 0` with an opaque background; Past Dream draws its hard shadow as a thicker border
  (`border-width: 2px 5px 5px 2px`).
- **The title bar must stand on its own.** Pinned, *minimize* folds the panel down to the title bar (`body.collapsed` hides
  `.toolbar`, `.body` and `.statusbar`). Themes that hide the window controls (`--wc-display: none`) get the same button
  next to the pin, only while pinned.
- **Tokens that go into a `background` list can't carry their own size.** The slider paints
  `var(--slider-fill) 0 0 / var(--fill) 100% no-repeat, var(--slider-track)`, so `--slider-fill` must be a plain image
  (a gradient), while `--slider-track`, the last layer, may include `center / 100% 3px no-repeat`.
  CassiUI and BoringLight draw thin lines with a gradient that is only opaque in the middle.
- **Tones accept gradients.** `--tone-*` paint the device icon tiles; Cutelight and Frutiger Aero use gradients there.
- **Inset shadows are your friend** for "sunken" or "pressed" looks (CassiUI's `--sunken`), and they never get clipped by
  scrolling containers. `--selected-ring` is inset for the same reason.
- **Keep the shadows inside the list.** Floating cards need breathing room: give `--list-padding` a few pixels.
- **Check both a light and a dark device page**: the hero number, the power button on/off and the toggles are where
  themes usually break.

### Community themes (no rebuild)

The app loads themes from `<app data folder>/themes/<id>/` — `manifest.json` + `theme.css`.
There's a “Themes folder” button in Settings. Missing tokens fall back to Moonlight's values.

```json
{ "id": "my-theme", "name": "My theme", "author": "you", "description": { "pt-BR": "…", "en": "…" },
  "swatches": ["#101010", "#f0f0f0", "#ff00aa"] }
```

Use `data:` URIs for fonts/images in external themes (relative paths don't resolve).

## Adding a component

- Need a colour, border, radius, shadow or font? **Create a token** in `tokens.json` and define it in **every** theme.
  The test rejects `var(--something)` outside the contract and literal colours.
- Colour per gadget type? Use `data-tone` (sun, sky, mint, peach, lilac, pink, neutral) — the theme picks the shade.
- Icon? Draw a 24×24 black-stroke SVG in `icons/`, run `npm run assets` and use `<i class="glyph" data-g="name">`
  (and map it in `base.css`: `.glyph[data-g="name"] { --glyph: var(--i-name); }`).

## Languages

- Text in HTML: `data-i18n="key"` (or `-html`, `-placeholder`, `-title`, `-aria`).
- Text in JS: `t('key', { variable })`. Text that comes from data (gadgets, themes) uses `pick({ 'pt-BR': …, en: … })`.
- New language: copy the `en` block in `ui/i18n.js` and translate it. Gadgets and themes accept the same language code.
- The test makes sure every language has the same keys and that no key in use is missing.
