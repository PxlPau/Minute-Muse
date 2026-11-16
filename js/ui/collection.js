/* =============================================================================
   ui/collection.js — the Cabinet of Curios

   Owns three surfaces:
   · the rail's cabinet card (wallet, rank, streak, today's draw)
   · the collection overlay (draw, shelf, sets, curios, marks)
   · the reward announcement shown after a session or a draw

   All state lives in the `collection` signal; this file never invents a value.
   ========================================================================== */

import { $, $$, escapeHtml, icon, toast } from '../util.js';
import { collection, focusStreak, history, settings } from '../store.js';
import { curioArt } from '../curio-art.js';
import { MARKS, RARITY_META, SETS, CURIOS, CURIO_BY_ID } from '../curios.js';
import {
  COSTS, REWARDS, buyFromShelf, cabinetSummary, canCraft, craftSet, dailyShelf, drawCards,
  hasFreeDraw, ownedEntry, ownedInSet, setProgress, shelfPrice,
} from '../rewards.js';

const TABS = [
  { id: 'draw', label: 'Draw' },
  { id: 'shelf', label: 'The shelf' },
  { id: 'sets', label: 'Collections' },
  { id: 'curios', label: 'Your curios' },
  { id: 'marks', label: 'Marks' },
];

const RARITY_CLASS = {
  common: 'is-common',
  uncommon: 'is-uncommon',
  rare: 'is-rare',
  singular: 'is-singular',
};

export class CollectionPanel {
  constructor({ overlays, onOpenSettings = () => {} }) {
    this.overlays = overlays;
    this.onOpenSettings = onOpenSettings;
    this.overlay = $('#collection-overlay');
    this.hud = $('#cabinet-hud');
    this.tabsHost = $('#cabinet-tabs');
    this.panel = $('#cabinet-panel');
    this.footNote = $('#cabinet-foot-note');
    this.tab = 'draw';
    this.activeSet = SETS[0].id;
    this.lastPull = null;

    this.railWallet = $('#rail-wallet');
    this.railRank = $('#rail-rank');
    this.railMeter = $('#rail-meter');
    this.railStreak = $('#rail-streak');
    this.railDaily = $('#rail-daily');
    this.topbarDot = $('#daily-dot');
  }

  init() {
    this.renderTabs();
    this.wireOverlay();
    this.renderHud();
    this.renderPanel();

    collection.subscribe(() => {
      this.renderHud();
      if (this.overlay && this.overlays.isOpen(this.overlay)) this.renderPanel();
    });
    history.subscribe(() => this.renderHud());
  }

  /* ------------------------------------------------------------------- chrome */

