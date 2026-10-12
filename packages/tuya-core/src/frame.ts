import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';
import { concat, equalBytes, readU32be, u32be } from './bytes.ts';
import { crc32 } from './crc32.ts';
import { aesGcmDecrypt, aesGcmEncrypt } from './crypto.ts';

/**
 * Frames do protocolo Tuya.
 *
 * 0x55AA (v3.1 – v3.4):
 *   prefix(4)=000055AA | seq(4) | cmd(4) | len(4) | [retcode(4)] | payload | crc32(4) | suffix(4)=0000AA55
 *   `len` conta tudo depois do header: retcode + payload + crc + suffix.
 *
 * 0x6699 (v3.5):
 *   prefix(4)=00006699 | reserved(2) | seq(4) | cmd(4) | len(4) | iv(12) | ciphertext | tag(16) | suffix(4)=00009966
 *   AES-GCM com AAD = bytes 4..18 do header. `len` = iv + ciphertext + tag.
 */

export const PREFIX_55AA = 0x000055aa;
export const SUFFIX_55AA = 0x0000aa55;
export const PREFIX_6699 = 0x00006699;
export const SUFFIX_6699 = 0x00009966;

export const Cmd = {
  UDP: 0x00,
  CONTROL: 0x07,
  STATUS: 0x08,
  HEART_BEAT: 0x09,
  DP_QUERY: 0x0a,
  CONTROL_NEW: 0x0d,
  DP_QUERY_NEW: 0x10,
  UDP_NEW: 0x13,
  BROADCAST_LPV34: 0x23,
  REQ_DEVINFO: 0x25,
  SESS_KEY_NEG_START: 0x03,
  SESS_KEY_NEG_RESP: 0x04,
  SESS_KEY_NEG_FINISH: 0x05,
} as const;

export class FrameError extends Error {
  override name = 'FrameError';
}

export interface Frame55AA {
  kind: '55aa';
  seq: number;
  cmd: number;
  retcode?: number;
  payload: Uint8Array;
}

export interface Frame6699 {
  kind: '6699';
  seq: number;
  cmd: number;
  retcode?: number;
  /** payload já decifrado (sem retcode) */
  payload: Uint8Array;
}

export function detectPrefix(data: Uint8Array): '55aa' | '6699' | null {
  if (data.length < 4) return null;
  const p = readU32be(data, 0);
  if (p === PREFIX_55AA) return '55aa';
  if (p === PREFIX_6699) return '6699';
  return null;
}

/**
 * Heurística do retcode: frames vindos do dispositivo trazem 4 bytes de
 * código de retorno antes do payload. Payload de dispositivo nunca começa
 * com 0x00 (é JSON, "3.x" ou ciphertext), então 4 zeros ≈ retcode.
 */
function splitRetcode(body: Uint8Array, hasRetcode?: boolean): { retcode?: number; payload: Uint8Array } {
  const guess = hasRetcode ?? (body.length >= 4 && readU32be(body, 0) === 0);
  if (guess && body.length >= 4) return { retcode: readU32be(body, 0), payload: body.subarray(4) };
  return { payload: body };
}

/** Tamanho total do frame 55AA no início de `data`, ou null se ainda não chegou o header. */
export function frameLength55AA(data: Uint8Array): number | null {
  if (data.length < 16) return null;
  if (readU32be(data, 0) !== PREFIX_55AA) throw new FrameError('prefixo 0x55AA ausente (stream dessincronizado)');
  const len = readU32be(data, 12);
  if (len > 0x10000) throw new FrameError(`frame grande demais (${len})`);
  return 16 + len;
}

/**
 * Decodifica um frame 55AA. O fim do frame é conferido com CRC32 ou, no
 * protocolo 3.4, com HMAC-SHA256 (32 bytes) usando a chave local/da sessão.
 */
