/* =============================================================================
   tools/smoke-test.mjs — boot the whole app in jsdom and assert the essentials.
   `npm test` — no browser required.

   The project is served over loopback HTTP and the real ES modules are imported
   into Node with a jsdom global environment, so imports, fetch, storage and DOM
   behaviour are exercised for real rather than simulated.
   ========================================================================== */

import { startServer, installDom, projectRootUrl, teardown } from './jsdom-env.mjs';
import { assertPassageRendered } from './assertions.mjs';

let failures = 0;
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    failures += 1;
    results.push({ name, ok: false, error: error.message });
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'assertion failed');
};

const { server, url } = await startServer();
const { dom, window, errors } = await installDom(url);

const app = await import(new URL('js/app.js', projectRootUrl).href);

// The app registers its own DOMContentLoaded listener; dispatch it now.
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
await new Promise((resolve) => setTimeout(resolve, 400));
await new Promise((resolve) => setTimeout(resolve, 400));

const api = window.minuteMuse;
const $ = (selector) => window.document.querySelector(selector);

/* -------------------------------------------------------------------------- */

await check('app boots and exposes its modules', () => {
  assert(api && api.engine && api.reader && api.library && api.tasks, 'app was not wired');
});

await check('no uncaught errors during boot', () => {
  const relevant = errors.filter((message) => !/Not implemented|Could not parse CSS|cssparser/i.test(message));
  assert(relevant.length === 0, relevant.slice(0, 3).join(' | '));
});

await check('clock renders a real time', () => {
  const clock = $('#clock-time').textContent.trim();
  assert(/^\d{1,2}:\d{2}$/.test(clock), `clock shows "${clock}"`);
  assert($('#clock-ampm').textContent.length > 0, 'meridiem missing');
});

await check('reader renders a passage with an author', () => {
  // Structure, not length: the collection legitimately contains very short
  // diary-style entries such as "7.40 a.m. Have breakfast." (see assertions.mjs).
  const { text, author } = assertPassageRendered($);
  assert(author.length >= 2, `author missing in ${JSON.stringify(text.slice(0, 60))}`);
});

await check('the highlighted minute is marked exactly once', () => {
  // assertPassageRendered already proves exactly one highlight is present.
  // What remains worth checking is that the highlighted text really is the
  // passage's own time phrase, and that no markup escaped into the copy.
  const { text } = assertPassageRendered($);
  const highlighted = $('#quote').querySelector('.time-highlight');
  assert(highlighted, 'no highlight element');
  assert(highlighted.textContent.trim().length > 0, 'the highlight is empty');
  assert(text.includes(highlighted.textContent), 'the highlight is not part of the visible passage');
  assert(!text.includes('<span'), 'markup leaked into text');
});

await check('every minute of the day resolves to a passage', () => {
  const engine = api.passages;
  assert(engine, 'passage engine not exposed');
  let missing = 0;
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 1) {
      const key = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (!engine.candidates(key).length) missing += 1;
    }
  }
  assert(missing === 0, `${missing} minutes have no passage`);
});

await check('every passage in the collection renders cleanly', () => {
  // The single random draw above only ever exercises one minute. This walks the
  // entire collection through the real renderer so short entries, unusual
  // punctuation and missing time phrases are all covered — deterministically.
  const { passages } = api;
  const problems = [];
  let rendered = 0;
  let highlighted = 0;

  for (const [minute, entries] of Object.entries(passages.db || {})) {
    for (const entry of entries) {
      rendered += 1;
      const { html, plain } = passages.render(entry);

      if (!plain || !plain.trim()) {
        problems.push(`${minute}: empty passage`);
        continue;
      }
      if (!html || !html.trim()) {
        problems.push(`${minute}: empty markup`);
        continue;
      }
      if (/<script|onerror=|onload=/i.test(html)) {
        problems.push(`${minute}: unescaped markup leaked through`);
      }
      if (/&lt;script/i.test(html)) {
        problems.push(`${minute}: entity-escaped script tag suggests double encoding`);
      }

      const marks = html.match(/class="time-highlight"/g) || [];
      if (marks.length > 1) problems.push(`${minute}: ${marks.length} highlights`);
      if (marks.length === 1) {
        highlighted += 1;
        // The highlighted span must contain real text, never an empty tag.
        const inner = html.match(/class="time-highlight">([^<]*)</);
        if (!inner || !inner[1].trim()) problems.push(`${minute}: empty highlight`);
      }

      // Stripping every tag must give back exactly the passage, character for
      // character — this catches a highlight that duplicated or dropped text.
      const stripped = html.replace(/<[^>]+>/g, '');
      if (stripped !== escapeForCompare(plain)) {
        problems.push(`${minute}: rendered text differs from the source passage`);
      }
    }
  }

  assert(rendered > 3000, `only ${rendered} passages were checked`);
  assert(highlighted > rendered * 0.5, `only ${highlighted}/${rendered} passages highlighted their minute`);
  assert(problems.length === 0, `${problems.length} problems, first: ${problems.slice(0, 3).join(' | ')}`);
});

