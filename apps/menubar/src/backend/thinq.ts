/**
 * Conta LG ThinQ: ares-condicionados Wi-Fi da LG, pela API oficial ThinQ Connect.
 *
 * Os ares entram no mesmo inventário dos aparelhos Tuya, com homeId 'lg' e
 * categoria de ar-condicionado — a lista, a página e a bandeja tratam igual.
 * Só o caminho até o aparelho muda: comandos e estado vão pela nuvem da LG.
 * O token (Personal Access Token) é guardado no cofre do sistema pela página.
 */
import { uuidv4, type CloudDevice } from '@lilac/core';
import { createThinqClient, LG_AC_TYPE, lgAcDps, lgAcPayload, lgAcStatus, ThinqError, type ThinqClient } from '@lilac/thinq';

export const LG_HOME = 'lg';

/**
 * O que fica guardado no cofre. Sem `token` = desconectada, mas o `clientId`
 * continua: é um por instalação, e a LG bloqueia quem cria clientes demais.
 */
export interface ThinqConfig {
  token?: string;
  /** país da conta LG (ex.: 'BR') — define o servidor */
  country?: string;
  clientId: string;
}

/** Códigos da LG para token inválido, revogado ou desconhecido: hora de gerar outro. */
const TOKEN_REFUSED = new Set(['1103', '1218', '1302']);
export const tokenRefused = (error: unknown) => error instanceof ThinqError && TOKEN_REFUSED.has(error.code);

let config: ThinqConfig | null = null;
let client: ThinqClient | null = null;

export const thinqConfig = () => config;
export const thinqConnected = () => client !== null;
export const isLg = (device: CloudDevice) => device.homeId === LG_HOME;

/** Passa a usar a configuração salva; uma inválida (país desconhecido…) vira "desconectada". */
export function useThinq(next: ThinqConfig | null) {
  config = next;
  client = null;
  if (!next?.token || !next.country) return;
  try {
    client = createThinqClient({ token: next.token, country: next.country, clientId: next.clientId });
  } catch {
    config = { clientId: next.clientId };
  }
}

/** Valida o token buscando os aparelhos; só passa a usá-lo se a LG aceitar. */
export async function connectThinq(token: string, country: string): Promise<CloudDevice[]> {
  const next = { token: token.trim(), country: country.trim().toUpperCase(), clientId: config?.clientId ?? uuidv4() };
  const devices = await thinqInventory(createThinqClient(next));
  useThinq(next);
  return devices;
}

/** Esquece o token; o clientId fica para a próxima conexão. */
export function disconnectThinq() {
  useThinq(config ? { clientId: config.clientId } : null);
}

/** Os ares da conta, com perfil (o que cada modelo aceita) e estado atual. */
export async function thinqInventory(lg: ThinqClient | null = client): Promise<CloudDevice[]> {
  if (!lg) return [];
  const acs = (await lg.devices()).filter((d) => d.deviceType === LG_AC_TYPE);
  const devices = await Promise.all(
    acs.map(async (d): Promise<CloudDevice | null> => {
      // um modelo que a LG não descreve (ou um erro passageiro) fica de fora; os outros entram
      const profile = await lg.profile(d.deviceId).catch(() => null);
      if (!profile) return null;
      const state = await lg.state(d.deviceId).catch(() => null);
      return {
        id: d.deviceId,
        name: d.alias,
        localKey: '',
        category: 'kt', // ar-condicionado: mesma página e rótulos dos ares Tuya
        productId: d.modelName,
        productName: d.modelName,
        sub: false,
        online: state !== null, // sem estado = desconectado da LG
        homeId: LG_HOME,
        homeName: 'LG ThinQ',
        status: state ? lgAcStatus(state) : {},
        dps: lgAcDps(profile),
        supportLocal: false,
        writableKnown: true,
      };
    }),
  );
  return devices.filter((d): d is CloudDevice => d !== null);
}

export async function thinqStatus(deviceId: string): Promise<Record<string, unknown>> {
  return lgAcStatus(await connected().state(deviceId));
}

/** `mode`: o modo atual do aparelho — a temperatura vai no alvo dele. */
export async function thinqSend(deviceId: string, code: string, value: unknown, mode?: unknown): Promise<void> {
  await connected().control(deviceId, lgAcPayload({ code, value }, mode));
}

function connected(): ThinqClient {
  if (!client) throw new Error('LG ThinQ desconectada');
  return client;
}
