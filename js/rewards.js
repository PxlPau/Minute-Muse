/* =============================================================================
   rewards.js — the economy of the cabinet

   Two currencies, deliberately different in temperament:

   INK (soft)  — earned by the minute. One unit per focused minute, a small
                 completion bonus, a welcome float. Spent on card draws and on
                 the Antiquarian's Shelf. It rewards showing up.

   EMBER (hard) — scarce. Earned at milestones only: the first finished session
                 of a day, a completed cycle, and now and then an ember found in
                 the ash of a long session. Spent to guarantee a rare card, or to
                 assemble a collection's singular piece. It rewards persistence.

   Nothing here touches money, and nothing leaves the device. The rules are
   plain functions over the `collection` signal so they can be tested directly.
   ========================================================================== */

import {
  bookmarks, collection, focusStreak, history, notes, tasks,
} from './store.js';
import { dayKey } from './util.js';
import {
  CURIOS, CURIO_BY_ID, DRAWABLE, SETS, MARKS, RARITY_META, rankFor, curiosOf, setById,
} from './curios.js';

export const COSTS = {
  draw: 90,
  triple: 240,
  emberDraw: 3,
  craft: 10,
  reroll: 0,
  shelf: { common: 140, uncommon: 380, rare: 6 }, // rare is priced in ember
};

export const REWARDS = {
  inkPerMinute: 1,
  completionBonus: 8,
  dailySparkInk: 25,
  dailySparkEmber: 1,
  cycleEmber: 2,
  cycleInk: 40,
  emberChance: 0.07, // a little ember found in the ash of a finished session
  welcomeInk: 150,
  tripleUncommonFloor: true,
  pityAfter: 8, // draws without a rare, before one is guaranteed
  unownedBias: 0.8, // chance a draw favours something you do not have
};

const today = () => dayKey();
const nowIso = () => new Date().toISOString();
const sum = (list, key) => list.reduce((total, entry) => total + (Number(entry?.[key]) || 0), 0);

/* -------------------------------------------------------------------------- */
/* Small ledger helpers                                                       */
/* -------------------------------------------------------------------------- */

function addLedger(value, entry) {
  const ledger = [entry, ...value.ledger].slice(0, 2000);
  return { ...value, ledger };
}

function grant(value, { ink = 0, ember = 0, id, note = '', at = nowIso() }) {
  const next = {
    ...value,
    ink: value.ink + ink,
    ember: value.ember + ember,
    inkEarned: value.inkEarned + Math.max(0, ink),
    emberEarned: value.emberEarned + Math.max(0, ember),
  };
  return addLedger(next, { id, ink, ember, note, at });
}

/** Has this exact award already been paid? Sessions are replayed on reload. */
export function alreadyCredited(id) {
  return collection.value.ledger.some((entry) => entry.id === id);
}

/* -------------------------------------------------------------------------- */
/* Rank & collections                                                         */
/* -------------------------------------------------------------------------- */

export function totalFocusSeconds() {
  return history.value
    .filter((entry) => entry.phase === 'focus')
    .reduce((total, entry) => total + Math.max(0, Number(entry.focusSec) || 0), 0);
}

export function currentRank() {
  return rankFor(totalFocusSeconds());
}

/** How many curios of a set are owned, and whether the set is finished. */
export function setProgress(setId) {
  const set = setById(setId);
  const owned = new Set(collection.value.owned.map((entry) => entry.id));
  const items = curiosOf(setId);
  const ownedCount = items.filter((item) => owned.has(item.id)).length;
  return {
    set,
    total: items.length,
    owned: ownedCount,
    complete: ownedCount === items.length,
  };
}

export function completeSetIds() {
  return SETS.filter((set) => setProgress(set.id).complete).map((set) => set.id);
}

/* -------------------------------------------------------------------------- */
/* Marks                                                                      */
/* -------------------------------------------------------------------------- */

