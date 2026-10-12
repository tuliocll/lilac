/**
 * Conexão local (TCP 6668) com um dispositivo Tuya — protocolos 3.3 e 3.4.
 * Comportamento baseado no tinytuya (MIT) e validado contra ele nos testes.
 *
 *   3.3  frames 55AA com CRC32; payload em AES-ECB(localKey).
 *        CONTROL leva o cabeçalho "3.3"+12×0 *fora* da criptografia.
 *   3.4  primeiro negocia uma chave de sessão (3 mensagens); depois usa
 *        HMAC-SHA256 no lugar do CRC. Comandos viram CONTROL_NEW/DP_QUERY_NEW
 *        e o cabeçalho "3.4"+12×0 vai *dentro* da criptografia.
 *
 * Uso:
 *   const dev = createLocalDevice({ id, ip, localKey, version, transport });
 *   await dev.status();            // { '1': true, '2': 22 }
 *   await dev.set({ '1': false });
 *   dev.close();
 */
import { concat, equalBytes, td, te } from '../bytes.ts';
import { randomBytes } from '../cloud/encoding.ts';
import { Cmd, decode55AA, encode55AA, frameLength55AA, FrameError, type Frame55AA } from '../frame.ts';
import type { TcpSocket, Transport } from '../transport.ts';
import { ecbDecrypt, ecbEncrypt, hmacSha256, sessionKey34, startsWithVersion, versionHeader, VERSION_HEADER_LEN } from './crypto.ts';

export type Dps = Record<string, unknown>;
export type LocalVersion = '3.3' | '3.4';
export type LocalErrorCode = 'timeout' | 'connect' | 'auth' | 'protocol' | 'closed' | 'unsupported';

export class LocalError extends Error {
  constructor(
    message: string,
    readonly code: LocalErrorCode,
  ) {
    super(message);
    this.name = 'LocalError';
  }
}

export const SUPPORTED_LOCAL_VERSIONS: readonly string[] = ['3.3', '3.4'];

export function isLocalVersionSupported(v: string | undefined): v is LocalVersion {
  return v !== undefined && SUPPORTED_LOCAL_VERSIONS.includes(v);
}

export interface LocalDeviceOptions {
  id: string;
  ip: string;
  localKey: string;
  version: string;
  transport: Transport;
  port?: number;
  /** tempo máximo esperando cada resposta */
  timeoutMs?: number;
  /** intervalo do heartbeat enquanto conectado (0 desliga). Aparelhos derrubam conexões ociosas. */
  heartbeatMs?: number;
}

export interface LocalDevice {
  readonly id: string;
  readonly version: LocalVersion;
  isConnected(): boolean;
  /** Lê todos os DPs. Conecta se precisar. */
  status(): Promise<Dps>;
  /** Escreve DPs, ex.: set({ '1': true }). Resolve com o que o aparelho confirmou. */
  set(dps: Dps): Promise<Dps>;
  /** DPs que o aparelho anuncia sozinho (alguém mexeu nele). Retorna a função para parar de ouvir. */
  onStatus(listener: (dps: Dps) => void): () => void;
  /** Chamado quando a conexão cai. */
  onClose(listener: (error?: Error) => void): () => void;
  close(): Promise<void>;
}

