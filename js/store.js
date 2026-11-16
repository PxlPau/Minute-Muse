/* =============================================================================
   store.js — the application's single source of truth
   Every user-facing preference or saved artefact lives here, persisted to
   localStorage under the `mm.` namespace. Nothing leaves the device.

   Values are normalised on *every* read and write. That includes imported
   backups: anything from localStorage or a JSON file is untrusted data.
   ========================================================================== */

import { createSignal, dayKey, readStorage, writeStorage } from './util.js';
import { DEFAULT_VOLUMES, SOUNDSCAPE_IDS } from './soundscapes.js';
import { CURIO_IDS, MARK_BY_ID } from './curios.js';

/** Panels the user can reorder, hide, and arrange. */
export const DASHBOARD_PANELS = ['timer', 'tasks', 'sounds', 'music', 'cabinet'];

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
  /* ambience — one default for every layer in the soundscape catalogue */
  volumes: { ...DEFAULT_VOLUMES },
  ambienceOn: false,
  lastMix: [], // ids of sounds last left playing
  soundFavourites: [],
  /* dashboard — how the room is arranged */
  accent: 'gold', // gold | ember | verdigris | heather | rose | indigo | moss
  density: 'comfortable', // comfortable | compact
  cardStyle: 'glass', // glass | outline | paper
  railSide: 'left', // left | right
  readingWidth: 'regular', // narrow | regular | wide
  panelOrder: [...DASHBOARD_PANELS],
  hiddenPanels: [],
  /* listening room */
  musicVolume: 0.55,
  musicSource: 'local', // local | spotify | apple
  spotifyUrl: '',
  appleUrl: '',
  duckAmbienceForMusic: true,
  /* cabinet */
  rewardToasts: true,
};

const THEMES = ['lamplight', 'moonlight'];
const TEXT_SIZES = ['sm', 'md', 'lg'];
const CLIMATES = ['auto', 'tropical', 'north_winter', 'north_summer', 'south_winter', 'south_summer'];
const PHASES = ['focus', 'short', 'long'];
const STATUSES = ['idle', 'running', 'paused'];
const SOUND_IDS = new Set(SOUNDSCAPE_IDS);
const ACCENTS = ['gold', 'ember', 'verdigris', 'heather', 'rose', 'indigo', 'moss'];
const DENSITIES = ['comfortable', 'compact'];
const CARD_STYLES = ['glass', 'outline', 'paper'];
const RAIL_SIDES = ['left', 'right'];
const READING_WIDTHS = ['narrow', 'regular', 'wide'];
const MUSIC_SOURCES = ['local', 'spotify', 'apple'];

const clampNumber = (value, min, max, fallback) => {
  const number = typeof value === 'number' || (typeof value === 'string' && value.trim())
    ? Number(value)
    : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
};
const clampVolume = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
};
const asBoolean = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
const asText = (value, fallback = '', max = 500) =>
  (typeof value === 'string' ? value.slice(0, max) : fallback);
const asIso = (value, fallback = null) =>
  (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback);
