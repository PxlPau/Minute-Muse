/* =============================================================================
   ui/reader.js — the passage card
   Turns the minute into a page, lets the reader step through every passage that
   mentions that minute, preview neighbouring minutes, save favourites, copy,
   and reflect. All rendering goes through the escaping layer in quotes.js.
   ========================================================================== */

import { $, toast, copyText } from '../util.js';
import { passages } from '../quotes.js';
import { addBookmark, bookmarks, isBookmarked, removeBookmark } from '../store.js';

/**
 * Choose the next passage to show from `pool`.
 *
 * @param {Array<{quote: string}>} pool      every passage for the minute
 * @param {number} resume                   index to continue from, or -1 if unknown
 * @param {string|null} onScreen            quote currently displayed
 * @returns {number} an index into `pool` whose quote differs from `onScreen`
 *
 * The one rule that matters: never hand back the passage already on screen. When
 * a minute holds a single passage that is impossible, and the caller falls back
 * to a neighbouring minute instead of pretending there is nothing more to read.
 */
function nextIndex(pool, resume, onScreen) {
  const count = pool.length;
  if (!count) return -1;

  // Walk forward from where we left off, skipping repeats of the visible quote.
  for (let step = 1; step <= count; step += 1) {
    const index = (((resume + step) % count) + count) % count;
    if (pool[index].quote !== onScreen) return index;
  }

  // Nothing in `pool` differs from the visible quote, so a repeat is unavoidable
  // (this only happens when a minute's list is made entirely of duplicates).
  // Hand back the current position rather than an arbitrary one.
  return Math.min(Math.max(resume, 0), count - 1);
}

export class Reader {
  constructor({ onBookmarkChange = () => {}, onReflect = () => {}, onTurn = () => {} } = {}) {
    this.root = $('#reader');
    this.elQuote = $('#quote');
    this.elAuthor = $('#author');
    this.elWork = $('#work');
    this.elSave = $('#btn-save-quote');
    this.elPreview = $('#preview-flag');
    this.elContext = $('#reader-context');
    this.elEyebrow = $('#reader-eyebrow-text');
    this.onBookmarkChange = onBookmarkChange;
    this.onReflect = onReflect;
    this.onTurn = onTurn;

    this.current = null; // { ...passage, key }
    this.previewOffset = 0; // minutes away from now, 0 = live
    this.seenIndex = -1; // position in the current minute's list, -1 = not yet stepped
    this.swapTimer = null;
  }

  init() {
    this.elSave?.addEventListener('click', () => this.toggleSave());
    // A saved passage is a favourite; a click should feel instant.
    this.elSave?.addEventListener('pointerdown', (event) => event.stopPropagation());
    $('#btn-copy-quote')?.addEventListener('click', () => this.copy());
    $('#btn-new-quote')?.addEventListener('click', () => this.advance());
    $('#btn-note-quote')?.addEventListener('click', () => this.onReflect(this.current));
    $('#btn-prev-minute')?.addEventListener('click', () => this.shiftMinute(-1));
    $('#btn-next-minute')?.addEventListener('click', () => this.shiftMinute(1));
    this.elPreview?.addEventListener('click', () => this.returnToNow());
  }

  /** Show a specific passage (from search or the journal) without moving the clock. */
  previewPassage(passage) {
    if (!passage) return;
    this.previewOffset = 0;
    const minutes = passage.key ? passage.key.split(':').map(Number) : null;
    if (minutes) {
      const now = new Date();
      const current = now.getHours() * 60 + now.getMinutes();
      const target = minutes[0] * 60 + minutes[1];
      let delta = target - current;
      if (delta > 720) delta -= 1440;
      if (delta < -720) delta += 1440;
      this.previewOffset = delta;
    }
    this.show({ ...passage, minute: passage.key, total: passage.total || 1 }, { animate: true });
    this.updatePreviewFlag();
  }

  /** Hold the current passage even as minutes pass (the reader's own choice). */
  pinCurrent() {
    if (this.stayOnPassage) return;
    this.stayOnPassage = true;
    this.updatePreviewFlag();
  }

  setTurnLabel() {
    const label = this.elNextTime;
    if (!label) return;
    if (this.stayOnPassage) {
      label.textContent = 'Staying on this page';
      label.style.cursor = 'pointer';
      label.title = 'Turn to the current minute';
      label.onclick = () => {
        this.releasePin();
        this.renderNow({ animate: true });
      };
    } else {
      label.style.cursor = '';
      label.title = '';
      label.onclick = null;
    }
  }

