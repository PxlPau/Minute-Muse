/* =============================================================================
   ui/backdrop.js — atmosphere
   Swaps the photographic backdrop with a two-layer crossfade (never a flash),
   credits the photographer, and stays out of the way when the user has asked
   for a quiet room.

   images.json is generated from a third-party API and is treated as untrusted:
   URLs are checked for a safe scheme, text is escaped, and CSS strings are
   quoted before they reach a style attribute.
   ========================================================================== */

import { $, detectClimate, escapeHtml, periodOf } from '../util.js';
import { settings } from '../store.js';

const IMAGE_URL = 'images.json';
const VARIANT_WIDTH = 1600;
const UTM_PARAMS = { utm_source: 'MinuteMuse', utm_medium: 'referral' };

function safeHttpUrl(value, fallback = null) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const url = new URL(value, window.location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    return url;
  } catch {
    return fallback;
  }
}

function withUtm(value) {
  const url = new URL(String(value), window.location.href);
  for (const [key, val] of Object.entries(UTM_PARAMS)) url.searchParams.set(key, val);
  return url.href;
}

function cssString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, '');
}

export class Atmosphere {
  constructor() {
    this.layers = [$('#backdrop-a'), $('#backdrop-b')];
    this.activeLayer = 0;
    this.root = $('#backdrop');
    this.creditEl = $('#photo-credit');
    this.images = null;
    this.currentKey = null;
    this.lastUrl = null;
    this.applyToken = 0;
    this.climate = detectClimate();
  }

  async load() {
    try {
      const response = await fetch(`${IMAGE_URL}?v=3`, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Unexpected format');
      this.images = data;
    } catch (error) {
      console.warn('[atmosphere] photography unavailable, using the quiet room', error);
      this.images = null;
    }
  }

  resolveClimate() {
    this.climate = detectClimate(new Date(), settings.value.climate);
    return this.climate;
  }

  pool(period = periodOf()) {
    const { mode } = this.resolveClimate();
    const byMode = this.images?.[mode];
    const list = byMode?.[period];
    if (Array.isArray(list) && list.length) {
      return list.filter((item) => item && typeof item.url === 'string');
    }
    return [];
  }

  /** Choose a fresh photograph for the current period and swap it in. */
  refresh({ force = false } = {}) {
    // Invalidate a preload from the previous mood before changing the room.
    this.applyToken += 1;
    if (settings.value.quietBackdrop) {
      this.root?.classList.add('backdrop--calm');
      if (this.creditEl) this.creditEl.textContent = 'Quiet backdrop · photography paused';
      return;
    }
    this.root?.classList.remove('backdrop--calm');

    const period = periodOf();
    const pool = this.pool(period);
    if (!pool.length) {
      this.clear();
      return;
    }

    const options = pool.length > 1 ? pool.filter((item) => item.url !== this.lastUrl) : pool;
    const pick = options[Math.floor(Math.random() * options.length)] || pool[0];
    this.apply(pick, { force });
  }

  apply(image) {
    const source = this.sizeUrl(image.url, VARIANT_WIDTH);
    if (!source) {
      this.clear();
      return;
    }
    const nextIndex = 1 - this.activeLayer;
    const nextLayer = this.layers[nextIndex];
    const currentLayer = this.layers[this.activeLayer];
    if (!nextLayer) {
      this.clear();
      return;
    }

    const token = ++this.applyToken;
    const preload = new Image();
    preload.decoding = 'async';
    preload.onload = () => {
      if (token !== this.applyToken) return;
      this.lastUrl = String(image.url);
      nextLayer.style.backgroundImage = `url("${cssString(source)}")`;
      nextLayer.classList.add('is-visible');
      currentLayer?.classList.remove('is-visible');
      this.activeLayer = nextIndex;
    };
    preload.onerror = () => {
      if (token !== this.applyToken) return;
      // Do not remember a URL that failed to load.
      this.lastUrl = null;
      if (this.creditEl) this.creditEl.textContent = 'Atmosphere courtesy of the Unsplash community';
    };
    preload.src = source;

    if (this.creditEl) {
      const name = typeof image.name === 'string' && image.name.trim()
        ? image.name
        : 'an Unsplash photographer';
      const profileUrl = safeHttpUrl(image.link, null);
      const profile = withUtm(profileUrl ? profileUrl.href : 'https://unsplash.com/');
      const unsplash = withUtm('https://unsplash.com/');
      this.creditEl.innerHTML = `Photograph by <a href="${escapeHtml(profile)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a> on <a href="${escapeHtml(unsplash)}" target="_blank" rel="noopener noreferrer">Unsplash</a>`;
    }
  }

  /** Unsplash URLs accept sizing params; normalise with the right width. */
  sizeUrl(url, width) {
    const parsed = safeHttpUrl(url, null);
    if (!parsed) return '';
    const host = parsed.hostname.toLowerCase();
    if (host === 'unsplash.com' || host.endsWith('.unsplash.com')) {
      parsed.searchParams.set('w', String(width));
      parsed.searchParams.set('q', '78');
      parsed.searchParams.set('auto', 'format');
    }
    return parsed.href;
  }

  clear() {
    this.applyToken += 1;
    this.lastUrl = null;
    this.layers.forEach((layer) => {
      if (layer) {
        layer.classList.remove('is-visible');
        layer.style.backgroundImage = '';
      }
    });
    if (this.creditEl) this.creditEl.textContent = 'Atmosphere courtesy of the Unsplash community';
  }

  /** Re-evaluate the room when the period, climate, or quiet setting changes. */
  update({ force = false } = {}) {
    const period = periodOf();
    const climate = settings.value.climate;
    const quiet = settings.value.quietBackdrop;
    const key = `${period}|${climate}|${quiet}`;
    if (!force && key === this.currentKey) return;
    const changed = this.currentPeriod !== period
      || this.currentClimate !== climate
      || this.currentQuiet !== quiet;
    this.currentKey = key;
    this.currentPeriod = period;
    this.currentClimate = climate;
    this.currentQuiet = quiet;
    // A mood change, a quiet-room toggle, or a missed image all need a refresh.
    if (force || changed || !this.lastUrl) this.refresh({ force });
  }
}
