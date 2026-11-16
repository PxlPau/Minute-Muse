/* =============================================================================
   tools/resilience-worker.mjs — one failure scenario, one process
   Usage: node tools/resilience-worker.mjs <scenario>
   Exits 0 and prints a summary when the app recovered; exits 1 with the reason.
   ========================================================================== */

import { startServer, installDom, projectRootUrl, teardown } from './jsdom-env.mjs';
import { assertReaderNotBroken } from './assertions.mjs';

const scenario = process.argv[2];
const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'failed');
};

const { server, url } = await startServer();
const { dom, window } = await installDom(url);
const $ = (selector) => window.document.querySelector(selector);

const storage = {
  'quotes-offline': {},
  'images-offline': {},
  'corrupt-storage': {
    'mm.settings': '{"focusMin":"banana","theme":"neon","volumes":null}',
    'mm.tasks': '["not-a-task", null, {"text":"   "}]',
    'mm.history': '{"nope":true}',
    'mm.timer': '"a string, not an object"',
    'mm.notes': 'null',
  },
  'corrupt-bookmarks': { 'mm.bookmarks': '{"broken":true}' },
  'quotes-malformed': {},
}[scenario];

if (!storage) {
  console.error(`Unknown scenario: ${scenario}`);
  process.exit(2);
}
for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);

if (['quotes-offline', 'images-offline', 'quotes-malformed'].includes(scenario)) {
  const malformedQuotes = {
    '10:30': [
      { quote: 'A passage with a number for an author', author: 42, title: null, time_case: 7 },
      { quote: 123, author: null, title: {}, time_case: [] },
      { quote: 'A safe passage <img src=x onerror=alert(1)>', author: '<b>Author</b>', title: 'A & B', time_case: 'half past ten' },
    ],
    '99:99': [{ quote: 'An invalid minute key', author: 'Nobody', title: '', time_case: '' }],
  };
  const original = globalThis.fetch;
  const patched = (input, init) => {
    const target = String(input);
    if (scenario === 'quotes-offline' && target.includes('quotes.json')) {
      return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
    }
    if (scenario === 'images-offline' && target.includes('images.json')) {
      return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
    }
    if (scenario === 'quotes-malformed' && target.includes('quotes.json')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => malformedQuotes });
    }
    return original(input, init);
  };
  globalThis.fetch = patched;
  window.fetch = patched;
}

try {
  await import(new URL('js/app.js', projectRootUrl).href);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 900));

  const app = window.minuteMuse;

  if (scenario === 'quotes-offline') {
    const quote = $('#quote').textContent;
    assert(quote.includes('could not be reached'), `unexpected placeholder: "${quote}"`);
    assert($('.toast__msg'), 'no explanation shown to the reader');
    assert(/\d{2}:\d{2}/.test($('#timer-time').textContent), 'timer is unusable');
    assert($('#task-input'), 'tasks are unusable');
    app.library.open();
    app.library.run();
    assert(!$('#library-empty').hidden, 'library did not show its empty state');
    app.reader.advance(); // must not throw
    console.log('placeholder shown, timer and library remain usable');
  }

  if (scenario === 'images-offline') {
    assert($('#backdrop'), 'backdrop missing');
    assert(!$('.backdrop__img.is-visible'), 'an image was shown despite the failure');
    assert($('#photo-credit').textContent.includes('Unsplash'), 'credit line lost');
    assertReaderNotBroken($);
    console.log('quiet gradient used, reading unaffected');
  }

  if (scenario === 'corrupt-storage') {
    const settings = app.state.settings.value;
    assert(settings.focusMin === 25, `focusMin repaired to ${settings.focusMin}, expected 25`);
    assert(settings.theme === 'lamplight', `theme repaired to ${settings.theme}`);
    assert(/\d{2}:\d{2}/.test($('#clock-time').textContent), 'clock did not render');
    assertReaderNotBroken($);
    app.engine.recover();
    assert(app.engine.snapshot(), 'engine could not produce a snapshot');
    console.log('settings, tasks and timer repaired to safe defaults');
  }

  if (scenario === 'quotes-malformed') {
    const { passages, QUOTE_STATE } = await import(new URL('js/quotes.js', projectRootUrl).href);
    const valid = passages.db['10:30'];
    assert(valid?.length === 2, 'bad quote keys or non-string passages were not filtered');
    assert(
      valid.every((entry) => ['quote', 'author', 'title', 'timeCase'].every((key) => typeof entry[key] === 'string')),
      'a non-string quote field survived normalisation',
    );
    assert(!passages.db['99:99'], 'an invalid minute key was accepted');

    // A later load failure must settle waiters instead of hanging forever.
    passages.state = QUOTE_STATE.loading;
    const pending = passages.whenReady();
    const failingFetch = () => Promise.reject(new Error('network down'));
    globalThis.fetch = failingFetch;
    window.fetch = failingFetch;
    assert(await passages.load() === false, 'a failed load should report failure');
    await Promise.race([
      pending,
      new Promise((_, reject) => setTimeout(() => reject(new Error('whenReady() never settled')), 1000)),
    ]);
    assert(passages.state === QUOTE_STATE.error, 'the engine did not record the load error');
    console.log('malformed quote fields sanitised; load failures settle waiters');
  }

  if (scenario === 'corrupt-bookmarks') {
    const { bookmarks } = await import(new URL('js/store.js', projectRootUrl).href);
    app.reader.renderNow({ animate: false });
    assert(app.reader.current, 'reader has no passage to save');
    app.reader.toggleSave();
    assert(Array.isArray(bookmarks.value), 'bookmarks were not repaired to an array');
    const stored = JSON.parse(window.localStorage.getItem('mm.bookmarks'));
    assert(Array.isArray(stored) && stored.length === 1, 'saving did not recover the list');
    console.log('bookmark list recovered and saving works');
  }

  teardown({ server, dom });
  process.exit(0);
} catch (error) {
  console.error(error.message);
  teardown({ server, dom });
  process.exit(1);
}