await check('the shortest passages still render as real quotes', () => {
  // Regression guard for the flake this suite used to have: a 16-character
  // diary entry is legitimate content, and it must reach the reader intact.
  const { passages, reader } = api;
  let shortest = null;
  for (const [minute, entries] of Object.entries(passages.db || {})) {
    for (const entry of entries) {
      if (!shortest || entry.quote.length < shortest.quote.length) shortest = { ...entry, key: minute };
    }
  }
  assert(shortest, 'the collection is empty');
  assert(shortest.quote.length > 0, 'a passage is empty');

  reader.show({ ...shortest, minute: shortest.key }, { animate: false });
  const { text } = assertPassageRendered($, { allowNoHighlight: !shortest.timeCase });
  assert(text.slice(1, -1).trim() === shortest.quote.trim(), 'the shortest passage was altered on its way to the screen');

  // Restore the live reading so later checks see the real clock again.
  reader.renderNow({ animate: false });
});

await check('library search returns results', () => {
  api.library.input.value = 'the';
  api.library.run();
  assert($('#library-results').querySelectorAll('.result').length > 0, 'no results for "the"');
});

await check('library search understands a minute query', () => {
  api.library.input.value = '00:00';
  api.library.run();
  assert($('#library-results').querySelectorAll('.result').length > 0, 'no results for "00:00"');
});

await check('tasks persist and render', () => {
  $('#task-input').value = 'Read chapter four';
  $('#task-form').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  const stored = JSON.parse(window.localStorage.getItem('mm.tasks'));
  assert(stored.length === 1 && stored[0].text === 'Read chapter four', 'task not persisted');
  assert($('#task-list').querySelectorAll('.task').length === 1, 'task row not rendered');
});

await check('completing a focus round records history and moves to a break', () => {
  const { engine } = api;
  engine.begin({ phase: 'focus', round: 1 });
  assert(engine.isRunning, 'engine did not start');
  engine.complete();
  const history = JSON.parse(window.localStorage.getItem('mm.history'));
  assert(history.length >= 1, 'no session recorded');
  assert(history[0].focusSec > 0, 'session has no focus seconds');
  assert(engine.snapshot().phase === 'short', `expected a break, got ${engine.snapshot().phase}`);
});

await check('pause and resume preserve remaining time', () => {
  const { engine } = api;
  engine.begin({ phase: 'focus', round: 1 });
  engine.pause();
  const remaining = engine.remaining;
  assert(remaining > 0, 'no remaining time after pause');
  assert(!engine.isRunning, 'still running after pause');
  engine.resume();
  assert(engine.isRunning, 'did not resume');
  assert(Math.abs(engine.remaining - remaining) <= 1, 'time drifted across pause');
  engine.reset();
});

await check('long break arrives on the configured round', () => {
  const { engine } = api;
  const rounds = api.state.settings.value.roundsBeforeLong;
  let phase = 'focus';
  let round = rounds;
  // Jump the engine to the last round of a cycle and finish it.
  engine.begin({ phase: 'focus', round: rounds });
  engine.complete();
  assert(engine.snapshot().phase === 'long', `expected long break on round ${rounds}, got ${engine.snapshot().phase}`);
  engine.reset();
  assert(phase === 'focus', 'sanity');
});

await check('bookmarks toggle on and off', () => {
  const { reader } = api;
  assert(reader.current, 'reader has no current passage');
  reader.toggleSave();
  assert(JSON.parse(window.localStorage.getItem('mm.bookmarks')).length === 1, 'bookmark not saved');
  reader.toggleSave();
  assert(JSON.parse(window.localStorage.getItem('mm.bookmarks')).length === 0, 'bookmark not removed');
});

