/* =============================================================================
   ui/journal.js — the private notebook
   Auto-saving session reflection, saved passages, and the current intention.
   Notes are keyed by day and kept on this device only.
   ========================================================================== */

import {
  $, $$, debounce, escapeHtml, toast, copyText, relativeDay, countWords,
} from '../util.js';
import {
  bookmarks, notes, saveNote, getTodayNote, removeBookmark, tasks,
} from '../store.js';

export class Journal {
  constructor({ overlays, reader, engine }) {
    this.overlays = overlays;
    this.reader = reader;
    this.engine = engine;

    this.drawer = $('#journal-drawer');
    this.textarea = $('#journal-text');
    this.status = $('#journal-status');
    this.statusText = $('#journal-status-text');
    this.wordcount = $('#journal-wordcount');
    this.savedList = $('#saved-list');
    this.savedEmpty = $('#saved-empty');
    this.intentionText = $('#intention-text');
    this.contextLabel = $('#journal-context-label');
    this.reflectPassage = null;

    this.autosave = debounce(() => this.save(), 650);
  }

  init() {
    $('#btn-close-journal')?.addEventListener('click', () => this.close());

    $$('.tab', this.drawer).forEach((tab) => {
      tab.addEventListener('click', () => this.selectTab(tab.getAttribute('aria-controls')));
    });

    this.textarea?.addEventListener('input', () => {
      this.updateWordcount();
      this.setStatus('saving', 'Saving…');
      this.autosave();
    });

    this.textarea?.addEventListener('blur', () => this.autosave.flush());

    bookmarks.subscribe(() => this.renderSaved());
    notes.subscribe((value, meta) => {
      // Only re-read from storage when another tab changed it; otherwise we'd
      // stomp the caret while the user is typing.
      if (meta?.external && this.overlays.isOpen(this.drawer)) this.hydrate();
    });
    tasks.subscribe(() => this.renderIntention());
    this.renderSaved();
    this.renderIntention();
  }

  open({ tab = 'notes', passage = null, openSaved = false } = {}) {
    if (openSaved) tab = 'saved';
    this.selectTab(tab === 'saved' ? 'panel-saved' : 'panel-notes');
    if (passage) this.reflectPassage = passage;
    this.syncContext();
    this.hydrate();
    this.overlays.open(this.drawer);
    window.setTimeout(() => this.textarea?.focus({ preventScroll: true }), 260);
  }

  close() {
    this.autosave.flush();
    this.overlays.close(this.drawer);
    this.reflectPassage = null;
  }

  selectTab(panelId) {
    $$('.tab', this.drawer).forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.getAttribute('aria-controls') === panelId));
    });
    $$('[role="tabpanel"]', this.drawer).forEach((panel) => {
      panel.hidden = panel.id !== panelId;
    });
    if (panelId === 'panel-saved') this.renderSaved();
  }

  hydrate() {
    const note = getTodayNote();
    this.textarea.value = note?.text || '';
    this.updateWordcount();
    this.setStatus('saved', note ? 'Saved on this device' : 'Nothing written yet');
  }

  syncContext() {
    if (!this.contextLabel) return;
    const passage = this.reflectPassage;
    if (passage) {
      this.contextLabel.textContent = `Reflection on “${truncate(passage.quote, 60)}” — ${passage.author}`;
    } else {
      const today = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      this.contextLabel.textContent = `Session reflection · ${today}`;
    }
  }

  save() {
    const text = this.textarea?.value || '';
    const passage = this.reflectPassage;
    saveNote(text, passage ? { type: 'passage', quote: passage.quote, author: passage.author, title: passage.title } : undefined);
    this.setStatus('saved', 'Saved on this device');
  }

  setStatus(kind, label) {
    if (!this.status || !this.statusText) return;
    this.status.classList.toggle('is-saved', kind === 'saved');
    this.status.classList.toggle('is-saving', kind === 'saving');
    this.statusText.textContent = label;
  }

  updateWordcount() {
    if (!this.wordcount) return;
    const words = countWords(this.textarea?.value);
    this.wordcount.textContent = `${words} word${words === 1 ? '' : 's'}`;
  }

  renderIntention() {
    if (!this.intentionText) return;
    const active = tasks.value.find((task) => !task.done);
    if (!active) {
      this.intentionText.textContent = 'No intention set. Add the one thing you want from this session in the task list.';
      return;
    }
    this.intentionText.innerHTML = `This session is for <strong>${escapeHtml(active.text)}</strong>.`;
  }

  renderSaved() {
    if (!this.savedList) return;
    const items = bookmarks.value;
    this.savedEmpty.hidden = items.length > 0;
    this.savedList.innerHTML = items
      .map(
        (item) => `
        <article class="passage" data-bookmark-id="${item.id}">
          <p class="passage__quote">“${escapeHtml(item.quote)}”</p>
          <div class="passage__meta">
            <span>${escapeHtml(item.author)}${item.title ? ` · <em>${escapeHtml(item.title)}</em>` : ''}</span>
            <span class="passage__actions">
              <button type="button" data-action="read" aria-label="Read this passage in the clock" title="Read now">
                <svg class="icon icon--sm"><use href="#i-book"></use></svg>
              </button>
              <button type="button" data-action="copy" aria-label="Copy passage" title="Copy">
                <svg class="icon icon--sm"><use href="#i-copy"></use></svg>
              </button>
              <button type="button" class="danger" data-action="remove" aria-label="Remove saved passage" title="Remove">
                <svg class="icon icon--sm"><use href="#i-trash"></use></svg>
              </button>
            </span>
          </div>
          <span class="field-hint">Saved ${relativeDay(item.savedAt?.slice(0, 10) || '')}${item.minute ? ` · ${item.minute}` : ''}</span>
        </article>`,
      )
      .join('');

    this.savedList.onclick = async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const card = button.closest('[data-bookmark-id]');
      const item = items.find((entry) => entry.id === card?.dataset.bookmarkId);
      if (!item) return;

      if (button.dataset.action === 'remove') {
        removeBookmark(item.id);
        toast('Passage removed.', { icon: 'trash' });
      } else if (button.dataset.action === 'copy') {
        const ok = await copyText(`“${item.quote}” — ${item.author}`);
        toast(ok ? 'Copied.' : 'Copying is blocked in this browser.', { icon: ok ? 'copy' : 'alert', tone: ok ? 'default' : 'warn' });
      } else if (button.dataset.action === 'read') {
        this.close();
        this.reader.show({ ...item, quote: item.quote, author: item.author, title: item.title, key: item.minute, timeCase: item.timeCase });
        toast('That passage is now open in the reader.', { icon: 'book' });
      }
    };
  }
}

function truncate(text = '', max = 60) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