/** Everything the marks and the cabinet want to know about your practice. */
export function practiceContext() {
  const value = collection.value;
  const focusEntries = history.value.filter((entry) => entry.phase === 'focus');
  const focusSessions = focusEntries.filter((entry) => (Number(entry.focusSec) || 0) > 0);
  const hours = focusEntries
    .map((entry) => new Date(entry.startedAt || entry.endedAt).getHours())
    .filter((hour) => Number.isFinite(hour));
  const owned = new Set(value.owned.map((entry) => entry.id));
  const setsComplete = SETS.filter((set) => set.curioIds.every((id) => owned.has(id))).length;

  return {
    focusSessions: focusSessions.length,
    completedSessions: focusEntries.filter((entry) => entry.completed).length,
    focusSec: focusEntries.reduce((total, entry) => total + Math.max(0, Number(entry.focusSec) || 0), 0),
    longestSession: focusEntries.reduce((longest, entry) => Math.max(longest, Number(entry.focusSec) || 0), 0),
    streak: focusStreak(),
    longBreaks: value.cycles,
    nightOwl: hours.some((hour) => hour >= 0 && hour < 4),
    earlyBird: hours.some((hour) => hour >= 5 && hour < 8),
    tasksDone: tasks.value.filter((task) => task.done).length,
    bookmarks: bookmarks.value.length,
    noteDays: Object.values(notes.value).filter((note) => note && String(note.text || '').trim()).length,
    curios: value.owned.length,
    setsComplete,
    inkEarned: value.inkEarned,
    emberEarned: value.emberEarned,
  };
}

/**
 * Award every mark whose condition is now true. Returns the marks that were
 * newly earned so the UI can celebrate them in the right order.
 */
export function evaluateMarks() {
  const ctx = practiceContext();
  const earned = [];
  for (const mark of MARKS) {
    if (collection.value.marks.includes(mark.id)) continue;
    let passed = false;
    try {
      passed = Boolean(mark.test(ctx));
    } catch {
      passed = false;
    }
    if (!passed) continue;
    collection.update((value) => {
      if (value.marks.includes(mark.id)) return value;
      const withMark = {
        ...value,
        marks: [...value.marks, mark.id],
      };
      return grant(withMark, {
        ink: mark.reward.ink || 0,
        ember: mark.reward.ember || 0,
        id: `mark-${mark.id}`,
        note: `mark:${mark.id}`,
      });
    });
    earned.push(mark);
  }
  return earned;
}

/* -------------------------------------------------------------------------- */
/* Session rewards                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Pay out for a logged focus session. Idempotent: a recovered session that is
 * replayed from storage is recognised by its id and paid only once.
 *
 * @param {object} record a history entry from the store
 * @param {{rng?: () => number}} [options]
 */
export function awardSession(record, { rng = Math.random } = {}) {
  if (!record || record.phase !== 'focus') {
    return { ink: 0, ember: 0, marks: [], duplicate: true, spark: false };
  }
  if (alreadyCredited(record.id)) {
    return { ink: 0, ember: 0, marks: [], duplicate: true, spark: false };
  }

  const minutes = Math.floor(Math.max(0, Number(record.focusSec) || 0) / 60);
  let ink = minutes * REWARDS.inkPerMinute;
  let ember = 0;
  if (record.completed) ink += REWARDS.completionBonus;

  const sparkAvailable = record.completed && collection.value.daily.spark !== today();
  if (sparkAvailable) {
    ink += REWARDS.dailySparkInk;
    ember += REWARDS.dailySparkEmber;
  }

  // A long, honest session occasionally turns up something in the ash.
  if (record.completed && rng() < REWARDS.emberChance) ember += 1;
  if (record.completed && (Number(record.focusSec) || 0) >= 50 * 60 && rng() < 0.15) ember += 1;

  collection.update((value) => {
    // Belt and braces: another tab may have paid this session while we waited.
    if (value.ledger.some((entry) => entry.id === record.id)) return value;
    const next = grant(value, {
      ink,
      ember,
      id: record.id,
      note: record.completed ? 'session' : 'session-partial',
    });
    return sparkAvailable
      ? { ...next, daily: { ...next.daily, spark: today() } }
      : next;
  });

  const marks = evaluateMarks();
  return { ink, ember, marks, duplicate: false, spark: sparkAvailable };
}