  releasePin() {
    this.stayOnPassage = false;
  }

  /** Show the passage for the live minute (unless previewing). */
  renderNow({ animate = true } = {}) {
    if (this.previewOffset !== 0) return;
    this.show(this.pickFor(new Date()), { animate });
  }

  /** Called on the minute tick. */
  onMinute(date = new Date()) {
    if (this.previewOffset !== 0) {
      // Keep the preview label honest about how far the clock has drifted.
      this.updatePreviewFlag();
      return;
    }
    if (!this.stayOnPassage) this.renderNow({ animate: true });
    else this.updatePreviewFlag();
  }

  setLoading(isLoading) {
    this.root?.classList.toggle('is-loading', isLoading);
  }

  pickFor(date, { avoid = this.current?.quote, index = null } = {}) {
    const key = passages.keyFor(date);
    const passage = passages.pick(key, { avoid, index });
    return passage ? { ...passage, minute: key } : passage;
  }

  show(passage, { animate = true, stepped = false } = {}) {
    if (!passage) {
      this.setLoading(false);
      this.elQuote.innerHTML = 'The collection could not be reached. Your focus tools still work.';
      this.elAuthor.textContent = '';
      this.elWork.textContent = '';
      return;
    }

    // A passage that arrives without `stepped` did not come from pressing "next"
    // — the clock turned the page, the reader previewed a minute, or a search
    // result opened. Its position belongs to a different minute's list (or to
    // none at all), so drop it: otherwise the next press would resume from a
    // stale index and could step straight back onto the passage on screen.
    if (!stepped) this.seenIndex = -1;

    this.current = passage;
    const { html, plain } = passages.render(passage);

    const swap = () => {
      this.elQuote.innerHTML = `“${html}”`;
      // Very long passages ease down a touch so the card keeps its shape.
      this.root.classList.toggle('is-dense', plain.length > 320);
      this.elAuthor.textContent = passage.author;
      this.elWork.textContent = passage.title || '';
      this.elWork.hidden = !passage.title;
      this.root.classList.remove('is-swapping');
      this.syncSaveState();
      this.updatePreviewFlag();
      this.onTurn(passage);
    };

    if (!animate) {
      this.setLoading(false);
      swap();
      return;
    }

    this.setLoading(false);
    this.root.classList.add('is-swapping');
    clearTimeout(this.swapTimer);
    this.swapTimer = setTimeout(swap, 260);
  }

  /**
   * Step to another passage in the same minute (or nearby minute in preview).
   *
 * The reading position is tracked as "which passage in the minute on screen was
 * last shown", and it is discarded whenever a passage arrives from anywhere
 * other than a press of "next" (see `show`). It used to be a bare array index
 * that survived everything, which broke in a way that is easy to miss: the clock
 * turns the page on its own once a minute, so a page turn can land between two
 * presses. The leftover index then pointed into a different minute's list, and
 * the reader could step from a two-passage minute straight back onto the passage
 * it was already showing — the same sentence, twice in a row.
 */
  advance() {
    this.releasePin();
    const key = this.current?.key || passages.keyFor();
    const pool = passages.candidates(key);
    const onScreen = this.current?.quote ?? null;

    if (pool.length > 1) {
      // Continue from the remembered position only if it still describes the
      // passage on screen. If that quote appears more than once in the list, the
      // position is ambiguous — the two occurrences look identical — so start
      // afresh rather than risk settling into an A/B/A/B alternation.
      let resume = -1;
      if (this.seenIndex >= 0 && this.seenIndex < pool.length && pool[this.seenIndex].quote === onScreen) {
        const appears = pool.filter((entry) => entry.quote === onScreen).length;
        if (appears === 1) resume = this.seenIndex;
      }
      const index = nextIndex(pool, resume, onScreen);
      this.seenIndex = index;
      this.show({ ...pool[index], key, minute: key, total: pool.length }, { stepped: true });
      return;
    }

    // This minute has a single passage: offer the nearest minute that has more
    // instead of showing the reader the same sentence again.
    const neighbour = this.nearestRichMinute(key);
    if (neighbour) {
      const pool = passages.candidates(neighbour);
      const index = nextIndex(pool, -1, onScreen);
      this.seenIndex = index;
      this.show({ ...pool[index], key: neighbour, minute: neighbour, total: pool.length }, { stepped: true });
      toast('One passage for this minute — here is the closest neighbour.', { icon: 'book' });
      return;
    }
    toast('This is the only passage in the collection for this minute.', { icon: 'book' });
  }

