/**
 * A parte do handle do tinyjs que usamos — tipada, para não espalhar `any`.
 * O handle chega em cada chamada da API e no `init`; guardamos uma referência
 * para os módulos poderem avisar a interface (push) a qualquer momento.
 */
export interface TrayMenuItem {
  id?: string;
  label?: string;
  checked?: boolean;
  enabled?: boolean;
  separator?: boolean;
}

export interface TinyApp {
  push(event: string, data?: unknown): void;
  quit(): void;
  setHideOnClose(hide: boolean): void;
  tray: { set(spec: { title?: string; tooltip?: string; icon?: string; menu?: TrayMenuItem[]; primaryAction?: boolean }): void };
  store: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> };
  paths?: { data?: string };
}

let current: TinyApp | null = null;

export function setApp(app: TinyApp) {
  current = app;
}

export function app(): TinyApp {
  if (!current) throw new Error('o app ainda não iniciou');
  return current;
}

/** Envia um evento para a interface (no-op antes do app iniciar). */
export function push(event: string, data?: unknown) {
  current?.push(event, data);
}
