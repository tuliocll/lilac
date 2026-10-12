# TuyaBar

Controle **local** de dispositivos Tuya (Smart Life) direto da barra de menu / bandeja do sistema —
sem Home Assistant, sem depender da nuvem para o dia a dia.

> Status: **spike**. Hoje ele só *descobre* dispositivos na LAN. Controle (local key + comandos) vem a seguir.

## Estrutura

```
packages/
  tuya-core/         protocolo Tuya em TS puro (frames 55AA/6699, AES-ECB/GCM, descoberta)
                     — zero dependência de runtime; a rede entra por uma interface `Transport`
  transport-node/    Transport para Node (CLI, testes, futuro daemon)
  transport-txiki/   Transport para txiki.js (backend do tinyjs)
apps/
  cli/               discover + fake-device (testar sem hardware)
  menubar/           app de bandeja em tinyjs
```

O `tuya-core` não sabe em que runtime está. Se o tinyjs não vingar, troca-se só a casca (Tauri, Electron…).

## Rodando

Requer Node 22+.

```bash
npm install
npm test                  # testes do protocolo
npm run discover          # escuta a rede por 10s e lista os dispositivos Tuya
npm run discover -- 20 -v # 20s, mostrando também datagramas não reconhecidos
```

Sem dispositivo por perto? Em outro terminal:

```bash
npm run fake-device       # anuncia 3 dispositivos falsos (v3.1, v3.3 e v3.5)
```

### App de bandeja (tinyjs)

```bash
# instalar o tinyjs (Windows / PowerShell)
irm https://tinyjs.app/install.ps1 | iex
# macOS / Linux
curl -fsSL https://tinyjs.app/install | sh

cd apps/menubar
tinyjs dev
```

O backend (`src/main.ts`) é empacotado com esbuild pelo próprio tinyjs, puxando os pacotes do workspace.

## Spike: o que precisa ser validado

- [x] Frames 55AA e 6699, CRC32, AES-ECB/GCM com `@noble/*` (JS puro)
- [x] Descoberta v3.1 / v3.3 / v3.5 em Node (testado com `fake-device`)
- [ ] `npm run discover` encontra os dispositivos **reais** da casa
- [ ] UDP no txiki.js do tinyjs: qual API ele expõe (`UDPSocket` ou `tjs.listen`), bind em 6666/6667/7000 e recepção de broadcast — no Windows, macOS e Linux
- [ ] Bandeja abre o painel posicionado sob o ícone (Windows: barra embaixo)

## Próximos passos

1. **Login por QR** (fluxo do app Smart Life, o mesmo do HA oficial) → lista de dispositivos + local keys
2. Conexão TCP 6668: handshake de sessão v3.4/v3.5, leitura/escrita de DPs
3. Modelo de capabilities (switch, light, climate, sensor…) a partir da categoria/DPs
4. UI de verdade (React) com cards por capability

## Notas do protocolo

- A descoberta **não precisa de credencial**: a chave dos broadcasts é pública (`md5("yGAdlopoPVldABfn")`).
- A *local key* (por dispositivo) só é necessária para controlar e muda se o dispositivo for re-pareado.
- Muitos dispositivos aceitam só 1 conexão TCP local por vez — se outro app (ex.: LocalTuya) estiver conectado, o nosso pode ser recusado.
- Dispositivos a bateria dormem e não respondem localmente.

## Licença

MIT
