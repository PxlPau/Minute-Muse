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

      // Normalise once so the rest of the app can trust the shape.
      const cleaned = {};
      let total = 0;
      for (const [key, entries] of Object.entries(data)) {
        if (!Array.isArray(entries)) continue;
        const minutes = entries.filter((entry) => entry && typeof entry.quote === 'string' && entry.quote.trim());
        if (!minutes.length) continue;
        cleaned[key] = minutes.map((entry) => ({
          quote: entry.quote.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim(),
          author: (entry.author || 'Unknown').trim(),
          title: (entry.title || '').trim(),
          timeCase: (entry.time_case || '').trim(),
        }));
        total += minutes.length;
      }

      this.db = cleaned;
      this.total = total;
      this.minuteCount = Object.keys(cleaned).length;
      this.state = QUOTE_STATE.ready;
      this.onReady.forEach((fn) => fn(this));
      this.onReady.clear();
      return true;
    } catch (error) {
      console.warn('[quotes] collection unavailable', error);
      this.db = {};
      this.state = QUOTE_STATE.error;
      return false;
    }
  }

  /** Resolve once the collection has loaded (or failed). */
  whenReady() {
    if (this.state !== QUOTE_STATE.loading) return Promise.resolve(this.state);
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
    const [hours, minutes] = key.split(':').map(Number);
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
    if (typeof index === 'number') {
      choice = pool[index % pool.length];
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

    const phrase = passage.timeCase;
    if (phrase) {
      const escapedPhrase = escapeHtml(phrase);
      const index = html.toLowerCase().indexOf(escapedPhrase.toLowerCase());
      if (index !== -1) {
        html =
          html.slice(0, index) +
          `<span class="time-highlight">${html.slice(index, index + escapedPhrase.length)}</span>` +
          html.slice(index + escapedPhrase.length);
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
          const haystack = `${entry.quote} ${entry.author} ${entry.title} ${key}`.toLowerCase();
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
