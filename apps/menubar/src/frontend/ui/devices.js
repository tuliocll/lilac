// Lista de aparelhos, em lista ou em grade (dois por linha).
(() => {
  const { $, h, glyph, gadgetIcon } = TuyaBar.dom;
  const { t } = TuyaBar.i18n;

  let devices = [];
  let layout = 'list';

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

  function item(d) {
    const li = h('li', d.route ? 'device' : 'device away');
    li.title = d.id;
    li.tabIndex = 0;
    li.setAttribute('role', 'button');

    const name = h('span', 'device-name');
    if (d.favorite) name.append(glyph('star-fill'), ' ');
    name.append(d.name);

    const meta = h('span', 'device-meta', [d.known ? d.type : t('type.unknown'), d.ip].filter(Boolean).join(' · ') || d.id);
    const [label, tone] = badge(d);
    const chip = h('span', 'badge', label);
    if (tone) chip.dataset.tone = tone;

    li.append(gadgetIcon(d.gadget, d.tone), name, meta, chip);
    const open = () => TuyaBar.devicePage.open(d);
    li.addEventListener('click', open);
    li.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && open());
    return li;
  }

  function render() {
    $('list').replaceChildren(...devices.map(item));
    $('list').dataset.layout = layout;
    document.body.classList.toggle('has-devices', devices.length > 0);
    renderLayoutButton();
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
