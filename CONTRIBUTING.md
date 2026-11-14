# Contributing to Minute Muse

Thanks for being here. Minute Muse is a small, deliberately calm project: a static site with
no runtime dependencies. Keeping it that way is part of the design.

## Getting started

```bash
git clone https://github.com/PxlPau/Minute-Muse.git
cd Minute-Muse
npm install        # jsdom, for the test harness only
npm run serve      # http://localhost:8000
npm test           # app + mixer + resilience suites, in a headless DOM
npm run test:minutes # the app suite pinned to ten awkward minutes of the day
```

There is no build step and no bundler. Edit a file, reload the page.

## House rules

- **No runtime dependencies.** The site must keep working from plain files. Dev dependencies
  for testing are fine.
- **Respect the CSP.** No inline scripts, no inline event handlers. Icons come from the
  inline SVG sprite in `index.html` via `<use href="#i-name">`.
- **Treat data as untrusted.** Anything rendered from `quotes.json`, `images.json` or
  `localStorage` must go through `escapeHtml` (or `textContent`) before it reaches the DOM.
- **State belongs in `js/store.js`.** Add a signal, normalise it on read, and let modules
  subscribe. Do not scatter `localStorage` calls through the UI.
- **Time comes from the clock.** If your feature needs a tick, subscribe to `Clock` or the
  session engine rather than starting another `setInterval`.
- **Quiet is a feature.** Prefer fades to cuts, state to celebration, and one calm toast to
  a stack of them. Nothing should move unless the user moved it.

## Asking for a change

- **Bug:** open an issue with the browser and the steps to reproduce.
- **Feature:** describe the study behaviour it supports, not just the control it adds.
- **Passage or media removal:** follow the [takedown process](terms.html#dmca).

## Pull requests

1. Branch from `main` with a descriptive name.
2. Keep the change focused; small diffs get read properly.
3. Run `npm test` — every suite must stay green.

## A note on time-dependent tests

The reader shows a passage chosen from the current minute's candidates, and the
collection contains very short entries ("7.40 a.m. Have breakfast."). Never
assert on the *length* of what the reader renders — assert on its structure
(quotes, byline, one highlighted time phrase). Use the helpers in
`tools/assertions.mjs`, and if you touch anything time-sensitive, run
`npm run test:minutes`, which pins the clock to the minutes that once caused a
flaky build.
4. If you change behaviour, update the README or the in-app copy that describes it.

## Adding a sound

1. Drop a CC0 file in `audio/` using the existing `id__creator__name` convention.
2. Add it to `SOUNDS` in `js/audio.js` with a credit line and an icon from the sprite.
3. Add a sensible default volume in `DEFAULT_SETTINGS.volumes` in `js/store.js`.
4. Update the credits list in `index.html` and `disclaimer.html`.

## Adding a passage or fixing the collection

`quotes.json` is generated from the upstream Literature Clock dataset. Prefer fixing entries
at the source and regenerating, rather than hand-editing the JSON, so the two stay in step.
