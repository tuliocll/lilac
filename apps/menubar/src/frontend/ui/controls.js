// Controles da página do gadget. Cada fábrica recebe um controle resolvido
// (ver packages/gadgets: ResolvedControl), o slot onde ele vai e `send(valor)`,
// e devolve { el, update(valor) }. Sem estilo aqui — só classes do base.css.
(() => {
  const { h, button, glyph } = TuyaBar.dom;
  const { t, pick } = TuyaBar.i18n;

  // ------------------------------------------------------------ formatação

  /** Casas decimais a partir da escala do DP (scale 1 → 22,5). */
  function decimals(c) {
    if (c.scale > 0) return c.scale;
    const step = (c.step ?? 1) / 10 ** c.scale;
    return step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
  }

  function formatNumber(c, value) {
    const digits = decimals(c);
    return value.toLocaleString(TuyaBar.i18n.lang(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  /** Limites na escala de tela. */
  function bounds(c) {
    const factor = 10 ** c.scale;
    return {
      min: (c.min ?? 0) / factor,
      max: (c.max ?? 100) / factor,
      step: Math.max(c.step ?? 1, 1) / factor,
    };
  }

  /** Valor pronto para ler: "22,5 °C", "Ligado", "Frio", "70%". */
  function format(c, value) {
    if (value === undefined || value === null) return '—';
    if (typeof value === 'boolean') return t(value ? 'device.on' : 'device.off');
    const option = c.options?.find((o) => o.value === String(value));
    if (option) return pick(option.label);
    if (typeof value === 'number' && c.display === 'percent') {
      const { min, max } = bounds(c);
      return `${Math.round(((value - min) / (max - min || 1)) * 100)}%`;
    }
    if (typeof value === 'number') return `${formatNumber(c, value)}${c.unit ? ` ${c.unit}` : ''}`;
    return String(value);
  }

  // ------------------------------------------------------------ peças comuns

  function paintFill(range) {
    const min = Number(range.min);
    const max = Number(range.max);
    const percent = max > min ? ((Number(range.value) - min) / (max - min)) * 100 : 0;
    range.style.setProperty('--fill', `${percent}%`);
  }

  /** <input type=range>: `onInput` enquanto arrasta, `onCommit` ao soltar. */
  function rangeInput(label, { min, max, step }, { onInput, onCommit, className = '' }) {
    const range = h('input', `range ${className}`.trim());
    Object.assign(range, { type: 'range', min: String(min), max: String(max), step: String(step) });
    range.setAttribute('aria-label', label);
    range.addEventListener('input', () => {
      paintFill(range);
      onInput?.(Number(range.value));
    });
    range.addEventListener('change', () => onCommit(Number(range.value)));
    return range;
  }

  function roundButton(icon, label, onClick) {
    const b = button('btn round');
    b.append(glyph(icon));
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  }

  /** Linha padrão: [ícone] rótulo … [conteúdo à direita] */
  function row(c, ...right) {
    const el = h('div', 'ctl-row ctl');
    if (c.icon) el.append(glyph(c.icon));
    el.append(h('span', 'label', pick(c.label)), ...right);
    return el;
  }

  // ------------------------------------------------------------ fábricas

  const factories = {
    power(c, slot, send) {
      let on = false;
      const b = button(slot === 'header' ? 'btn btn-icon ctl ctl-power-mini' : 'ctl ctl-power');
      const state = h('span', 'state');
      b.append(glyph('power'));
      if (slot !== 'header') b.append(state);
      b.setAttribute('aria-label', pick(c.label));
      b.addEventListener('click', () => send(!on));
      return {
        el: b,
        update(value) {
          on = Boolean(value);
          b.setAttribute('aria-pressed', String(on));
          state.textContent = t(on ? 'device.on' : 'device.off');
        },
      };
    },

    toggle(c, slot, send) {
      let on = false;
      if (slot === 'chips') {
        const chip = button('chip ctl');
        chip.setAttribute('role', 'switch');
        const value = h('span', 'value');
        chip.append(glyph(c.icon), h('span', 'corner dot-state'), h('span', 'label', pick(c.label)), value);
        chip.addEventListener('click', () => send(!on));
        return {
          el: chip,
          update(v) {
            on = Boolean(v);
            chip.setAttribute('aria-checked', String(on));
            value.textContent = t(on ? 'device.on' : 'device.off');
          },
        };
      }
      const sw = button('switch');
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-label', pick(c.label));
      sw.addEventListener('click', () => send(!on));
      return { el: row(c, sw), update: (v) => sw.setAttribute('aria-checked', String((on = Boolean(v)))) };
    },

    setpoint(c, slot, send) {
      const limits = bounds(c);
      let current = limits.min;
      const number = h('span', 'num');
      const big = h('div', 'sp-value');
      big.append(number, h('span', 'unit', c.unit ?? ''));

      const range = rangeInput(pick(c.label), limits, {
        onInput: (v) => (number.textContent = formatNumber(c, v)),
        onCommit: send,
      });
      const nudge = (delta) => send(Math.min(limits.max, Math.max(limits.min, +(current + delta).toFixed(6))));
      const controls = h('div', 'sp-row');
      controls.append(roundButton('minus', '−', () => nudge(-limits.step)), range, roundButton('plus', '+', () => nudge(limits.step)));
      const scale = h('div', 'sp-scale');
      scale.append(h('span', '', formatNumber(c, limits.min)), h('span', '', formatNumber(c, limits.max)));

      const box = h('div', 'ctl ctl-setpoint');
      box.append(big, controls, scale);
      return {
        el: box,
        update(v) {
          if (typeof v !== 'number') return;
          current = v;
          number.textContent = formatNumber(c, v);
          range.value = String(v);
          paintFill(range);
        },
      };
    },

    slider(c, slot, send) {
      const value = h('span', 'value');
      const range = rangeInput(pick(c.label), bounds(c), { onInput: (v) => (value.textContent = format(c, v)), onCommit: send });
      return {
        el: row(c, value, range),
        update(v) {
          if (typeof v !== 'number') return;
          range.value = String(v);
          paintFill(range);
          value.textContent = format(c, v);
        },
      };
    },

    stepper(c, slot, send) {
      const limits = bounds(c);
      // faixas enormes (temporizador em segundos) andam de 10 em 10 minutos
      const jump = limits.max - limits.min > 3600 ? 600 : limits.step;
      let current = limits.min;
      const value = h('span', 'value');
      const stepper = h('div', 'stepper');
      stepper.append(
        roundButton('minus', '−', () => send(Math.max(limits.min, current - jump))),
        value,
        roundButton('plus', '+', () => send(Math.min(limits.max, current + jump))),
      );
      return {
        el: row(c, stepper),
        update(v) {
          if (typeof v !== 'number') return;
          current = v;
          value.textContent = format(c, v);
        },
      };
    },

    select(c, slot, send) {
      const select = h('select');
      select.setAttribute('aria-label', pick(c.label));
      for (const o of c.options ?? []) {
        const option = h('option', '', pick(o.label));
        option.value = o.value;
        select.append(option);
      }
      select.addEventListener('change', () => send(select.value));

      if (slot === 'chips') {
        // cartão inteiro clicável: o <select> fica invisível por cima dele
        const chip = h('label', 'chip ctl');
        const value = h('span', 'value');
        const chevron = glyph('chevron');
        chevron.classList.add('corner');
        chip.append(glyph(c.icon), chevron, h('span', 'label', pick(c.label)), value, select);
        return {
          el: chip,
          update(v) {
            select.value = String(v);
            value.textContent = format(c, v);
          },
        };
      }
      const wrap = h('label', 'select-wrap');
      wrap.append(select, glyph('chevron'));
      return { el: row(c, wrap), update: (v) => (select.value = String(v)) };
    },

    buttons(c, slot, send) {
      const box = h('div', 'ctl ctl-buttons');
      const byValue = new Map();
      for (const o of c.options ?? []) {
        const b = button('btn', pick(o.label));
        b.addEventListener('click', () => send(o.value));
        byValue.set(o.value, b);
        box.append(b);
      }
      return {
        el: box,
        update(v) {
          for (const [value, b] of byValue) b.classList.toggle('btn-primary', String(v) === value);
        },
      };
    },

    readout(c) {
      const label = h('span', 'label');
      if (c.icon) label.append(glyph(c.icon));
      label.append(pick(c.label));
      const value = h('span', 'value', '—');
      const box = h('div', 'ctl ctl-readout');
      box.append(label, value);
      return { el: box, update: (v) => (value.textContent = format(c, v)) };
    },

    text(c, slot, send) {
      const input = h('input');
      const form = h('form', 'ctl-text');
      const submit = h('button', 'btn', t('action.send'));
      submit.type = 'submit';
      form.append(input, submit);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        send(input.value);
      });
      return {
        el: row(c, form),
        update(v) {
          if (document.activeElement !== input) input.value = v ?? '';
        },
      };
    },

    /** Cor: matiz + saturação (o brilho fica no slider de brilho). Valor { h, s, v }. */
    color(c, slot, send) {
      let color = { h: 0, s: 1, v: 1 };
      const swatch = h('span', 'color-swatch');
      const commit = () => send({ ...color });
      const hue = rangeInput(t('control.hue'), { min: 0, max: 360, step: 1 }, {
        className: 'hue',
        onInput: (v) => paint({ ...color, h: v }),
        onCommit: (v) => ((color = { ...color, h: v }), commit()),
      });
      const saturation = rangeInput(t('control.saturation'), { min: 0, max: 100, step: 1 }, {
        className: 'saturation',
        onInput: (v) => paint({ ...color, s: v / 100 }),
        onCommit: (v) => ((color = { ...color, s: v / 100 }), commit()),
      });
      const el = row(c, swatch, hue, saturation);
      el.classList.add('ctl-color');

      function paint(value) {
        el.style.setProperty('--hue', String(value.h));
        el.style.setProperty('--sat', String(value.s));
      }
      return {
        el,
        update(v) {
          if (!v || typeof v !== 'object') return;
          color = v;
          hue.value = String(Math.round(v.h));
          saturation.value = String(Math.round(v.s * 100));
          paint(v);
        },
      };
    },
  };

  /** Cria o controle certo para o tipo (tipo desconhecido vira leitura). */
  function create(control, send) {
    const factory = factories[control.type] ?? factories.readout;
    return factory(control, control.slot, send);
  }

  TuyaBar.controls = { create, format };
})();