  renderTabs() {
    if (!this.tabsHost) return;
    this.tabsHost.innerHTML = TABS.map(
      (tab) => `<button type="button" role="tab" class="cabinet-tab" data-tab="${tab.id}"
        aria-selected="${tab.id === this.tab}">${tab.label}</button>`,
    ).join('');
    this.tabsHost.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tab]');
      if (!button) return;
      this.setTab(button.dataset.tab);
    });
  }

  wireOverlay() {
    if (!this.overlay) return;
    this.panel?.addEventListener('click', (event) => this.handleAction(event));
  }

  setTab(tab) {
    if (!TABS.some((entry) => entry.id === tab)) return;
    this.tab = tab;
    $$('.cabinet-tab', this.tabsHost).forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.tab === tab));
    });
    this.renderPanel();
  }

  open(tab = null) {
    if (tab) this.tab = tab;
    this.renderHud();
    this.renderPanel();
    this.overlays.open(this.overlay);
  }

  /* ---------------------------------------------------------------------- hud */

  renderHud() {
    const summary = cabinetSummary();
    if (this.railWallet) {
      this.railWallet.innerHTML = `
        <span class="wallet__pile" title="Ink — earned by the minute">
          ${icon('ink', 'icon--sm')}<strong>${summary.ink.toLocaleString()}</strong><span>ink</span>
        </span>
        <span class="wallet__pile" title="Ember — earned at milestones">
          ${icon('ember', 'icon--sm')}<strong>${summary.ember}</strong><span>ember</span>
        </span>`;
    }
    if (this.railRank) {
      const { rank } = summary;
      this.railRank.innerHTML = `
        <span class="rail-rank__name">${escapeHtml(rank.name)}</span>
        <span class="rail-rank__next">${rank.next ? `${Math.ceil(rank.remainingSec / 3600)}h to ${escapeHtml(rank.next)}` : 'the far end of the shelf'}</span>`;
    }
    if (this.railMeter) {
      this.railMeter.style.setProperty('--fill', `${Math.round(summary.rank.progress * 100)}%`);
    }
    if (this.railStreak) {
      const streak = focusStreak();
      this.railStreak.innerHTML = `
        <span class="rail-streak__flame" aria-hidden="true">${icon('flame', 'icon--sm')}</span>
        <span>${streak} ${streak === 1 ? 'day' : 'days'} running</span>
        <span class="rail-streak__curios">${summary.curios}/${summary.totalCurios} curios</span>`;
    }
    if (this.railDaily) {
      const free = hasFreeDraw();
      this.railDaily.textContent = free ? 'Today’s draw is waiting' : 'Draw again with ink';
      this.railDaily.classList.toggle('is-ready', free);
    }
    if (this.topbarDot) this.topbarDot.hidden = !hasFreeDraw();

    if (this.hud) {
      this.hud.innerHTML = `
        <div class="cabinet-wallet">
          <span class="wallet__pile wallet__pile--lg" title="Ink">
            ${icon('ink')}<strong>${summary.ink.toLocaleString()}</strong><span>ink</span>
          </span>
          <span class="wallet__pile wallet__pile--lg" title="Ember">
            ${icon('ember')}<strong>${summary.ember}</strong><span>ember</span>
          </span>
        </div>
        <div class="cabinet-rankline">
          <span class="cabinet-rankline__name">${escapeHtml(summary.rank.name)}</span>
          <span class="cabinet-rankline__hint">${summary.rank.next
            ? `${Math.ceil(summary.rank.remainingSec / 60)} min to ${escapeHtml(summary.rank.next)}`
            : 'every rank earned'}</span>
        </div>
        <div class="meter meter--thin" aria-hidden="true"><span style="width:${Math.round(summary.rank.progress * 100)}%"></span></div>
        <div class="cabinet-statline">
          <span>${summary.curios}<span class="muted">/${summary.totalCurios}</span> curios</span>
          <span>${summary.setsComplete}<span class="muted">/${summary.totalSets}</span> collections</span>
          <span>${summary.marks}<span class="muted">/${summary.totalMarks}</span> marks</span>
        </div>
        ${summary.pity ? `<p class="field-hint">${REWARDS.pityAfter - summary.pity} draw(s) until a rare is guaranteed.</p>` : ''}`;
    }
    if (this.footNote) {
      this.footNote.textContent = `${summary.draws} draw${summary.draws === 1 ? '' : 's'} so far · everything stays on this device`;
    }
  }

  /* -------------------------------------------------------------------- panels */

  renderPanel() {
    if (!this.panel) return;
    switch (this.tab) {
      case 'shelf':
        this.panel.innerHTML = this.renderShelf();
        break;
      case 'sets':
        this.panel.innerHTML = this.renderSets();
        break;
      case 'curios':
        this.panel.innerHTML = this.renderCurios();
        break;
      case 'marks':
        this.panel.innerHTML = this.renderMarks();
        break;
      default:
        this.panel.innerHTML = this.renderDraw();
    }
  }

  renderDraw() {
    const summary = cabinetSummary();
    const free = summary.freeDraw;
    const pull = this.lastPull
      ? `
        <div class="pull-strip">
          ${this.lastPull.cards.map((card) => this.cardTile(card, { owned: true, compact: true, fresh: true })).join('')}
        </div>`
      : '';

    return `
      <section class="cabinet-section">
        <div class="cabinet-callout${free ? ' is-ready' : ''}">
          <div>
            <p class="section-label">Today</p>
            <h3>${free ? 'A card, on the house' : 'Today’s card has been drawn'}</h3>
            <p class="field-hint">One free draw each day. The cabinet keeps its own hours: it resets at midnight, local time.</p>
          </div>
          <button class="btn btn--primary" type="button" data-action="draw" data-mode="free" ${free ? '' : 'disabled'}>
            ${icon('cards')} ${free ? 'Draw a curio' : 'Come back tomorrow'}
          </button>
        </div>

        <div class="draw-grid">
          <div class="draw-option">
            <span class="draw-option__eyebrow">One card</span>
            <strong>${icon('ink', 'icon--sm')} ${COSTS.draw} ink</strong>
            <p>Any drawable curio. Duplicates return ink as an echo.</p>
            <button class="btn btn--ghost" type="button" data-action="draw" data-mode="single" ${summary.ink >= COSTS.draw ? '' : 'disabled'}>Draw</button>
          </div>
          <div class="draw-option">
            <span class="draw-option__eyebrow">Three cards</span>
            <strong>${icon('ink', 'icon--sm')} ${COSTS.triple} ink</strong>
            <p>Three draws, with at least one uncommon among them.</p>
            <button class="btn btn--ghost" type="button" data-action="draw" data-mode="triple" ${summary.ink >= COSTS.triple ? '' : 'disabled'}>Draw three</button>
          </div>
          <div class="draw-option draw-option--ember">
            <span class="draw-option__eyebrow">The ember draw</span>
            <strong>${icon('ember', 'icon--sm')} ${COSTS.emberDraw} ember</strong>
            <p>A guaranteed rare. Ember is never bought — only earned.</p>
            <button class="btn btn--ghost" type="button" data-action="draw" data-mode="ember" ${summary.ember >= COSTS.emberDraw ? '' : 'disabled'}>Spend an ember</button>
          </div>
        </div>

        ${pull}

        <p class="field-hint">Pity: ${summary.pity ? `${summary.pity}/${REWARDS.pityAfter} — a rare arrives by the ${REWARDS.pityAfter}th draw without one.` : 'a rare resets the counter.'}</p>
      </section>`;
  }

  renderShelf() {
    const shelf = dailyShelf();
    return `
      <section class="cabinet-section">
        <p class="section-label">The Antiquarian’s Shelf</p>
        <p class="field-hint">Three pieces offered for today, and nothing else. A bought piece leaves the shelf.</p>
        <div class="shelf-grid">
          ${shelf.map((curio) => {
            const owned = Boolean(ownedEntry(curio.id));
            const price = shelfPrice(curio);
            const affordable = owned ? false : (price.ember ? collection.value.ember >= price.ember : collection.value.ink >= price.ink);
            return `
              <article class="curio-card ${RARITY_CLASS[curio.rarity]}">
                <div class="curio-card__art">${curioArt(curio)}</div>
                <div class="curio-card__body">
                  <span class="rarity rarity--${curio.rarity}">${RARITY_META[curio.rarity].label}</span>
                  <h4>${escapeHtml(curio.name)}</h4>
                  <p class="curio-card__epigraph">${escapeHtml(curio.epigraph)}</p>
                  <p class="curio-card__source">${escapeHtml(curio.source)}</p>
                  <p class="curio-card__set">${escapeHtml(curio.setName)}</p>
                </div>
                <button class="btn ${affordable ? 'btn--primary' : 'btn--ghost'}" type="button"
                  data-action="buy" data-curio="${curio.id}" ${owned || !affordable ? 'disabled' : ''}>
                  ${owned ? 'In your cabinet' : `${icon(price.ember ? 'ember' : 'ink', 'icon--sm')} ${price.ember ? `${price.ember} ember` : `${price.ink} ink`}`}
                </button>
              </article>`;
          }).join('')}
        </div>
      </section>`;
  }

  renderSets() {
    const active = SETS.find((set) => set.id === this.activeSet) || SETS[0];
    const status = setProgress(active.id);
    const craft = canCraft(active.id);
    const items = ownedInSet(active.id);

    return `
      <section class="cabinet-section">
        <div class="set-grid">
          ${SETS.map((set) => {
            const progress = setProgress(set.id);
            return `
              <button type="button" class="set-chip${set.id === active.id ? ' is-active' : ''}${progress.complete ? ' is-complete' : ''}"
                data-action="set" data-set="${set.id}">
                <span class="set-chip__num">${set.number.toString().padStart(2, '0')}</span>
                <span class="set-chip__name">${escapeHtml(set.name)}</span>
                <span class="set-chip__count">${progress.owned}/${progress.total}</span>
              </button>`;
          }).join('')}
        </div>

        <div class="set-detail">
          <div class="set-detail__head">
            <div>
              <p class="section-label">Collection ${active.number}</p>
              <h3>${escapeHtml(active.name)}</h3>
              <p class="field-hint">${escapeHtml(active.blurb)}</p>
            </div>
            <div class="set-detail__progress">
              <strong>${status.owned}/${status.total}</strong>
              <span>${status.complete ? 'complete' : 'curios held'}</span>
            </div>
          </div>
          <div class="curio-grid">
            ${items.map(({ curio, owned }) => this.cardTile(curio, { owned: Boolean(owned), serial: owned?.serial })).join('')}
          </div>
          <div class="craft-row">
            <div>
              <strong>Assemble the singular piece</strong>
              <p class="field-hint">Hold the other six, then spend ${COSTS.craft} ember. Singulars are never drawn.</p>
            </div>
            <button class="btn ${craft.ok ? 'btn--primary' : 'btn--ghost'}" type="button"
              data-action="craft" data-set="${active.id}" ${craft.ok ? '' : 'disabled'}>
              ${icon('ember', 'icon--sm')} ${craft.ok ? 'Assemble' : escapeHtml(craft.reason)}
            </button>
          </div>
        </div>
      </section>`;
  }

  renderCurios() {
    const owned = [...collection.value.owned].reverse();
    if (!owned.length) {
      return `<div class="empty-state">${icon('cards')}<p>Nothing in the cabinet yet. The first draw is free.</p></div>`;
    }
    return `
      <section class="cabinet-section">
        <p class="section-label">${owned.length} of ${CURIOS.length} curios</p>
        <p class="field-hint">Every piece is inscribed with the number it entered the cabinet.</p>
        <div class="curio-grid curio-grid--wide">
          ${owned.map((entry) => {
            const curio = CURIO_BY_ID.get(entry.id);
            return curio ? this.cardTile(curio, { owned: true, serial: entry.serial }) : '';
          }).join('')}
        </div>
      </section>`;
  }

  renderMarks() {
    const owned = new Set(collection.value.marks);
    const earned = MARKS.filter((mark) => owned.has(mark.id));
    const pending = MARKS.filter((mark) => !owned.has(mark.id));
    const row = (mark) => `
      <div class="mark${owned.has(mark.id) ? ' is-earned' : ''}">
        <span class="mark__seal">${icon(owned.has(mark.id) ? 'check' : 'lock', 'icon--sm')}</span>
        <div class="mark__body">
          <strong>${escapeHtml(mark.name)}</strong>
          <span>${escapeHtml(mark.hint)}</span>
        </div>
        <span class="mark__reward">
          ${mark.reward.ink ? `${icon('ink', 'icon--sm')} ${mark.reward.ink}` : ''}
          ${mark.reward.ember ? `${icon('ember', 'icon--sm')} ${mark.reward.ember}` : ''}
        </span>
      </div>`;
    return `
      <section class="cabinet-section">
        <p class="section-label">${earned.length} of ${MARKS.length} marks</p>
        <div class="mark-list">${pending.map(row).join('')}${earned.map(row).join('')}</div>
      </section>`;
  }

  /** One curio card. Locked pieces show a silhouette rather than their art. */
  cardTile(curio, { owned = false, serial = null, compact = false, fresh = false } = {}) {
    const rarity = RARITY_META[curio.rarity]?.label || 'Curio';
    return `
      <article class="curio-card ${RARITY_CLASS[curio.rarity]}${owned ? ' is-owned' : ' is-locked'}${compact ? ' is-compact' : ''}${fresh ? ' is-fresh' : ''}"
        data-curio-id="${curio.id}">
        <div class="curio-card__art">
          ${owned ? curioArt(curio) : `<div class="curio-card__silhouette" aria-hidden="true">${icon('lock')}</div>`}
          <span class="rarity rarity--${curio.rarity}">${rarity}</span>
          ${serial ? `<span class="curio-card__serial">No. ${serial}</span>` : ''}
        </div>
        <div class="curio-card__body">
          <h4>${owned ? escapeHtml(curio.name) : 'Not yet in the cabinet'}</h4>
          <p class="curio-card__set">${escapeHtml(curio.setName)}${owned ? '' : ` · ${rarity}`}</p>
          ${owned ? `<p class="curio-card__epigraph">${escapeHtml(curio.epigraph)}</p>
            <p class="curio-card__source">${escapeHtml(curio.source)}</p>` : ''}
        </div>
      </article>`;
  }

  /* ------------------------------------------------------------------ actions */

  handleAction(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    try {
      if (action === 'draw') {
        this.performDraw(target.dataset.mode || 'single');
      } else if (action === 'buy') {
        const result = buyFromShelf(target.dataset.curio);
        toast(`${result.curio.name} joins the cabinet.${this.markNote(result.marks)}`, { icon: 'sparkle' });
      } else if (action === 'set') {
        this.activeSet = target.dataset.set;
        this.renderPanel();
      } else if (action === 'craft') {
        const result = craftSet(target.dataset.set);
        toast(`Assembled: ${result.curio.name}.${this.markNote(result.marks)}`, { icon: 'sparkle' });
      }
    } catch (error) {
      toast(error.userMessage || error.message || 'That did not work.', { icon: 'alert', tone: 'warn' });
    }
    this.renderHud();
    this.renderPanel();
  }

  performDraw(mode) {
    const result = drawCards({ mode });
    this.lastPull = result;
    const fresh = result.cards.filter((card) => !card.duplicate);
    const duplicates = result.cards.filter((card) => card.duplicate);
    const names = fresh.map((card) => card.name);
    let message;
    if (names.length && duplicates.length) {
      message = `${names.join(', ')} — and ink for the echoes.`;
    } else if (names.length > 1) {
      message = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`;
    } else if (names.length === 1) {
      message = `${names[0]} joins the cabinet.`;
    } else {
      const returns = [`${result.echo.ink} ink`];
      if (result.echo.ember) returns.push(`${result.echo.ember} ember`);
      message = `All echoes — ${returns.join(' and ')} returned.`;
    }
    toast(`${message}${this.markNote(result.marks)}`, { icon: 'sparkle', duration: 5600 });
  }

  /** A short clause for a toast that is already being shown. */
  markNote(marks = []) {
    if (!marks.length) return '';
    const total = marks.reduce(
      (sum, mark) => ({
        ink: sum.ink + (mark.reward.ink || 0),
        ember: sum.ember + (mark.reward.ember || 0),
      }),
      { ink: 0, ember: 0 },
    );
    const reward = [total.ink ? `+${total.ink} ink` : '', total.ember ? `+${total.ember} ember` : '']
      .filter(Boolean)
      .join(', ');
    return ` Mark earned: ${marks.map((mark) => mark.name).join(', ')}${reward ? ` (${reward})` : ''}.`;
  }

  /** Called by app.js after a session is logged, with rewards from rewards.js. */
  notifyReward(reward, { quiet = false } = {}) {
    if (!reward || (!reward.ink && !reward.ember && !(reward.marks || []).length)) return;
    if (quiet || !settings.value.rewardToasts) return;
    const marks = reward.marks || [];
    const markInk = marks.reduce((total, mark) => total + (mark.reward?.ink || 0), 0);
    const markEmber = marks.reduce((total, mark) => total + (mark.reward?.ember || 0), 0);
    const bits = [];
    if (reward.ink || markInk) bits.push(`+${(reward.ink || 0) + markInk} ink`);
    if (reward.ember || markEmber) bits.push(`+${(reward.ember || 0) + markEmber} ember`);
    if (reward.spark) bits.push('daily spark');
    if (marks.length) bits.push(...marks.map((mark) => `${mark.name} mark`));
    toast(bits.join(' · '), { icon: 'sparkle', duration: 5200 });
  }

  renderAll() {
    this.renderHud();
    this.renderPanel();
  }
}
