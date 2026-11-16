/* =============================================================================
   quotes.js — the literary clock's reading engine

   The collection is served as a static quotes.json (built from the Literature
   Clock dataset), keyed by "HH:MM" in local time. Every minute has a handful of
   candidate passages; the reader picks one and can step through the rest.

   All text from the dataset is treated as untrusted: it is escaped before being
   turned into markup, and only the matched time phrase is ever wrapped in a
   highlight span.
   ========================================================================== */

import { escapeHtml, pad2 } from './util.js';

const QUOTES_URL = 'quotes.json';

export const QUOTE_STATE = {
  loading: 'loading',
  ready: 'ready',
  error: 'error',
};

/**
 * Drop repeated passages inside a single minute.
 *
 * The source collection contains occasional exact duplicates: 09:20 lists the
 * same Wodehouse sentence twice, under the same author and title. The reader
 * steps through the candidates one by one, so a duplicate would show the same
 * passage twice in a row — and a "next passage" button that returns the same
 * words is a bug, not a feature. Keying on quote + author + title keeps
 * genuinely distinct entries that happen to share a sentence (two books can
 * both say "It was 9.20").
 */
function dedupe(entries) {
  const seen = new Set();
  const unique = [];
  for (const entry of entries) {
    const identity = `${entry.quote}\u0000${entry.author}\u0000${entry.title}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    unique.push(entry);
  }
  return unique;
}

class PassageEngine {
  constructor() {
    this.db = null;
    this.state = QUOTE_STATE.loading;
    this.total = 0;
    this.minuteCount = 0;
    this.onReady = new Set();
  }

  async load() {
    try {
      const response = await fetch(`${QUOTES_URL}?v=2`, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Unexpected format');

      // Normalise once so the rest of the app can trust the shape. The JSON is
      // a static upstream dataset, not code: reject bad keys and coerce every
      // text field before the reader or search engine touches it.
      const cleaned = Object.create(null);
      let total = 0;
      const asText = (value, fallback = '') =>
        (typeof value === 'string' ? value : value == null ? fallback : String(value)).trim();
      for (const [key, entries] of Object.entries(data)) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(key) || !Array.isArray(entries)) continue;
        const minutes = entries.filter(
          (entry) => entry && typeof entry.quote === 'string' && asText(entry.quote),
        );
        if (!minutes.length) continue;
        cleaned[key] = dedupe(
          minutes.map((entry) => ({
            quote: asText(entry.quote).replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim(),
            author: asText(entry.author, 'Unknown') || 'Unknown',
            title: asText(entry.title),
            timeCase: asText(entry.time_case),
          })),
        );
        total += cleaned[key].length;
      }

      this.db = cleaned;
      this.total = total;
      this.minuteCount = Object.keys(cleaned).length;
      this.state = QUOTE_STATE.ready;
      this.settleWaiters();
      return true;
    } catch (error) {
      console.warn('[quotes] collection unavailable', error);
      this.db = {};
      this.state = QUOTE_STATE.error;
      // A failed load must not leave `whenReady()` promises pending forever.
      this.settleWaiters();
      return false;
    }
  }

  settleWaiters() {
    this.onReady.forEach((fn) => fn(this));
    this.onReady.clear();
  }

  /** Resolve once the collection has loaded (or failed). */
  whenReady() {
    if (this.state !== QUOTE_STATE.loading) return Promise.resolve(this);
    return new Promise((resolve) => {
      this.onReady.add(resolve);
    });
  }

  keyFor(date = new Date()) {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  /** All passages for a minute key, nearest populated minute as fallback. */
  candidates(key) {
    if (!this.db) return [];
    if (this.db[key]?.length) return this.db[key];

    // Some minutes are empty in the source data; borrow from the closest minute
    // so the reader is never blank. Search outwards, minute by minute.
    const parts = /^(\d{1,2}):(\d{1,2})$/.exec(String(key));
    if (!parts) return [];
    const [, hours, minutes] = parts.map(Number);
    if (hours > 23 || minutes > 59) return [];
    const start = hours * 60 + minutes;
    for (let offset = 1; offset <= 180; offset += 1) {
      for (const direction of [1, -1]) {
        const probe = ((start + offset * direction) % 1440 + 1440) % 1440;
        const probeKey = `${pad2(Math.floor(probe / 60))}:${pad2(probe % 60)}`;
        if (this.db[probeKey]?.length) return this.db[probeKey];
      }
    }
    return [];
  }

  pick(key, { avoid = null, index = null } = {}) {
    const pool = this.candidates(key);
    if (!pool.length) return null;

    let choice = pool[0];
    if (Number.isFinite(index)) {
      const offset = ((Math.trunc(index) % pool.length) + pool.length) % pool.length;
      choice = pool[offset];
    } else {
      const alternatives = pool.length > 1 && avoid ? pool.filter((entry) => entry.quote !== avoid) : pool;
      choice = alternatives[Math.floor(Math.random() * alternatives.length)] || pool[0];
    }

    return { ...choice, key, total: pool.length };
  }

  /** Build safe markup: the passage is escaped, then the time phrase wrapped. */
  render(passage) {
    if (!passage) return { html: 'No passage found for this minute.', plain: '' };
    const plain = passage.quote;
    let html = escapeHtml(plain);

    // Find the phrase in the original text, then escape each slice. Searching
    // inside already-escaped HTML breaks on ampersands and Unicode case folding.
    const phrase = String(passage.timeCase || '');
    if (phrase) {
      const pattern = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = new RegExp(pattern, 'i').exec(plain);
      if (match) {
        const start = match.index;
        const end = start + match[0].length;
        html =
          escapeHtml(plain.slice(0, start)) +
          `<span class="time-highlight">${escapeHtml(plain.slice(start, end))}</span>` +
          escapeHtml(plain.slice(end));
      }
    }
    return { html, plain };
  }

  /**
   * Search across the whole collection.
   * @param {string} query free text; "14:30" jumps to a minute
   * @param {{limit?: number, filter?: 'all'|'time'|'now'|'author', now?: Date}} [options]
   */
  search(query, options = {}) {
    const { limit = 40, filter = 'all', now = new Date() } = options;
    if (!this.db) return { results: [], total: 0 };

    const needle = String(query || '').trim().toLowerCase();
    const results = [];
    let scanned = 0;

    const nowKey = this.keyFor(now);
    const hourPrefix = `${pad2(now.getHours())}:`;

    for (const [key, entries] of Object.entries(this.db)) {
      if (filter === 'now' && key !== nowKey) continue;
      if (filter === 'time' && !key.startsWith(hourPrefix)) continue;

      for (const entry of entries) {
        scanned += 1;
        if (needle) {
          const haystack = filter === 'author'
            ? String(entry.author || '').toLowerCase()
            : `${entry.quote} ${entry.author} ${entry.title} ${key}`.toLowerCase();
          if (!haystack.includes(needle)) continue;
        }
        results.push({ ...entry, key });
      }
    }

    results.sort((a, b) => a.key.localeCompare(b.key));
    return { results: results.slice(0, limit), total: results.length, scanned };
  }

  random() {
    if (!this.db) return null;
    const keys = Object.keys(this.db);
    if (!keys.length) return null;
    const key = keys[Math.floor(Math.random() * keys.length)];
    const entry = this.db[key][Math.floor(Math.random() * this.db[key].length)];
    return { ...entry, key };
  }
}

export const passages = new PassageEngine();
