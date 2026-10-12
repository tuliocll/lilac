# TuyaBar

Controle **local** de dispositivos Tuya (Smart Life) direto da barra de menu / bandeja do sistema —
sem Home Assistant, sem depender da nuvem para o dia a dia.

> Status: **spike**. Descobre dispositivos na LAN e faz login no Smart Life por QR para obter nomes, categorias,
> local keys e mapa de DPs. O controle local (TCP 6668) vem a seguir.

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

Login no Smart Life (para nomes, local keys e DPs):

```bash
npm run login             # pede o "código de usuário" e mostra um QR no terminal
npm run devices           # cruza conta x rede; --keys mostra as local keys, --dps o mapa de DPs
```

O código de usuário fica no app Smart Life: **Eu → ⚙ Configurações → Conta e segurança → Código de usuário**.
A CLI guarda a sessão em `~/.tuyabar/` (só para desenvolvimento); o app de bandeja usa o cofre do sistema.

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
- [x] `npm run discover` encontra os dispositivos reais da casa
- [x] UDP no txiki.js do tinyjs recebe broadcast (Windows)
- [x] Bandeja abre o painel posicionado junto ao ícone (Windows)
- [x] Assinatura/criptografia da API Smart Life idênticas ao SDK oficial (vetores de teste gerados com ele)
- [ ] Login por QR e inventário com uma conta real
- [ ] `fetch` do txiki falando com `apigw.iotbing.com` e o endpoint regional
- [ ] `tiny.app.secrets` guardando sessão e local keys no Windows (Credential Manager)

## Próximos passos

1. Conexão TCP 6668: handshake de sessão v3.4/v3.5, leitura/escrita de DPs
2. Modelo de capabilities (switch, light, climate, sensor…) a partir da categoria/DPs
3. UI de verdade (React) com cards por capability

## Login Smart Life e o `clientId`

O login por QR usa a mesma API da integração oficial Tuya do Home Assistant (porta em TS do
[tuya-device-sharing-sdk](https://github.com/tuya/tuya-device-sharing-sdk), MIT). Essa API exige um
`clientId`/`schema` de app parceiro registrado na Tuya. Por ora usamos o do Home Assistant
(`packages/tuya-core/src/cloud/app-credentials.ts`), o que serve para testar com a própria conta.
**Antes de publicar, é preciso obter credenciais próprias junto à Tuya.**

## Notas do protocolo

- A descoberta **não precisa de credencial**: a chave dos broadcasts é pública (`md5("yGAdlopoPVldABfn")`).
- A *local key* (por dispositivo) só é necessária para controlar e muda se o dispositivo for re-pareado.
- Muitos dispositivos aceitam só 1 conexão TCP local por vez — se outro app (ex.: LocalTuya) estiver conectado, o nosso pode ser recusado.
- Dispositivos a bateria dormem e não respondem localmente.

## Licença

MIT
