// Lista de aparelhos, em lista ou em grade (dois por linha).
// Favoritos ficam numa seção própria, no topo, na ordem que o usuário
// escolher no modo "Organizar" (setas ↑ ↓ — funcionam com teclado e mouse).
(() => {
  const { $, h, button, glyph, gadgetIcon, logError } = TuyaBar.dom;
  const { t } = TuyaBar.i18n;

  let devices = [];
  let layout = 'list';
  let arranging = false;
  /** ids já mostrados: só aparelhos novos ganham a animação de entrada */
  const shown = new Set();

  /** Selo de cada aparelho: [texto, tom] */
  function badge(d) {
    if (!d.known) return [t('badge.stranger', { version: d.version }), ''];
    if (d.route === 'local') return [t('badge.local', { version: d.version }), d.experimental ? 'warn' : 'ok'];
    if (d.route === 'cloud') return [t('badge.cloud'), ''];
    if (d.reason === 'nokey') return [t('badge.nokey'), 'warn'];
    if (d.reason === 'version') return [t('badge.unsupported', { version: d.version }), 'warn'];
    if (d.reason === 'sub') return [t('badge.sub'), ''];
    return [t('badge.away'), ''];
  }

  /** Um aparelho. Com `move`, mostra as setas de organizar no lugar do selo. */
  function item(d, move) {
    const li = h('li', d.route ? 'device' : 'device away');
    if (!shown.has(d.id)) li.classList.add('entering');
    shown.add(d.id);
    li.title = d.id;
    li.dataset.id = d.id;

    const name = h('span', 'device-name');
    if (d.favorite) name.append(glyph('star-fill'), ' ');
    name.append(d.name);
    const meta = h('span', 'device-meta', [d.known ? d.type : t('type.unknown'), d.ip].filter(Boolean).join(' · ') || d.id);
    li.append(gadgetIcon(d.gadget, d.tone), name, meta, move ? moveButtons(d, move) : badgeOf(d));

    if (!move) {
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      const open = () => TuyaBar.devicePage.open(d);
      li.addEventListener('click', open);
      li.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && open());
    }
    return li;
  }

  function badgeOf(d) {
    const [label, tone] = badge(d);
    const chip = h('span', 'badge', label);
    if (tone) chip.dataset.tone = tone;
    return chip;
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

  TuyaBar.devices = { init, all: () => devices };
})();
