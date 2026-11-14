# 🕰️ Minute Muse

> *"The clock showed the time, and the world held its breath."*

**Minute Muse** is a quiet, literary study workspace. A clock tells the time through real
passages from books that mention that exact minute, and around it sit the tools a study
session actually needs: a focus timer, a task list, layered ambience, and a private journal.
No accounts, no analytics, no build step — just a static site that keeps everything on your
own device.

🔗 **[Live site](https://pxlpau.github.io/Minute-Muse/)**

---

## ✨ What is in the room

**Reading**

- **A literary clock** — every minute of the day resolves to a passage from
  [Literature Clock](https://github.com/JohannesNE/literature-clock): 3,600+ excerpts across
  1,400+ minutes. The time phrase inside each quote is underlined in ink.
- **Every passage for the minute** — when a minute has several candidates, step through them
  with *New passage*.
- **Minute preview** — arrow keys or the chevrons walk the clock forwards and back, with a
  clear *Back to now* flag, so you never lose your place.
- **Passage library** — search the whole collection by phrase, author, title, or minute
  (`14:30`). Selecting a result previews it in the reader.
- **Saved passages** — keep the lines worth returning to; they live in your journal.

**Session**

- **Focus timer** — focus / short break / long break, with a long break every fourth round.
  Presets for 5, 15, 25, 45, 50 and 90 minutes, adjustable in Settings.
- **It is a clock, not a metronome** — a running phase stores the wall-clock time it ends, so
  a refresh, a locked screen or a throttled background tab can never make it drift. Close the
  tab and the session is still there when you come back.
- **Immersive view** — a full-screen dial with the session's intention and nothing else.
- **Session intention** — the task at the top of your list becomes what the session is *for*.

**Support**

- **Session tasks** — add, tick, rename, clear. Completed items sink quietly to the bottom.
- **Layered ambience mixer** — rain, fireplace, forest, two jazz-free beds and two synthesised
  ones. Every layer has its own volume and fades independently, so you can build a room
  instead of switching a track. Saved presets for common blends.
- **Journal** — day-keyed notes that autosave as you type, plus your saved passages.
- **Focus record** — today, this week, typical session, streak, fourteen days of bars, and a
  log of recent sessions. Only time actually spent counts.
- **Zen mode** — the room recedes to just the clock and the page.
- **Offline** — a service worker keeps the shell and collection available when the network
  is not.

**Preferences** — Lamplight or Moonlight palette, three reading sizes, 24-hour clock, quiet
backdrop, reduced motion, climate override, session lengths, chimes and notifications.
Everything is exportable and erasable from Settings.

---

## ⌨️ Keyboard

| Key | Action |
| --- | --- |
| `Space` | Start or pause the session |
| `N` | Another passage |
| `S` | Save the current passage |
| `J` | Journal |
| `/` | Search the library |
| `Z` | Zen mode |
| `F` | Immersive view |
| `M` | Mute ambience |
| `←` `→` | Previous / next minute |
| `Esc` | Close, or return to now |

---

## 🏗️ How it is built

No framework, no bundler, no dependencies at runtime. The site is HTML, CSS and native ES
modules, which keeps it fast and keeps it yours.

```
index.html              the room: shell, rail, reader, dialogs (icons inline, CSP-safe)
styles.css              design tokens → components → responsive & motion states
js/
  app.js                composition root: modules, events, keyboard map, boot order
  store.js              persistent state (localStorage) + normalisation + export/import
  quotes.js             the literary collection: lookup, neighbour fallback, search
  timer.js              session engine: wall-clock countdown, phases, history, chimes
  audio.js              layered ambience mixer (media + Web Audio synthesis)
  util.js               formatting, storage signals, toasts, confirm dialogs
  ui/
    overlays.js         one owner for open/close, focus trap, Escape, scroll lock
    backdrop.js         two-layer crossfade for photography, with credits
    clock.js            the single second-hand interval the whole app listens to
    reader.js           the page-turner: passages, preview, save, copy, reflect
    timer-panel.js      timer dial + immersive view + document title
    tasks.js            the session task list
    sounds.js           the mixer UI and its saved blends
    journal.js          notes and saved passages
    library.js          search across the collection
    stats.js            the focus record
    settings-panel.js   preferences and data controls
tools/
  serve.mjs             zero-dependency static server (npm run serve)
  smoke-test.mjs        boots the app in jsdom and asserts 29 behaviours
  audio-test.mjs        exercises the mixer against a stub Web Audio graph
  resilience-test.mjs   boots four failure modes and checks recovery
  jsdom-env.mjs         the test harness: loopback server + DOM environment
sw.js                   offline shell (stale-while-revalidate)
generate-images.js      nightly photography curator (GitHub Action)
```

### Design decisions worth knowing

- **Everything derives from real time.** The clock owns one interval; when the minute
  changes, the reader, atmosphere and climate label are told once. The timer derives its
  remaining seconds from `endsAt`, so nothing accumulates drift.
- **State is a set of small signals.** Each store (`settings`, `tasks`, `notes`, `bookmarks`,
  `history`, `timer`) serialises to one `localStorage` key, notifies its subscribers, and
  syncs across tabs. Every value is normalised on read, so a corrupt or outdated entry can
  never break the page.
- **Nothing plays on its own.** Audio waits for a deliberate gesture and fades in and out;
  the ambience ducks slightly while focusing and breathes back on breaks.
- **The collection is local.** Quotes ship as a static `quotes.json`; the client makes no
  third-party requests for content. Photography is the only external asset.
- **Text from data is untrusted.** Passages are escaped and only the matched time phrase is
  wrapped in markup. The CSP forbids inline scripts; icons are an inline SVG sprite.

---

## 🚀 Running it locally

```bash
npm run serve      # http://localhost:8000
npm test           # 29 app + 13 mixer + 4 resilience checks, headless
```

`npm run serve` uses `tools/serve.mjs` (no dependencies, correct MIME types, 404 page). Opening
`index.html` from the filesystem also works, but a server is required for the modules, the
service worker, and the collection fetch.

### Refreshing the photography

`generate-images.js` curates photographs by season and time of day into `images.json`. It is
run nightly by `.github/workflows/refresh.yml`; locally:

```bash
UNSPLASH_ACCESS_KEY=your_key npm run curate
```

If Unsplash is unavailable the curator keeps the previous set rather than writing dead links,
and the client falls back to its quiet gradient.

---

## 🧭 Study workflow this is designed around

1. **Name the work.** Add the one thing to the task list; it becomes the session's intention.
2. **Set the room.** Choose a blend in Ambience, or leave it quiet.
3. **Start a focus round.** The timer, document title and immersive view all show what is left.
4. **Read while you think.** The clock turns its page every minute — or hold it, if the passage
   is worth sitting with.
5. **Break properly.** Breaks are part of the session, not an interruption to it.
6. **Close the day.** Jot a line in the journal; the focus record keeps the honest tally.

---

## © Credits & licences

### Literature
Passages come from the open-source [Literature Clock](https://github.com/JohannesNE/literature-clock)
collection. Copyright remains with the authors and publishers; single excerpts are displayed in
a transformative, educational context. Rights holders can use the
[takedown process](terms.html#dmca).

### Photography
Backgrounds come from the [Unsplash](https://unsplash.com) community and are credited in the
reader's footer with a link to each photographer, as the API terms require.

### Audio
All recorded loops are public domain (CC0):

| Track | Creator | Source |
| --- | --- | --- |
| Tropical rain | pablodavilla | [Freesound #503167](https://freesound.org/s/503167/) |
| Cozy fireplace | true_killian | [Freesound #760474](https://freesound.org/s/760474/) |
| Forest birds I | titi2 | [Freesound #567531](https://freesound.org/s/567531/) |
| Forest birds II | sama66 | [Freesound #462137](https://freesound.org/s/462137/) |
| Smooth jazz | amandedou | [Freesound #317673](https://freesound.org/s/317673/) |

*Night waves* and *Deep brown noise* are synthesised in the browser with the Web Audio API.

### Code
MIT. The licence covers the code only — see the [disclaimer](disclaimer.html) for the assets.

---

## 🤝 Contributing

1. Fork the repository and create a branch.
2. Make the change, then run `npm test` — both suites should stay green.
3. Open a pull request describing the behaviour change.

Found a bug, or a passage that should be removed? Open an issue.
