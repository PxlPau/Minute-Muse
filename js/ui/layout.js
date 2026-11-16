/* =============================================================================
   ui/layout.js — how the room is arranged

   The dashboard is yours: choose an accent, a density, a card finish, which
   side the rail sits on, how wide the reading column runs — and which tools
   appear at all, in what order. Everything is applied through `data-*`
   attributes on <body>, so the CSS stays declarative and nothing depends on a
   framework or a re-render.
   ========================================================================== */

import { $, $$, icon, toast } from '../util.js';
import { DASHBOARD_PANELS, patchSettings, settings } from '../store.js';

export const PANEL_META = {
  timer: { label: 'Focus session', hint: 'The dial, presets and transport.' },
  tasks: { label: 'Session tasks', hint: 'The list this session is for.' },
  sounds: { label: 'Ambience', hint: 'The layered soundscape mixer.' },
  music: { label: 'Listening room', hint: 'Local records and streaming links.' },
  cabinet: { label: 'Cabinet', hint: 'Ink, ember, rank and the daily draw.' },
};

const ACCENTS = [
  { id: 'gold', label: 'Lamplight gold' },
  { id: 'ember', label: 'Ember' },
  { id: 'verdigris', label: 'Verdigris' },
  { id: 'heather', label: 'Heather' },
  { id: 'rose', label: 'Dusty rose' },
  { id: 'indigo', label: 'Indigo' },
  { id: 'moss', label: 'Moss' },
];

const DENSITIES = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
];

const CARDS = [
  { id: 'glass', label: 'Glass' },
  { id: 'outline', label: 'Outline' },
  { id: 'paper', label: 'Paper' },
];

const RAILS = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

const WIDTHS = [
  { id: 'narrow', label: 'Narrow' },
  { id: 'regular', label: 'Regular' },
  { id: 'wide', label: 'Wide' },
];

export class DashboardLayout {
  constructor() {
    this.rail = $('#rail');
    this.list = $('#layout-panels');
  }

  init() {
    this.appliedSignature = '';
    this.renderChoices();
    this.renderPanelList();
    this.bind();
    this.apply();
  }

  /** Paint the current preferences onto the document. */
  apply() {
    const value = settings.value;
    const signature = JSON.stringify([
      value.accent, value.density, value.cardStyle, value.railSide,
      value.readingWidth, value.panelOrder, value.hiddenPanels,
    ]);
    if (signature === this.appliedSignature) return;
    this.appliedSignature = signature;
    const body = document.body;
    body.dataset.accent = value.accent;
    body.dataset.density = value.density;
    body.dataset.cards = value.cardStyle;
    body.dataset.rail = value.railSide;
    body.dataset.width = value.readingWidth;
    this.arrangePanels(value.panelOrder, value.hiddenPanels);
  }

  arrangePanels(order = DASHBOARD_PANELS, hidden = []) {
    if (!this.rail) return;
    const hiddenSet = new Set(hidden);
    // The timer is the room's reason for existing; an imported or stale
    // preference must not be able to hide the way you start a session.
    hiddenSet.delete('timer');
    const sections = new Map(
      $$('[data-panel]', this.rail).map((section) => [section.dataset.panel, section]),
    );
    const desired = [
      ...order.filter((id) => !hiddenSet.has(id)),
      ...order.filter((id) => hiddenSet.has(id)),
    ].filter((id) => sections.has(id));
    // Re-appending already-ordered sections would restart their animations on
    // every unrelated settings change, so only reorder when the order differs.
    const current = $$('[data-panel]', this.rail).map((section) => section.dataset.panel);
    if (current.join('|') !== desired.join('|')) {
      desired.forEach((id) => this.rail.appendChild(sections.get(id)));
    }
    desired.forEach((id) => {
      sections.get(id).classList.toggle('is-panel-hidden', hiddenSet.has(id));
    });

    // A dock button that opens an empty sheet is a small betrayal; hide it.
    $$('[data-sheet]').forEach((button) => {
      const map = { focus: 'timer', tasks: 'tasks', sounds: 'sounds', music: 'music' };
      const panel = map[button.dataset.sheet];
      button.hidden = panel ? hiddenSet.has(panel) : false;
    });
  }

  renderChoices() {
    const groups = [
      ['#setting-accent', ACCENTS, 'accent'],
      ['#setting-density', DENSITIES, 'density'],
      ['#setting-cards', CARDS, 'cardStyle'],
      ['#setting-rail', RAILS, 'railSide'],
      ['#setting-width', WIDTHS, 'readingWidth'],
    ];
    for (const [selector, options, key] of groups) {
      const host = $(selector);
      if (!host) continue;
      host.innerHTML = options
        .map((option) => `<button type="button" data-value="${option.id}" aria-pressed="false">${option.label}</button>`)
        .join('');
      host.addEventListener('click', (event) => {
        const button = event.target.closest('[data-value]');
        if (!button) return;
        patchSettings({ [key]: button.dataset.value });
        this.syncChoices();
        this.apply();
      });
    }
    this.syncChoices();
  }

