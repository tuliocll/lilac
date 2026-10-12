/**
 * Conexão local (TCP 6668) com um dispositivo Tuya — v3.3 e v3.4.
 * Baseado no comportamento do tinytuya (MIT); validado contra ele nos testes.
 *
 * v3.3: frames 55AA com CRC32; payload AES-ECB(localKey).
 *       CONTROL leva o cabeçalho "3.3"+12×0 *fora* da criptografia.
 * v3.4: negocia uma chave de sessão (3 mensagens) e passa a usar HMAC-SHA256
 *       no lugar do CRC; comandos viram CONTROL_NEW/DP_QUERY_NEW e o cabeçalho
 *       "3.4"+12×0 vai *dentro* da criptografia.
 */
import { concat, td, te } from '../bytes.ts';
import { randomBytes } from '../cloud/encoding.ts';
import { Cmd, decode55AA, encode55AA, frameLength55AA, FrameError, type Frame55AA } from '../frame.ts';
import type { TcpSocket, Transport } from '../transport.ts';
import { ecbDecrypt, ecbEncrypt, hmacSha256, sessionKey34, startsWithVersion, versionHeader, VERSION_HEADER_LEN } from './crypto.ts';

export type Dps = Record<string, unknown>;
export type LocalVersion = '3.3' | '3.4';

export class LocalError extends Error {
  constructor(
    message: string,
    readonly code: 'timeout' | 'connect' | 'auth' | 'protocol' | 'closed' | 'unsupported',
  ) {
    super(message);
  }
}

export interface LocalDeviceOptions {
  id: string;
  ip: string;
  localKey: string;
  version: string;
  transport: Transport;
  port?: number;
  timeoutMs?: number;
}

export const SUPPORTED_LOCAL_VERSIONS: readonly string[] = ['3.3', '3.4'];

export function isLocalVersionSupported(v: string | undefined): v is LocalVersion {
  return !!v && SUPPORTED_LOCAL_VERSIONS.includes(v);
}