const asSeconds = (value, max = 86400) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(0, Math.round(number))) : 0;
};
const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const newId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Fill gaps and repair out-of-range values when settings come from older builds. */
export function normaliseSettings(raw) {
  const base = { ...DEFAULT_SETTINGS, ...(isPlainObject(raw) ? raw : {}) };
  const volumes = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS.volumes)) {
    const candidate = Number(base.volumes?.[key]);
    volumes[key] = Number.isFinite(candidate)
      ? Math.min(1, Math.max(0, candidate))
      : fallback;
  }
  const lastMix = Array.isArray(base.lastMix)
    ? [...new Set(base.lastMix.filter((id) => typeof id === 'string' && SOUND_IDS.has(id)))].slice(0, SOUND_IDS.size)
    : [];

  // Return only known fields: a backup must not be able to smuggle arbitrary
  // properties into the settings object.
  return {
    theme: THEMES.includes(base.theme) ? base.theme : 'lamplight',
    textSize: TEXT_SIZES.includes(base.textSize) ? base.textSize : 'md',
    quietBackdrop: asBoolean(base.quietBackdrop, false),
    reduceMotion: asBoolean(base.reduceMotion, false),
    hour24: asBoolean(base.hour24, false),
    autoTurn: asBoolean(base.autoTurn, true),
    climate: CLIMATES.includes(base.climate) ? base.climate : 'auto',
    focusMin: clampNumber(base.focusMin, 1, 180, 25),
    shortMin: clampNumber(base.shortMin, 1, 60, 5),
    longMin: clampNumber(base.longMin, 1, 90, 15),
    roundsBeforeLong: clampNumber(base.roundsBeforeLong, 2, 8, 4),
    autoStartBreaks: asBoolean(base.autoStartBreaks, true),
    chime: asBoolean(base.chime, true),
    notify: asBoolean(base.notify, false),
    tabTitle: asBoolean(base.tabTitle, true),
    volumes,
    ambienceOn: asBoolean(base.ambienceOn, false),
    lastMix,
    soundFavourites: Array.isArray(base.soundFavourites)
      ? [...new Set(base.soundFavourites.filter((id) => typeof id === 'string' && SOUND_IDS.has(id)))].slice(0, SOUND_IDS.size)
      : [],
    accent: ACCENTS.includes(base.accent) ? base.accent : 'gold',
    density: DENSITIES.includes(base.density) ? base.density : 'comfortable',
    cardStyle: CARD_STYLES.includes(base.cardStyle) ? base.cardStyle : 'glass',
    railSide: RAIL_SIDES.includes(base.railSide) ? base.railSide : 'left',
    readingWidth: READING_WIDTHS.includes(base.readingWidth) ? base.readingWidth : 'regular',
    panelOrder: normalisePanelOrder(base.panelOrder),
    hiddenPanels: normalisePanelList(base.hiddenPanels),
    musicVolume: clampVolume(base.musicVolume, 0.55),
    musicSource: MUSIC_SOURCES.includes(base.musicSource) ? base.musicSource : 'local',
    spotifyUrl: asText(base.spotifyUrl, '', 400),
    appleUrl: asText(base.appleUrl, '', 400),
    duckAmbienceForMusic: asBoolean(base.duckAmbienceForMusic, true),
    rewardToasts: asBoolean(base.rewardToasts, true),
  };
}

/** Every known panel exactly once: unknown ids dropped, missing ones appended. */
function normalisePanelOrder(value) {
  const chosen = Array.isArray(value)
    ? value.filter((id) => DASHBOARD_PANELS.includes(id))
    : [];
  const unique = [...new Set(chosen)];
  return [...unique, ...DASHBOARD_PANELS.filter((id) => !unique.includes(id))];
}

function normalisePanelList(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((id) => DASHBOARD_PANELS.includes(id)))]
    : [];
}

export const settings = createSignal('settings', DEFAULT_SETTINGS, {
  normalise: normaliseSettings,
});
export const patchSettings = (partial) => settings.set({ ...settings.value, ...partial });

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export function normaliseTaskList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((task) => isPlainObject(task) && typeof task.text === 'string' && task.text.trim())
    .slice(0, 1000)
    .map((task) => ({
      id: typeof task.id === 'string' && task.id ? task.id.slice(0, 100) : newId('t'),
      text: task.text.trim().slice(0, 180),
      done: Boolean(task.done),
      createdAt: asIso(task.createdAt, new Date().toISOString()),
      doneAt: task.done ? asIso(task.doneAt, null) : null,
    }));
}

const withoutInvalid = (list, predicate) =>
  (Array.isArray(list) ? list : []).filter(predicate);

export const tasks = createSignal('tasks', [], { normalise: normaliseTaskList });