  syncChoices() {
    const value = settings.value;
    const map = [
      ['#setting-accent', value.accent],
      ['#setting-density', value.density],
      ['#setting-cards', value.cardStyle],
      ['#setting-rail', value.railSide],
      ['#setting-width', value.readingWidth],
    ];
    for (const [selector, current] of map) {
      $$('[data-value]', $(selector)).forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.value === current));
      });
    }
  }

  renderPanelList() {
    if (!this.list) return;
    const value = settings.value;
    const order = value.panelOrder;
    const hidden = new Set(value.hiddenPanels);
    this.list.innerHTML = order.map((id, index) => {
      const meta = PANEL_META[id];
      if (!meta) return '';
      const isHidden = hidden.has(id);
      const fixed = id === 'timer';
      return `
        <div class="layout-row${isHidden ? ' is-hidden' : ''}" data-layout-row="${id}">
          <div class="layout-row__label">
            <strong>${meta.label}</strong>
            <span>${fixed ? 'The focus timer always stays on the desk.' : meta.hint}</span>
          </div>
          <div class="layout-row__controls">
            <button class="icon-btn icon-btn--xs" type="button" data-move="-1" data-panel-id="${id}"
              aria-label="Move ${meta.label} up" ${index === 0 ? 'disabled' : ''}>${icon('arrow-up', 'icon--sm')}</button>
            <button class="icon-btn icon-btn--xs" type="button" data-move="1" data-panel-id="${id}"
              aria-label="Move ${meta.label} down" ${index === order.length - 1 ? 'disabled' : ''}>${icon('arrow-down', 'icon--sm')}</button>
            <label class="switch switch--sm" title="${fixed ? 'The timer always stays' : `${isHidden ? 'Show' : 'Hide'} ${meta.label}`}">
              <input type="checkbox" data-visibility="${id}" ${isHidden ? '' : 'checked'}
                ${fixed ? 'disabled' : ''} aria-label="Show ${meta.label}" />
              <span class="switch__track"></span>
            </label>
          </div>
        </div>`;
    }).join('');
  }

  bind() {
    this.list?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-move]');
      if (!button) return;
      this.move(button.dataset.panelId, Number(button.dataset.move));
    });
    this.list?.addEventListener('change', (event) => {
      const input = event.target.closest('[data-visibility]');
      if (!input) return;
      this.toggle(input.dataset.visibility, input.checked);
    });

    $('#btn-layout-reset')?.addEventListener('click', () => {
      patchSettings({
        accent: 'gold',
        density: 'comfortable',
        cardStyle: 'glass',
        railSide: 'left',
        readingWidth: 'regular',
        panelOrder: [...DASHBOARD_PANELS],
        hiddenPanels: [],
      });
      this.syncChoices();
      this.renderPanelList();
      this.apply();
      toast('Dashboard reset to its original arrangement.', { icon: 'reset' });
    });

    // Another tab (or an import) can change the arrangement under us. Only the
    // arrangement fields redraw the panel list; volume drags must not.
    let lastOrder = settings.value.panelOrder.join(',');
    let lastHidden = settings.value.hiddenPanels.join(',');
    settings.subscribe((value) => {
      this.syncChoices();
      this.apply();
      const order = value.panelOrder.join(',');
      const hidden = value.hiddenPanels.join(',');
      if (order !== lastOrder || hidden !== lastHidden) {
        lastOrder = order;
        lastHidden = hidden;
        this.renderPanelList();
      }
    });
  }

  move(id, direction) {
    const order = [...settings.value.panelOrder];
    const index = order.indexOf(id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    patchSettings({ panelOrder: order });
    this.renderPanelList();
    this.apply();
  }

  toggle(id, visible) {
    if (id === 'timer' && !visible) {
      toast('The focus timer always stays on the desk.', { icon: 'alert', tone: 'warn' });
      this.renderPanelList();
      return;
    }
    const hidden = new Set(settings.value.hiddenPanels);
    if (visible) hidden.delete(id);
    else {
      const visibleCount = DASHBOARD_PANELS.length - hidden.size;
      if (visibleCount <= 1) {
        toast('Keep at least one panel on the desk.', { icon: 'alert', tone: 'warn' });
        this.renderPanelList();
        return;
      }
      hidden.add(id);
    }
    patchSettings({ hiddenPanels: [...hidden] });
    this.renderPanelList();
    this.apply();
  }
}
