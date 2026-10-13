# Roadmap

🇺🇸 [Read in English](ROADMAP.md)

O que falta, o que descobrimos e o que queremos. Ordem dentro de cada seção = prioridade.
Quer pegar algum item? Abra uma issue antes para a gente alinhar.

## Antes de abrir para o público

- [ ] **Validar no tinyjs de verdade.** A interface só foi testada com um `tiny` simulado e o TCP
      do backend nunca rodou no txiki. Maior risco do projeto: se o TCP falhar lá, cai todo o controle local.
      Conferir também: ícone da bandeja (`assets/tray.png` — o caminho é relativo a quê?) e o ícone do app no build.
- [ ] **Controle local com aparelho real** (3.4 — ex.: lâmpadas/disjuntores Wi-Fi). Hoje passa nos testes
      com o aparelho falso e com o tinytuya, mas nunca acendeu uma lâmpada.
- [ ] **clientId próprio.** Hoje usamos o do Home Assistant (ok para teste, não para distribuir).
- [ ] **Nome e endereço:** conferir se "lilac" está livre no npm, caso um dia publiquemos pacotes.
- [ ] **Builds assinados**, ou ao menos instruções claras para o SmartScreen (Windows) e o Gatekeeper (macOS).
- [ ] **Revisão humana do código** nas áreas de risco: segredos e sessão (`cloud/*`, `vault.js`, CLI),
      decodificadores de rede (`frame.ts`, `discovery.ts`), concorrência (`local/device.ts`, `backend/control.ts`).

## Nuvem e IR

- [x] **Ar IR pela nuvem** — liga/desliga, temperatura, modo, vento; estado lembrado pelo app.
- [ ] **Confirmar no ar real** o que cada número de `M` faz (hoje: 0 frio · 1 quente · 2 auto · 3 ventilar · 4 secar)
      e se o "detalhe" da nuvem traz algum estado depois de mexer pelo app Smart Life (daria o estado inicial).
- [ ] **TV, ventilador, umidificador** — grade de botões a partir da lista de funções (confirmar com `--inspect`).
- [ ] **Controles "DIY"/aprendidos** (`infrared_diy`) — botões com os nomes que o usuário gravou.
- [ ] **Cair para a nuvem quando o local falha.** Aparelho que anuncia na rede mas não aceita TCP
      (Wi-Fi separada, isolamento de AP — aconteceu com um emissor IR de verdade) hoje dá "tempo esgotado".
      Deve usar a nuvem e explicar, discretamente. Vale para a CLI também.
- [ ] **Protocolo 3.5** (frames 6699). Aparelhos novos já vêm assim; hoje ficam só pela nuvem.
- [ ] **Tempo real da nuvem** (o canal de push que a integração do HA usa). Sem isso, o que muda pelo
      celular só aparece quando o app pergunta de novo.

## Features

- [ ] **Automações ligadas ao computador** — bloqueou a tela → desliga a luz da mesa; desbloqueou →
      liga; PC dormiu → desliga o ar. (Depende do tinyjs expor esses eventos.)
- [ ] **Cenas** — "Sair de casa", "Cinema"… e disparar as cenas *tap-to-run* que já existem no Smart Life.
- [ ] **Atalho global por ação** — ex.: `Ctrl+Alt+L` alterna a luz da mesa.
- [ ] **Integração com outras ferramentas** — `lilac://toggle/luz-garagem` ou servidor local
      (Stream Deck, Raycast, AutoHotkey, scripts).
- [ ] **Timer** — "desligar o ar em 1 h" (countdown do aparelho quando houver; senão, o app agenda).
- [ ] **Agrupar por cômodo** — a nuvem já devolve casas e cômodos.
- [ ] **Estado na barra** — no macOS, texto ao lado do ícone ("❄ 23°"); no Windows, ícone que muda.
- [ ] **Notificações** (depende do tempo real) — porta abriu, botão Zigbee apertado, vazamento.
- [ ] **Consumo das tomadas** — potência atual + mini gráfico das últimas horas.

## Comunidade

- [ ] **Template de issue "meu aparelho não funciona"** pedindo a saída de
      `npm run control -- "<nome>" --inspect` (foi assim que destravamos o IR).
- [ ] **CONTRIBUTING.md** — como cadastrar um gadget, rodar o aparelho falso, criar um tema e
      onde revisar com mais cuidado (as áreas de risco acima).
- [ ] **Gadgets que faltam** — robô aspirador; botão sem fio (`wxkg`: só leitura ou esconder).

## Código

- [ ] **Teste de fuzz dos decodificadores** (`frame.ts`, `discovery.ts`): bytes aleatórios da rede não
      podem quebrar nem travar o app.
- [ ] **Segredos da CLI no Windows** — `~/.lilac` guarda sessão e chaves em texto puro (o `0600` não vale
      no Windows). Documentar como "só para desenvolvimento" ou usar o cofre do sistema.
- [ ] **Separar `backend/control.ts`** (sessões × escolha de rota) — fazer junto com o fallback para a nuvem.
- [ ] **Traduções em JSON por idioma** (hoje `ui/i18n.js` tem tudo num arquivo só).
- [ ] **Testes do transporte txiki** — hoje não tem nenhum; e decidir se a API antiga do txiki ainda precisa existir.

## Feito (out/2026)

- [x] Nome novo: **Lilac** · ícone (cacho de lilás em hexágonos) para app, bandeja, README e Sobre.
- [x] Temas novos: Frutiger Aero, CassiUI, Cutelight, BoringLight (7 no total) · escolha de tema nas boas-vindas
      · seção de temas no README · grade compacta nas configurações.
- [x] Sessão da nuvem não morre mais depois de ~2 h (a renovação ia com o token vencido).
- [x] "Atalhos na lista" no fim da página do aparelho (no lugar do ⚡ que ninguém entendia).
- [x] Past Dream sem o fundo azul em volta; sombra dura desenhada como borda (Windows não tem janela transparente).
- [x] Documentação em inglês e português; repositório em [github.com/tuliocll/lilac](https://github.com/tuliocll/lilac).

## Descartado (e por quê)

- **Janela expandida** (menu lateral, lista e aparelho lado a lado) — feita e desfeita: o painel da bandeja
  basta; o espaço extra não pagou a complexidade.