await check('invalid settings are clamped, not trusted', () => {
  api.state.settings.set({ ...api.state.settings.value, focusMin: 9999, theme: 'nonsense', textSize: 'huge' });
  assert(api.state.settings.value.focusMin === 180, `focusMin not clamped (${api.state.settings.value.focusMin})`);
  assert(api.state.settings.value.theme === 'lamplight', 'theme not sanitised');
  assert(api.state.settings.value.textSize === 'md', 'textSize not sanitised');
  api.state.settings.set({ ...api.state.settings.value, focusMin: 25 });
});

await check('minute preview updates and clears the flag', () => {
  api.reader.shiftMinute(3);
  assert(!$('#preview-flag').hidden, 'preview flag not shown');
  api.reader.returnToNow();
  assert($('#preview-flag').hidden, 'preview flag not cleared');
});

await check('stats render four tiles and a bar chart', () => {
  api.stats.open();
  assert($('#stats-hero').querySelectorAll('.stat-tile').length === 4, 'stat tiles missing');
  assert($('#stats-bars').querySelectorAll('.bar-col').length === 14, 'expected 14 day columns');
  api.overlays.close($('#stats-overlay'));
});

await check('journal note persists to local storage', async () => {
  api.journal.open();
  const textarea = $('#journal-text');
  textarea.value = 'Two pages on the Stoics, then a walk.';
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 900));
  const notes = JSON.parse(window.localStorage.getItem('mm.notes'));
  const key = Object.keys(notes).sort().pop();
  assert(notes[key].text.includes('Stoics'), 'note not persisted');
  api.overlays.close($('#journal-drawer'));
});

await check('data export contains every store', () => {
  const payload = api.store.exportData();
  assert(payload.data.settings && payload.data.tasks && payload.data.history, 'export incomplete');
});

await check('settings panel reflects stored values', () => {
  api.settingsPanel.open();
  assert($('#setting-focus-min').value === String(api.state.settings.value.focusMin), 'settings input out of sync');
  assert($('#setting-24h').checked === api.state.settings.value.hour24, 'toggle out of sync');
  api.overlays.close($('#settings-overlay'));
});

await check('keyboard shortcut starts and pauses the session', () => {
  const event = new window.KeyboardEvent('keydown', { key: ' ', bubbles: true });
  window.document.body.dispatchEvent(event);
  assert(api.engine.isRunning, 'space did not start the session');
  window.document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  assert(!api.engine.isRunning, 'space did not pause the session');
  api.engine.reset();
});

await check('export can be imported back without loss', async () => {
  const { importData } = await import(new URL('js/store.js', projectRootUrl).href);
  const payload = api.store.exportData();
  const before = JSON.parse(JSON.stringify(payload.data));
  importData(payload);
  const after = api.store.exportData().data;
  assert(JSON.stringify(before.tasks) === JSON.stringify(after.tasks), 'tasks changed across round-trip');
  assert(JSON.stringify(before.history) === JSON.stringify(after.history), 'history changed across round-trip');
});

await check('import rejects a file that is not a backup', async () => {
  const { importData } = await import(new URL('js/store.js', projectRootUrl).href);
  let threw = false;
  try {
    importData({ hello: 'world' });
  } catch {
    threw = true;
  }
  assert(threw, 'a malformed backup was accepted');
});

await check('a running session survives a reload', () => {
  const { engine } = api;
  engine.begin({ phase: 'focus', round: 1 });
  const stored = JSON.parse(window.localStorage.getItem('mm.timer'));
  assert(stored.status === 'running' && stored.endsAt, 'session state not persisted');
  const endsAt = new Date(stored.endsAt).getTime();
  assert(endsAt > Date.now(), 'persisted session has already expired');
  // A fresh engine reading the same storage should pick the session back up.
  const remaining = Math.round((endsAt - Date.now()) / 1000);
  assert(remaining > 60, `unexpected remaining time: ${remaining}s`);
  engine.reset();
});

await check('a lapsed session is closed quietly instead of counting', async () => {
  // Simulate a tab that was closed for an hour: storage holds a session whose
  // end time has long passed. A fresh engine (a fresh page load) must settle it.
  const lapsed = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  window.localStorage.setItem('mm.timer', JSON.stringify({
    phase: 'focus', status: 'running', round: 1,
    endsAt: lapsed, remainingSec: null,
    startedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    focusSec: 0, taskId: null, intent: null,
  }));
  const { SessionEngine } = await import(new URL('js/timer.js', projectRootUrl).href);
  const { timerState: timerSignal } = await import(new URL('js/store.js', projectRootUrl).href);
  timerSignal.reload();
  const fresh = new SessionEngine();
  fresh.recover();
  assert(timerSignal.value.status === 'idle', `lapsed session left as "${timerSignal.value.status}"`);
  const stored = JSON.parse(window.localStorage.getItem('mm.timer'));
  assert(stored.status === 'idle', `lapsed session still persisted as "${stored.status}"`);
});

