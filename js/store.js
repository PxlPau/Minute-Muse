/* =============================================================================
   store.js — the application's single source of truth
   Every user-facing preference or saved artefact lives here, persisted to
   localStorage under the `mm.` namespace. Nothing leaves the device.
   ========================================================================== */

import { createSignal, dayKey, readStorage, writeStorage } from './util.js';

export const DEFAULT_SETTINGS = {
  /* appearance */
  theme: 'lamplight', // lamplight | moonlight
  textSize: 'md', // sm | md | lg
  quietBackdrop: false,
  reduceMotion: false,
  /* clock & reading */
  hour24: false,
  autoTurn: true,
  climate: 'auto', // auto | tropical | north_winter | north_summer | south_winter | south_summer
  /* sessions */
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  roundsBeforeLong: 4,
  autoStartBreaks: true,
  chime: true,
  notify: false,
  tabTitle: true,
  /* ambience */
  volumes: { rain: 0.38, fire: 0.3, forest: 0.24, waves: 0.3, brown: 0.22 },
  ambienceOn: false,
  lastMix: [], // ids of sounds last left playing
};

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
};

/** Fill gaps and repair out-of-range values when settings come from older builds. */
export function normaliseSettings(raw) {
  const base = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  const isTheme = base.theme === 'moonlight' || base.theme === 'lamplight';
  const isSize = ['sm', 'md', 'lg'].includes(base.textSize);
  const climates = ['auto', 'tropical', 'north_winter', 'north_summer', 'south_winter', 'south_summer'];
  const volumes = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS.volumes)) {
    const candidate = base.volumes && Number(base.volumes[key]);
    volumes[key] = Number.isFinite(candidate) ? Math.min(1, Math.max(0, candidate)) : fallback;
  }
  return {
    ...DEFAULT_SETTINGS,
    ...base,
    theme: isTheme ? base.theme : 'lamplight',
    textSize: isSize ? base.textSize : 'md',
    quietBackdrop: Boolean(base.quietBackdrop),
    reduceMotion: Boolean(base.reduceMotion),
    hour24: Boolean(base.hour24),
    autoTurn: Boolean(base.autoTurn),
    climate: climates.includes(base.climate) ? base.climate : 'auto',
    focusMin: clampNumber(base.focusMin, 1, 180, 25),
    shortMin: clampNumber(base.shortMin, 1, 60, 5),
    longMin: clampNumber(base.longMin, 1, 90, 15),
    roundsBeforeLong: clampNumber(base.roundsBeforeLong, 2, 8, 4),
    autoStartBreaks: Boolean(base.autoStartBreaks),
    chime: Boolean(base.chime),
    notify: Boolean(base.notify),
    tabTitle: Boolean(base.tabTitle),
    volumes,
    ambienceOn: Boolean(base.ambienceOn),
    lastMix: Array.isArray(base.lastMix) ? base.lastMix.filter((id) => typeof id === 'string') : [],
  };
}

export const settings = (() => {
  const signal = createSignal('settings', DEFAULT_SETTINGS);
  // Normalise once on boot and always write back sanitised settings.
  signal.set(normaliseSettings(signal.value));
  const originalSet = signal.set;
  signal.set = (next, meta) => originalSet(next ? normaliseSettings(next) : normaliseSettings(), meta);
  signal.update = (updater, meta) => signal.set(updater(signal.value), meta);
  return signal;
})();

export const patchSettings = (partial) => settings.set({ ...settings.value, ...partial });

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

const isTaskList = (list) =>
  Array.isArray(list) &&
  list.every((task) => task && typeof task === 'object' && typeof task.text === 'string' && typeof task.id === 'string');

const withoutInvalid = (list, predicate) =>
  (Array.isArray(list) ? list : []).filter(predicate);

export const tasks = createSignal('tasks', [], {
  validate: (list) => Array.isArray(list) && list.every((task) => task && typeof task === 'object'),
});

export function addTask(text) {
  const clean = String(text || '').trim().slice(0, 180);
  if (!clean) return null;
  const task = {
    id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    text: clean,
    done: false,
    createdAt: new Date().toISOString(),
    doneAt: null,
  };
  tasks.update((list) => [task, ...list]);
  return task;
}

export function toggleTask(id, done) {
  tasks.update((list) =>
    list.map((task) => {
      if (task.id !== id) return task;
      const nextDone = typeof done === 'boolean' ? done : !task.done;
      return { ...task, done: nextDone, doneAt: nextDone ? new Date().toISOString() : null };
    }),
  );
}

export function renameTask(id, text) {
  const clean = String(text || '').trim().slice(0, 180);
  if (!clean) return;
  tasks.update((list) => list.map((task) => (task.id === id ? { ...task, text: clean } : task)));
}

export function removeTask(id) {
  tasks.update((list) => list.filter((task) => task.id !== id));
}

export function clearCompletedTasks() {
  tasks.update((list) => list.filter((task) => !task.done));
}

/* -------------------------------------------------------------------------- */
/* Saved passages                                                             */
/* -------------------------------------------------------------------------- */

export const bookmarks = createSignal('bookmarks', [], {
  validate: (list) => Array.isArray(list) && list.every((item) => item && typeof item === 'object'),
});

export function isBookmarked(quote, author, title) {
  return bookmarks.value.some(
    (item) => item && item.quote === quote && item.author === author && item.title === title,
  );
}