interface Waiter {
  accepts: (frame: Frame55AA) => boolean;
  resolve: (frame: Frame55AA) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const COMMANDS_WITHOUT_HEADER = new Set<number>([Cmd.DP_QUERY, Cmd.DP_QUERY_NEW, Cmd.HEART_BEAT]);
const EMPTY = new Uint8Array(0);

export function createLocalDevice(options: LocalDeviceOptions): LocalDevice {
  const { id, ip, transport, port = 6668, timeoutMs = 5000, heartbeatMs = 10_000 } = options;
  if (!isLocalVersionSupported(options.version)) {
    throw new LocalError(`protocolo v${options.version} ainda não suportado`, 'unsupported');
  }
  if (options.localKey.length !== 16) throw new LocalError('a local key precisa ter 16 caracteres', 'auth');

  const version: LocalVersion = options.version;
  const is34 = version === '3.4';
  const localKey = te.encode(options.localKey);

  // --- estado da conexão (tudo é reiniciado em resetConnection) ---
  let socket: TcpSocket | null = null;
  let sessionKey: Uint8Array = localKey; // em 3.4 vira a chave negociada
  let pending: Uint8Array = EMPTY;
  let seq = 1;
  let negotiating = false;
  let connecting: Promise<void> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let waiters: Waiter[] = [];

  // aparelhos "device22" só respondem a CONTROL_NEW pedindo DPs explícitos
  let isDevice22 = false;

  // último STATUS recebido (pode chegar no mesmo pacote que o ack de um controle)
  let lastStatus: Frame55AA | null = null;
  let statusCount = 0;

  const statusListeners = new Set<(dps: Dps) => void>();
  const closeListeners = new Set<(error?: Error) => void>();

  // Um comando por vez: as respostas são casadas pelo número do comando,
  // então dois comandos em paralelo poderiam pegar a resposta um do outro.
  let queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  // ------------------------------------------------------------- conexão

  function connect(): Promise<void> {
    if (socket) return Promise.resolve();
    connecting ??= openConnection().finally(() => (connecting = null));
    return connecting;
  }

  async function openConnection() {
    if (!transport.connectTcp) throw new LocalError('este runtime não tem TCP', 'unsupported');
    try {
      socket = await transport.connectTcp({ host: ip, port, timeoutMs });
    } catch (error) {
      throw new LocalError(`não conectou em ${ip}:${port} — ${(error as Error).message}`, 'connect');
    }
    const current = socket;
    current.onData((chunk) => socket === current && receive(chunk));
    current.onClose((error) => socket === current && dropConnection(error));

    if (is34) {
      try {
        await negotiateSessionKey();
      } catch (error) {
        await closeSocket();
        // o aparelho derruba a conexão quando o HMAC não confere: é chave errada
        if (error instanceof LocalError && error.code === 'closed') {
          throw new LocalError('o aparelho recusou a conexão — a local key provavelmente mudou', 'auth');
        }
        throw error;
      }
    }
    if (heartbeatMs > 0) heartbeat = setInterval(sendHeartbeat, heartbeatMs);
  }

  async function negotiateSessionKey() {
    negotiating = true;
    try {
      const localNonce = randomBytes(16);
      const reply = await sendFrame(Cmd.SESS_KEY_NEG_START, ecbEncrypt(localKey, localNonce), [Cmd.SESS_KEY_NEG_RESP]);
      let payload: Uint8Array;
      try {
        payload = ecbDecrypt(localKey, reply.payload);
      } catch {
        throw new LocalError('a local key não confere com o aparelho', 'auth');
      }
      if (payload.length < 48) throw new LocalError('resposta de negociação curta demais', 'protocol');

      const remoteNonce = payload.subarray(0, 16);
      if (!equalBytes(hmacSha256(localKey, localNonce), payload.subarray(16, 48))) {
        throw new LocalError('a local key não confere com o aparelho', 'auth');
      }
      await sendFrame(Cmd.SESS_KEY_NEG_FINISH, ecbEncrypt(localKey, hmacSha256(localKey, remoteNonce)), null);
      sessionKey = sessionKey34(localKey, localNonce, remoteNonce);
    } finally {
      negotiating = false;
    }
  }

  function sendHeartbeat() {
    exclusive(() => request(Cmd.HEART_BEAT, { gwId: id, devId: id }, [Cmd.HEART_BEAT])).catch((error) =>
      dropConnection(error as Error),
    );
  }

  function resetConnection() {
    clearInterval(heartbeat);
    heartbeat = undefined;
    socket = null;
    sessionKey = localKey;
    pending = EMPTY;
  }

  async function closeSocket() {
    const s = socket;
    resetConnection();
    rejectAllWaiters(new LocalError('conexão fechada', 'closed'));
    if (s) await s.close().catch(() => {});
  }

  function dropConnection(error?: Error) {
    if (!socket) return;
    const s = socket;
    resetConnection();
    rejectAllWaiters(new LocalError(error ? `a conexão caiu: ${error.message}` : 'o aparelho fechou a conexão', 'closed'));
    s.close().catch(() => {});
    for (const listener of closeListeners) listener(error);
  }

  // ------------------------------------------------------------- comandos

  async function status(): Promise<Dps> {
    return exclusive(async () => {
      await connect();
      if (is34) return dpsIn(await request(Cmd.DP_QUERY_NEW, {}, [Cmd.DP_QUERY_NEW, Cmd.STATUS])) ?? {};

      if (!isDevice22) {
        const now = String(unixTime());
        const reply = await request(Cmd.DP_QUERY, { gwId: id, devId: id, uid: id, t: now }, [Cmd.DP_QUERY, Cmd.STATUS]);
        if (reply !== 'device22') return dpsIn(reply) ?? {};
        isDevice22 = true;
      }
      return controlAndWait(Cmd.CONTROL_NEW, { devId: id, uid: id, t: String(unixTime()), dps: { '1': null } });
    });
  }

  async function set(dps: Dps): Promise<Dps> {
    return exclusive(async () => {
      await connect();
      return is34
        ? controlAndWait(Cmd.CONTROL_NEW, { protocol: 5, t: unixTime(), data: { dps } })
        : controlAndWait(Cmd.CONTROL, { devId: id, uid: id, t: String(unixTime()), dps });
    });
  }

  /**
   * Um controle costuma ter duas respostas: um "ack" (às vezes vazio) e um
   * STATUS com os DPs aplicados. Alguns aparelhos mandam só uma delas.
   * Esperamos pela primeira; se for um ack vazio, usamos o STATUS que chegar
   * em seguida (ou que já tenha chegado junto, no mesmo pacote TCP).
   */
  async function controlAndWait(cmd: number, body: unknown): Promise<Dps> {
    const statusesBefore = statusCount;
    const first = dpsIn(await request(cmd, body, [cmd, Cmd.STATUS]));
    if (first && Object.keys(first).length) return first;

    if (statusCount > statusesBefore && lastStatus) return dpsIn(decodePayload(lastStatus)) ?? {};
    const frame = await waitForFrame((f) => f.cmd === Cmd.STATUS, 2500).catch(() => null);
    return (frame && dpsIn(decodePayload(frame))) ?? {}; // sem STATUS: confirmou sem dizer o que mudou
  }

  // ------------------------------------------------------------- envio

  /** JSON → payload (cifrado, com cabeçalho de versão quando o comando pede) → frame. */
  async function request(cmd: number, body: unknown, expect: number[]): Promise<unknown> {
    const json = te.encode(JSON.stringify(body));
    const withHeader = !COMMANDS_WITHOUT_HEADER.has(cmd);
    let payload: Uint8Array;
    if (is34) {
      payload = ecbEncrypt(sessionKey, withHeader ? concat(versionHeader('3.4'), json) : json);
    } else {
      const encrypted = ecbEncrypt(sessionKey, json);
      payload = withHeader ? concat(versionHeader('3.3'), encrypted) : encrypted;
    }
    return decodePayload(await sendFrame(cmd, payload, expect));
  }

  /** Envia um frame. Com `expect`, espera pelo primeiro frame recebido com um daqueles comandos. */
  async function sendFrame(cmd: number, payload: Uint8Array, expect: number[] | null): Promise<Frame55AA> {
    if (!socket) throw new LocalError('desconectado', 'closed');
    const frame = encode55AA({ seq: seq++, cmd, payload }, { hmacKey: is34 ? sessionKey : undefined });
    const reply = expect ? waitForFrame((f) => expect.includes(f.cmd)) : null;
    await socket.write(frame);
    return reply ?? { kind: '55aa', seq: 0, cmd, payload: EMPTY };
  }

  function waitForFrame(accepts: (f: Frame55AA) => boolean, ms = timeoutMs): Promise<Frame55AA> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        accepts,
        resolve,
        reject,
        timer: setTimeout(() => {
          waiters = waiters.filter((w) => w !== waiter);
          reject(new LocalError('o aparelho não respondeu a tempo', 'timeout'));
        }, ms),
      };
      waiters.push(waiter);
    });
  }

  function rejectAllWaiters(error: Error) {
    const all = waiters;
    waiters = [];
    for (const w of all) {
      clearTimeout(w.timer);
      w.reject(error);
    }
  }

  // ------------------------------------------------------------- recebimento

  function receive(chunk: Uint8Array) {
    pending = pending.length ? concat(pending, chunk) : chunk;
    for (;;) {
      let length: number | null;
      try {
        length = frameLength55AA(pending);
      } catch (error) {
        return dropConnection(error as Error); // fluxo dessincronizado: melhor reconectar
      }
      if (length === null || pending.length < length) return;

      const raw = pending.slice(0, length);
      pending = pending.slice(length);
      try {
        dispatch(decode55AA(raw, { hasRetcode: true, hmacKey: is34 ? sessionKey : undefined }));
      } catch (error) {
        if (!(error instanceof FrameError)) throw error;
        // HMAC inválido durante a negociação = local key errada; fora dela, frame corrompido
        if (negotiating) rejectAllWaiters(new LocalError('a local key não confere com o aparelho', 'auth'));
      }
    }
  }

  function dispatch(frame: Frame55AA) {
    const index = waiters.findIndex((w) => w.accepts(frame));
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter!.timer);
      waiter!.resolve(frame);
    }
    if (frame.cmd === Cmd.STATUS && !negotiating) {
      lastStatus = frame;
      statusCount++;
      let dps: Dps | null = null;
      try {
        dps = dpsIn(decodePayload(frame));
      } catch {
        // STATUS ilegível: ignora, o próximo virá
      }
      if (dps) for (const listener of statusListeners) listener(dps);
    }
  }

  /** Bytes do frame → JSON. Retorna null para payload vazio e 'device22' para "data unvalid". */
  function decodePayload(frame: Frame55AA): unknown {
    let bytes = frame.payload;
    if (!bytes.length) return null;
    try {
      if (is34) {
        bytes = ecbDecrypt(sessionKey, bytes);
        if (startsWithVersion(bytes)) bytes = bytes.subarray(VERSION_HEADER_LEN);
      } else {
        if (startsWithVersion(bytes)) bytes = bytes.subarray(VERSION_HEADER_LEN);
        if (bytes[0] !== 0x7b /* { */) bytes = ecbDecrypt(sessionKey, bytes);
      }
    } catch {
      throw new LocalError('não consegui decifrar a resposta (local key errada?)', 'auth');
    }
    const text = td.decode(bytes);
    if (text.includes('data unvalid')) return 'device22';
    try {
      return JSON.parse(text);
    } catch {
      throw new LocalError(`resposta inesperada: ${text.slice(0, 60)}`, 'protocol');
    }
  }

  return {
    id,
    version,
    isConnected: () => socket !== null,
    status,
    set,
    onStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    onClose(listener) {
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    close: closeSocket,
  };
}

/** Aceita { dps } (3.3) e { data: { dps } } (3.4). */
export function dpsIn(reply: unknown): Dps | null {
  if (!reply || typeof reply !== 'object') return null;
  const r = reply as { dps?: Dps; data?: { dps?: Dps } };
  const dps = r.dps ?? r.data?.dps;
  return dps && typeof dps === 'object' ? { ...dps } : null;
}

function unixTime() {
  return Math.floor(Date.now() / 1000);
}
