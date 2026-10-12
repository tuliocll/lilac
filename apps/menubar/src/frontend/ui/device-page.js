// Página de um aparelho: monta os controles por slot a partir do perfil do
// gadget e cuida do ciclo de vida (abrir, receber estado, reconectar, sair).
//
// Slots (ver packages/gadgets/src/types.ts):
//   header → barra de ferramentas · aside/hero → destaque · chips → grade
//   main → lista · readouts → leituras · advanced → recolhido
(() => {
  const { $, h, button, glyph, gadgetIcon, logError } = TuyaBar.dom;
  const { t, pick } = TuyaBar.i18n;
  const status = TuyaBar.status;

  const SLOT_ORDER = ['aside', 'hero', 'chips', 'main', 'readouts'];

  /** O que está aberto agora: { device, controls: [{ control, el, update }], values } */
  let page = null;

  // ------------------------------------------------------------ abrir e sair

  async function open(device) {
    page = { device, controls: [], values: {} };
    TuyaBar.nav.go('device', { title: device.name });
    const container = $('device-page');
    container.replaceChildren(h('p', 'muted center', t('device.connecting')));
    $('device-header').replaceChildren(quickButton(), favoriteButton(device));

    const done = status.busy();
    try {
      const result = await tiny.api.call('openDevice', { id: device.id });
      if (page?.device.id === device.id) render(result);
    } catch (error) {
      container.replaceChildren(h('p', 'dp-note warn card', t('device.reason.error', { error: error.message ?? error })));
    } finally {
      done();
    }
  }

  function leave() {
    if (page) tiny.api.call('closeDevice', { id: page.device.id }).catch(logError('closeDevice'));
    page = null;
  }
  TuyaBar.nav.onLeave('device', leave);

  // ------------------------------------------------------------ montagem

  function render(result) {
    const { device } = page;
    const { gadget, route } = result;
    const container = $('device-page');
    container.replaceChildren(header(device, gadget), ...notes(result));
    container.dataset.layout = gadget?.profile.layout ?? 'generic';
    container.classList.toggle('locked', !route);
    $('device-header').replaceChildren(quickButton(), favoriteButton(device));

    page.values = { ...result.values };
    page.controls = (gadget?.controls ?? []).map((control) => ({
      control,
      ...TuyaBar.controls.create(control, (value) => change(control, value)),
    }));

    const slots = {
      aside: h('div', 'dp-aside'),
      hero: h('div', 'dp-hero'),
      chips: h('div', 'dp-chips'),
      main: h('div', 'dp-main'),
      readouts: h('div', 'dp-readouts'),
      advanced: h('div', 'dp-main'),
    };
    for (const item of page.controls) {
      if (item.control.slot === 'header') $('device-header').prepend(item.el);
      else (slots[item.control.slot] ?? slots.main).append(item.el);
    }
    for (const name of SLOT_ORDER) if (slots[name].childElementCount) container.append(slots[name]);
    if (slots.advanced.childElementCount) {
      const details = h('details', 'dp-advanced');
      details.append(h('summary', '', t('device.advanced')), slots.advanced);
      container.append(details);
    }
    if (!page.controls.length && !gadget?.profile.note) container.append(h('p', 'dp-note card', t('device.noControls')));
    refresh();
  }

  /** Nome, tipo e — aqui, onde interessa — como está conectado e o IP. */
  function header(device, gadget) {
    const titles = h('div', 'titles');
    const type = gadget ? pick(gadget.profile.name) : device.type;
    const link = [TuyaBar.devices.linkText(device), device.ip].filter(Boolean).join(' · ');
    titles.append(h('div', 'name', device.name), h('div', 'sub', type), h('div', 'sub', link));
    const el = h('div', 'dp-head');
    el.append(gadgetIcon(gadget?.profile.id ?? device.gadget, gadget?.profile.tone ?? device.tone), titles);
    return el;
  }

  /** Avisos: do perfil (ex.: hubs), da rota (nuvem) e de por que não dá para controlar. */
  function notes({ gadget, route, reason, version, error }) {
    const list = [];
    if (gadget?.profile.note) list.push(h('p', 'dp-note card', pick(gadget.profile.note)));
    if (route === 'cloud' && reason) {
      list.push(h('p', 'dp-note card', t('device.cloud', { why: t(`device.why.${reason}`, { version, error }) })));
    }
    if (!route && reason) {
      const note = h('div', 'dp-note warn card stack-tight');
      note.append(h('p', '', t(`device.reason.${reason}`, { version: version ?? '', error: error ?? '' })));
      if (reason === 'auth' || reason === 'nokey') note.append(resyncButton());
      list.push(note);
    }
    return list;
  }

  function resyncButton() {
    const b = button('btn', t('device.resync'));
    b.addEventListener('click', async () => {
      b.disabled = true;
      await tiny.api.call('sync').catch(logError('sync'));
      if (page) open(page.device);
    });
    return b;
  }

  function favoriteButton(device) {
    const b = button('btn btn-icon');
    const render = (on) => {
      b.replaceChildren(glyph(on ? 'star-fill' : 'star'));
      b.setAttribute('aria-pressed', String(on));
      b.title = t(on ? 'device.favorite.remove' : 'device.favorite.add');
      b.setAttribute('aria-label', b.title);
    };
    render(Boolean(device.favorite));
    b.addEventListener('click', async () => {
      const { favorite } = await tiny.api.call('toggleFavorite', { id: device.id });
      device.favorite = favorite;
      render(favorite);
    });
    return b;
  }

  // ------------------------------------------------------------ ações rápidas

  function quickButton() {
    const b = button('btn btn-icon');
    b.append(glyph('quick'));
    b.title = t('quick.edit');
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', toggleQuickEditor);
    return b;
  }

  async function toggleQuickEditor() {
    const container = $('device-page');
    const open = container.querySelector('.quick-editor');
    if (open) return open.remove();
    const options = await tiny.api.call('quickActionOptions', { id: page.device.id }).catch(logError('quickActionOptions'));
    if (!options || !page) return;
    container.querySelector('.dp-head')?.after(quickEditor(options));
  }

  /**
   * Lista de controles que podem virar botão na lista de aparelhos.
   * Liga/desliga vira "alternar"; os demais fixam o valor atual
   * (ex.: escolha "Frio" no modo e marque — o botão fica "Frio").
   */
  function quickEditor({ chosen, candidates, max }) {
    const box = h('div', 'card quick-editor');
    let actions = [...chosen];

    const describe = (candidate, saved) => {
      const label = pick(candidate.control.label);
      if (candidate.mode === 'toggle') return label;
      const value = saved ? saved.value : page.values[candidate.code];
      return `${label}: ${TuyaBar.controls.format(candidate.control, value)}`;
    };

    async function toggle(candidate) {
      const index = actions.findIndex((a) => a.code === candidate.code);
      if (index >= 0) {
        actions.splice(index, 1);
      } else if (actions.length >= max) {
        return status.show('quick.max', { max }, { warn: true });
      } else {
        const value = candidate.mode === 'set' ? page.values[candidate.code] : undefined;
        actions.push({ code: candidate.code, mode: candidate.mode, value });
      }
      const result = await tiny.api.call('setQuickActions', { id: page.device.id, actions }).catch(logError('setQuickActions'));
      if (result) actions = result.actions;
      render();
    }

    function render() {
      const rows = candidates.map((candidate) => {
        const saved = actions.find((a) => a.code === candidate.code);
        const unknownValue = candidate.mode === 'set' && !saved && page.values[candidate.code] === undefined;
        const sw = button('switch');
        sw.setAttribute('role', 'switch');
        sw.setAttribute('aria-checked', String(Boolean(saved)));
        sw.disabled = unknownValue || (!saved && actions.length >= max);
        const text = describe(candidate, saved);
        sw.setAttribute('aria-label', text);
        sw.addEventListener('click', () => toggle(candidate));
        const row = h('div', 'setting-row');
        row.append(h('span', '', text), sw);
        return row;
      });
      box.replaceChildren(h('h2', 'section-title', t('quick.title')), h('p', 'hint', t('quick.hint', { max })), ...rows);
    }

    render();
    return box;
  }

  // ------------------------------------------------------------ valores

  /** Mostra a mudança na hora; se o aparelho recusar, volta e avisa. */
  async function change(control, value) {
    const item = page.controls.find((i) => i.control === control);
    const previous = page.values[control.code];
    page.values[control.code] = value;
    refresh();
    item?.el.setAttribute('aria-busy', 'true');
    try {
      Object.assign(page.values, await tiny.api.call('setControl', { id: page.device.id, code: control.code, value }));
    } catch (error) {
      page.values[control.code] = previous;
      status.show('device.setError', { error: error.message ?? error }, { warn: true });
    } finally {
      item?.el.removeAttribute('aria-busy');
      refresh();
    }
  }

  function refresh() {
    for (const item of page?.controls ?? []) {
      item.update(page.values[item.control.code]);
      item.el.classList.toggle('is-hidden', !isVisible(item.control));
    }
  }

  /** showWhen: { work_mode: 'colour' } → só aparece no modo cor (ou se ainda não sabemos o modo). */
  function isVisible(control) {
    const rules = Object.entries(control.showWhen ?? {});
    return rules.every(([code, expected]) => page.values[code] === undefined || page.values[code] === expected);
  }

  // ------------------------------------------------------------ eventos do backend

  tiny.api.on('state', ({ id, values }) => {
    if (page?.device.id !== id) return;
    Object.assign(page.values, values);
    refresh();
  });

  tiny.api.on('device-trouble', ({ id, reason }) => {
    if (page?.device.id !== id) return;
    if (reason) status.show('device.reconnecting', undefined, { warn: true });
    else status.show('device.reconnected');
    if (reason === 'auth') open(page.device); // mostra o botão de re-sincronizar
  });

  // textos dinâmicos: remonta no idioma novo
  TuyaBar.i18n.onChange(() => page && open(page.device));

  TuyaBar.devicePage = { open };
})();
