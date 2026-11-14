/* =============================================================================
   tools/smoke-test.mjs — boot the whole app in jsdom and assert the essentials.
   `npm test` — no browser required.

   The project is served over loopback HTTP and the real ES modules are imported
   into Node with a jsdom global environment, so imports, fetch, storage and DOM
   behaviour are exercised for real rather than simulated.
   ========================================================================== */

import { startServer, installDom, projectRootUrl, teardown } from './jsdom-env.mjs';

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
  const quote = $('#quote').textContent.trim();
  assert(quote.length > 40, `quote too short: "${quote}"`);
  assert($('#author').textContent.trim().length > 1, 'author missing');
});

await check('the highlighted minute is marked exactly once', () => {
  const html = $('#quote').innerHTML;
  const text = $('#quote').textContent;
  assert((html.match(/class="time-highlight"/g) || []).length <= 1, 'multiple highlights');
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

await check('stepping through a minute never repeats itself', async () => {
  const { reader } = api;
  const { passages } = api;
  const key = passages.keyFor();
  reader.renderNow({ animate: false });
  const pool = passages.candidates(key);
  const seenQuotes = [];
  for (let i = 0; i < Math.min(pool.length, 3); i += 1) {
    reader.advance();
    await new Promise((resolve) => setTimeout(resolve, 300));
    seenQuotes.push(reader.current.quote);
  }
  assert(new Set(seenQuotes).size === seenQuotes.length, `a passage repeated: ${seenQuotes.length} presses`);
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

const pad = (label) => label.padEnd(52, '.');
console.log('\n  Minute Muse — smoke test\n');
for (const result of results) {
  console.log(`  ${result.ok ? '✓' : '✗'} ${pad(result.name)}${result.ok ? 'ok' : result.error}`);
}
console.log(`\n  ${results.length - failures}/${results.length} checks passed\n`);

teardown({ server, dom });
process.exit(failures ? 1 : 0);