await check('a session that ended moments ago still counts', async () => {
  // Reloading a second after a phase ends should credit the round, not discard it.
  const { SessionEngine } = await import(new URL('js/timer.js', projectRootUrl).href);
  const { timerState: timerSignal } = await import(new URL('js/store.js', projectRootUrl).href);
  timerSignal.set({
    phase: 'focus', status: 'running', round: 1,
    endsAt: new Date(Date.now() - 4000).toISOString(),
    remainingSec: null, startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    focusSec: 0, taskId: null, intent: null,
  });
  const before = (JSON.parse(window.localStorage.getItem('mm.history')) || []).length;
  const fresh = new SessionEngine();
  fresh.recover();
  const after = JSON.parse(window.localStorage.getItem('mm.history')).length;
  assert(after === before + 1, 'a just-finished session was not recorded');
  assert(timerSignal.value.phase === 'short', `expected a break, got ${timerSignal.value.phase}`);
  timerSignal.set({ ...timerSignal.value, status: 'idle', phase: 'focus', round: 1, endsAt: null, remainingSec: null });
});

/**
 * Hold the clock still while a check runs.
 *
 * The app turns the page on its own second-hand tick. That is the behaviour we
 * want in production, but in a test it means a page turn can land in the middle
 * of a check and change which minute is on screen — the source of this suite's
 * one genuinely random failure. Stopping the clock keeps each check talking
 * about the minute it chose, on every run.
 */
async function withClockStopped(fn) {
  const { clock } = api;
  const wasRunning = Boolean(clock?.interval);
  clock?.stop();
  try {
    return await fn();
  } finally {
    // start() would attach a second visibility listener; restart the interval
    // the clock was already using so the app is left exactly as it was found.
    if (wasRunning) clock.interval = window.setInterval(() => clock.loop(), 1000);
  }
}

await check('stepping through a minute never repeats itself', () => withClockStopped(async () => {
  const { reader, passages } = api;
  // Pick a minute with several passages rather than whatever the wall clock
  // happens to be showing: the check must exercise stepping even at minutes that
  // only ever hold one passage.
  const key = Object.keys(passages.db).find((minute) => passages.db[minute].length >= 3);
  assert(key, 'no minute holds several passages');
  const pool = passages.candidates(key);
  // Deliberately not `passages.pick()`: it is random, and if it happened to land
  // on the passage this walk will reach on its last press the check would fail
  // for reasons that have nothing to do with stepping. Start from a passage the
  // walk cannot reach in three presses.
  const start = pool.findIndex((entry) => !pool.slice(0, 3).includes(entry));
  assert(start >= 0, 'the chosen minute has too few distinct passages');
  reader.show({ ...pool[start], key, minute: key, total: pool.length }, { animate: false });
  const seenQuotes = [reader.current.quote];
  for (let i = 0; i < Math.min(pool.length, 3); i += 1) {
    reader.advance();
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert(reader.current?.key === key, `the minute changed mid-step (${reader.current?.key})`);
    seenQuotes.push(reader.current.quote);
  }
  assert(new Set(seenQuotes).size === seenQuotes.length, `a passage repeated: ${seenQuotes.length} presses`);
}));

