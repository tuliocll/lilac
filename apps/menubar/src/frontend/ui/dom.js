// Pequenos ajudantes de DOM. Nada de estilo aqui — só estrutura e classes.
(() => {
  /** Elemento pelo id. */
  const $ = (id) => document.getElementById(id);

  /** Cria um elemento com classe e texto opcionais. */
  function h(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  /** Botão (type="button" por padrão, para nunca submeter formulários sem querer). */
  function button(className, text) {
    const b = h('button', className, text);
    b.type = 'button';
    return b;
  }

  /** Ícone monocromático; a cor vem do tema (ver icons.css / base.css). */
  function glyph(name) {
    const i = h('i', 'glyph');
    if (name) i.dataset.g = name;
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  /** Quadro colorido com o ícone de um gadget (tom e ícone vêm do perfil). */
  function gadgetIcon(gadgetId, tone) {
    const tile = h('span', 'device-icon');
    tile.dataset.tone = tone || 'neutral';
    tile.style.setProperty('--glyph', `var(--i-gadget-${gadgetId || 'generic'})`);
    tile.append(glyph());
    return tile;
  }

  /** Repassa erros de promessas para o log do tinyjs em vez de engoli-los. */
  const logError = (where) => (error) => tiny.log(`[${where}] ${error?.message ?? error}`);

  Lilac.dom = { $, h, button, glyph, gadgetIcon, logError };
})();
