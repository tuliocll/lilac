# Contribuindo com o Lilac

🇺🇸 [Read in English](CONTRIBUTING.md)

Valeu por passar aqui. O Lilac é um projeto pequeno e toda ajuda conta: um relato de aparelho, um perfil de gadget, um tema,
uma tradução ou código.

## A ajuda mais rápida: "meu aparelho não funciona"

Abra uma issue com o modelo [“Meu aparelho não funciona”](https://github.com/tuliocll/lilac/issues/new/choose) e cole a
saída de:

```bash
npm run control -- "<nome do aparelho>" --inspect   # Tuya / Smart Life
npm run lg -- --inspect                             # LG ThinQ
```

As chaves e os tokens saem escondidos. Foi assim que os ares por infravermelho passaram a funcionar.

## Rodando

Precisa do **Node 22+** e, para o app de bandeja, do [tinyjs](https://tinyjs.app).

```bash
git clone https://github.com/tuliocll/lilac && cd lilac
npm install
npm test && npm run typecheck

npm run fake-device                  # três aparelhos falsos anunciando na sua rede (sem hardware)
npm run discover                     # quem está anunciando
cd apps/menubar && tinyjs dev        # o app de bandeja
```

A CLI (`login`, `devices`, `control`, `lg`) é o jeito mais fácil de mexer no protocolo sem a interface.

## Antes de abrir um PR

- `npm run assets` se mexeu em ícones, fontes, gadgets ou no `assets/tray.png`; depois `npm test` e `npm run typecheck`.
- Mexeu na rede? Rode também `npm run test:txiki` (precisa do `tjs` do txiki.js no PATH, ou `TJS=/caminho/do/tjs`).
- **Toda mudança de interface precisa funcionar em todos os temas e idiomas.** Os testes de contrato pegam cor literal,
  tradução faltando e token de tema faltando. Leia o [THEMING.pt-BR.md](apps/menubar/THEMING.pt-BR.md) antes de mexer na
  interface.
- O estilo de código está no [CLAUDE.md](CLAUDE.md): funções e closures, comentários e textos da interface em português,
  docs em inglês (`*.md`) e português (`*.pt-BR.md`), sempre em dia uma com a outra.
- Nunca imprima local keys ou tokens, nem em log de depuração.
- Mensagens de commit: título curto e um corpo explicando *por quê*. Português ou inglês, tanto faz.

## Onde fica cada coisa

- **Novo tipo de gadget** (ícone, nome, cores, controles): uma pasta em `packages/gadgets/gadgets/`, sem código —
  veja [o README de lá](packages/gadgets/gadgets/README.pt-BR.md).
- **Novo tema**: uma pasta em `apps/menubar/src/frontend/themes/` — veja o [THEMING.pt-BR.md](apps/menubar/THEMING.pt-BR.md).
  Quem usa também pode jogar um tema na pasta de temas sem recompilar nada.
- **Novo idioma**: copie o bloco `en` em `apps/menubar/src/frontend/ui/i18n.js`.
- **Protocolo**: `packages/tuya-core` (Tuya, sem depender de runtime) e `packages/thinq` (LG ThinQ Connect).
- **Backend do app**: `apps/menubar/src/backend/*`, um módulo por assunto, cada um dono do próprio estado.

O mapa completo está na [Organização do projeto](README.pt-BR.md#organização-do-projeto) do README.

## Partes que merecem um olhar a mais

A maior parte do Lilac foi escrita com uma IA e revisada por uma pessoa. Estas partes têm mais risco, então revisão e testes
nelas são muito bem-vindos:

- segredos e sessões: `packages/tuya-core/src/cloud/*`, `apps/menubar/src/frontend/ui/vault.js`, o armazenamento da CLI;
- leitura de dados da rede: `frame.ts`, `discovery.ts`;
- concorrência: `local/device.ts`, `apps/menubar/src/backend/control.ts`.

PR feito com ajuda de IA não tem problema. Avise na descrição e garanta que você leu e rodou o que está mandando.

## Publicando versão (mantenedores)

Suba uma tag `v*`. A versão do app vem da tag, e a nota curta que aparece no aviso de atualização é a mensagem da tag:

```bash
git tag -a v1.2.3 -m "- o que mudou"
git push origin v1.2.3
```

Sem mensagem, a nota vira os títulos dos commits desde a tag anterior. O CI builda Windows, macOS e Linux, gera o
`manifest.json` que o atualizador lê e publica a release (não como pre-release, senão o `releases/latest` não enxerga).