await check('a page turn mid-step never repeats itself', () => withClockStopped(() => {
  // Regression guard for the flake in this suite. The clock turns the page once
  // a minute, so it can land between two presses; the reader used to keep a bare
  // array index across that turn and step straight back onto the same passage.
  // (The clock is stopped here so the page turn under test is the one we stage.)
  const { reader, passages } = api;
  const start = Object.keys(passages.db).find((minute) => passages.db[minute].length >= 3);
  const turn = Object.keys(passages.db).find(
    (minute) => passages.db[minute].length === 2 && passages.db[minute][0].quote !== passages.db[minute][1].quote,
  );
  assert(start && turn, 'need a three-passage and a two-passage minute');

  // Deliberately not `passages.pick()`: it is random, and this check must fail
  // every time the bug is present rather than one time in three.
  const show = (minute, index) => reader.show(
    { ...passages.candidates(minute)[index], key: minute, minute, total: passages.candidates(minute).length },
    { animate: false },
  );

  // Walk through *every* passage of the previous minute and then roll over, so
  // whichever stepping position a page turn could leave behind is covered. A
  // forward step from a stale index wraps onto whichever passage the shorter
  // list happens to hold at that spot — sometimes the one already on screen.
  const startPool = passages.candidates(start);
  for (let carried = -1; carried < startPool.length; carried += 1) {
    show(start, carried < 0 ? 0 : carried);
    reader.seenIndex = carried; // the position a page turn would leave behind

    show(turn, 1);
    const showing = reader.current.quote;
    reader.advance();
    assert(
      reader.current.quote !== showing,
      `a page turn (carrying position ${carried}) showed the same passage again: ${JSON.stringify(showing.slice(0, 40))}`,
    );
  }

  // And it must keep moving rather than sticking on one entry for ever.
  show(turn, 0);
  const visited = new Set();
  for (let press = 0; press < 6; press += 1) {
    reader.advance();
    visited.add(reader.current.quote);
  }
  assert(visited.size > 1, 'stepping stalled on a single passage');
}));

await check('no minute lists the same passage twice', () => {
  // The collection ships occasional exact duplicates (09:20 listed the same
  // Wodehouse sentence twice), which made "next passage" a no-op there.
  const { passages } = api;
  const offenders = [];
  for (const [minute, entries] of Object.entries(passages.db)) {
    const identities = entries.map((entry) => `${entry.quote}\u0000${entry.author}\u0000${entry.title}`);
    if (new Set(identities).size !== identities.length) offenders.push(minute);
  }
  assert(offenders.length === 0, `duplicate passages in ${offenders.slice(0, 5).join(', ')}`);
});

await check('a minute with one passage borrows its nearest neighbour', () => {
  const { passages, reader } = api;
  // Find a minute with exactly one candidate.
  let lonely = null;
  for (let h = 0; h < 24 && !lonely; h += 1) {
    for (let m = 0; m < 60; m += 1) {
      const key = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (passages.candidates(key).length === 1) { lonely = key; break; }
    }
  }
  assert(lonely, 'no single-passage minute in the collection');
  reader.show(passages.pick(lonely), { animate: false });
  const before = reader.current.quote;
  reader.advance();
  assert(reader.current.quote !== before, 'single-passage minute repeated itself');

  // The minutes where the nearest neighbour happens to contain the very passage
  // the lonely minute already shows. Borrowing it back is a no-op on screen.
  for (const minute of ['00:22', '04:13', '08:02', '19:21']) {
    if (!passages.db[minute]) continue;
    reader.show(passages.candidates(minute)[0] && { ...passages.candidates(minute)[0], key: minute, minute }, { animate: false });
    const shown = reader.current.quote;
    reader.advance();
    assert(reader.current.quote !== shown, `${minute} borrowed its own passage back`);
  }
});

await check('focus record only counts focus phases', () => {
  const history = JSON.parse(window.localStorage.getItem('mm.history'));
  assert(history.every((entry) => entry.phase === 'focus' || entry.focusSec === 0), 'break logged as focus time');
});

await check('erasing data clears every store', async () => {
  const storeModule = await import(new URL('js/store.js', projectRootUrl).href);
  storeModule.resetAllData();
  for (const key of ['settings', 'tasks', 'bookmarks', 'notes', 'history']) {
    assert(window.localStorage.getItem(`mm.${key}`) === null, `${key} survived the erase`);
  }
  assert(storeModule.tasks.value.length === 0, 'tasks not cleared in memory');
  assert(window.localStorage.getItem('mm.timer'), 'timer state lost during reset');
});

/* -------------------------------------------------------------------------- */

/** Mirror of the app's escaping, for comparing rendered text to its source. */
function escapeForCompare(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const pad = (label) => label.padEnd(52, '.');
console.log('\n  Minute Muse — smoke test\n');
for (const result of results) {
  console.log(`  ${result.ok ? '✓' : '✗'} ${pad(result.name)}${result.ok ? 'ok' : result.error}`);
}
console.log(`\n  ${results.length - failures}/${results.length} checks passed\n`);

teardown({ server, dom });
process.exit(failures ? 1 : 0);
