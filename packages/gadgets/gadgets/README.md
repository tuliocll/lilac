# Gadgets

Cada tipo de dispositivo é uma pasta aqui. Para cadastrar um novo:

```
gadgets/
  meu-gadget/
    gadget.json   ← nome, cor, layout, categorias Tuya e controles
    icon.svg      ← 24×24, traço preto (vira máscara; a cor vem do tema)
```

Depois rode `npm run assets` na raiz e `npm test`.

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

- **code**: código do DP (veja com `npm run devices -- --dps`). Uma lista = alternativas.
- **type**: `power`, `toggle`, `setpoint`, `slider`, `stepper`, `select`, `buttons`, `readout`, `text`.
- **slot**: `header`, `hero`, `aside`, `chips`, `main`, `readouts`.
- DPs que o perfil não cita aparecem sozinhos em “Avançado”, com o controle inferido pelo tipo.
- Rótulos de DPs e opções comuns ficam em `_common.json`.
- Cor: **nunca** coloque hex aqui — use `tone`. Quem decide o tom é o tema.
