/* =============================================================================
   ui/backdrop.js — atmosphere
   Swaps the photographic backdrop with a two-layer crossfade (never a flash),
   credits the photographer, and stays out of the way when the user has asked
   for a quiet room.
   ========================================================================== */

import { $, detectClimate, periodOf } from '../util.js';
import { settings } from '../store.js';

const IMAGE_URL = 'images.json';
const VARIANT_WIDTH = 1600;

export class Atmosphere {
  constructor() {
    this.layers = [$('#backdrop-a'), $('#backdrop-b')];
    this.activeLayer = 0;
    this.root = $('#backdrop');
    this.creditEl = $('#photo-credit');
    this.images = null;
    this.currentKey = null;
    this.lastUrl = null;
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
    if (Array.isArray(list) && list.length) return list.filter((item) => item && item.url);
    return [];
  }

  /** Choose a fresh photograph for the current period and swap it in. */
  refresh({ force = false } = {}) {
    if (settings.value.quietBackdrop) {
      this.root.classList.add('backdrop--calm');
      if (this.creditEl) this.creditEl.textContent = 'Quiet backdrop · photography paused';
      return;
    }
    this.root.classList.remove('backdrop--calm');

    const period = periodOf();
    const pool = this.pool(period);
    if (!pool.length) {
      this.clear();
      return;
    }

    const options = pool.length > 1 ? pool.filter((item) => item.url !== this.lastUrl) : pool;
    const pick = options[Math.floor(Math.random() * options.length)] || pool[0];
    this.apply(pick);
  }

  apply(image) {
    this.lastUrl = image.url;
    const url = this.sizeUrl(image.url, VARIANT_WIDTH);
    const nextIndex = 1 - this.activeLayer;
    const nextLayer = this.layers[nextIndex];
    const currentLayer = this.layers[this.activeLayer];
    if (!nextLayer) return;

    const preload = new Image();
    preload.decoding = 'async';
    preload.onload = () => {
      nextLayer.style.backgroundImage = `url("${url}")`;
      nextLayer.classList.add('is-visible');
      if (currentLayer) currentLayer.classList.remove('is-visible');
      this.activeLayer = nextIndex;
    };
    preload.onerror = () => {
      if (this.creditEl) this.creditEl.textContent = 'Atmosphere courtesy of the Unsplash community';
    };
    preload.src = url;

    if (this.creditEl) {
      const name = image.name || 'an Unsplash photographer';
      const link = image.link ? `${image.link}?utm_source=MinuteMuse&utm_medium=referral` : 'https://unsplash.com';
      this.creditEl.innerHTML = `Photograph by <a href="${escAttr(link)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a> on <a href="https://unsplash.com/?utm_source=MinuteMuse&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>`;
    }
  }

  /** Unsplash URLs accept sizing params; normalise with the right width. */
  sizeUrl(url, width) {
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.hostname.endsWith('unsplash.com')) {
        parsed.searchParams.set('w', String(width));
        parsed.searchParams.set('q', '78');
        parsed.searchParams.set('auto', 'format');
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }

  clear() {
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
    const key = `${period}|${settings.value.climate}|${settings.value.quietBackdrop}`;
    if (!force && key === this.currentKey) return;
    const periodChanged = this.currentPeriod !== period;
    this.currentKey = key;
    this.currentPeriod = period;
    // A new photograph when the mood changes; otherwise just restore if needed.
    if (force || periodChanged || !this.lastUrl) this.refresh({ force });
    else if (settings.value.quietBackdrop) this.refresh({ force });
  }
}

function esc(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(value = '') {
  return esc(value).replace(/'/g, '&#39;');
}
