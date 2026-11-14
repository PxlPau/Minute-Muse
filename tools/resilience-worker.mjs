/* =============================================================================
   tools/resilience-worker.mjs — one failure scenario, one process
   Usage: node tools/resilience-worker.mjs <scenario>
   Exits 0 and prints a summary when the app recovered; exits 1 with the reason.
   ========================================================================== */

import { startServer, installDom, projectRootUrl, teardown } from './jsdom-env.mjs';

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
}[scenario];

if (!storage) {
  console.error(`Unknown scenario: ${scenario}`);
  process.exit(2);
}
for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);

if (scenario === 'quotes-offline' || scenario === 'images-offline') {
  const original = globalThis.fetch;
  const patched = (input, init) => {
    const target = String(input);
    if (scenario === 'quotes-offline' && target.includes('quotes.json')) {
      return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
    }
    if (scenario === 'images-offline' && target.includes('images.json')) {
      return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
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
    assert($('#quote').textContent.length > 40, 'reading broke with the photography');
    console.log('quiet gradient used, reading unaffected');
  }

  if (scenario === 'corrupt-storage') {
    const settings = app.state.settings.value;
    assert(settings.focusMin === 25, `focusMin repaired to ${settings.focusMin}, expected 25`);
    assert(settings.theme === 'lamplight', `theme repaired to ${settings.theme}`);
    assert(/\d{2}:\d{2}/.test($('#clock-time').textContent), 'clock did not render');
    assert($('#quote').textContent.length > 40, 'reading did not render');
    app.engine.recover();
    assert(app.engine.snapshot(), 'engine could not produce a snapshot');
    console.log('settings, tasks and timer repaired to safe defaults');
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