/**
 * A full pomodoro cycle has been completed (a long break is due). Cycles are
 * the one thing history cannot tell us, because breaks are never logged.
 */
export function awardCycle() {
  const key = `cycle-${collection.value.cycles + 1}`;
  let paid = false;
  collection.update((value) => {
    if (value.ledger.some((entry) => entry.id === key)) return value;
    paid = true;
    const next = grant(value, {
      ink: REWARDS.cycleInk,
      ember: REWARDS.cycleEmber,
      id: key,
      note: 'cycle',
    });
    return { ...next, cycles: next.cycles + 1 };
  });
  const marks = paid ? evaluateMarks() : [];
  return { ink: paid ? REWARDS.cycleInk : 0, ember: paid ? REWARDS.cycleEmber : 0, marks };
}

/** The welcome float, granted once, so the cabinet is never empty on day one. */
export function ensureWelcome() {
  if (collection.value.inkEarned > 0 || collection.value.ledger.length > 0) return false;
  collection.update((value) => grant(value, {
    ink: REWARDS.welcomeInk,
    id: 'welcome',
    note: 'welcome',
  }));
  return true;
}

/* -------------------------------------------------------------------------- */
/* Card draws                                                                 */
/* -------------------------------------------------------------------------- */

const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];

function rarityFor(pool, { force = null, rng = Math.random } = {}) {
  if (force) return force;
  const options = ['common', 'uncommon', 'rare'];
  const weights = options
    .filter((rarity) => pool.some((curio) => curio.rarity === rarity))
    .map((rarity) => [rarity, RARITY_META[rarity].weight]);
  const total = weights.reduce((sumWeight, [, weight]) => sumWeight + weight, 0);
  let roll = rng() * total;
  for (const [rarity, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return weights.length ? weights[weights.length - 1][0] : 'common';
}

/**
 * Choose one curio of a rarity. Unowned pieces are favoured (80%) so the
 * cabinet always makes progress, but duplicates remain possible — and are
 * converted to ink as "echoes" rather than quietly discarded.
 */
function chooseCurio(rarity, owned, rng) {
  const pool = DRAWABLE.filter((curio) => curio.rarity === rarity);
  if (!pool.length) return DRAWABLE[0];
  const unowned = pool.filter((curio) => !owned.has(curio.id));
  if (unowned.length && rng() < REWARDS.unownedBias) return pick(unowned, rng);
  return pick(pool, rng);
}

function fail(message) {
  const error = new Error(message);
  error.userMessage = message;
  return error;
}

export function hasFreeDraw() {
  return collection.value.daily.draw !== today();
}

export function drawPrice(mode = 'single') {
  if (mode === 'free') return { ink: 0, ember: 0 };
  if (mode === 'triple') return { ink: COSTS.triple, ember: 0 };
  if (mode === 'ember') return { ink: 0, ember: COSTS.emberDraw };
  return { ink: COSTS.draw, ember: 0 };
}

/**
 * Draw one or more cards.
 * @param {{mode?: 'single'|'triple'|'ember'|'free', rng?: () => number}} options
 */
export function drawCards({ mode = 'single', rng = Math.random } = {}) {
  const value = collection.value;
  const price = drawPrice(mode);
  if (price.ink > value.ink) throw fail(`You need ${price.ink - value.ink} more ink for that draw.`);
  if (price.ember > value.ember) throw fail(`You need ${price.ember - value.ember} more ember for that draw.`);
  if (mode === 'free' && !hasFreeDraw()) throw fail('Today’s draw is already yours. Come back tomorrow.');

  const count = mode === 'triple' ? 3 : 1;
  const owned = new Set(value.owned.map((entry) => entry.id));
  const drawn = [];
  let pity = value.pity;
  const cards = [];

  for (let index = 0; index < count; index += 1) {
    let force = null;
    if (mode === 'ember') force = 'rare';
    else if (pity >= REWARDS.pityAfter) force = 'rare';
    let rarity = rarityFor(DRAWABLE, { force, rng });
    // Triple draws guarantee that at least one card is uncommon or better.
    if (
      mode === 'triple' &&
      index === count - 1 &&
      REWARDS.tripleUncommonFloor &&
      cards.every((card) => card.rarity === 'common')
    ) {
      rarity = 'uncommon';
    }

    const curio = chooseCurio(rarity, owned, rng);
    const duplicate = owned.has(curio.id);
    let echo = { ink: 0, ember: 0 };
    if (duplicate) {
      echo = { ink: RARITY_META[curio.rarity].echo || 0, ember: curio.rarity === 'rare' ? 1 : 0 };
      drawn.push({ curio, duplicate: true, echo });
      cards.push({ ...curio, duplicate: true, echo });
    } else {
      owned.add(curio.id);
      drawn.push({ curio, duplicate: false });
      cards.push({ ...curio, duplicate: false, echo });
    }
    pity = curio.rarity === 'rare' ? 0 : pity + 1;
  }

  const echoInk = drawn.reduce((total, entry) => total + (entry.echo?.ink || 0), 0);
  const echoEmber = drawn.reduce((total, entry) => total + (entry.echo?.ember || 0), 0);

  collection.update((current) => {
    let next = {
      ...current,
      ink: Math.max(0, current.ink - price.ink + echoInk),
      ember: Math.max(0, current.ember - price.ember + echoEmber),
      draws: current.draws + count,
      pity,
      inkEarned: current.inkEarned + Math.max(0, echoInk),
      emberEarned: current.emberEarned + Math.max(0, echoEmber),
      serial: current.serial + drawn.filter((entry) => !entry.duplicate).length,
    };
    let serial = current.serial;
    for (const entry of drawn) {
      if (entry.duplicate) continue;
      serial += 1;
      next = {
        ...next,
        owned: [
          ...next.owned,
          {
            id: entry.curio.id,
            at: nowIso(),
            source: mode === 'free' ? 'daily' : mode,
            serial,
          },
        ],
      };
    }
    if (mode === 'free') next = { ...next, daily: { ...next.daily, draw: today() } };
    return addLedger(next, {
      id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ink: echoInk - price.ink,
      ember: echoEmber - price.ember,
      note: `draw:${mode}`,
    });
  });

  const marks = evaluateMarks();
  return { cards, spent: price, echo: { ink: echoInk, ember: echoEmber }, marks };
}

/* -------------------------------------------------------------------------- */
/* Assembling a singular piece                                                */
/* -------------------------------------------------------------------------- */

export function canCraft(setId) {
  const value = collection.value;
  const set = setById(setId);
  if (!set || !set.singularId) return { ok: false, reason: 'That collection has no singular piece.' };
  const owned = new Set(value.owned.map((entry) => entry.id));
  if (owned.has(set.singularId)) return { ok: false, reason: 'You already hold this one.' };
  const missing = set.curioIds.filter((id) => id !== set.singularId && !owned.has(id));
  if (missing.length) {
    return { ok: false, reason: `Still missing ${missing.length} of ${set.curioIds.length - 1}.` };
  }
  if (value.ember < COSTS.craft) {
    return { ok: false, reason: `Needs ${COSTS.craft} ember (you have ${value.ember}).` };
  }
  return { ok: true, reason: '' };
}

export function craftSet(setId) {
  const status = canCraft(setId);
  if (!status.ok) throw fail(status.reason);
  const curio = CURIO_BY_ID.get(setById(setId).singularId);
  collection.update((value) => {
    const serial = value.serial + 1;
    const next = {
      ...value,
      ember: value.ember - COSTS.craft,
      serial,
      owned: [...value.owned, { id: curio.id, at: nowIso(), source: 'crafted', serial }],
    };
    return addLedger(next, {
      id: `craft-${setId}`,
      ink: 0,
      ember: -COSTS.craft,
      note: `craft:${setId}`,
    });
  });
  const marks = evaluateMarks();
  return { curio, marks };
}

/* -------------------------------------------------------------------------- */
/* The Antiquarian's Shelf                                                     */
/* -------------------------------------------------------------------------- */

function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

const daySeed = (key = today()) =>
  [...key].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);

/**
 * Three curios offered for the day, stable until midnight. Kept in storage so
 * the shelf cannot change underneath a user who is deciding.
 */
export function dailyShelf() {
  const value = collection.value;
  if (value.daily.shelf === today() && value.daily.shelfIds.length === 3) {
    return value.daily.shelfIds.map((id) => CURIO_BY_ID.get(id)).filter(Boolean);
  }
  const rng = seededRandom(daySeed());
  const owned = new Set(value.owned.map((entry) => entry.id));
  const unowned = DRAWABLE.filter((curio) => !owned.has(curio.id));
  // Prefer pieces you do not have, but always be able to fill three slots.
  const source = unowned.length >= 3 ? unowned : DRAWABLE;
  const chosen = [];
  // One from each rarity band keeps the shelf varied and guarantees there is
  // usually something a soft-currency wallet can afford.
  for (const rarity of ['common', 'uncommon', 'rare']) {
    const band = source.filter((curio) => curio.rarity === rarity && !chosen.includes(curio));
    if (band.length) chosen.push(band[Math.floor(rng() * band.length)]);
  }
  // Fill any remaining slots from the rest of the source, never repeating.
  if (chosen.length < 3) {
    const rest = source.filter((curio) => !chosen.includes(curio));
    for (const curio of rest) {
      if (chosen.length >= 3) break;
      chosen.push(curio);
    }
  }
  const shelf = chosen.slice(0, 3);
  if (shelf.length === 3) {
    collection.update((current) => ({
      ...current,
      daily: { ...current.daily, shelf: today(), shelfIds: shelf.map((curio) => curio.id) },
    }));
  }
  return shelf;
}

export function shelfPrice(curio) {
  const entry = COSTS.shelf[curio?.rarity] ?? COSTS.shelf.common;
  return curio?.rarity === 'rare' ? { ink: 0, ember: entry } : { ink: entry, ember: 0 };
}

export function buyFromShelf(curioId) {
  const shelf = dailyShelf();
  const curio = shelf.find((item) => item.id === curioId);
  if (!curio) throw fail('That piece is no longer on the shelf.');
  const value = collection.value;
  if (value.owned.some((entry) => entry.id === curio.id)) throw fail('You already hold this one.');
  const price = shelfPrice(curio);
  if (value.ink < price.ink) throw fail(`You need ${price.ink - value.ink} more ink.`);
  if (value.ember < price.ember) throw fail(`You need ${price.ember - value.ember} more ember.`);

  collection.update((current) => {
    const serial = current.serial + 1;
    const next = {
      ...current,
      ink: current.ink - price.ink,
      ember: current.ember - price.ember,
      serial,
      owned: [...current.owned, { id: curio.id, at: nowIso(), source: 'shelf', serial }],
      daily: {
        ...current.daily,
        shelfIds: current.daily.shelfIds.filter((id) => id !== curio.id),
      },
    };
    return addLedger(next, {
      id: `shelf-${curio.id}-${Date.now()}`,
      ink: -price.ink,
      ember: -price.ember,
      note: `shelf:${curio.id}`,
    });
  });
  const marks = evaluateMarks();
  return { curio, spent: price, marks };
}

/* -------------------------------------------------------------------------- */
/* Read-only summaries for the UI                                             */
/* -------------------------------------------------------------------------- */

export function cabinetSummary() {
  const value = collection.value;
  return {
    ink: value.ink,
    ember: value.ember,
    curios: value.owned.length,
    totalCurios: CURIOS.length,
    marks: value.marks.length,
    totalMarks: MARKS.length,
    setsComplete: completeSetIds().length,
    totalSets: SETS.length,
    draws: value.draws,
    pity: value.pity,
    freeDraw: hasFreeDraw(),
    rank: currentRank(),
    inkEarned: value.inkEarned,
    emberEarned: value.emberEarned,
  };
}

/** Curios owned in a set, newest first, for the collection UI. */
export function ownedInSet(setId) {
  const byId = new Map(collection.value.owned.map((entry) => [entry.id, entry]));
  return curiosOf(setId).map((curio) => ({ curio, owned: byId.get(curio.id) || null }));
}

export function ownedEntry(curioId) {
  return collection.value.owned.find((entry) => entry.id === curioId) || null;
}

export { CURIO_BY_ID, SETS, MARKS, CURIOS };
