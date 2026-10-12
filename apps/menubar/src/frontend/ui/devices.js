// Lista de aparelhos, em lista ou em grade (dois por linha).
// Favoritos ficam numa seção própria, no topo, na ordem que o usuário
// escolher no modo "Organizar" (setas ↑ ↓ — funcionam com teclado e mouse).
(() => {
  const { $, h, button, glyph, gadgetIcon, logError } = TuyaBar.dom;
  const { t, pick } = TuyaBar.i18n;

  let devices = [];
  let layout = 'list';
  let arranging = false;
  /** ids já mostrados: só aparelhos novos ganham a animação de entrada */
  const shown = new Set();

  /** Como o aparelho está conectado, em texto (tooltip e cabeçalho da página). */
  function linkText(d) {
    if (!d.known) return t('link.stranger', { version: d.version });
    if (d.route === 'local') return t(d.experimental ? 'link.experimental' : 'link.local', { version: d.version });
    if (d.route === 'cloud') return t('link.cloud');
    return t('link.none');
  }

  /**
   * Um aparelho: ícone (com o pontinho de conexão), nome, tipo e até 3
   * ações rápidas. Com `move`, as setas de organizar ocupam o lugar delas.
   * O nome é o botão de abrir (teclado); clicar no ícone, no tipo ou no
   * fundo do item também abre.
   */
  function item(d, move) {
    const li = h('li', d.route ? 'device' : 'device away');
    if (!shown.has(d.id)) li.classList.add('entering');
    shown.add(d.id);
    li.dataset.id = d.id;
    li.title = [linkText(d), d.ip].filter(Boolean).join(' · ');

    const icon = gadgetIcon(d.gadget, d.tone);
    if (d.route) icon.dataset.link = d.route;

    const name = button('device-name');
    if (d.favorite) name.append(glyph('star-fill'), ' ');
    name.append(d.name);
    const meta = h('span', 'device-meta', d.known ? d.type : t('type.unknown'));

    li.append(icon, name, meta, move ? moveButtons(d, move) : quickActions(d));
    if (!move) {
      const open = () => TuyaBar.devicePage.open(d);
      name.addEventListener('click', open);
      li.addEventListener('click', (e) => e.target === li && open());
      for (const part of [icon, meta]) part.addEventListener('click', open);
    }
    return li;
  }

  // ---- ações rápidas

  function quickActions(d) {
    const box = h('span', 'quick-actions');
    (d.quick ?? []).forEach((action, index) => box.append(quickButton(d, action, index)));
    return box;
  }

  function quickButton(d, action, index) {
    const { control } = action;
    const label = pick(control.label);
    const b = button('btn quick');
    b.disabled = !d.route;

    if (action.mode === 'toggle') {
      b.append(glyph(control.type === 'power' ? 'power' : control.icon || 'power'));
      if (action.active !== undefined) b.setAttribute('aria-pressed', String(action.active));
      b.setAttribute('aria-label', `${label}: ${t(action.active ? 'device.on' : 'device.off')}`);
    } else {
      const value = TuyaBar.controls.format(control, action.value);
      if (control.icon) b.append(glyph(control.icon));
      b.append(h('span', 'text', value));
      b.setAttribute('aria-pressed', String(Boolean(action.active)));
      b.setAttribute('aria-label', `${label}: ${value}`);
    }
    b.title = b.getAttribute('aria-label');

    b.addEventListener('click', async (e) => {
      e.stopPropagation(); // não abre a página
      b.setAttribute('aria-busy', 'true');
      try {
        await tiny.api.call('runQuickAction', { id: d.id, index });
      } catch (error) {
        TuyaBar.status.show('quick.failed', { error: error.message ?? error }, { warn: true });
      } finally {
        b.removeAttribute('aria-busy');
      }
    });
    return b;
  }

  function moveButtons(d, { index, count }) {
    const box = h('span', 'move-buttons');
    const arrow = (direction, icon, key, disabled) => {
      const b = button('btn round');
      b.dataset.move = String(direction);
      b.append(glyph(icon));
      b.setAttribute('aria-label', t(key, { name: d.name }));
      b.title = b.getAttribute('aria-label');
      b.disabled = disabled;
      b.addEventListener('click', () => moveFavorite(d.id, direction));
      return b;
    };
    box.append(arrow(-1, 'arrow-up', 'devices.moveUp', index === 0), arrow(1, 'arrow-down', 'devices.moveDown', index === count - 1));
    return box;
  }

  function heading(text, action) {
    const li = h('li', 'list-heading');
    li.setAttribute('role', 'presentation');
    li.append(h('span', '', text));
    if (action) li.append(action);
    return li;
  }

  function arrangeButton() {
    const b = button('btn-link', t(arranging ? 'devices.reorderDone' : 'devices.reorder'));
    b.setAttribute('aria-pressed', String(arranging));
    b.addEventListener('click', () => {
      arranging = !arranging;
      render();
    });
    return b;
  }

  function render() {
    const favorites = devices.filter((d) => d.favorite);
    const others = devices.filter((d) => !d.favorite);
    if (favorites.length < 2) arranging = false; // com um só, não há o que ordenar

    const items = [];
    if (favorites.length) {
      items.push(heading(t('devices.favorites'), favorites.length > 1 ? arrangeButton() : null));
      items.push(...favorites.map((d, index) => item(d, arranging && { index, count: favorites.length })));
      if (others.length) items.push(heading(t('devices.others')));
    }
    items.push(...others.map((d) => item(d)));

    $('list').replaceChildren(...items);
    $('list').dataset.layout = layout;
    $('list').classList.toggle('arranging', arranging);
    document.body.classList.toggle('has-devices', devices.length > 0);
    renderLayoutButton();
  }

  // ---- organizar favoritos

  async function moveFavorite(id, direction) {
    const order = devices.filter((d) => d.favorite).map((d) => d.id);
    const from = order.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];

    // mostra na hora; o backend confirma reenviando a lista
    const byId = new Map(devices.map((d) => [d.id, d]));
    devices = [...order.map((x) => byId.get(x)), ...devices.filter((d) => !d.favorite)];
    render();
    focusArrow(id, direction);
    await tiny.api.call('reorderFavorites', { order }).catch(logError('reorderFavorites'));
  }

  /** Mantém o foco na mesma seta depois de mover — dá para ir apertando Enter. */
  function focusArrow(id, direction) {
    const row = $('list').querySelector(`[data-id="${CSS.escape(id)}"]`);
    const same = row?.querySelector(`[data-move="${direction}"]`);
    const other = row?.querySelector(`[data-move="${-direction}"]`);
    (same && !same.disabled ? same : other)?.focus();
  }

  // ---- lista ⇄ grade (lembrado entre aberturas)

  function renderLayoutButton() {
    const next = layout === 'list' ? 'grid' : 'list';
    const b = $('layout-toggle');
    b.replaceChildren(glyph(next === 'grid' ? 'view-grid' : 'view-list'));
    b.title = t(next === 'grid' ? 'action.layoutGrid' : 'action.layoutList');
    b.setAttribute('aria-label', b.title);
  }

  $('layout-toggle').addEventListener('click', async () => {
    layout = layout === 'list' ? 'grid' : 'list';
    render();
    await tiny.store.set('deviceLayout', layout).catch(() => {});
  });

  async function init() {
    layout = (await tiny.store.get('deviceLayout').catch(() => null)) === 'grid' ? 'grid' : 'list';
    render();
  }

  tiny.api.on('devices', (list) => {
    devices = list;
    render();
  });
  TuyaBar.i18n.onChange(render);

  TuyaBar.devices = { init, all: () => devices, linkText };
})();
