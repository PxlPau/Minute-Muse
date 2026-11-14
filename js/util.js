/* =============================================================================
   util.js — small, dependency-free helpers
   DOM access, formatting, persistence, and shared UI primitives.
   ========================================================================== */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const pad2 = (n) => String(n).padStart(2, '0');

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Inline SVG icon that references the sprite shipped in index.html. */
export function icon(name, extraClass = '') {
  const cls = `icon${extraClass ? ` ${extraClass}` : ''}`;
  return `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function debounce(fn, wait = 200) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.flush = (...args) => {
    clearTimeout(timer);
    fn(...args);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/* -------------------------------------------------------------------------- */
/* Time & date formatting                                                      */
/* -------------------------------------------------------------------------- */

/** Local YYYY-MM-DD (not UTC — the study day is the user's day). */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function minuteKey(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatClock(date = new Date(), hour24 = false) {
  let hours = date.getHours();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  if (!hour24) hours = hours % 12 || 12;
  return { time: `${pad2(hours)}:${pad2(date.getMinutes())}`, suffix: hour24 ? '' : suffix };
}

export function formatDuration(totalSeconds, { compact = false, padded = true } = {}) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (compact) {
    if (hours) return `${hours}h ${minutes ? `${minutes}m` : ''}`.trim();
    if (minutes) return `${minutes}m`;
    return `${seconds}s`;
  }
  if (hours) return `${hours}h ${pad2(minutes)}m`;
  return `${padded ? pad2(minutes) : minutes}:${pad2(seconds)}`;
}

export function countWords(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Split focus time into a headline value + unit for stat tiles. */
export function formatStatMinutes(totalSeconds) {
  const minutes = Math.round((Number(totalSeconds) || 0) / 60);
  if (minutes < 60) return { value: String(minutes), unit: 'min' };
  const hours = minutes / 60;
  const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return { value: String(rounded), unit: 'hrs' };
}

/** Readable span such as "42m", "1h", "1h 15m" for labels and captions. */
export function formatSpan(totalSeconds) {
  const minutes = Math.round((Number(totalSeconds) || 0) / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatTimeOfDay(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatLongDate(date = new Date()) {
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function relativeDay(key) {
  const today = dayKey();
  if (key === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKey(yesterday)) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const PERIOD_LABELS = {
  dawn: 'Dawn',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

export function periodOf(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 20) return 'evening';
  return 'night';
}

export function greetingOf(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 9) return 'Good morning';
  if (h >= 9 && h < 12) return 'Late morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  if (h >= 21 && h < 24) return 'Late evening';
  if (h >= 0 && h < 3) return 'Late night';
  return 'The small hours';
}

/** Timezone → climate hint. Deliberately coarse: this only tints the room. */
export function detectClimate(date = new Date(), override = 'auto') {
  if (override && override !== 'auto') {
    if (override === 'tropical') {
      return { mode: 'tropical', season: 'tropical', city: '', label: 'Tropical · pinned', overridden: true };
    }
    const [hemisphere, season] = override.split('_');
    const label = `${hemisphere === 'north' ? 'Northern' : 'Southern'} ${season} · pinned`;
    return { mode: hemisphere, season, city: '', label, overridden: true };
  }

  const tropical = [
    'Singapore', 'Jakarta', 'Bangkok', 'Ho_Chi_Minh', 'Kuala_Lumpur', 'Manila',
    'Phnom_Penh', 'Colombo', 'Maldives', 'Honolulu', 'Jamaica', 'Bogota', 'Lagos',
    'Darwin', 'Kolkata', 'Mumbai', 'Chennai', 'Dhaka', 'Yangon', 'Guam', 'Manaus',
  ];
  const southern = [
    'Australia', 'New_Zealand', 'Auckland', 'Sydney', 'Melbourne', 'Brisbane',
    'Perth', 'Adelaide', 'Hobart', 'Johannesburg', 'Cape_Town', 'Buenos_Aires',
    'Santiago', 'Sao_Paulo', 'Montevideo', 'Asuncion', 'Windhoek', 'Harare',
  ];

  let timeZone = 'UTC';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    /* older browsers */
  }

  const city = (timeZone.split('/').pop() || timeZone).replace(/_/g, ' ');
  const haystack = `${timeZone} ${city}`;
  const month = date.getMonth();

  if (tropical.some((word) => haystack.includes(word))) {
    return { mode: 'tropical', season: 'tropical', city, label: `Tropical · ${city}` };
  }

  const isNorth = !southern.some((word) => haystack.includes(word));
  const northWinter = [11, 0, 1].includes(month);
  const isWinter = isNorth ? northWinter : !northWinter;
  const season = isWinter ? 'winter' : 'summer';

  return {
    mode: isNorth ? 'north' : 'south',
    season,
    city,
    label: `${isNorth ? 'Northern' : 'Southern'} ${season} · ${city}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                 */
/* -------------------------------------------------------------------------- */

const PREFIX = 'mm.';

export function readStorage(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export const STORAGE_PREFIX = PREFIX;

/**
 * A tiny persistent signal: holds a value, saves it, and notifies subscribers.
 * Also mirrors changes made in other tabs.
 */
export function createSignal(storageKey, initialValue, { validate = null } = {}) {
  const listeners = new Set();

  /** Read from storage, repairing anything the caller's validator rejects. */
  const read = () => {
    const raw = readStorage(storageKey, initialValue);
    if (!validate) return raw;
    try {
      const ok = validate(raw);
      if (ok) return raw;
    } catch {
      /* fall through to the default */
    }
    return structuredCloneSafe(initialValue);
  };

  let value = read();

  const notify = (next, meta = {}) => {
    value = next;
    listeners.forEach((fn) => {
      try {
        fn(next, meta);
      } catch (error) {
        console.error('[store] listener failed', error);
      }
    });
  };

  const signal = {
    get value() {
      return value;
    },
    set(next, meta) {
      notify(next, meta);
      writeStorage(storageKey, next);
      return next;
    },
    update(updater, meta) {
      return signal.set(updater(value), meta);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reload() {
      notify(read(), { external: true });
    },
    clear() {
      removeStorage(storageKey);
      notify(structuredCloneSafe(initialValue), { external: true });
    },
    storageKey: PREFIX + storageKey,
  };

  window.addEventListener('storage', (event) => {
    if (event.key === PREFIX + storageKey) signal.reload();
  });

  return signal;
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

/* -------------------------------------------------------------------------- */
/* Small UI primitives                                                         */
/* -------------------------------------------------------------------------- */

let toastHost = null;

/**
 * Quiet, one-at-a-time toast with an optional action.
 * @param {string} message
 * @param {{actionLabel?: string, onAction?: Function, duration?: number, icon?: string, tone?: 'default'|'warn'}} [options]
 */
export function toast(message, options = {}) {
  const { actionLabel, onAction, duration = 4200, icon: iconName = 'check', tone = 'default' } = options;
  toastHost = toastHost || document.getElementById('toasts');
  if (!toastHost) return;

  // Only ever show one toast; replace the previous one.
  toastHost.querySelectorAll('.toast').forEach((node) => node.remove());

  const el = document.createElement('div');
  el.className = `toast${tone === 'warn' ? ' toast--warn' : ''}`;
  el.setAttribute('role', 'status');

  const iconEl = document.createElement('span');
  iconEl.className = 'toast__icon';
  iconEl.innerHTML = icon(iconName === 'check' ? 'check' : iconName, 'icon--sm');

  const msg = document.createElement('span');
  msg.className = 'toast__msg';
  msg.textContent = message;

  el.append(iconEl, msg);

  if (actionLabel && typeof onAction === 'function') {
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = actionLabel;
    action.addEventListener('click', () => {
      onAction();
      dismiss();
    });
    el.appendChild(action);
  }

  let closed = false;
  function dismiss() {
    if (closed) return;
    closed = true;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 240);
  }

  toastHost.appendChild(el);
  if (duration > 0) setTimeout(dismiss, duration);
  return dismiss;
}

/** Friendly confirm dialog built from the same chrome as other modals. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" style="max-width:420px">
        <div class="modal__head">
          <div><h2 id="confirm-title"></h2><p></p></div>
        </div>
        <div class="modal__body" style="display:none"></div>
        <div class="modal__foot">
          <button class="btn btn--ghost" type="button" data-cancel></button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-confirm></button>
        </div>
      </div>`;
    overlay.querySelector('h2').textContent = title;
    overlay.querySelector('.modal__head p').textContent = message;
    overlay.querySelector('[data-cancel]').textContent = cancelLabel;
    overlay.querySelector('[data-confirm]').textContent = confirmLabel;
    document.body.appendChild(overlay);

    const previouslyFocused = document.activeElement;
    const confirmBtn = overlay.querySelector('[data-confirm]');
    requestAnimationFrame(() => confirmBtn.focus());

    const finish = (result) => {
      overlay.classList.add('is-closing');
      setTimeout(() => overlay.remove(), 200);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        finish(false);
      }
      if (event.key === 'Tab') {
        const focusables = overlay.querySelectorAll('button');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(false);
    });
    confirmBtn.addEventListener('click', () => finish(true));
    overlay.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
  });
}

export function downloadFile(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without the async clipboard API.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
