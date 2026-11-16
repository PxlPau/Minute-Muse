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
  a refresh, a locked screen or a throttled background tab can never make it drift.
- **A session survives a closed tab** — shut the tab mid-round and the phase keeps running on
  the wall clock. Come back before it ends and the countdown is simply where it should be.
  Come back after it ends (within a day) and the session is logged, paid out and celebrated
  once; beyond that window it is closed quietly rather than inventing a night of focus.
- **Immersive view** — a full-screen dial with the session's intention and nothing else.
- **Session intention** — the task at the top of your list becomes what the session is *for*.

**Support**

- **Session tasks** — add, tick, rename, clear. Completed items sink quietly to the bottom.
- **A catalogue of 39 soundscapes** — five field recordings (rain, fireplace, two forest
  beds, jazz) and thirty-four beds synthesised in the browser: tin-roof rain, storm at the
  window, wind over the moor, stream, tide cave, embers, crickets, dawn chorus, café murmur,
  night train, library hush, cathedral nave, vinyl crackle, tape hiss, substation hum, and
  generative music (a nocturne, a music box, slow strings, a glass harmonica). Every layer
  fades independently, has its own volume, can be searched, filtered by category and starred;
  fourteen blends are saved as presets.
- **Listening room** — a real music player for your own files. Drag audio into the panel and it
  is stored in IndexedDB on this device, with play/pause/next/previous, shuffle, repeat-one/all,
  seeking and a volume control. Or paste a Spotify or Apple Music link and the official player
  is embedded — nothing loads from those services until you do.
- **A dashboard that is yours** — seven accent colours, comfortable or compact density, glass /
  outline / paper panel finishes, the study rail on either side, three reading widths, and a
  panel list you can reorder or hide. Preferences follow you back to the same browser.
- **The Cabinet of Curios** — 84 niche collectibles in twelve themed collections (The
  Marginalists, The Orrery Club, The Lighthouse Ledger, The Paper Bestiary, Sonic Curiosities,
  The Cartographers’ Guild and more). Every portrait is generated as SVG from the curio’s own
  id, so nothing ships as an image and no two pieces look alike.
- **Two currencies, no money** — *ink* is the soft currency, earned one unit per focused minute
  plus completion bonuses. *Ember* is hard currency, granted only at milestones: the first
  finished session of a day, a completed cycle, certain marks, or occasionally found in the
  ash of a long session. Neither can be bought.
- **Motivation that stays honest** — daily free draws, ink draws, a triple draw, a guaranteed
  rare for ember, a pity counter, a rotating three-piece Antiquarian’s Shelf, and singular
  pieces that can only be assembled from the other six in a collection. 22 marks and eight
  ranks (Curious → The Long Read) track the practice rather than the performance.
- **Journal** — day-keyed notes that autosave as you type, plus your saved passages.
- **Focus record** — today, this week, typical session, streak, fourteen days of bars, and a
  log of recent sessions. Only time actually spent counts.
- **Zen mode** — the room recedes to just the clock and the page.
- **Offline** — a service worker keeps the shell and collection available when the network
  is not.

**Preferences** — Lamplight or Moonlight palette, an accent of your own, three reading sizes,
comfortable or compact density, three panel finishes, rail side and reading width, panel
order and visibility, 24-hour clock, quiet backdrop, reduced motion, climate override, session
lengths, chimes, notifications and reward notices. Everything — including your cabinet — is
exportable and erasable from Settings.

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
| `C` | Open the cabinet of curios |
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
  soundscapes.js        39-bed catalogue and the four synthesis engines that build them
  music.js              local music library (IndexedDB) + transport + Spotify/Apple link parsing
  curios.js             the 84-curio catalogue, 22 marks and eight ranks
  curio-art.js          deterministic SVG portraits generated from each curio's id
  rewards.js            ink, ember, draws, crafting, the shelf and mark evaluation
  util.js               formatting, storage signals, toasts, confirm dialogs
  ui/
    overlays.js         one owner for open/close, focus trap, Escape, scroll lock
    backdrop.js         two-layer crossfade for photography, with credits
    clock.js            the single second-hand interval the whole app listens to
    reader.js           the page-turner: passages, preview, save, copy, reflect
    timer-panel.js      timer dial + immersive view + document title
    tasks.js            the session task list
    sounds.js           the mixer: search, categories, favourites, saved blends
    music.js            the listening room: local transport and streaming embeds
    collection.js       the cabinet overlay, rail wallet and reward announcements
    layout.js           dashboard arrangement: accent, density, panels, rail side
    journal.js          notes and saved passages
    library.js          search across the collection
    stats.js            the focus record
    settings-panel.js   preferences and data controls
