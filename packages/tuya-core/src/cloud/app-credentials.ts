/**
 * Credenciais de "app parceiro" da Tuya para o login por QR do Smart Life.
 *
 * ⚠️  O clientId abaixo é o do Home Assistant (registrado por eles na Tuya),
 * o único público hoje. Ele serve para o spike, para testar com a própria conta.
 * Antes de publicar o Lilac é preciso solicitar um clientId/schema próprios à
 * Tuya — distribuir um app se apresentando como Home Assistant não é ok.
 */
export interface SharingAppCredentials {
  clientId: string;
  schema: string;
}

export const HOME_ASSISTANT_CREDENTIALS: SharingAppCredentials = {
  clientId: 'HA_3y9q4ak7g4ephrvke',
  schema: 'haauthorize',
};
