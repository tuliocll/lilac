# Gadgets

🇺🇸 [Read in English](README.md)

Cada tipo de dispositivo é uma pasta aqui. Para cadastrar um novo:

```
gadgets/
  meu-gadget/
    gadget.json   ← nome, tom, layout, categorias Tuya e controles
    icon.svg      ← 24×24, traço preto (vira máscara; a cor vem do tema)
```

Depois rode `npm run assets` na raiz do repositório, e `npm test`.

## gadget.json

```jsonc
{
  "$schema": "../gadget.schema.json",
  "id": "meu-gadget",                       // igual ao nome da pasta
  "name": { "pt-BR": "Aquecedor", "en": "Heater" },
  "tone": "peach",                          // sun | sky | mint | peach | lilac | pink | neutral
  "layout": "climate",                      // como a página é montada
  "match": { "categories": ["qn"] },        // categorias Tuya que usam este perfil
  "controls": [
    { "code": "switch",   "type": "power",    "slot": "header" },
    { "code": "temp_set", "type": "setpoint", "slot": "hero", "unit": "°C" },
    { "code": "mode",     "type": "select",   "slot": "chips", "icon": "mode",
      "options": { "eco": { "pt-BR": "Econômico", "en": "Eco" } } }
  ]
}
```

- **code**: o código do DP. Uma lista = alternativas — vale o primeiro que o aparelho tiver
  (ex.: `["switch", "power"]`).
- **type**: `power`, `toggle`, `setpoint`, `slider`, `stepper`, `select`, `buttons`, `readout`, `text`, `color`.
- **slot**: `header`, `hero`, `aside`, `chips`, `main`, `readouts`.
- Opcionais por controle: `label`, `icon`, `unit`, `options` (rótulo por valor), `showWhen` (ex.: só mostrar o seletor de cor
  quando `work_mode` for `colour`) e `display: "percent"` (mostra 10–1000 como 1–100 %).
- Opcionais por perfil: `match.requiredCodes` (só usa este perfil se o aparelho tiver esses códigos), `priority`
  (quando dois perfis servem para a mesma categoria, vence o maior) e `note` (uma linha no topo da página).
- DPs que o perfil não cita aparecem sozinhos em “Avançado”, com o controle inferido pelo tipo.
- Só aparecem os controles que o aparelho realmente informa — o perfil pode listar mais do que qualquer modelo tem.
- Rótulos de DPs e opções comuns ficam em `_common.json`.
- Cor: **nunca** coloque hex aqui — use `tone`. Quem decide o tom é o tema.

## Descobrindo os códigos

```bash
npm run devices -- --dps                 # todos os aparelhos da conta, com os DPs
npm run control -- "<nome>" --inspect    # respostas cruas da nuvem (status, especificação) de um aparelho
```

Ares-condicionados por infravermelho são um caso à parte: a nuvem fala um conjunto fixo de comandos (`PowerOn`, `PowerOff`,
`T`, `M`, `F`) que o `tuya-core` traduz em DPs comuns — `power`, `temp`, `mode`, `wind` — e o perfil `climate` serve para eles
sem mudança. Veja `packages/tuya-core/src/cloud/infrared.ts`.
