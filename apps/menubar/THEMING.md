# Temas, idiomas e a regra de ouro da interface

**Toda tela, componente ou controle novo precisa funcionar em todos os temas e idiomas.**
Os testes em `apps/menubar/test/ui-contract.test.ts` garantem isso — se falharem, a mudança não está pronta.

## Como a interface é montada

```
index.html        estrutura + data-i18n (nenhum texto solto, nenhuma cor)
base.css          layout e componentes — só var(--token), nada de cor/fonte/sombra literal
controls.js       controles da página do gadget (só classes do base.css)
app.js            telas e estado
themes/
  tokens.json     CONTRATO: todos os tokens que um tema precisa definir
  moonlight/      tema padrão (também define os valores-base em :root)
  past-dream/     tema retrô (fonte embutida via fonts.json)
  index.js        temas que vêm com o app
i18n.js           dicionários pt-BR / en
icons/*.svg       glifos (viram máscara — a cor vem do tema)
```

## Criando um tema

1. Copie `themes/past-dream/` para `themes/meu-tema/`.
2. No `theme.css`, troque o seletor para `[data-theme="meu-tema"]` e ajuste **todos** os tokens de `tokens.json`.
3. Ajustes que vão além de tokens podem ficar abaixo, sempre prefixados com `[data-theme="meu-tema"]`
   (ex.: listras na barra de título, `::-webkit-scrollbar-button`).
4. Fonte própria? Coloque o `.woff2` em `fonts/`, declare em `fonts.json` e rode `npm run assets`
   (no Windows o WebView2 bloqueia fontes via `file://`, então elas são embutidas como `data:`).
5. Registre em `themes/index.js` (com `description` em pt-BR e en) e rode `npm test`.

O layout também é tematizável: `--window-areas`, `--window-columns` e `--window-rows` decidem se a
barra de ferramentas fica ao lado do título (Moonlight) ou abaixo (Past Dream).

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
- Ícone? Desenhe um SVG 24×24 de traço preto em `icons/`, rode `npm run assets` e use `<i class="glyph" data-g="nome">`.

## Idiomas

- Texto no HTML: `data-i18n="chave"` (ou `-html`, `-placeholder`, `-title`, `-aria`).
- Texto no JS: `t('chave', { variavel })`. Textos que vêm de dados (gadgets, temas) usam `pick({ 'pt-BR': …, en: … })`.
- Novo idioma: copie o bloco `en` em `i18n.js`, traduza. Gadgets e temas aceitam o mesmo código de idioma.
- O teste garante que todos os idiomas têm as mesmas chaves e que nenhuma chave usada está faltando.
