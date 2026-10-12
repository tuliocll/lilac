/**
 * Abstração de rede. O core nunca importa `node:dgram`, `tjs` etc. —
 * cada runtime fornece uma implementação (ver packages/transport-*).
 */

export interface RemoteInfo {
  address: string;
  port: number;
}

export interface UdpSocket {
  /** Registra um callback para cada datagrama recebido. */
  onMessage(cb: (data: Uint8Array, remote: RemoteInfo) => void): void;
  send(data: Uint8Array, port: number, address: string): Promise<void>;
  close(): Promise<void>;
}

export interface UdpBindOptions {
  port: number;
  /** Endereço local. Padrão: 0.0.0.0 */
  address?: string;
  /** Habilita SO_BROADCAST (necessário para enviar a 255.255.255.255). */
  broadcast?: boolean;
  /** SO_REUSEADDR — permite coexistir com outro app escutando a mesma porta. */
  reuseAddr?: boolean;
}

export interface TcpSocket {
  onData(cb: (data: Uint8Array) => void): void;
  onClose(cb: (err?: Error) => void): void;
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface TcpConnectOptions {
  host: string;
  port: number;
  timeoutMs?: number;
}

export interface Transport {
  bindUdp(opts: UdpBindOptions): Promise<UdpSocket>;
  /** Necessário só para controle local (TCP 6668). */
  connectTcp?(opts: TcpConnectOptions): Promise<TcpSocket>;
}