export function addTask(text) {
  const clean = String(text || '').trim().slice(0, 180);
  if (!clean) return null;
  const task = {
    id: newId('t'),
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

export function normaliseBookmarkList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => isPlainObject(item) && typeof item.quote === 'string' && item.quote.trim())
    .slice(0, 1000)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id.slice(0, 100) : newId('b'),
      quote: item.quote.slice(0, 2000),
      author: asText(item.author, 'Unknown', 300),
      title: asText(item.title, '', 300),
      timeCase: asText(item.timeCase, '', 100),
      minute: /^([01]\d|2[0-3]):[0-5]\d$/.test(item.minute) ? item.minute : '',
      savedAt: asIso(item.savedAt, new Date().toISOString()),
    }));
}

export const bookmarks = createSignal('bookmarks', [], { normalise: normaliseBookmarkList });

export function isBookmarked(quote, author, title) {
  return bookmarks.value.some(
    (item) => item && item.quote === quote && item.author === author && item.title === title,
  );
}

export function addBookmark(entry) {
  const record = {
    id: newId('b'),
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

function normaliseNoteContext(value) {
  if (!isPlainObject(value)) return null;
  const clean = {};
  for (const key of ['type', 'quote', 'author', 'title']) {
    if (typeof value[key] === 'string') clean[key] = value[key].slice(0, 500);
  }
  return Object.keys(clean).length ? clean : null;
}

export function normaliseNotes(value) {
  if (!isPlainObject(value)) return {};
  const result = {};
  for (const [key, note] of Object.entries(value).slice(-370)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !isPlainObject(note)) continue;
    result[key] = {
      text: asText(note.text, '', 100000),
      updatedAt: asIso(note.updatedAt, new Date().toISOString()),
      context: normaliseNoteContext(note.context),
    };
  }
  return result;
}

export const notes = createSignal('notes', {}, { normalise: normaliseNotes });

export function saveNote(text, context = null) {
  const key = dayKey();
  const existing = notes.value[key] || {};
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

export function normaliseHistory(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((entry) => isPlainObject(entry))
    .slice(0, 600)
    .map((entry) => {
      const endedAt = asIso(entry.endedAt, new Date().toISOString());
      return {
        id: typeof entry.id === 'string' && entry.id ? entry.id.slice(0, 100) : newId('s'),
        phase: PHASES.includes(entry.phase) ? entry.phase : 'focus',
        startedAt: asIso(entry.startedAt, endedAt),
        endedAt,
        plannedSec: asSeconds(entry.plannedSec),
        focusSec: asSeconds(entry.focusSec),
        completed: Boolean(entry.completed),
        recovered: Boolean(entry.recovered),
        task: typeof entry.task === 'string' ? entry.task.slice(0, 180) : null,
        intent: typeof entry.intent === 'string' ? entry.intent.slice(0, 180) : null,
      };
    });
}

export const history = createSignal('history', [], { normalise: normaliseHistory });

export function recordSession(session) {
  const record = {
    id: newId('s'),
    phase: session.phase, // focus | short | long
    startedAt: session.startedAt || new Date().toISOString(),
    endedAt: new Date().toISOString(),
    plannedSec: asSeconds(session.plannedSec),
    focusSec: asSeconds(session.focusSec),
    completed: Boolean(session.completed),
    recovered: Boolean(session.recovered),
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
    .reduce((total, entry) => total + asSeconds(entry.focusSec), 0);
}

export function focusSecondsToday() {
  return focusSecondsForDay(dayKey());
}

/** Consecutive days (ending today or yesterday) with at least one focus session. */
export function focusStreak() {
  const days = new Set(
    history.value
      .filter((entry) => entry.phase === 'focus' && asSeconds(entry.focusSec) > 0)
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
/* The cabinet — currencies, curios, marks                                    */
/* -------------------------------------------------------------------------- */

/**
 * `ink` is the soft currency: earned minute by minute, spent on draws.
 * `ember` is the hard currency: scarce, earned only at milestones, and the only
 * way to guarantee a rare card or assemble a collection's singular piece.
 *
 * `owned` holds one entry per curio (duplicates are converted to ink on the spot,
 * so the cabinet is a set, not a pile). `ledger` records every award so a
 * session can never be paid out twice, even across a reload.
 */
export const DEFAULT_COLLECTION = {
  ink: 0,
  ember: 0,
  owned: [],
  ledger: [],
  marks: [],
  draws: 0,
  pity: 0,
  serial: 0,
  cycles: 0,
  inkEarned: 0,
  emberEarned: 0,
  daily: { draw: null, shelf: null, spark: null, shelfIds: [] },
};

const asCount = (value, max = 1e9) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(0, Math.round(number))) : 0;
};
/** Ledger entries are signed: spending is recorded as a negative movement. */
const asSigned = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-1e9, Math.min(1e9, Math.round(number))) : 0;
};

export function normaliseCollection(raw) {
  const base = isPlainObject(raw) ? raw : {};
  const seen = new Set();
  const owned = [];
  for (const entry of Array.isArray(base.owned) ? base.owned : []) {
    if (!isPlainObject(entry)) continue;
    const id = typeof entry.id === 'string' ? entry.id : '';
    if (!CURIO_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    owned.push({
      id,
      at: asIso(entry.at, new Date().toISOString()),
      source: asText(entry.source, 'cabinet', 40),
      serial: asCount(entry.serial, 1e6) || owned.length + 1,
    });
  }
  const ledger = (Array.isArray(base.ledger) ? base.ledger : [])
    .filter((entry) => isPlainObject(entry) && typeof entry.id === 'string')
    .slice(0, 2000)
    .map((entry) => ({
      id: entry.id.slice(0, 120),
      ink: asSigned(entry.ink),
      ember: asSigned(entry.ember),
      at: asIso(entry.at, new Date().toISOString()),
      note: asText(entry.note, '', 160),
    }));
  const daily = isPlainObject(base.daily) ? base.daily : {};
  const dayOrNull = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

  return {
    ink: asCount(base.ink),
    ember: asCount(base.ember),
    owned,
    ledger,
    marks: Array.isArray(base.marks)
      ? [...new Set(base.marks.filter((id) => typeof id === 'string' && MARK_BY_ID.has(id)))]
      : [],
    draws: asCount(base.draws, 1e6),
    pity: asCount(base.pity, 999),
    serial: asCount(base.serial, 1e6),
    cycles: asCount(base.cycles, 1e6),
    inkEarned: asCount(base.inkEarned),
    emberEarned: asCount(base.emberEarned),
    daily: {
      draw: dayOrNull(daily.draw),
      shelf: dayOrNull(daily.shelf),
      spark: dayOrNull(daily.spark),
      shelfIds: Array.isArray(daily.shelfIds)
        ? [...new Set(daily.shelfIds.filter((id) => typeof id === 'string' && CURIO_IDS.has(id)))].slice(0, 6)
        : [],
    },
  };
}

export const collection = createSignal('collection', DEFAULT_COLLECTION, {
  normalise: normaliseCollection,
});


/* -------------------------------------------------------------------------- */
/* Timer session persistence                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Running pomodoro, so a refresh (or an accidental tab close) doesn't lose the
 * session. `endsAt` is authoritative for a running phase; `remainingSec` for a
 * paused one. Cleared when a phase is completed or discarded.
 */
export const DEFAULT_TIMER_STATE = {
  phase: 'focus',
  status: 'idle', // idle | running | paused
  round: 1,
  endsAt: null,
  remainingSec: null,
  plannedSec: null, // duration frozen when the phase begins
  startedAt: null,
  focusSec: 0,
  taskId: null,
  intent: null,
};

export function normaliseTimerState(raw) {
  const base = isPlainObject(raw) ? raw : {};
  const phase = PHASES.includes(base.phase) ? base.phase : 'focus';
  let status = STATUSES.includes(base.status) ? base.status : 'idle';
  const endsAt = status === 'running' ? asIso(base.endsAt, null) : null;
  const remaining = Number(base.remainingSec);
  const remainingSec = status === 'paused' && Number.isFinite(remaining)
    ? Math.max(0, Math.round(remaining))
    : null;
  // A running phase without a usable deadline (or a pause without a remaining
  // value) cannot be recovered; settle it instead of displaying NaN forever.
  if (status === 'running' && !endsAt) status = 'idle';
  if (status === 'paused' && remainingSec === null) status = 'idle';

  // Settings may be edited mid-session. Keep the duration the user started
  // with; older stored sessions get the closest current setting.
  const settingsPlanned = phase === 'short'
    ? settings.value.shortMin * 60
    : phase === 'long'
      ? settings.value.longMin * 60
      : settings.value.focusMin * 60;
  const plannedSec = status === 'idle'
    ? null
    : clampNumber(base.plannedSec, 1, 86400, settingsPlanned);

  return {
    phase,
    status,
    round: clampNumber(base.round, 1, 999, 1),
    endsAt,
    remainingSec,
    plannedSec,
    startedAt: asIso(base.startedAt, null),
    focusSec: asSeconds(base.focusSec),
    taskId: typeof base.taskId === 'string' ? base.taskId.slice(0, 100) : null,
    intent: typeof base.intent === 'string' ? base.intent.slice(0, 180) : null,
  };
}

export const timerState = createSignal('timer', DEFAULT_TIMER_STATE, {
  normalise: normaliseTimerState,
});

export const clearTimerState = () => timerState.set({ ...DEFAULT_TIMER_STATE });

/* -------------------------------------------------------------------------- */
/* Data export / import / reset                                               */
/* -------------------------------------------------------------------------- */

// An in-progress `mm.timer` is deliberately ephemeral and is not exported.
const SIGNALS = { settings, tasks, bookmarks, notes, history, collection };

export function exportData() {
  const payload = {
    app: 'minute-muse',
    version: 3,
    exportedAt: new Date().toISOString(),
    data: {},
  };
  for (const [key, signal] of Object.entries(SIGNALS)) {
    payload.data[key] = signal.value;
  }
  return payload;
}

export function importData(payload) {
  if (
    !isPlainObject(payload) ||
    payload.app !== 'minute-muse' ||
    !isPlainObject(payload.data)
  ) {
    throw new Error('That file does not look like a Minute Muse backup.');
  }
  const data = payload.data;
  const has = (key) => Object.prototype.hasOwnProperty.call(data, key);

  // Reject malformed backups before replacing anything; normalisation below
  // then strips hostile or nonsensical fields from the values themselves.
  if (has('settings') && !isPlainObject(data.settings)) {
    throw new Error('That backup has invalid settings.');
  }
  if (has('notes') && !isPlainObject(data.notes)) {
    throw new Error('That backup has invalid notes.');
  }
  for (const key of ['tasks', 'bookmarks', 'history']) {
    if (has(key) && !Array.isArray(data[key])) {
      throw new Error(`That backup has invalid ${key}.`);
    }
  }
  if (has('collection') && !isPlainObject(data.collection)) {
    throw new Error('That backup has an invalid cabinet.');
  }

  // CreateSignal normalises every value before it reaches the DOM or storage.
  if (has('settings')) settings.set(data.settings);
  if (has('tasks')) tasks.set(data.tasks);
  if (has('bookmarks')) bookmarks.set(data.bookmarks);
  if (has('notes')) notes.set(data.notes);
  if (has('history')) history.set(data.history);
  if (has('collection')) collection.set(data.collection);
  return true;
}

export function resetAllData() {
  for (const signal of Object.values(SIGNALS)) signal.clear();
  clearTimerState();
  // The engine owns its interval; give it a chance to stop cleanly.
  window.dispatchEvent(new CustomEvent('mm:data-erased'));
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
