import { ecb, gcm } from '@noble/ciphers/aes';
import { md5 } from '@noble/hashes/legacy';
import { te } from './bytes.ts';

/**
 * Chave fixa usada pelos broadcasts UDP de descoberta (v3.3+):
 * md5("yGAdlopoPVldABfn"). É pública e igual para todos os dispositivos.
 */
export const UDP_KEY: Uint8Array = md5(te.encode('yGAdlopoPVldABfn'));

export function aesEcbDecrypt(key: Uint8Array, data: Uint8Array): Uint8Array {
  return ecb(key).decrypt(data); // remove padding PKCS#7
}

export function aesEcbEncrypt(key: Uint8Array, data: Uint8Array): Uint8Array {
  return ecb(key).encrypt(data); // adiciona padding PKCS#7
}

export function aesGcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  aad: Uint8Array,
  ciphertextAndTag: Uint8Array,
): Uint8Array {
  return gcm(key, iv, aad).decrypt(ciphertextAndTag);
}

export function aesGcmEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array,
): Uint8Array {
  return gcm(key, iv, aad).encrypt(plaintext); // ciphertext || tag(16)
}
