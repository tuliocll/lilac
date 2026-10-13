# Gadgets

🇧🇷 [Leia em português](README.pt-BR.md)

Each device type is a folder here. To add a new one:

```
gadgets/
  my-gadget/
    gadget.json   ← name, tone, layout, Tuya categories and controls
    icon.svg      ← 24×24, black stroke (used as a mask; the colour comes from the theme)
```

Then run `npm run assets` at the repo root, and `npm test`.

## gadget.json

```jsonc
{
  "$schema": "../gadget.schema.json",
  "id": "my-gadget",                        // same as the folder name
  "name": { "pt-BR": "Aquecedor", "en": "Heater" },
  "tone": "peach",                          // sun | sky | mint | peach | lilac | pink | neutral
  "layout": "climate",                      // how the page is laid out
  "match": { "categories": ["qn"] },        // Tuya categories that use this profile
  "controls": [
    { "code": "switch",   "type": "power",    "slot": "header" },
    { "code": "temp_set", "type": "setpoint", "slot": "hero", "unit": "°C" },
    { "code": "mode",     "type": "select",   "slot": "chips", "icon": "mode",
      "options": { "eco": { "pt-BR": "Econômico", "en": "Eco" } } }
  ]
}
```

- **code**: the data point's code. A list means alternatives — the first one the device has wins
  (e.g. `["switch", "power"]`).
- **type**: `power`, `toggle`, `setpoint`, `slider`, `stepper`, `select`, `buttons`, `readout`, `text`, `color`.
- **slot**: `header`, `hero`, `aside`, `chips`, `main`, `readouts`.
- Optional per control: `label`, `icon`, `unit`, `options` (labels per value), `showWhen` (e.g. only show the colour picker
  when `work_mode` is `colour`) and `display: "percent"` (show 10–1000 as 1–100 %).
- Optional per profile: `match.requiredCodes` (only use this profile if the device has these codes), `priority`
  (when two profiles match the same category, the higher one wins) and `note` (a line shown at the top of the page).
- Data points the profile doesn't mention show up on their own under “Advanced”, with a control inferred from their type.
- Only controls the device actually reports are shown — a profile can list more than any single model has.
- Labels for common data points and options live in `_common.json`.
- Colour: **never** put hex values here — use `tone`. The theme decides the shade.

## Finding the codes

```bash
npm run devices -- --dps                 # every device in the account, with its data points
npm run control -- "<name>" --inspect    # raw cloud answers (status, specification) for one device
```

Infrared air conditioners are a special case: the cloud speaks a fixed command set (`PowerOn`, `PowerOff`, `T`, `M`, `F`)
that `tuya-core` translates into ordinary data points — `power`, `temp`, `mode`, `wind` — so the `climate` profile works for
them unchanged. See `packages/tuya-core/src/cloud/infrared.ts`.