export function decode55AA(data: Uint8Array, opts: { hasRetcode?: boolean; hmacKey?: Uint8Array } = {}): Frame55AA {
  const checkSize = opts.hmacKey ? 32 : 4;
  const tailSize = checkSize + 4; // checksum + sufixo

  if (data.length < 16 + tailSize) throw new FrameError(`frame curto demais (${data.length} bytes)`);
  if (readU32be(data, 0) !== PREFIX_55AA) throw new FrameError('prefixo 0x55AA ausente');
  const seq = readU32be(data, 4);
  const cmd = readU32be(data, 8);
  const len = readU32be(data, 12);
  const end = 16 + len;
  if (len < tailSize) throw new FrameError(`len=${len} menor que o fim do frame`);
  if (end > data.length) throw new FrameError(`len=${len} excede os dados (${data.length})`);
  if (readU32be(data, end - 4) !== SUFFIX_55AA) throw new FrameError('sufixo 0xAA55 ausente');

  const signed = data.subarray(0, end - tailSize);
  const check = data.subarray(end - tailSize, end - 4);
  const expected = opts.hmacKey ? hmac(sha256, opts.hmacKey, signed) : u32be(crc32(signed));
  if (!equalBytes(check, expected)) throw new FrameError(opts.hmacKey ? 'HMAC inválido (local key errada?)' : 'CRC inválido');

  const { retcode, payload } = splitRetcode(data.subarray(16, end - tailSize), opts.hasRetcode);
  return { kind: '55aa', seq, cmd, retcode, payload };
}

export function encode55AA(
  f: { seq: number; cmd: number; retcode?: number; payload: Uint8Array },
  opts: { hmacKey?: Uint8Array } = {},
): Uint8Array {
  const body = f.retcode === undefined ? f.payload : concat(u32be(f.retcode), f.payload);
  const tail = opts.hmacKey ? 36 : 8;
  const head = concat(u32be(PREFIX_55AA), u32be(f.seq), u32be(f.cmd), u32be(body.length + tail));
  const signed = concat(head, body);
  const check = opts.hmacKey ? hmac(sha256, opts.hmacKey, signed) : u32be(crc32(signed));
  return concat(signed, check, u32be(SUFFIX_55AA));
}

export function decode6699(data: Uint8Array, key: Uint8Array, opts: { hasRetcode?: boolean } = {}): Frame6699 {
  if (data.length < 18 + 12 + 16 + 4) throw new FrameError(`frame 6699 curto demais (${data.length} bytes)`);
  if (readU32be(data, 0) !== PREFIX_6699) throw new FrameError('prefixo 0x6699 ausente');
  const seq = readU32be(data, 6);
  const cmd = readU32be(data, 10);
  const len = readU32be(data, 14);
  const end = 18 + len;
  if (len < 12 + 16) throw new FrameError(`len=${len} menor que IV + tag`);
  if (end + 4 > data.length) throw new FrameError(`len=${len} excede o datagrama (${data.length})`);
  if (readU32be(data, end) !== SUFFIX_6699) throw new FrameError('sufixo 0x9966 ausente');
  const aad = data.subarray(4, 18);
  const iv = data.subarray(18, 30);
  let plain: Uint8Array;
  try {
    plain = aesGcmDecrypt(key, iv, aad, data.subarray(30, end));
  } catch {
    throw new FrameError('falha ao decifrar GCM (chave errada?)');
  }
  const { retcode, payload } = splitRetcode(plain, opts.hasRetcode);
  return { kind: '6699', seq, cmd, retcode, payload };
}

export function encode6699(
  f: { seq: number; cmd: number; retcode?: number; payload: Uint8Array },
  key: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  if (iv.length !== 12) throw new FrameError('IV do GCM precisa ter 12 bytes');
  const plain = f.retcode === undefined ? f.payload : concat(u32be(f.retcode), f.payload);
  const len = 12 + plain.length + 16;
  const header = concat(u32be(PREFIX_6699), new Uint8Array(2), u32be(f.seq), u32be(f.cmd), u32be(len));
  const sealed = aesGcmEncrypt(key, iv, header.subarray(4), plain);
  return concat(header, iv, sealed, u32be(SUFFIX_6699));
}
