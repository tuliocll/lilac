/**
 * Dispositivo Tuya falso (lado do aparelho) para testes — v3.3 e v3.4.
 * É validado contra o cliente do tinytuya em local.test.ts, então serve de
 * referência para o nosso cliente.
 */
import net from 'node:net';
import { concat, td, te } from '../src/bytes.ts';
import { Cmd, decode55AA, encode55AA, frameLength55AA } from '../src/frame.ts';
import { ecbDecrypt, ecbEncrypt, hmacSha256, sessionKey34, startsWithVersion, versionHeader } from '../src/local/crypto.ts';

export interface FakeDeviceOptions {
  id: string;
  localKey: string;
  version: '3.3' | '3.4';
  dps: Record<string, unknown>;
  /** simula aparelhos "device22" (respondem "data unvalid" ao DP_QUERY) */
  device22?: boolean;
}

export async function startFakeDevice(opts: FakeDeviceOptions) {
  const realKey = te.encode(opts.localKey);
  const dps = { ...opts.dps };
  const log: { cmd: number; body?: unknown }[] = [];
  const sockets = new Set<net.Socket>();

  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    let key: Uint8Array = realKey;
    let localNonce: Uint8Array | null = null as Uint8Array | null;
    let remoteNonce: Uint8Array | null = null;
    let buf: Uint8Array = new Uint8Array(0);
    let seq = 100;
    const v34 = opts.version === '3.4';

    const send = (cmd: number, payload: Uint8Array, k = key) => {
      sock.write(encode55AA({ seq: seq++, cmd, retcode: 0, payload }, { hmacKey: v34 ? k : undefined }));
    };
    const sendJson = (cmd: number, obj: unknown, withHeader: boolean) => {
      const json = te.encode(JSON.stringify(obj));
      if (v34) send(cmd, ecbEncrypt(key, withHeader ? concat(versionHeader('3.4'), json) : json));
      else send(cmd, withHeader ? concat(versionHeader('3.3'), ecbEncrypt(key, json)) : ecbEncrypt(key, json));
    };
    const pushStatus = (changed: Record<string, unknown>) => {
      const t = Math.floor(Date.now() / 1000);
      if (v34) sendJson(Cmd.STATUS, { protocol: 4, t, data: { dps: changed } }, true);
      else sendJson(Cmd.STATUS, { devId: opts.id, dps: changed, t }, true);
    };
    const readJson = (p: Uint8Array): any => {
      let b = p;
      if (v34) {
        b = ecbDecrypt(key, b);
        if (startsWithVersion(b)) b = b.subarray(15);
      } else {
        if (startsWithVersion(b)) b = b.subarray(15);
        b = ecbDecrypt(key, b);
      }
      return JSON.parse(td.decode(b));
    };

    sock.on('data', (chunk) => {
      buf = concat(buf, new Uint8Array(chunk));
      for (;;) {
        const len = frameLength55AA(buf);
        if (len === null || buf.length < len) return;
        const raw = buf.slice(0, len);
        buf = buf.slice(len);
        let f;
        try {
          f = decode55AA(raw, { hasRetcode: false, hmacKey: v34 ? key : undefined });
        } catch {
          return sock.destroy(); // aparelhos reais derrubam a conexão
        }

        if (f.cmd === Cmd.SESS_KEY_NEG_START) {
          localNonce = ecbDecrypt(realKey, f.payload) as Uint8Array;
          remoteNonce = te.encode('fakeRemoteNonce!');
          send(Cmd.SESS_KEY_NEG_RESP, ecbEncrypt(realKey, concat(remoteNonce, hmacSha256(realKey, localNonce))), realKey);
          log.push({ cmd: f.cmd });
          continue;
        }
        if (f.cmd === Cmd.SESS_KEY_NEG_FINISH) {
          const mac = ecbDecrypt(realKey, f.payload);
          const ok = td.decode(mac) === td.decode(hmacSha256(realKey, remoteNonce!));
          log.push({ cmd: f.cmd, body: ok });
          if (!ok) return sock.destroy();
          key = sessionKey34(realKey, localNonce!, remoteNonce!);
          continue;
        }

        const body = f.payload.length ? readJson(f.payload) : undefined;
        log.push({ cmd: f.cmd, body });

        if (f.cmd === Cmd.DP_QUERY || f.cmd === Cmd.DP_QUERY_NEW) {
          if (opts.device22 && f.cmd === Cmd.DP_QUERY) {
            send(f.cmd, ecbEncrypt(key, te.encode('json obj data unvalid')));
          } else sendJson(f.cmd, { devId: opts.id, dps, t: Math.floor(Date.now() / 1000) }, false);
        } else if (f.cmd === Cmd.CONTROL || f.cmd === Cmd.CONTROL_NEW) {
          const req = v34 ? body.data?.dps : body.dps;
          const asking = Object.values(req ?? {}).every((v) => v === null);
          send(f.cmd, new Uint8Array(0)); // ack vazio
          if (asking) pushStatus({ ...dps });
          else {
            Object.assign(dps, req);
            setTimeout(() => pushStatus(req), 20);
          }
        } else if (f.cmd === Cmd.HEART_BEAT) {
          send(Cmd.HEART_BEAT, new Uint8Array(0));
        }
      }
    });
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as net.AddressInfo).port;
  return {
    port,
    dps,
    log,
    close: () =>
      new Promise<void>((r) => {
        for (const s of sockets) s.destroy();
        server.close(() => r());
      }),
  };
}
