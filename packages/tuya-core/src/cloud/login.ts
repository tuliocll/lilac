/**
 * Login por QR no app Smart Life — o mesmo fluxo da integração oficial Tuya
 * do Home Assistant (porta de tuya_sharing/user.py, MIT © Tuya).
 *
 *  1. requestLoginQr(userCode) → token; o QR contém `tuyaSmart--qrLogin?token=…`
 *  2. o usuário escaneia no Smart Life e confirma
 *  3. pollLogin(token) até vir a sessão (tokens + endpoint regional)
 */
import type { SharingAppCredentials } from './app-credentials.ts';

export const LOGIN_HOST = 'https://apigw.iotbing.com';

export class CloudError extends Error {
  constructor(
    message: string,
    readonly code?: string | number,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}

export interface SharingSession {
  uid: string;
  username?: string;
  accessToken: string;
  refreshToken: string;
  /** epoch ms em que o accessToken expira */
  expiresAt: number;
  /** host regional, ex.: https://apigw.tuyaus.com */
  endpoint: string;
  terminalId: string;
  userCode: string;
}

export interface LoginQr {
  token: string;
  /** conteúdo a ser codificado no QR */
  qrData: string;
}

export const qrDataFor = (token: string) => `tuyaSmart--qrLogin?token=${token}`;

export async function requestLoginQr(userCode: string, app: SharingAppCredentials, fetchFn: typeof fetch = fetch): Promise<LoginQr> {
  const query = new URLSearchParams({ clientid: app.clientId, usercode: userCode.trim(), schema: app.schema });
  const response = await fetchFn(`${LOGIN_HOST}/v1.0/m/life/home-assistant/qrcode/tokens?${query}`, { method: 'POST' });
  const json = (await response.json().catch(() => null)) as any;
  if (!json?.success || !json.result?.qrcode) {
    throw new CloudError(json?.msg || `falha ao gerar o QR (HTTP ${response.status})`, json?.code);
  }
  return { token: json.result.qrcode, qrData: qrDataFor(json.result.qrcode) };
}

/** Uma consulta. Retorna `null` enquanto o usuário não confirmou no app. */
export async function checkLogin(
  token: string,
  userCode: string,
  app: SharingAppCredentials,
  fetchFn: typeof fetch = fetch,
): Promise<SharingSession | null> {
  const query = new URLSearchParams({ clientid: app.clientId, usercode: userCode.trim() });
  const response = await fetchFn(`${LOGIN_HOST}/v1.0/m/life/home-assistant/qrcode/tokens/${token}?${query}`);
  const json = (await response.json().catch(() => null)) as any;
  if (!json?.success) return null;
  const r = json.result ?? {};
  return {
    uid: r.uid,
    username: r.username,
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: Number(json.t ?? Date.now()) + Number(r.expire_time ?? 0) * 1000,
    endpoint: r.endpoint,
    terminalId: r.terminal_id,
    userCode: userCode.trim(),
  };
}

/** Consulta a cada `intervalMs` até o login ser confirmado, expirar ou ser cancelado. */
export async function pollLogin(
  token: string,
  userCode: string,
  app: SharingAppCredentials,
  options: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<SharingSession> {
  const { intervalMs = 2000, timeoutMs = 3 * 60_000, signal } = options;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new CloudError('login cancelado');
    const session = await checkLogin(token, userCode, app, options.fetch).catch(() => null); // rede instável: tenta de novo
    if (session) return session;
    await sleep(intervalMs);
  }
  throw new CloudError('o QR expirou sem confirmação');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
