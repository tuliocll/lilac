/**
 * Assinatura e criptografia das requisições da API "Smart Life sharing"
 * (porta 1:1 de tuya_sharing/customerapi.py, MIT © Tuya).
 */
import { gcm } from '@noble/ciphers/aes';
import { hmac } from '@noble/hashes/hmac';
import { md5 } from '@noble/hashes/legacy';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import { td } from '../bytes.ts';
import { fromBase64, randomNonce, toBase64, utf8 } from './encoding.ts';

/** hash_key = md5_hex(requestId + refreshToken) */
export function hashKey(requestId: string, refreshToken: string): string {
  return bytesToHex(md5(utf8(requestId + refreshToken)));
}

/** secret = hmac_sha256(key=requestId, msg=hashKey[+ "_" + f(sid)]).hex[:16] */
export function deriveSecret(requestId: string, sid: string, hashKeyHex: string): string {
  let message = hashKeyHex;
  if (sid !== '') {
    const len = Math.min(sid.length, 16);
    let ecode = '';
    for (let i = 0; i < len; i++) ecode += sid[sid.charCodeAt(i) % 16] ?? '';
    message += '_' + ecode;
  }
  return bytesToHex(hmac(sha256, utf8(requestId), utf8(message))).slice(0, 16);
}

const SIGNED_HEADERS = ['X-appKey', 'X-requestId', 'X-sid', 'X-time', 'X-token'] as const;

export function restfulSign(
  hashKeyHex: string,
  queryEnc: string,
  bodyEnc: string,
  headers: Record<string, string>,
): string {
  const parts: string[] = [];
  for (const h of SIGNED_HEADERS) {
    const v = headers[h] ?? '';
    if (v !== '') parts.push(`${h}=${v}`);
  }
  const signStr = parts.join('||') + (queryEnc || '') + (bodyEnc || '');
  return bytesToHex(hmac(sha256, utf8(hashKeyHex), utf8(signStr)));
}

/** Retorna base64(nonce) + base64(ciphertext||tag) — sim, duas base64 concatenadas, como o SDK faz. */
export function encryptPayload(json: string, secret: string, nonce = randomNonce(12)): string {
  const n = utf8(nonce);
  const sealed = gcm(utf8(secret), n).encrypt(utf8(json));
  return toBase64(n) + toBase64(sealed);
}

/** A resposta vem como base64(nonce(12) || ciphertext || tag). */
export function decryptPayload(b64: string, secret: string): string {
  const raw = fromBase64(b64);
  return td.decode(gcm(utf8(secret), raw.subarray(0, 12)).decrypt(raw.subarray(12)));
}
