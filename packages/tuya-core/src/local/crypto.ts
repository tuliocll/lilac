import { ecb } from '@noble/ciphers/aes';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { concat, te } from '../bytes.ts';

export const VERSION_HEADER_LEN = 15; // "3.x" + 12 zeros

export function versionHeader(version: string): Uint8Array {
  return concat(te.encode(version.slice(0, 3)), new Uint8Array(12));
}

export function startsWithVersion(b: Uint8Array): boolean {
  return b.length >= 3 && b[0] === 0x33 /* 3 */ && b[1] === 0x2e /* . */ && b[2]! >= 0x31 && b[2]! <= 0x35;
}

export const ecbEncrypt = (key: Uint8Array, data: Uint8Array) => ecb(key).encrypt(data);
export const ecbDecrypt = (key: Uint8Array, data: Uint8Array) => ecb(key).decrypt(data);
export const ecbEncryptRaw = (key: Uint8Array, data: Uint8Array) => ecb(key, { disablePadding: true }).encrypt(data);
export const hmacSha256 = (key: Uint8Array, data: Uint8Array) => hmac(sha256, key, data);

/** Chave da sessão v3.4: AES-ECB(localKey, localNonce XOR remoteNonce), sem padding. */
export function sessionKey34(localKey: Uint8Array, localNonce: Uint8Array, remoteNonce: Uint8Array): Uint8Array {
  const x = new Uint8Array(16);
  for (let i = 0; i < 16; i++) x[i] = localNonce[i]! ^ remoteNonce[i]!;
  return ecbEncryptRaw(localKey, x);
}
