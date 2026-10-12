/** Texto traduzido: { "pt-BR": "...", "en": "..." } */
export type I18nText = Record<string, string>;

/** Cor semântica — cada tema decide o tom real (tokens --tone-*). */
export type Tone = 'sun' | 'sky' | 'mint' | 'peach' | 'lilac' | 'pink' | 'neutral';

/**
 * Tipos de controle que a página sabe desenhar:
 *  power    botão grande liga/desliga          (Boolean)
 *  toggle   chave liga/desliga                 (Boolean)
 *  setpoint número grande com − / + e slider   (Integer) — ex.: temperatura alvo
 *  slider   barra deslizante                   (Integer)
 *  stepper  − valor +                          (Integer)
 *  select   escolha entre opções               (Enum)
 *  buttons  uma ação por opção                 (Enum) — ex.: abrir/parar/fechar
 *  readout  só leitura                         (qualquer)
 *  text     campo de texto                     (String)
 *  color    matiz + saturação                  (colour_data_v2 / colour_data)
 */
export type ControlType = 'power' | 'toggle' | 'setpoint' | 'slider' | 'stepper' | 'select' | 'buttons' | 'readout' | 'text' | 'color';

/**
 * Onde o controle aparece na página:
 *  header   canto da barra (ex.: liga/desliga do ar)
 *  hero     destaque central
 *  aside    informação ao lado do destaque (ex.: temperatura ambiente)
 *  chips    grade de cartões (modo, ventilação, sono…)
 *  main     lista de controles
 *  readouts linha de leituras (potência, tensão…)
 *  advanced o resto, gerado automaticamente, recolhido
 */
export type Slot = 'header' | 'hero' | 'aside' | 'chips' | 'main' | 'readouts' | 'advanced';

export interface ControlDef {
  /** códigos de DP aceitos, em ordem de preferência (o primeiro presente vence) */
  code: string | string[];
  type: ControlType;
  slot: Slot;
  label?: I18nText;
  /** glifo do ícone (ver icons/ no app) */
  icon?: string;
  unit?: string;
  /** rótulos das opções de Enum */
  options?: Record<string, I18nText>;
  /** só mostra se outro DP tiver este valor, ex.: { "work_mode": "white" } */
  showWhen?: Record<string, unknown>;
  /** "percent": mostra a posição na faixa (min..max) como 0–100% */
  display?: 'percent';
}

export interface GadgetProfile {
  id: string;
  name: I18nText;
  tone: Tone;
  /** layout da página (cada tema pode refinar por layout) */
  layout: 'climate' | 'switch' | 'light' | 'plug' | 'sensor' | 'cover' | 'fan' | 'hub' | 'generic';
  match: { categories: string[]; requiredCodes?: string[] };
  /** em empate de categoria, o maior vence */
  priority?: number;
  /** aviso exibido na página (ex.: hubs sem controle próprio) */
  note?: I18nText;
  controls: ControlDef[];
  /** SVG do ícone (preenchido pelo build a partir de icon.svg) */
  iconSvg?: string;
}

export interface CommonLabels {
  codes: Record<string, I18nText>;
  options: Record<string, I18nText>;
}

// --------------------------------------------------------------- resolvido

export interface ResolvedOption {
  value: string;
  label: I18nText;
}

export interface ResolvedControl {
  /** código do DP — também é a chave do controle */
  code: string;
  dpId: number;
  type: ControlType;
  slot: Slot;
  label: I18nText;
  icon?: string;
  writable: boolean;
  dpType: string;
  min?: number;
  max?: number;
  step?: number;
  /** casas decimais: valor exibido = bruto / 10^scale */
  scale: number;
  unit?: string;
  options?: ResolvedOption[];
  showWhen?: Record<string, unknown>;
  display?: 'percent';
}

export interface ResolvedGadget {
  profile: Pick<GadgetProfile, 'id' | 'name' | 'tone' | 'layout' | 'note'>;
  controls: ResolvedControl[];
}
