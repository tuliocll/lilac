# Temas, idiomas e a regra de ouro da interface

🇺🇸 [Read in English](THEMING.md)

**Toda tela, componente ou controle novo precisa funcionar em todos os temas e idiomas.**
Os testes em `apps/menubar/test/ui-contract.test.ts` garantem isso — se falharem, a mudança não está pronta.

## Como a interface é montada

```
index.html        estrutura + data-i18n (nenhum texto solto, nenhuma cor)
base.css          layout e componentes — só var(--token), nada de cor/fonte/sombra literal
device-color.css  a única exceção: cores que vêm do APARELHO (cor da lâmpada, espectro de matizes)
ui/*.js           um módulo por tela (devices, device-page, controls, settings…) — só classes do base.css
app.js            inicialização e eventos gerais
themes/
  tokens.json     CONTRATO: todos os tokens que um tema precisa definir
  moonlight/      tema padrão (também define os valores-base em :root)
  past-dream/     sistema retrô (fonte embutida via fonts.json)
  frutiger-aero/  vidro e brilho        cassi-ui/     LCD oliva
  cutelight/      claro e fofo          boringlight/  lavanda e índigo (sem fonte própria)
  contrast/       alto contraste
  index.js        temas que vêm com o app
ui/i18n.js        dicionários pt-BR / en
icons/*.svg       glifos (viram máscara — a cor vem do tema)
```

## Criando um tema

1. Copie `themes/past-dream/` para `themes/meu-tema/`.
2. No `theme.css`, troque o seletor para `[data-theme="meu-tema"]` e defina **todos** os tokens de `tokens.json`.
   Declare a paleta como variáveis no topo (`--ink`, `--paper`…) e monte os tokens a partir delas.
3. Ajustes que vão além de tokens ficam abaixo, sempre prefixados com `[data-theme="meu-tema"]`
   (ex.: listras na barra de título, `::-webkit-scrollbar-button`, rótulos pixelados em caixa alta).
4. Fonte própria? Coloque o `.woff2` em `fonts/` (com a licença), declare em `fonts.json` e rode `npm run assets`
   (o WebView2 bloqueia fontes via `file://`, então elas são embutidas como `data:`). Dê o crédito em `ui/about.js` e no README.
5. Registre em `themes/index.js` (com `description` em pt-BR e en, e algumas `swatches`) e rode `npm test`.

O layout também é tematizável: `--window-areas`, `--window-columns` e `--window-rows` decidem se a
barra de ferramentas fica ao lado do título (Moonlight) ou abaixo (Past Dream).

### Lições dos temas que vêm com o app

- **Nada de transparência no Windows.** Lá a janela é opaca, então o que fica fora da `.window` vira uma borda branca.
  Use `--window-margin: 0` e um `--desktop-bg` opaco. Quer sombra dura? Desenhe como borda mais grossa
  (Past Dream: `border-width: 2px 5px 5px 2px`).
- **Token que entra numa lista de `background` não pode trazer o próprio tamanho.** O slider pinta
  `var(--slider-fill) 0 0 / var(--fill) 100% no-repeat, var(--slider-track)`, então `--slider-fill` precisa ser só uma imagem
  (um degradê), enquanto `--slider-track`, a última camada, pode ter `center / 100% 3px no-repeat`.
  CassiUI e BoringLight desenham linhas finas com um degradê opaco só no meio.
- **Tons aceitam degradê.** Os `--tone-*` pintam os ícones dos aparelhos; Cutelight e Frutiger Aero usam degradê ali.
- **Sombra interna é sua amiga** para o visual "afundado" ou "apertado" (o `--sunken` do CassiUI), e nunca é cortada por
  áreas com rolagem. O `--selected-ring` é interno pelo mesmo motivo.
- **Deixe as sombras dentro da lista.** Cartão flutuando precisa de respiro: dê uns pixels de `--list-padding`.
- **Confira uma página de aparelho clara e uma escura**: o número grande, o liga/desliga ligado e desligado e os
  interruptores são onde os temas costumam quebrar.

### Temas da comunidade (sem recompilar)

O app carrega temas de `<pasta de dados do app>/themes/<id>/` — `manifest.json` + `theme.css`.
Há um botão “Pasta de temas” em Configurações. Tokens esquecidos caem nos valores do Moonlight.

```json
{ "id": "meu-tema", "name": "Meu tema", "author": "você", "description": { "pt-BR": "…", "en": "…" },
  "swatches": ["#101010", "#f0f0f0", "#ff00aa"] }
```

Use `data:` URIs para fontes/imagens em temas externos (caminhos relativos não resolvem).

## Adicionando um componente novo

- Precisa de uma cor, borda, raio, sombra ou fonte? **Crie um token** em `tokens.json` e defina-o
  em **todos** os temas. O teste reprova `var(--algo)` fora do contrato e cores literais.
- Cor por tipo de gadget? Use `data-tone` (sun, sky, mint, peach, lilac, pink, neutral) — o tema decide o tom.
- Ícone? Desenhe um SVG 24×24 de traço preto em `icons/`, rode `npm run assets` e use `<i class="glyph" data-g="nome">`
  (e ligue no `base.css`: `.glyph[data-g="nome"] { --glyph: var(--i-nome); }`).

## Idiomas

- Texto no HTML: `data-i18n="chave"` (ou `-html`, `-placeholder`, `-title`, `-aria`).
- Texto no JS: `t('chave', { variavel })`. Textos que vêm de dados (gadgets, temas) usam `pick({ 'pt-BR': …, en: … })`.
- Novo idioma: copie o bloco `en` em `ui/i18n.js` e traduza. Gadgets e temas aceitam o mesmo código de idioma.
- O teste garante que todos os idiomas têm as mesmas chaves e que nenhuma chave usada está faltando.
