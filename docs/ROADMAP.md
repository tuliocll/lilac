# Roadmap

O que falta, o que descobrimos e o que queremos. Ordem dentro de cada seção = prioridade.
Quer pegar algum item? Abra uma issue antes para a gente alinhar.

## Antes de abrir para o público

- [ ] **Validar no tinyjs de verdade.** A interface só foi testada com um `tiny` simulado e o TCP
      do backend nunca rodou no txiki. Maior risco do projeto: se o TCP falhar lá, cai todo o controle local.
- [ ] **Controle local com aparelho real** (3.4 — ex.: lâmpadas/disjuntores Wi-Fi). Hoje passa nos
      testes com o aparelho falso e com o tinytuya, mas nunca acendeu uma lâmpada.
- [ ] **clientId próprio.** Hoje usamos o do Home Assistant (ok para teste, não para distribuir).
- [ ] **Confirmar a URL do repositório** (`config.js` e `package.json`).
- [ ] **README: aviso de builds sem assinatura** (SmartScreen no Windows, Gatekeeper no macOS).

## Descobertas (out/2026)

- [x] **Ar IR pela nuvem** (liga/desliga, temperatura, modo, vento; estado lembrado) — falta confirmar
      no aparelho real o significado de cada número de `M`.
- [ ] **Resto do IR pela nuvem —** Controles virtuais criados no Smart Life (marca/modelo) expõem
      comandos padrão da Tuya pela API de compartilhamento, seja qual for o emissor (Wi-Fi ou Zigbee):
      - Ar (`infrared_ac`): `PowerOn`/`PowerOff`, `T` (temperatura), `M` (modo 0–4), `F` (vento 0–3).
        Testado: liga e desliga. Falta confirmar `T`, `M` e o significado de cada número de modo.
      - A nuvem **não informa estado** desses aparelhos → o app lembra o último comando enviado
        e deixa claro que o controle físico pode tê-lo mudado.
      - TV / ventilador / umidificador: grade de botões a partir da lista de funções (confirmar com `--inspect`).
      - Controles "DIY"/aprendidos (`infrared_diy`): botões com os nomes que o usuário gravou.
- [ ] **Cair para a nuvem quando o local falha.** Aparelho que anuncia na rede mas não aceita TCP
      (ex.: Wi-Fi separada, isolamento de AP) hoje dá "tempo esgotado". Deve usar a nuvem e explicar,
      discretamente. Vale para a CLI também.
- [ ] **Protocolo 3.5** (frames 6699). Aparelhos novos já vêm assim; hoje ficam só pela nuvem.
- [ ] **Tempo real da nuvem** (o canal de push que a integração do HA usa). Sem isso, o que muda pelo
      celular só aparece quando o app pergunta de novo.

## Features

- [ ] **Automações ligadas ao computador** — bloqueou a tela → desliga a luz da mesa; desbloqueou →
      liga; PC dormiu → desliga o ar. (Depende do tinyjs expor esses eventos.)
- [ ] **Cenas** — "Sair de casa", "Cinema"… e disparar as cenas *tap-to-run* que já existem no Smart Life.
- [ ] **Atalho global por ação** — ex.: `Ctrl+Alt+L` alterna a luz da mesa.
- [ ] **Integração com outras ferramentas** — `tuyabar://toggle/luz-garagem` ou servidor local
      (Stream Deck, Raycast, AutoHotkey, scripts).
- [ ] **Estado na barra** — no macOS, texto ao lado do ícone ("❄ 23°"); no Windows, ícone que muda.
- [ ] **Timer** — "desligar o ar em 1 h" (countdown do aparelho quando houver; senão, o app agenda).
- [ ] **Agrupar por cômodo** — a nuvem já devolve casas e cômodos.
- [ ] **Notificações** (depende do tempo real) — porta abriu, botão Zigbee apertado, vazamento.
- [ ] **Consumo das tomadas** — potência atual + mini gráfico das últimas horas.

## Comunidade

- [ ] **Template de issue "meu aparelho não funciona"** pedindo a saída de
      `npm run control -- "<nome>" --inspect` (foi assim que destravamos o IR).
- [ ] **CONTRIBUTING.md** — como cadastrar um gadget, rodar o aparelho falso e criar um tema.
- [ ] **Gadgets que faltam** — robô aspirador; botão sem fio (`wxkg`: só leitura ou esconder).

## Código

- [ ] **Separar `backend/control.ts`** (sessões × escolha de rota) — fazer junto com o fallback para a nuvem.
- [ ] **Traduções em JSON por idioma** (hoje `ui/i18n.js` tem tudo num arquivo só).
