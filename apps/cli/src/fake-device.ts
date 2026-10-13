/**
 * Simula dispositivos Tuya anunciando na rede — para testar a descoberta sem
 * hardware. Roda junto com `npm run discover` (outro terminal):
 *   npm run fake-device
 *
 * Emite um anúncio de cada formato a cada 2s: v3.1 (6666, texto), v3.3 (6667, ECB)
 * e v3.5 (6667, frame 6699 com GCM).
 */
import { randomBytes } from 'node:crypto';
import { aesEcbEncrypt, Cmd, encode55AA, encode6699, te, UDP_KEY } from '@lilac/core';
import { createNodeTransport } from '@lilac/transport-node';

const ip = process.argv[2] ?? '192.168.0.250';
const fakes = [
  { version: '3.1', gwId: 'bf0000000000000031', productKey: 'fakePlug31', port: 6666 },
  { version: '3.3', gwId: 'bf0000000000000033', productKey: 'fakeBulb33', port: 6667 },
  { version: '3.5', gwId: 'bf0000000000000035', productKey: 'fakeAC35', port: 6667 },
];

function packet(f: (typeof fakes)[number], seq: number): Uint8Array {
  const json = te.encode(
    JSON.stringify({ ip, gwId: f.gwId, active: 2, ability: 0, mode: 0, encrypt: f.version !== '3.1', productKey: f.productKey, version: f.version }),
  );
  if (f.version === '3.1') return encode55AA({ seq, cmd: Cmd.UDP, retcode: 0, payload: json });
  if (f.version === '3.5') return encode6699({ seq, cmd: Cmd.UDP_NEW, retcode: 0, payload: json }, UDP_KEY, randomBytes(12));
  return encode55AA({ seq, cmd: Cmd.UDP_NEW, retcode: 0, payload: aesEcbEncrypt(UDP_KEY, json) });
}

const sock = await createNodeTransport().bindUdp({ port: 0, broadcast: true });
let seq = 0;
console.log(`Anunciando ${fakes.length} dispositivos falsos (ip=${ip}) a cada 2s. Ctrl+C para sair.`);
setInterval(async () => {
  seq++;
  for (const f of fakes) {
    const p = packet(f, seq);
    for (const addr of ['255.255.255.255', '127.0.0.1']) await sock.send(p, f.port, addr).catch(() => {});
  }
}, 2000);
