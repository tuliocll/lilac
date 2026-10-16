/**
 * Cliente da API ThinQ Connect — a API oficial da LG para os aparelhos do app
 * LG ThinQ (porta de thinqconnect/thinq_api.py, Apache-2.0 © LG Electronics).
 *
 * Autenticação por Personal Access Token (PAT), gerado pelo próprio usuário em
 * https://connect-pat.lgthinq.com — sem login por senha, sem QR.
 */

import { toBase64, uuidv4 } from '@lilac/core';
import { regionOf } from './regions.ts';

/** Chave pública do SDK oficial (thinqconnect/const.py): identifica a API, não o usuário. */
const API_KEY = 'v6GFvkweNo7DK7yD3ylIZ9w52aKBU0eJ7wLXkSR3';

export class ThinqError extends Error {
  constructor(
    message: string,
    /** código da LG (ex.: '1103' token inválido, '1222' aparelho desconectado) ou status HTTP */
    readonly code: string,
  ) {
    super(message);
    this.name = 'ThinqError';
  }
}

export interface ThinqDevice {
  deviceId: string;
  /** nome dado no app ThinQ */
  alias: string;
  /** 'DEVICE_AIR_CONDITIONER', 'DEVICE_WASHER'… */
  deviceType: string;
  modelName: string;
  /** cômodo/grupo do app ThinQ, quando há */
  groupId?: string;
}

export interface ThinqClientOptions {
  /** Personal Access Token */
  token: string;
  /** país da conta LG, ISO de duas letras (ex.: 'BR') */
  country: string;
  /** um UUID por instalação — a LG bloqueia quem cria clientes demais */
  clientId: string;
  fetch?: typeof fetch;
}

export interface ThinqClient {
  devices(): Promise<ThinqDevice[]>;
  /** o que o modelo aceita: propriedades, faixas, modos */
  profile(deviceId: string): Promise<any>;
  /** estado atual */
  state(deviceId: string): Promise<any>;
  /** ex.: { operation: { airConOperationMode: 'POWER_ON' } } */
  control(deviceId: string, payload: object): Promise<any>;
}

export function createThinqClient(options: ThinqClientOptions): ThinqClient {
  const fetchFn = options.fetch ?? fetch;
  const country = options.country.trim().toUpperCase();
  const region = regionOf(country);
  if (!region) throw new ThinqError(`A LG ThinQ não atende o país "${options.country}"`, 'country');
  const base = `https://api-${region}.lgthinq.com/`;

  async function request(method: 'GET' | 'POST', path: string, body?: object, extra: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.token}`,
      'x-country': country,
      'x-message-id': messageId(),
      'x-client-id': options.clientId,
      'x-api-key': API_KEY,
      'x-service-phase': 'OP',
      ...extra,
    };
    if (body) headers['Content-Type'] = 'application/json';
    const response = await fetchFn(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const json = (await response.json().catch(() => null)) as any;
    if (!response.ok) {
      const error = json?.error ?? {};
      throw new ThinqError(`LG ${error.code ?? response.status}: ${error.message ?? 'erro'} (${path})`, String(error.code ?? response.status));
    }
    return json?.response;
  }

  return {
    devices: async () =>
      ((await request('GET', 'devices')) ?? []).map((d: any) => ({
        deviceId: String(d.deviceId),
        alias: String(d.deviceInfo?.alias ?? d.deviceId),
        deviceType: String(d.deviceInfo?.deviceType ?? ''),
        modelName: String(d.deviceInfo?.modelName ?? ''),
        ...(d.deviceInfo?.groupId && { groupId: String(d.deviceInfo.groupId) }),
      })),
    profile: (id) => request('GET', `devices/${id}/profile`),
    state: (id) => request('GET', `devices/${id}/state`),
    // x-conditional-control: a LG recusa o comando se o aparelho não puder executá-lo agora
    control: (id, payload) => request('POST', `devices/${id}/control`, payload, { 'x-conditional-control': 'true' }),
  };
}

/** UUID v4 em base64url sem padding, 22 caracteres — o formato que a LG espera. */
function messageId(): string {
  const hex = uuidv4().replace(/-/g, '');
  const bytes = Uint8Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
