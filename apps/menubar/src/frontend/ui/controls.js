// Componentes de controle e montagem da página do gadget.
// Cada controle recebe um "ResolvedControl" (ver packages/gadgets) e devolve
// { el, update(valor) }. Nenhum estilo aqui — só classes do base.css.

window.Controls = (() => {
  const { t, pick } = I18N;

  // ------------------------------------------------------------ helpers

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function glyph(name) {
    const i = h('i', 'glyph');
    if (name) i.dataset.g = name;
    return i;
  }

  function decimals(c) {
    if (c.scale > 0) return c.scale;
    const step = (c.step ?? 1) / 10 ** c.scale;
    return step < 1 ? String(step).split('.')[1]?.length ?? 0 : 0;
  }

  function fmtNumber(c, v) {
    if (typeof v !== 'number') return v ?? '—';
    return v.toLocaleString(I18N.lang, { minimumFractionDigits: decimals(c), maximumFractionDigits: decimals(c) });
  }

  function fmt(c, v) {
    if (v === undefined || v === null) return '—';
    if (typeof v === 'boolean') return t(v ? 'device.on' : 'device.off');
    if (c.options) {
      const o = c.options.find((x) => x.value === String(v));
      if (o) return pick(o.label);
    }
    if (typeof v === 'number' && c.display === 'percent') {
      const { min, max } = bounds(c);
      return `${Math.round(((v - min) / (max - min || 1)) * 100)}%`;
    }
    if (typeof v === 'number') return `${fmtNumber(c, v)}${c.unit ? ` ${c.unit}` : ''}`;
    return String(v);
  }

  /** limites na escala de tela */
  function bounds(c) {
    const k = 10 ** c.scale;
    const min = (c.min ?? 0) / k;
    const max = (c.max ?? 100) / k;
    const step = Math.max(c.step ?? 1, 1) / k;
    return { min, max, step };
  }

  function setFill(range) {
    const min = Number(range.min);
    const max = Number(range.max);
    const p = max > min ? ((Number(range.value) - min) / (max - min)) * 100 : 0;
    range.style.setProperty('--fill', `${p}%`);
  }

  function rangeInput(c, onChange, onInput) {
    const { min, max, step } = bounds(c);
    const r = h('input', 'range');
    r.type = 'range';
    r.min = String(min);
    r.max = String(max);
    r.step = String(step);
    r.setAttribute('aria-label', pick(c.label));
    r.addEventListener('input', () => {
      setFill(r);
      onInput?.(Number(r.value));
    });
    r.addEventListener('change', () => onChange(Number(r.value)));
    return r;
  }

  // ------------------------------------------------------------ componentes

  const make = {
    power(c, slot, send) {
      if (slot === 'header') {
        const b = h('button', 'btn btn-icon ctl ctl-power-mini');
        b.type = 'button';
        b.title = pick(c.label);
        b.append(glyph('power'));
        let v = false;
        b.addEventListener('click', () => send(!v));
        return { el: b, update: (nv) => b.setAttribute('aria-pressed', String((v = Boolean(nv)))) };
      }
      const b = h('button', 'ctl ctl-power');
      b.type = 'button';
      const state = h('span', 'state');
      b.append(glyph('power'), state);
      b.setAttribute('aria-label', pick(c.label));
      let v = false;
      b.addEventListener('click', () => send(!v));
      return {
        el: b,
        update(nv) {
          v = Boolean(nv);
          b.setAttribute('aria-pressed', String(v));
          state.textContent = t(v ? 'device.on' : 'device.off');
        },
      };
    },

    toggle(c, slot, send) {
      let v = false;
      if (slot === 'chips') {
        const b = h('button', 'chip ctl');
        b.type = 'button';
        b.setAttribute('role', 'switch');
        const val = h('span', 'value');
        const dot = h('span', 'corner dot-state');
        b.append(glyph(c.icon), dot, h('span', 'label', pick(c.label)), val);
        b.addEventListener('click', () => send(!v));
        return {
          el: b,
          update(nv) {
            v = Boolean(nv);
            b.setAttribute('aria-checked', String(v));
            val.textContent = t(v ? 'device.on' : 'device.off');
          },
        };
      }
      const row = h('div', 'ctl-row ctl');
      if (c.icon) row.append(glyph(c.icon));
      const sw = h('button', 'switch');
      sw.type = 'button';
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-label', pick(c.label));
      sw.addEventListener('click', () => send(!v));
      row.append(h('span', 'label', pick(c.label)), sw);
      return { el: row, update: (nv) => sw.setAttribute('aria-checked', String((v = Boolean(nv)))) };
    },

    setpoint(c, slot, send) {
      const box = h('div', 'ctl ctl-setpoint');
      const big = h('div', 'sp-value');
      const num = h('span', 'num');
      const unit = h('span', 'unit', c.unit ?? '');
      big.append(num, unit);
      const { min, max, step } = bounds(c);
      let v = min;
      const r = rangeInput(c, (x) => send(x), (x) => (num.textContent = fmtNumber(c, x)));
      const minus = h('button', 'btn round');
      minus.type = 'button';
      minus.append(glyph('minus'));
      minus.setAttribute('aria-label', '−');
      const plus = h('button', 'btn round');
      plus.type = 'button';
      plus.append(glyph('plus'));
      plus.setAttribute('aria-label', '+');
      minus.addEventListener('click', () => send(Math.max(min, +(v - step).toFixed(6))));
      plus.addEventListener('click', () => send(Math.min(max, +(v + step).toFixed(6))));
      const row = h('div', 'sp-row');
      row.append(minus, r, plus);
      const scale = h('div', 'sp-scale');
      scale.append(h('span', '', `${fmtNumber(c, min)}°`), h('span', '', `${fmtNumber(c, max)}°`));
      box.append(big, row, scale);
      return {
        el: box,
        update(nv) {
          if (typeof nv !== 'number') return;
          v = nv;
          num.textContent = fmtNumber(c, nv);
          r.value = String(nv);
          setFill(r);
        },
      };
    },

    slider(c, slot, send) {
      const row = h('div', 'ctl-row ctl');
      if (c.icon) row.append(glyph(c.icon));
      const val = h('span', 'value');
      const r = rangeInput(c, (x) => send(x), (x) => (val.textContent = fmt(c, x)));
      row.append(h('span', 'label', pick(c.label)), val, r);
      return {
        el: row,
        update(nv) {
          if (typeof nv !== 'number') return;
          r.value = String(nv);
          setFill(r);
          val.textContent = fmt(c, nv);
        },
      };
    },

    stepper(c, slot, send) {
      const row = h('div', 'ctl-row ctl');
      if (c.icon) row.append(glyph(c.icon));
      const { min, max, step } = bounds(c);
      // passos grandes (ex.: temporizador em segundos) andam de 10 em 10 min
      const jump = max - min > 3600 ? 600 : step;
      let v = min;
      const st = h('div', 'stepper');
      const minus = h('button', 'btn round');
      minus.type = 'button';
      minus.append(glyph('minus'));
      const val = h('span', 'value');
      const plus = h('button', 'btn round');
      plus.type = 'button';
      plus.append(glyph('plus'));
      minus.addEventListener('click', () => send(Math.max(min, v - jump)));
      plus.addEventListener('click', () => send(Math.min(max, v + jump)));
      st.append(minus, val, plus);
      row.append(h('span', 'label', pick(c.label)), st);
      return {
        el: row,
        update(nv) {
          if (typeof nv !== 'number') return;
          v = nv;
          val.textContent = fmt(c, nv);
        },
      };
    },

    select(c, slot, send) {
      const sel = h('select');
      sel.setAttribute('aria-label', pick(c.label));
      for (const o of c.options ?? []) {
        const opt = h('option', '', pick(o.label));
        opt.value = o.value;
        sel.append(opt);
      }
      sel.addEventListener('change', () => send(sel.value));
      if (slot === 'chips') {
        const chip = h('label', 'chip ctl');
        const val = h('span', 'value');
        const corner = glyph('chevron');
        corner.classList.add('corner');
        chip.append(glyph(c.icon), corner, h('span', 'label', pick(c.label)), val, sel);
        return {
          el: chip,
          update(nv) {
            sel.value = String(nv);
            val.textContent = fmt(c, nv);
          },
        };
      }
      const row = h('div', 'ctl-row ctl');
      if (c.icon) row.append(glyph(c.icon));
      const wrap = h('label', 'select-wrap');
      const chev = glyph('chevron');
      wrap.append(sel, chev);
      row.append(h('span', 'label', pick(c.label)), wrap);
      return { el: row, update: (nv) => (sel.value = String(nv)) };
    },

    buttons(c, slot, send) {
      const box = h('div', 'ctl ctl-buttons');
      const btns = (c.options ?? []).map((o) => {
        const b = h('button', 'btn', pick(o.label));
        b.type = 'button';
        b.addEventListener('click', () => send(o.value));
        box.append(b);
        return [o.value, b];
      });
      return {
        el: box,
        update(nv) {
          for (const [val, b] of btns) b.classList.toggle('btn-primary', String(nv) === val);
        },
      };
    },

    readout(c) {
      const box = h('div', 'ctl ctl-readout');
      const label = h('span', 'label');
      if (c.icon) label.append(glyph(c.icon));
      label.append(document.createTextNode(pick(c.label)));
      const val = h('span', 'value', '—');
      box.append(label, val);
      return { el: box, update: (nv) => (val.textContent = fmt(c, nv)) };
    },

    text(c, slot, send) {
      const row = h('div', 'ctl-row ctl');
      const form = h('form', 'ctl-text');
      const input = h('input');
      const btn = h('button', 'btn', t('action.send'));
      btn.type = 'submit';
      form.append(input, btn);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        send(input.value);
      });
      row.append(h('span', 'label', pick(c.label)), form);
      return { el: row, update: (nv) => document.activeElement !== input && (input.value = nv ?? '') };
    },
  };

  // ------------------------------------------------------------ página

  /**
   * Monta a página de um gadget.
   * data: resposta de openDevice — { device, gadget, values, local, reason, error, version }
   * onSet(code, value) → Promise<values>
   */
  function renderPage(container, data, { onSet, onError, headerSlot }) {
    container.replaceChildren();
    headerSlot.replaceChildren();
    const { device, gadget } = data;
    const page = container;
    page.dataset.layout = gadget?.profile.layout ?? 'generic';
    page.dataset.tone = gadget?.profile.tone ?? 'neutral';

    // cabeçalho com ícone, nome e tipo
    const head = h('div', 'dp-head');
    const icon = h('span', 'device-icon');
    icon.dataset.tone = gadget?.profile.tone ?? device?.tone ?? 'neutral';
    icon.style.setProperty('--glyph', `var(--i-gadget-${gadget?.profile.id ?? device?.gadget ?? 'generic'})`);
    icon.append(glyph());
    const titles = h('div', 'titles');
    titles.append(h('div', 'name', device?.name ?? ''), h('div', 'sub', [gadget ? pick(gadget.profile.name) : device?.type, device?.ip].filter(Boolean).join(' · ')));
    head.append(icon, titles);
    page.append(head);

    // avisos: do perfil (ex.: hubs) e de conectividade
    if (gadget?.profile.note) page.append(h('p', 'dp-note card', pick(gadget.profile.note)));
    if (!data.local && data.reason) {
      const msg = t(`device.reason.${data.reason}`, { version: data.version ?? '', error: data.error ?? '' });
      page.append(h('p', 'dp-note warn card', msg));
    }
    if (!data.local) page.classList.add('locked');
    else page.classList.remove('locked');

    const slots = {
      aside: h('div', 'dp-aside'),
      hero: h('div', 'dp-hero'),
      chips: h('div', 'dp-chips'),
      main: h('div', 'dp-main'),
      readouts: h('div', 'dp-readouts'),
      advanced: h('div', 'dp-main'),
    };
    const items = [];
    let values = { ...data.values };

    for (const c of gadget?.controls ?? []) {
      const factory = make[c.type] ?? make.readout;
      const send = async (v) => {
        const prev = values[c.code];
        values[c.code] = v;
        refresh(); // otimista
        item.el.setAttribute('aria-busy', 'true');
        try {
          values = { ...values, ...(await onSet(c.code, v)) };
        } catch (e) {
          values[c.code] = prev;
          onError(t('device.setError', { error: e.message || e }));
        } finally {
          item.el.removeAttribute('aria-busy');
          refresh();
        }
      };
      const item = { c, ...factory(c, c.slot, send) };
      items.push(item);
      if (c.slot === 'header') headerSlot.append(item.el);
      else slots[c.slot]?.append(item.el);
    }

    if (slots.aside.childElementCount) page.append(slots.aside);
    if (slots.hero.childElementCount) page.append(slots.hero);
    for (const k of ['chips', 'main', 'readouts']) if (slots[k].childElementCount) page.append(slots[k]);
    if (slots.advanced.childElementCount) {
      const det = h('details', 'dp-advanced');
      det.append(h('summary', '', t('device.advanced')), slots.advanced);
      page.append(det);
    }
    if (!items.length && !gadget?.profile.note) page.append(h('p', 'dp-note card', t('device.noControls')));

    function refresh() {
      for (const it of items) {
        it.update(values[it.c.code]);
        const when = it.c.showWhen;
        const show = !when || Object.entries(when).every(([k, v]) => values[k] === undefined || values[k] === v);
        it.el.classList.toggle('is-hidden', !show);
      }
    }
    refresh();

    return {
      update(newValues) {
        values = { ...values, ...newValues };
        refresh();
      },
    };
  }

  return { renderPage, fmt };
})();
