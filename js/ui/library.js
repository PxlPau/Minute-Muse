/* =============================================================================
   ui/library.js — searching the whole collection
   Query by phrase, author, or minute ("14:30"). Results render as quiet list
   rows; choosing one previews it in the reader.
   ========================================================================== */

import { $, $$, debounce, escapeHtml, toast } from '../util.js';
import { passages } from '../quotes.js';

const FILTER_LABELS = {
  all: 'Everything',
  time: 'This hour',
  now: 'This minute',
  author: 'By author',
};

export class Library {
  constructor({ overlays, reader }) {
    this.overlays = overlays;
    this.reader = reader;
    this.overlay = $('#library-overlay');
    this.input = $('#library-search');
    this.results = $('#library-results');
    this.empty = $('#library-empty');
    this.count = $('#library-count');
    this.hint = $('#library-hint');
    this.totalLabel = $('#library-total');
    this.filters = $('#library-filters');
    this.filter = 'all';
    this.lastQuery = '';
    this.search = debounce(() => this.run(), 160);
  }

  init() {
    this.input?.addEventListener('input', () => this.search());
    this.input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.search.flush();
        this.results?.querySelector('button.result')?.click();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.results?.querySelector('button.result')?.focus();
      }
    });

    this.filters?.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-filter]');
      if (!chip) return;
      this.filter = chip.dataset.filter;
      $$('[data-filter]', this.filters).forEach((button) => {
        button.classList.toggle('is-active', button === chip);
        button.setAttribute('aria-pressed', String(button === chip));
      });
      if (this.filter === 'author') {
        this.hint.textContent = 'Type an author’s name to browse their passages.';
        if (!this.input.value) this.input.focus();
        return;
      }
      this.run();
    });

    this.run();
  }

  open() {
    this.overlays.open(this.overlay);
    if (passages.minuteCount && this.totalLabel) {
      this.totalLabel.textContent = `${passages.total.toLocaleString()} passages across ${passages.minuteCount.toLocaleString()} minutes`;
    }
    window.setTimeout(() => {
      this.input?.focus({ preventScroll: true });
      this.input?.select();
    }, 260);
  }

  run() {
    if (!this.results) return;
    const query = this.input?.value.trim() || '';
    this.lastQuery = query;
    const { results, total } = passages.search(query, { filter: this.filter, limit: 60 });

    if (this.count) {
      this.count.textContent = total ? `${total.toLocaleString()} found` : '';
    }
    this.empty?.setAttribute('hidden', total ? 'true' : 'false');
    if (total === 0) this.empty.hidden = false;
    else if (this.empty) this.empty.hidden = true;

    this.results.innerHTML = results
      .map(
        (entry) => `
        <button class="result" type="button"
          data-quote="${escapeAttr(entry.quote)}"
          data-author="${escapeAttr(entry.author)}"
          data-title="${escapeAttr(entry.title)}"
          data-timecase="${escapeAttr(entry.timeCase)}"
          data-key="${entry.key}">
          <span class="result__quote">“${escapeHtml(entry.quote)}”</span>
          <span class="result__meta">
            <span class="time-tag">${entry.key}</span>
            <span>${escapeHtml(entry.author)}</span>
            ${entry.title ? `<span>· <em>${escapeHtml(entry.title)}</em></span>` : ''}
          </span>
        </button>`,
      )
      .join('');

    if (!this.results.dataset.bound) {
      this.results.dataset.bound = 'true';
      this.results.addEventListener('click', (event) => {
        const button = event.target.closest('.result');
        if (!button) return;
        const passage = {
          quote: button.dataset.quote,
          author: button.dataset.author,
          title: button.dataset.title,
          timeCase: button.dataset.timecase,
          key: button.dataset.key,
        };
        this.reader.previewPassage(passage);
        this.overlays.close(this.overlay);
        toast(`Opened a passage from ${button.dataset.key}.`, { icon: 'book' });
      });
    }
  }

  focusQuery(prefix = '') {
    this.input.value = prefix;
    this.search.flush();
  }
}

function escapeAttr(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