tools/
  serve.mjs             zero-dependency static server (npm run serve)
  smoke-test.mjs        boots the app in jsdom and asserts core behaviours
  static-test.mjs       checks scripts, offline assets, and the quote collection
  audio-test.mjs        exercises the mixer against a stub Web Audio graph
  resilience-test.mjs   boots five failure modes and checks recovery
  cabinet-test.mjs      economy, draws, crafting, marks, layout, music links and sanitisation
  curator-test.mjs      checks the image curator's missing-key and outage paths
  time-of-day-test.mjs  reruns the suite at the minutes that used to flake
  assertions.mjs        shared "did a passage really render" helpers
  jsdom-env.mjs         the test harness: loopback server + DOM environment
sw.js                   offline shell (stale-while-revalidate)
generate-images.js      six-hour photography curator (GitHub Action)
```

### Design decisions worth knowing

- **Everything derives from real time.** The clock owns one interval; when the minute
  changes, the reader, atmosphere and climate label are told once. The timer derives its
  remaining seconds from `endsAt`, so nothing accumulates drift.
- **State is a set of small signals.** Each store (`settings`, `tasks`, `notes`, `bookmarks`,
  `history`, `timer`, `collection`) serialises to one `localStorage` key, notifies its
  subscribers, and syncs across tabs. Every value is normalised on read, so a corrupt or
  outdated entry can never break the page.
- **Awards are a ledger, not a side effect.** Every currency payment is written into
  `mm.collection` under the session's id, so a session recovered from a closed tab is paid
  exactly once — even if the recovery runs twice, or the page is reloaded mid-settlement.
- **Collectibles cost nothing to ship.** There are no card images: each portrait is SVG
  generated from a hash of the curio's id, so the cabinet is ~40 kB of code and prose instead
  of hundreds of megabytes of art — and it works offline.
- **Nothing plays on its own.** Audio waits for a deliberate gesture and fades in and out;
  the ambience ducks slightly while focusing and breathes back on breaks.
- **The collection is local.** Quotes ship as a static `quotes.json`; the client makes no
  third-party requests for content. Photography is the only external asset.
- **Text from data is untrusted.** Passages are escaped and only the matched time phrase is
  wrapped in markup. The CSP forbids inline scripts; icons are an inline SVG sprite.

---

## 🚀 Running it locally

```bash
npm run serve        # http://localhost:8000
npm test             # app + mixer + resilience + curator + cabinet + static suites, headless
npm run test:minutes # the app suite again, pinned to 10 awkward minutes
npm run test:static  # scripts, offline assets, and the quote collection
npm run test:all     # test + the time-of-day matrix
```

`npm run serve` uses `tools/serve.mjs` (no dependencies, correct MIME types, 404 page). A server
is required: native ES modules, the service worker, and the collection fetch do not work
reliably from `file://`.

### Refreshing the photography

`generate-images.js` curates photographs by season and time of day into `images.json`. It is
run every six hours by `.github/workflows/refresh.yml`; the scheduled job needs an
`UNSPLASH_ACCESS_KEY` Actions secret in the repository settings. Locally:

```bash
UNSPLASH_ACCESS_KEY=your_key npm run curate
```

The scheduled job skips cleanly when the secret is not configured. If Unsplash is unavailable,
the curator keeps the previous set rather than writing dead links, and the client falls back
to its quiet gradient.

---

## 🧭 Study workflow this is designed around

1. **Name the work.** Add the one thing to the task list; it becomes the session's intention.
2. **Set the room.** Choose a blend in Ambience, or leave it quiet.
3. **Start a focus round.** The timer, document title and immersive view all show what is left.
   Close the tab if you like — it keeps running.
4. **Read while you think.** The clock turns its page every minute — or hold it, if the passage
   is worth sitting with. Add a soundscape, or put a record on.
5. **Break properly.** Breaks are part of the session, not an interruption to it. The ink you
   earned is waiting in the cabinet; the daily draw costs nothing.
6. **Close the day.** Jot a line in the journal; the focus record and the cabinet keep the
   honest tally.

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

Every other soundscape — including *Night waves*, *Deep brown noise*, *Rain on a tin roof*,
*Nocturne for one lamp* and *Glass harmonica* — is synthesised in the browser from a short
recipe. Nothing is sampled, so nothing needs a licence.

### Code
Code is [MIT licensed](LICENSE). The licence covers the code only — see the
[disclaimer](disclaimer.html) for the assets.

---

## 🤝 Contributing

1. Fork the repository and create a branch.
2. Make the change, then run `npm test` — every suite should stay green.
3. Open a pull request describing the behaviour change.

Found a bug, or a passage that should be removed? Open an issue.