  /** Walk outwards from a minute key to find one with more than one passage. */
  nearestRichMinute(key) {
    const [h, m] = String(key).split(':').map(Number);
    const start = h * 60 + m;
    for (let offset = 1; offset <= 90; offset += 1) {
      for (const direction of [1, -1]) {
        const probe = (((start + offset * direction) % 1440) + 1440) % 1440;
        const probeKey = `${String(Math.floor(probe / 60)).padStart(2, '0')}:${String(probe % 60).padStart(2, '0')}`;
        if (passages.candidates(probeKey).length > 1) return probeKey;
      }
    }
    return null;
  }

  shiftMinute(delta) {
    this.previewOffset = Math.max(-180, Math.min(180, this.previewOffset + delta));
    const target = new Date(Date.now() + this.previewOffset * 60_000);
    const passage = this.pickFor(target, { avoid: null });
    this.show(passage);
    this.updatePreviewFlag();
  }

  returnToNow() {
    this.previewOffset = 0;
    this.releasePin();
    this.renderNow({ animate: true });
    this.updatePreviewFlag();
    toast('Back to the present minute.', { icon: 'clock' });
  }

  updatePreviewFlag() {
    if (!this.elPreview) return;
    const showing = this.previewOffset !== 0;
    this.elPreview.hidden = !showing;
    if (showing) {
      const minutes = Math.abs(this.previewOffset);
      const direction = this.previewOffset > 0 ? 'ahead' : 'back';
      this.elPreview.textContent = `Preview ${minutes}m ${direction} · back to now`;
      if (this.elContext) {
        this.elContext.textContent = `The literary clock — ${minutes} minute${minutes === 1 ? '' : 's'} ${this.previewOffset > 0 ? 'ahead' : 'behind'}`;
      }
      if (this.elEyebrow) {
        this.elEyebrow.textContent = `${minutes} minute${minutes === 1 ? '' : 's'} ${this.previewOffset > 0 ? 'ahead' : 'behind'}`;
      }
    } else {
      if (this.elContext) this.elContext.textContent = 'The literary clock — a passage for this minute';
      if (this.elEyebrow) this.elEyebrow.textContent = 'The literary clock';
    }
    this.setTurnLabel();
  }

  toggleSave() {
    if (!this.current) return;
    const { quote, author, title, timeCase, key } = this.current;
    if (isBookmarked(quote, author, title)) {
      const existing = this.findBookmark();
      if (existing) removeBookmark(existing.id);
      toast('Removed from saved passages.', { icon: 'bookmark' });
    } else {
      addBookmark({ quote, author, title, timeCase, minute: key });
      toast('Saved to your journal.', {
        icon: 'bookmark',
        actionLabel: 'View',
        onAction: () => this.onReflect(this.current, { openSaved: true }),
      });
    }
    this.syncSaveState();
    this.onBookmarkChange();
  }

  findBookmark() {
    if (!this.current) return null;
    return bookmarks.value.find(
      (item) => item.quote === this.current.quote && item.author === this.current.author && item.title === this.current.title,
    );
  }

  syncSaveState() {
    const saved = this.current
      ? isBookmarked(this.current.quote, this.current.author, this.current.title)
      : false;
    if (!this.elSave) return;
    this.elSave.classList.toggle('is-saved', saved);
    this.elSave.setAttribute('aria-pressed', String(saved));
    const label = this.elSave.querySelector('.action-label');
    if (label) label.textContent = saved ? 'Saved' : 'Save';
    this.elSave.dataset.tooltip = saved ? 'Remove from saved passages' : 'Save to your journal';
  }

  async copy() {
    if (!this.current) return;
    const text = `“${this.current.quote}” — ${this.current.author}${this.current.title ? `, ${this.current.title}` : ''}`;
    const ok = await copyText(text);
    toast(ok ? 'Quote copied.' : 'Copying is blocked in this browser.', { icon: ok ? 'copy' : 'alert', tone: ok ? 'default' : 'warn' });
  }
}
