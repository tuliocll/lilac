/** Rótulos das categorias Tuya mais comuns (código → nome). */
export const CATEGORY_LABELS: Record<string, string> = {
  kg: 'Interruptor',
  cz: 'Tomada',
  pc: 'Filtro de linha',
  tdq: 'Disjuntor',
  dj: 'Lâmpada',
  dd: 'Fita LED',
  xdd: 'Luz de teto',
  fwd: 'Luz ambiente',
  dc: 'Cordão de luz',
  kt: 'Ar-condicionado',
  ktkzq: 'Controle de ar',
  infrared_ac: 'Ar (IR)',
  infrared_tv: 'TV (IR)',
  infrared_fan: 'Ventilador (IR)',
  infrared_diy: 'Controle IR personalizado',
  infrared_stb: 'TV a cabo (IR)',
  infrared_box: 'TV box (IR)',
  infrared_light: 'Luz (IR)',
  infrared_projector: 'Projetor (IR)',
  infrared_amplifier: 'Som (IR)',
  infrared_camera: 'Câmera (IR)',
  infrared_water_heater: 'Aquecedor de água (IR)',
  infrared_air_purifier: 'Purificador (IR)',
  wxkg: 'Botão sem fio',
  wnykq: 'Controle IR',
  qn: 'Aquecedor',
  fs: 'Ventilador',
  fsd: 'Ventilador de teto',
  cl: 'Cortina',
  clkg: 'Interruptor de cortina',
  ckmkzq: 'Portão',
  mc: 'Sensor de porta',
  mcs: 'Sensor de porta',
  pir: 'Sensor de presença',
  hps: 'Sensor de presença',
  wsdcg: 'Temperatura/umidade',
  ywbj: 'Detector de fumaça',
  rqbj: 'Detector de gás',
  sj: 'Sensor de vazamento',
  sp: 'Câmera',
  wg2: 'Gateway',
  wfcon: 'Gateway',
  zigbeeszq: 'Gateway Zigbee',
  bh: 'Chaleira',
  cs: 'Desumidificador',
  jsq: 'Umidificador',
  kj: 'Purificador',
  sd: 'Robô aspirador',
  ms: 'Fechadura',
};

export function categoryLabel(code: string | undefined): string {
  return (code && CATEGORY_LABELS[code]) || code || 'Dispositivo';
}

/** Família visual do dispositivo — usada pelos temas para escolher ícone/cor. */
export type DeviceKind =
  | 'light'
  | 'switch'
  | 'plug'
  | 'climate'
  | 'ir'
  | 'gateway'
  | 'sensor'
  | 'fan'
  | 'cover'
  | 'camera'
  | 'lock'
  | 'unknown';

const KIND_BY_CATEGORY: Record<string, DeviceKind> = {
  dj: 'light', dd: 'light', xdd: 'light', fwd: 'light', dc: 'light',
  kg: 'switch', tdq: 'switch', clkg: 'switch',
  cz: 'plug', pc: 'plug',
  kt: 'climate', ktkzq: 'climate', infrared_ac: 'climate', qn: 'climate', cs: 'climate', jsq: 'climate', kj: 'climate',
  wnykq: 'ir',
  infrared_tv: 'ir', infrared_fan: 'fan', infrared_diy: 'ir', infrared_stb: 'ir', infrared_box: 'ir',
  infrared_light: 'light', infrared_projector: 'ir', infrared_amplifier: 'ir', infrared_camera: 'ir',
  infrared_water_heater: 'climate', infrared_air_purifier: 'climate',
  wxkg: 'switch',
  wg2: 'gateway', wfcon: 'gateway', zigbeeszq: 'gateway',
  mc: 'sensor', mcs: 'sensor', pir: 'sensor', hps: 'sensor', wsdcg: 'sensor', ywbj: 'sensor', rqbj: 'sensor', sj: 'sensor',
  fs: 'fan', fsd: 'fan',
  cl: 'cover', ckmkzq: 'cover',
  sp: 'camera',
  ms: 'lock',
};

export function categoryKind(code: string | undefined): DeviceKind {
  return (code && KIND_BY_CATEGORY[code]) || 'unknown';
}