export function addBookmark(entry) {
  const record = {
    id: `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    quote: entry.quote || '',
    author: entry.author || '',
    title: entry.title || '',
    timeCase: entry.timeCase || '',
    minute: entry.minute || '',
    savedAt: new Date().toISOString(),
  };
  if (!record.quote) return null;
  bookmarks.update((list) => {
    const safe = withoutInvalid(list, (item) => item && typeof item.quote === 'string');
    return isBookmarked(record.quote, record.author, record.title) ? safe : [record, ...safe];
  });
  return record;
}

export function removeBookmark(id) {
  bookmarks.update((list) => withoutInvalid(list, (item) => item && item.id !== id));
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export const notes = createSignal('notes', {}, {
  validate: (value) => value && typeof value === 'object' && !Array.isArray(value),
});

export function saveNote(text, context = null) {
  const key = dayKey();
  const existing = notes.value[key] || { history: [] };
  const next = {
    text: String(text || ''),
    updatedAt: new Date().toISOString(),
    context: context || existing.context || null,
  };
  const values = { ...notes.value, [key]: next };
  // Keep a trailing year of notes and trim beyond that to protect storage.
  const keys = Object.keys(values).sort();
  if (keys.length > 370) keys.slice(0, keys.length - 370).forEach((old) => delete values[old]);
  notes.set(values);
  return next;
}

export const getTodayNote = () => notes.value[dayKey()] || null;

/* -------------------------------------------------------------------------- */
/* Session history                                                            */
/* -------------------------------------------------------------------------- */

export const history = createSignal('history', [], {
  validate: (list) => Array.isArray(list) && list.every((entry) => entry && typeof entry === 'object'),
});

export function recordSession(session) {
  const record = {
    id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    phase: session.phase, // focus | short | long
    startedAt: session.startedAt || new Date().toISOString(),
    endedAt: new Date().toISOString(),
    plannedSec: Math.max(0, Math.round(session.plannedSec || 0)),
    focusSec: Math.max(0, Math.round(session.focusSec || 0)),
    completed: Boolean(session.completed),
    task: session.task || null,
    intent: session.intent || null,
  };
  history.update((list) => [record, ...list].slice(0, 600));
  return record;
}

/** Focus seconds logged today (completed focus phases only when `completedOnly`). */
export function focusSecondsForDay(key, completedOnly = false) {
  return history.value
    .filter((entry) => entry.phase === 'focus' && dayKey(new Date(entry.endedAt)) === key)
    .filter((entry) => (completedOnly ? entry.completed : true))
    .reduce((total, entry) => total + (entry.focusSec || 0), 0);
}

export function focusSecondsToday() {
  return focusSecondsForDay(dayKey());
}

/** Consecutive days (ending today or yesterday) with at least one focus session. */
export function focusStreak() {
  const days = new Set(
    history.value.filter((entry) => entry.phase === 'focus' && entry.focusSec > 0)
      .map((entry) => dayKey(new Date(entry.endedAt))),
  );
  if (!days.size) return 0;

  let streak = 0;
  const cursor = new Date();
  // A streak survives until the end of today, so start counting from today.
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* -------------------------------------------------------------------------- */
/* Timer session persistence                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Running pomodoro, so a refresh (or an accidental tab close) doesn't lose the
 * session. `endsAt` is authoritative for a running phase; `remainingSec` for a
 * paused one. Cleared when a phase is completed or discarded.
 */
export const timerState = createSignal('timer', {
  phase: 'focus',
  status: 'idle', // idle | running | paused
  round: 1,
  endsAt: null,
  remainingSec: null,
  startedAt: null,
  focusSec: 0,
  taskId: null,
  intent: null,
});

export const clearTimerState = () =>
  timerState.set({
    phase: 'focus',
    status: 'idle',
    round: 1,
    endsAt: null,
    remainingSec: null,
    startedAt: null,
    focusSec: 0,
    taskId: null,
    intent: null,
  });

/* -------------------------------------------------------------------------- */
/* Data export / import / reset                                               */
/* -------------------------------------------------------------------------- */

const DATA_KEYS = ['settings', 'tasks', 'bookmarks', 'notes', 'history'];

export function exportData() {
  const payload = {
    app: 'minute-muse',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {},
  };
  for (const key of DATA_KEYS) {
    payload.data[key] = readStorage(key, null);
  }
  return payload;
}

export function importData(payload) {
  if (!payload || typeof payload !== 'object' || !payload.data) {
    throw new Error('That file does not look like a Minute Muse backup.');
  }
  const data = payload.data;
  if (data.settings) settings.set(normaliseSettings(data.settings));
  if (Array.isArray(data.tasks)) tasks.set(data.tasks.filter((t) => t && typeof t.text === 'string'));
  if (Array.isArray(data.bookmarks)) bookmarks.set(data.bookmarks.filter((b) => b && typeof b.quote === 'string'));
  if (data.notes && typeof data.notes === 'object') notes.set(data.notes);
  if (Array.isArray(data.history)) history.set(data.history.slice(0, 600));
  return true;
}

export function resetAllData() {
  settings.clear();
  tasks.clear();
  bookmarks.clear();
  notes.clear();
  history.clear();
  clearTimerState();
}

/* One-time migration from the original single-file build. */
export function migrateLegacyData() {
  if (readStorage('migrated', false)) return;
  try {
    const legacyJournal = window.localStorage.getItem('minuteMuseJournal');
    if (legacyJournal && legacyJournal.trim() && !getTodayNote()) {
      saveNote(legacyJournal, { type: 'legacy' });
    }
    const legacyClimate = window.localStorage.getItem('minuteMuseAdminLocation');
    if (legacyClimate && legacyClimate !== 'auto' && settings.value.climate === 'auto') {
      patchSettings({ climate: legacyClimate });
    }
  } catch {
    /* nothing worth surfacing */
  }
  writeStorage('migrated', true);
}
