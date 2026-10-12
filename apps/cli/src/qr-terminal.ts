import qrcode from 'qrcode-generator';

/** Desenha um QR no terminal usando meio-blocos (2 linhas do QR por linha de texto). */
export function renderQr(data: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  const n = qr.getModuleCount();
  const m = 2; // margem
  const dark = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && qr.isDark(r, c);
  const lines: string[] = [];
  for (let r = -m; r < n + m; r += 2) {
    let line = '';
    for (let c = -m; c < n + m; c++) {
      const top = dark(r, c);
      const bottom = dark(r + 1, c);
      // fundo claro, módulo escuro = espaço — funciona em terminal escuro
      line += top && bottom ? ' ' : top ? '▄' : bottom ? '▀' : '█';
    }
    lines.push(line);
  }
  return lines.join('\n');
}