interface Waiter {
  match: (f: Frame55AA) => boolean;
  resolve: (f: Frame55AA) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class TuyaLocalDevice {
  readonly id: string;
  readonly version: LocalVersion;
  private readonly realKey: Uint8Array;
  private key: Uint8Array; // chave de sessão (3.4) ou a própria local key (3.3)
  private sock: TcpSocket | null = null;
  private buf: Uint8Array = new Uint8Array(0);
  private seq = 1;
  private waiters: Waiter[] = [];
  private statusListeners: ((dps: Dps) => void)[] = [];
  private closeListeners: ((err?: Error) => void)[] = [];
  private device22 = false;
  private negotiating = false;

  constructor(private readonly opts: LocalDeviceOptions) {
    if (!isLocalVersionSupported(opts.version)) throw new LocalError(`protocolo v${opts.version} ainda não suportado`, 'unsupported');
    if (opts.localKey.length !== 16) throw new LocalError('local key precisa ter 16 caracteres', 'auth');
    this.id = opts.id;
    this.version = opts.version;
    this.realKey = te.encode(opts.localKey);
    this.key = this.realKey;
  }

  get connected() {
    return this.sock !== null;
  }

  onStatus(cb: (dps: Dps) => void) {
    this.statusListeners.push(cb);
  }

  onClose(cb: (err?: Error) => void) {
    this.closeListeners.push(cb);
  }

  async connect(): Promise<void> {
    if (this.sock) return;
    const { transport, ip, port = 6668, timeoutMs = 5000 } = this.opts;
    if (!transport.connectTcp) throw new LocalError('este runtime não tem TCP', 'unsupported');
    try {
      this.sock = await transport.connectTcp({ host: ip, port, timeoutMs });
    } catch (e) {
      throw new LocalError(`não conectou em ${ip}:${port} — ${(e as Error).message}`, 'connect');
    }
    this.sock.onData((d) => this.onBytes(d));
    this.sock.onClose((err) => this.handleClose(err));
    if (this.version === '3.4') {
      try {
        await this.negotiate();
      } catch (e) {
        await this.close();
        throw e;
      }
    }
  }

  async close(): Promise<void> {
    const s = this.sock;
    this.sock = null;
    this.key = this.realKey;
    if (s) await s.close().catch(() => {});
    this.failAll(new LocalError('conexão fechada', 'closed'));
  }

  // ----------------------------------------------------------------- comandos

  /** Lê todos os DPs. */
  async status(): Promise<Dps> {
    await this.connect();
    const t = Math.floor(Date.now() / 1000);
    if (this.version === '3.4') {
      const res = await this.request(Cmd.DP_QUERY_NEW, {}, [Cmd.DP_QUERY_NEW, Cmd.STATUS]);
      return extractDps(res) ?? {};
    }
    if (!this.device22) {
      const res = await this.request(Cmd.DP_QUERY, { gwId: this.id, devId: this.id, uid: this.id, t: String(t) }, [Cmd.DP_QUERY, Cmd.STATUS]);
      if (res !== 'device22') return extractDps(res) ?? {};
      this.device22 = true;
    }
    // "device22": aparelhos com id de 22 caracteres que só respondem a CONTROL_NEW pedindo DPs explícitos
    const ask: Dps = { '1': null };
    const statusWait = this.waitFor((f) => f.cmd === Cmd.STATUS, 2500).catch(() => null);
    const ack = extractDps(await this.request(Cmd.CONTROL_NEW, { devId: this.id, uid: this.id, t: String(t), dps: ask }, [Cmd.CONTROL_NEW, Cmd.STATUS]));
    if (ack && Object.keys(ack).length) return ack;
    const st = await statusWait;
    return (st && extractDps(this.decodePayload(st))) ?? {};
  }

  /** Escreve DPs, ex.: set({ 1: true, 2: 23 }). Resolve com o que o aparelho confirmou. */
  async set(dps: Dps): Promise<Dps> {
    await this.connect();
    const t = Math.floor(Date.now() / 1000);
    const body =
      this.version === '3.4'
        ? { protocol: 5, t, data: { dps } }
        : { devId: this.id, uid: this.id, t: String(t), dps };
    const cmd = this.version === '3.4' ? Cmd.CONTROL_NEW : Cmd.CONTROL;

    // o aparelho responde com um "ack" e, em seguida, um STATUS com os DPs aplicados
    const statusWait = this.waitFor((f) => f.cmd === Cmd.STATUS, 2500).catch(() => null);
    const ack = await this.request(cmd, body, [cmd, Cmd.STATUS]);
    const ackDps = extractDps(ack);
    if (ackDps && Object.keys(ackDps).length) return ackDps;
    const st = await statusWait;
    return (st && extractDps(this.decodePayload(st))) ?? {};
  }

  // ----------------------------------------------------------------- sessão v3.4

  private async negotiate() {
    this.negotiating = true;
    try {
      const localNonce = randomBytes(16);
      const resp = await this.sendRaw(Cmd.SESS_KEY_NEG_START, ecbEncrypt(this.realKey, localNonce), [Cmd.SESS_KEY_NEG_RESP]);
      let payload: Uint8Array;
      try {
        payload = ecbDecrypt(this.realKey, resp.payload);
      } catch {
        throw new LocalError('falha na negociação (local key errada?)', 'auth');
      }
      if (payload.length < 48) throw new LocalError('resposta de negociação curta', 'protocol');
      const remoteNonce = payload.subarray(0, 16);
      const expected = hmacSha256(this.realKey, localNonce);
      if (!bytesEq(expected, payload.subarray(16, 48))) throw new LocalError('HMAC da negociação não confere (local key errada?)', 'auth');

      await this.sendRaw(Cmd.SESS_KEY_NEG_FINISH, ecbEncrypt(this.realKey, hmacSha256(this.realKey, remoteNonce)), null);
      this.key = sessionKey34(this.realKey, localNonce, remoteNonce);
    } finally {
      this.negotiating = false;
    }
  }

  // ----------------------------------------------------------------- enquadramento

  /** Monta payload (JSON → bytes cifrados com cabeçalho quando aplicável) e envia. */
  private async request(cmd: number, body: unknown, expect: number[]): Promise<unknown> {
    const json = te.encode(JSON.stringify(body));
    const noHeader = cmd === Cmd.DP_QUERY || cmd === Cmd.DP_QUERY_NEW || cmd === Cmd.HEART_BEAT;
    let payload: Uint8Array;
    if (this.version === '3.4') {
      payload = ecbEncrypt(this.key, noHeader ? json : concat(versionHeader('3.4'), json));
    } else {
      const enc = ecbEncrypt(this.key, json);
      payload = noHeader ? enc : concat(versionHeader('3.3'), enc);
    }
    const frame = await this.sendRaw(cmd, payload, expect);
    return this.decodePayload(frame);
  }

  private async sendRaw(cmd: number, payload: Uint8Array, expect: number[] | null): Promise<Frame55AA> {
    if (!this.sock) throw new LocalError('desconectado', 'closed');
    const hmacKey = this.version === '3.4' ? this.key : undefined;
    const data = encode55AA({ seq: this.seq++, cmd, payload }, { hmacKey });
    const wait = expect ? this.waitFor((f) => expect.includes(f.cmd)) : null;
    await this.sock.write(data);
    return wait ? wait : ({ kind: '55aa', seq: 0, cmd, payload: new Uint8Array(0) } as Frame55AA);
  }

  private waitFor(match: (f: Frame55AA) => boolean, timeoutMs = this.opts.timeoutMs ?? 5000): Promise<Frame55AA> {
    return new Promise((resolve, reject) => {
      const w: Waiter = {
        match,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((x) => x !== w);
          reject(new LocalError('o dispositivo não respondeu a tempo', 'timeout'));
        }, timeoutMs),
      };
      this.waiters.push(w);
    });
  }

  private onBytes(chunk: Uint8Array) {
    this.buf = this.buf.length ? concat(this.buf, chunk) : chunk;
    for (;;) {
      let len: number | null;
      try {
        len = frameLength55AA(this.buf);
      } catch (e) {
        this.buf = new Uint8Array(0);
        this.handleClose(e as Error);
        return;
      }
      if (len === null || this.buf.length < len) return;
      const raw = this.buf.slice(0, len);
      this.buf = this.buf.slice(len);
      let frame: Frame55AA;
      try {
        frame = decode55AA(raw, { hasRetcode: true, hmacKey: this.version === '3.4' ? this.key : undefined });
      } catch (e) {
        if (e instanceof FrameError) {
          // na negociação, HMAC inválido = local key errada
          if (this.negotiating) this.failAll(new LocalError('a local key não confere com o aparelho', 'auth'));
          continue; // fora dela: frame corrompido, ignora
        }
        throw e;
      }
      this.dispatch(frame);
    }
  }

  private dispatch(frame: Frame55AA) {
    const i = this.waiters.findIndex((w) => w.match(frame));
    if (i >= 0) {
      const [w] = this.waiters.splice(i, 1);
      clearTimeout(w!.timer);
      w!.resolve(frame);
    }
    // STATUS espontâneo (alguém mexeu no aparelho, ou resposta a um set)
    if (frame.cmd === Cmd.STATUS && !this.negotiating) {
      const dps = extractDps(this.decodePayload(frame));
      if (dps) for (const l of this.statusListeners) l(dps);
    }
  }

  /** Bytes do frame → objeto JSON (ou 'device22' / null). */
  private decodePayload(frame: Frame55AA): unknown {
    let p = frame.payload;
    if (!p.length) return null;
    try {
      if (this.version === '3.4') {
        p = ecbDecrypt(this.key, p);
        if (startsWithVersion(p)) p = p.subarray(VERSION_HEADER_LEN);
      } else {
        if (startsWithVersion(p)) p = p.subarray(VERSION_HEADER_LEN);
        if (p[0] !== 0x7b) p = ecbDecrypt(this.key, p);
      }
    } catch {
      throw new LocalError('não consegui decifrar a resposta (local key errada?)', 'auth');
    }
    const text = td.decode(p);
    if (text.includes('data unvalid')) return 'device22';
    try {
      return JSON.parse(text);
    } catch {
      throw new LocalError(`resposta inesperada: ${text.slice(0, 60)}`, 'protocol');
    }
  }

  private handleClose(err?: Error) {
    if (!this.sock) return;
    this.sock = null;
    this.key = this.realKey;
    this.failAll(new LocalError(err ? `conexão caiu: ${err.message}` : 'o dispositivo fechou a conexão', 'closed'));
    for (const l of this.closeListeners) l(err);
  }

  private failAll(err: Error) {
    const ws = this.waiters;
    this.waiters = [];
    for (const w of ws) {
      clearTimeout(w.timer);
      w.reject(err);
    }
  }
}

/** Aceita {dps}, {data:{dps}} (v3.4) e normaliza chaves para string. */
export function extractDps(obj: unknown): Dps | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as any;
  const dps = o.dps ?? o.data?.dps;
  return dps && typeof dps === 'object' ? { ...dps } : null;
}

function bytesEq(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}
