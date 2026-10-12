/**
 * Spike #1 — descoberta na LAN, em Node.
 *   npm run discover            (escuta 10s)
 *   npm run discover -- 20      (escuta 20s)
 *   npm run discover -- 20 -v   (mostra também datagramas não reconhecidos)
 */
import { discover, toHex } from '@tuyabar/core';
import { createNodeTransport } from '@tuyabar/transport-node';

const seconds = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 10);
const verbose = process.argv.includes('-v');

console.log(`Escutando broadcasts Tuya nas portas 6666/6667/7000 por ${seconds}s…\n`);

const devices = await discover(createNodeTransport(), {
  timeoutMs: seconds * 1000,
  onDevice(d, isNew) {
    if (isNew) console.log(`+ ${d.id}  ${d.ip.padEnd(15)}  v${d.version}  [${d.frame} :${d.port}]  ${d.productKey ?? ''}`);
  },
  onUnknown(data, remote, port, err) {
    if (verbose) console.log(`? ${remote.address}:${remote.port} -> :${port}  ${err.message}  ${toHex(data.subarray(0, 24))}…`);
  },
  onBindError(port, err) {
    console.warn(`! não consegui abrir a porta ${port}: ${err.message}`);
  },
});

console.log(`\n${devices.length} dispositivo(s) encontrado(s).`);
if (devices.length) console.table(devices.map(({ id, ip, version, productKey, frame, port }) => ({ id, ip, version, productKey, frame, port })));
if (!devices.length)
  console.log(
    'Dicas: o PC precisa estar na mesma rede/sub-rede dos dispositivos; libere o Node no firewall do Windows (rede privada);\n' +
      'redes "guest"/isolamento de clientes no roteador bloqueiam broadcast.',
  );
