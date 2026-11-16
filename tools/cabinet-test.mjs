/* =============================================================================
   tools/cabinet-test.mjs — the cabinet, the economy, the arrangement, the room

   Boots the real app in jsdom and exercises the features added in v4:
   currencies, draws, the shelf, crafting, marks, dashboard layout, soundscape
   filtering, music link parsing and the recovery-friendly reward ledger.

   `npm run test:cabinet`
   ========================================================================== */

import { startServer, installDom, projectRootUrl, teardown } from './jsdom-env.mjs';

let failures = 0;
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    results.push(`✗ ${name} — ${error.message}`);
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'assertion failed');
};

const { server, url } = await startServer();
const { dom, window, errors } = await installDom(url);

const app = await import(new URL('js/app.js', projectRootUrl).href);
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
await new Promise((resolve) => setTimeout(resolve, 500));
await new Promise((resolve) => setTimeout(resolve, 500));

const api = window.minuteMuse;
const $ = (selector) => window.document.querySelector(selector);
const $$ = (selector) => Array.from(window.document.querySelectorAll(selector));

const store = await import(new URL('js/store.js', projectRootUrl).href);
const rewards = await import(new URL('js/rewards.js', projectRootUrl).href);
const curios = await import(new URL('js/curios.js', projectRootUrl).href);
const art = await import(new URL('js/curio-art.js', projectRootUrl).href);
const music = await import(new URL('js/music.js', projectRootUrl).href);

const resetCollection = (overrides = {}) => {
  store.collection.set({ ...store.DEFAULT_COLLECTION, ...overrides });
};

/* -------------------------------------------------------------------------- */

await check('the app boots with the cabinet, room and layout wired', () => {
  assert(api.cabinetPanel && api.musicRoom && api.layoutPanel, 'new modules are not exposed');
  const relevant = errors.filter((message) => !/Not implemented|Could not parse CSS|cssparser/i.test(message));
  assert(relevant.length === 0, relevant.slice(0, 3).join(' | '));
});

await check('a welcome float means day one is not empty', () => {
  const value = store.collection.value;
  assert(value.ink > 0, 'no welcome ink');
  assert(value.ledger.some((entry) => entry.id === 'welcome'), 'welcome grant is not recorded');
});

await check('the rail card renders a wallet, rank and streak', () => {
  const wallet = $('#rail-wallet');
  assert(wallet && wallet.textContent.includes('ink'), 'wallet missing');
  assert(wallet.textContent.includes('ember'), 'ember missing from wallet');
  assert($('#rail-rank').textContent.trim().length > 0, 'rank missing');
  assert($('#rail-streak').textContent.includes('day'), 'streak line missing');
});

await check('the catalogue is coherent', () => {
  assert(curios.SETS.length === 12, `expected 12 collections, got ${curios.SETS.length}`);
  assert(curios.CURIOS.length === 84, `expected 84 curios, got ${curios.CURIOS.length}`);
  assert(new Set(curios.CURIOS.map((curio) => curio.id)).size === 84, 'duplicate curio ids');
  for (const set of curios.SETS) {
    const items = curios.curiosOf(set.id);
    assert(items.length === 7, `${set.id} has ${items.length} pieces`);
    assert(items.filter((item) => item.rarity === 'singular').length === 1, `${set.id} needs exactly one singular`);
    assert(set.singularId, `${set.id} has no singular id`);
  }
  for (const curio of curios.CURIOS) {
    assert(curio.name && curio.epigraph && curio.source, `${curio.id} is missing prose`);
    assert(curio.source.length > 3, `${curio.id} has no provenance`);
  }
});

await check('every curio draws its own safe SVG portrait', () => {
  const seen = new Set();
  for (const curio of curios.CURIOS) {
    const svg = art.curioArt(curio);
    assert(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${curio.id} did not render`);
    assert(!/<script|onload=|onerror=/i.test(svg), `${curio.id} rendered unsafe markup`);
    assert(svg.includes('aria-label'), `${curio.id} has no accessible label`);
    seen.add(svg);
  }
  assert(seen.size === curios.CURIOS.length, 'two curios share identical art');
});

await check('the daily free draw adds a curio and is then spent', () => {
  resetCollection({ ink: 500 });
  assert(rewards.hasFreeDraw(), 'a fresh cabinet should have a free draw');
  const result = rewards.drawCards({ mode: 'free', rng: () => 0.42 });
  assert(result.cards.length === 1, 'free draw returned the wrong number of cards');
  assert(store.collection.value.owned.length === 1, 'the drawn card was not kept');
  assert(!rewards.hasFreeDraw(), 'the free draw was not consumed');
  assert(store.collection.value.daily.draw, 'the daily draw date is not stored');
  let threw = false;
  try {
    rewards.drawCards({ mode: 'free' });
  } catch {
    threw = true;
  }
  assert(threw, 'a second free draw was allowed the same day');
});

await check('paid draws spend exactly their price', () => {
  resetCollection({ ink: 1000 });
  const before = store.collection.value.ink;
  rewards.drawCards({ mode: 'single', rng: () => 0.3 });
  const afterSingle = store.collection.value.ink;
  assert(afterSingle <= before - rewards.COSTS.draw + 60, 'the ink price was not taken');
  const beforeTriple = afterSingle;
  const triple = rewards.drawCards({ mode: 'triple', rng: () => 0.5 });
  assert(triple.cards.length === 3, 'a triple draw did not return three cards');
  assert(store.collection.value.ink <= beforeTriple - rewards.COSTS.triple + 200, 'triple price was not taken');
  assert(store.collection.value.draws >= 4, 'draw count not tracked');
});

await check('the ember draw guarantees a rare', () => {
  resetCollection({ ember: 5 });
  const result = rewards.drawCards({ mode: 'ember', rng: () => 0.9 });
  assert(result.cards.length === 1, 'wrong card count');
  assert(result.cards[0].rarity === 'rare', `expected a rare, got ${result.cards[0].rarity}`);
  assert(store.collection.value.ember < 5, 'ember was not spent');
});

await check('a duplicate returns ink rather than a second copy', () => {
  // Own every drawable piece, then draw: the result must be an echo rather
  // than a second copy of the same curio.
  const owned = curios.DRAWABLE.map((curio) => ({
    id: curio.id, at: new Date().toISOString(), source: 'test', serial: 1,
  }));
  resetCollection({ ink: 1000, owned });
  const result = rewards.drawCards({ mode: 'single', rng: () => 0 });
  assert(result.cards[0].duplicate === true, 'expected a duplicate');
  assert(result.echo.ink > 0, 'a duplicate returned no ink');
  assert(store.collection.value.owned.length === owned.length, 'a duplicate was added to the cabinet');
});

await check('pity forces a rare after eight dry draws', () => {
  resetCollection({ ink: 5000, pity: rewards.REWARDS.pityAfter });
  const result = rewards.drawCards({ mode: 'single', rng: () => 0.99 });
  assert(result.cards[0].rarity === 'rare', 'pity did not produce a rare');
});

await check('a singular piece can only be assembled, never drawn', () => {
  const set = curios.SETS[0];
  const six = curios.curiosOf(set.id).filter((curio) => curio.rarity !== 'singular').map((curio) => ({
    id: curio.id, at: new Date().toISOString(), source: 'test', serial: 1,
  }));
  resetCollection({ owned: six, ember: 10 });
  assert(rewards.canCraft(set.id).ok, 'craft should be available with all six held');
  const crafted = rewards.craftSet(set.id);
  assert(crafted.curio.id === set.singularId, 'the wrong piece was assembled');
  assert(store.collection.value.owned.some((entry) => entry.id === set.singularId), 'singular not stored');
  const craftEntry = store.collection.value.ledger.find((entry) => entry.id === `craft-${set.id}`);
  assert(craftEntry && craftEntry.ember === -rewards.COSTS.craft, 'the ember cost was not recorded');
  const again = rewards.canCraft(set.id);
  assert(!again.ok, 'assembling the same singular twice was allowed');
  assert(!curios.DRAWABLE.some((curio) => curio.id === set.singularId), 'a singular leaked into the draw pool');
});

await check('the shelf offers three stable pieces and honours a purchase', () => {
  resetCollection({ ink: 1000 });
  const first = rewards.dailyShelf().map((curio) => curio.id);
  const second = rewards.dailyShelf().map((curio) => curio.id);
  assert(first.length === 3, `expected 3 shelf pieces, got ${first.length}`);
  assert(JSON.stringify(first) === JSON.stringify(second), 'the shelf changed without a change of day');
  const affordable = rewards.dailyShelf().find((curio) => curio.rarity !== 'rare');
  const bought = rewards.buyFromShelf(affordable.id);
  assert(bought.curio.id === affordable.id, 'the wrong shelf piece was bought');
  assert(store.collection.value.owned.some((entry) => entry.id === affordable.id), 'the purchase was not kept');
  assert(!rewards.dailyShelf().some((curio) => curio.id === affordable.id), 'a bought piece stayed on the shelf');
});

await check('marks pay out once and never twice', () => {
  resetCollection({ ink: 0, ember: 0 });
  const record = {
    id: 'mark-test-session',
    phase: 'focus',
    startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    endedAt: new Date().toISOString(),
    focusSec: 25 * 60,
    completed: true,
    task: null,
    intent: null,
  };
  store.history.set([record]);
  const awarded = rewards.evaluateMarks();
  assert(awarded.some((mark) => mark.id === 'first-focus'), 'the first-session mark was not awarded');
  assert(store.collection.value.marks.includes('first-focus'), 'the mark was not stored');
  const inkAfter = store.collection.value.ink;
  rewards.evaluateMarks();
  assert(store.collection.value.ink === inkAfter, 'marks were paid a second time');
});

await check('a session is paid once, even if replayed', () => {
  resetCollection({ ink: 0 });
  const record = {
    id: 'session-replay',
    phase: 'focus',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    focusSec: 25 * 60,
    completed: true,
  };
  const first = rewards.awardSession(record, { rng: () => 0.99 });
  assert(first.ink > 0, 'a completed session paid no ink');
  assert(first.spark, 'the first session of the day did not grant the daily spark');
  const ink = store.collection.value.ink;
  const ember = store.collection.value.ember;
  const second = rewards.awardSession(record, { rng: () => 0.99 });
  assert(second.duplicate, 'a replay was not recognised');
  assert(store.collection.value.ink === ink && store.collection.value.ember === ember, 'a replay paid again');
});

await check('a partial session pays for its minutes but not the bonus', () => {
  resetCollection({ ink: 0 });
  const result = rewards.awardSession({
    id: 'partial',
    phase: 'focus',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    focusSec: 12 * 60,
    completed: false,
  }, { rng: () => 0.99 });
  assert(result.ink === 12, `expected 12 ink, got ${result.ink}`);
  assert(result.ember === 0, 'a partial session granted ember');
});

await check('a full cycle grants ember exactly once', () => {
  resetCollection({ ember: 0 });
  const result = rewards.awardCycle();
  assert(result.ember === rewards.REWARDS.cycleEmber, 'cycle ember was wrong');
  assert(store.collection.value.cycles === 1, 'the cycle counter did not advance');
  rewards.awardCycle();
  assert(store.collection.value.cycles === 2, 'a second cycle should count separately');
});

await check('ranks advance with logged focus time', () => {
  const low = curios.rankFor(0);
  assert(low.name === curios.RANKS[0].name, 'rank floor is wrong');
  const mid = curios.rankFor(6 * 3600);
  assert(mid.name === 'Amanuensis', `unexpected rank ${mid.name}`);
  assert(mid.progress >= 0 && mid.progress <= 1, 'rank progress out of range');
  const top = curios.rankFor(999 * 3600);
  assert(top.name === curios.RANKS[curios.RANKS.length - 1].name, 'top rank is wrong');
  assert(top.next === null, 'the top rank should have no next rank');
});

await check('the cabinet overlay opens and every tab renders', () => {
  api.cabinetPanel.open('draw');
  assert(!$('#collection-overlay').hidden, 'the cabinet did not open');
  assert($('#cabinet-panel').textContent.trim().length > 0, 'the draw tab is empty');
  for (const tab of ['draw', 'shelf', 'sets', 'curios', 'marks']) {
    api.cabinetPanel.setTab(tab);
    assert($('#cabinet-panel').textContent.trim().length > 0, `${tab} tab is empty`);
  }
  assert($('#cabinet-panel').querySelectorAll('.mark').length === curios.MARKS.length, 'not every mark is listed');
  assert($$('.cabinet-tab').length === 5, 'tab count is wrong');
  api.overlays.close($('#collection-overlay'), { immediate: true });
});

await check('drawing through the UI updates the wallet and the panel', () => {
  resetCollection({ ink: 500 });
  api.cabinetPanel.open('draw');
  const button = $('#cabinet-panel [data-action="draw"][data-mode="single"]');
  assert(button && !button.disabled, 'the draw button is not available');
  button.click();
  assert(store.collection.value.owned.length === 1, 'a UI draw did not add a curio');
  assert($('#cabinet-panel .pull-strip'), 'the drawn card was not shown');
  assert($('#rail-wallet').textContent.includes('ink'), 'the wallet did not re-render');
  api.overlays.close($('#collection-overlay'), { immediate: true });
});

await check('layout changes persist and rearrange the rail', () => {
  const layout = api.layoutPanel;
  const before = store.settings.value.panelOrder.slice();
  layout.move(before[0], 1);
  const after = store.settings.value.panelOrder;
  assert(after[0] === before[1] && after[1] === before[0], 'the panel order did not swap');
  const railOrder = $$('#rail [data-panel]').filter((panel) => !panel.classList.contains('is-panel-hidden'))
    .map((panel) => panel.dataset.panel);
  assert(railOrder[0] === after[0], 'the DOM order does not match the preference');

  layout.toggle('sounds', false);
  assert(store.settings.value.hiddenPanels.includes('sounds'), 'hiding a panel was not stored');
  assert($('#panel-sounds').classList.contains('is-panel-hidden'), 'the panel was not hidden');
  layout.toggle('sounds', true);
  assert(!store.settings.value.hiddenPanels.includes('sounds'), 'showing the panel was not stored');

  // The timer is the one panel that cannot be switched off.
  layout.toggle('timer', false);
  assert(!store.settings.value.hiddenPanels.includes('timer'), 'the timer was allowed to hide');
  assert(!$('#panel-timer').classList.contains('is-panel-hidden'), 'the timer was hidden from the rail');

  store.patchSettings({ accent: 'heather', density: 'compact', cardStyle: 'paper', railSide: 'right' });
  assert(window.document.body.dataset.accent === 'heather', 'accent was not applied');
  assert(window.document.body.dataset.density === 'compact', 'density was not applied');
  assert(window.document.body.dataset.cards === 'paper', 'card finish was not applied');
  assert(window.document.body.dataset.rail === 'right', 'rail side was not applied');

  $('#btn-layout-reset').click();
  assert(store.settings.value.accent === 'gold' && store.settings.value.panelOrder[0] === 'timer', 'reset did not restore defaults');
});

await check('the soundscape panel filters by search and category', () => {
  const search = $('#sound-search');
  const total = $$('#sound-list .sound').length;
  assert(total >= 30, `only ${total} rows rendered`);
  search.value = 'train';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  const filtered = $$('#sound-list .sound');
  assert(filtered.length > 0 && filtered.length < total, 'search did not narrow the list');
  assert(filtered.some((row) => row.dataset.soundId === 'train'), 'searching for "train" missed the night train');
  search.value = 'zzzz';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert($$('#sound-list .sound').length === 0, 'a nonsense query should empty the list');
  search.value = '';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));

  const weather = $('#sound-cats [data-category="Weather"]');
  weather.click();
  assert($$('#sound-list .sound').length > 0, 'the weather category is empty');
  $$('#sound-list .sound').forEach((row) => {
    const meta = window.minuteMuse.sounds.visibleSounds().find((sound) => sound.id === row.dataset.soundId);
    assert(meta && meta.category === 'Weather', 'a non-weather bed slipped through the filter');
  });
  $('#sound-cats [data-category="all"]').click();
});

await check('favouriting a bed is remembered', () => {
  $('#sound-list [data-favourite="rain"]').click();
  assert((store.settings.value.soundFavourites || []).includes('rain'), 'favourite was not stored');
  api.sounds.onlyFavourites = true;
  api.sounds.renderSounds();
  assert($$('#sound-list .sound').length === 1, 'favourites filter is not working');
  api.sounds.onlyFavourites = false;
  api.sounds.renderSounds();
  $('#sound-list [data-favourite="rain"]').click();
});

await check('music links are parsed, and unsafe ones rejected', () => {
  const spotify = music.parseSpotifyLink('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc');
  assert(spotify && spotify.type === 'playlist', 'a playlist link was not parsed');
  assert(spotify.embed === 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?theme=0', 'unexpected embed url');
  const regional = music.parseSpotifyLink('https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3');
  assert(regional && regional.type === 'album', 'a regional album link was not parsed');
  const uri = music.parseSpotifyLink('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
  assert(uri && uri.type === 'track', 'a spotify: URI was not parsed');
  assert(music.parseSpotifyLink('https://open.spotify.com/track/short') === null, 'an invalid id was accepted');
  assert(music.parseSpotifyLink('https://evil.example/open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC') === null, 'a lookalike host was accepted');
  assert(music.parseSpotifyLink('javascript:alert(1)') === null, 'a javascript URL was accepted');
  assert(music.parseSpotifyLink('') === null, 'an empty link was accepted');

  const apple = music.parseAppleLink('https://music.apple.com/gb/album/late-pages/1234567890');
  assert(apple && apple.embed.startsWith('https://embed.music.apple.com/gb/album/'), 'an Apple link was not parsed');
  assert(music.parseAppleLink('http://music.apple.com/gb/album/x/1') === null, 'a plain-http link was accepted');
  assert(music.parseAppleLink('https://open.spotify.com/album/x1234567890') === null, 'Spotify was accepted as Apple');
});

await check('the listening room switches panes and refuses a bad link', () => {
  api.musicRoom.setSource('spotify');
  assert($('#music-local').hidden === true, 'the local pane stayed visible');
  assert($('#music-embed').hidden === false, 'the streaming pane did not appear');
  assert($('#music-embed-slot').children.length === 0, 'an embed loaded without a link');
  $('#music-link').value = 'https://example.com/not-music';
  $('#btn-music-embed').click();
  assert($('#music-embed-slot').children.length === 0, 'a non-music link produced an iframe');
  api.musicRoom.setSource('local');
  assert($('#music-local').hidden === false, 'the local pane did not return');
});

await check('the cabinet exports and imports with the rest of the data', async () => {
  const payload = api.store.exportData();
  assert(payload.data.collection, 'collection is missing from the export');
  assert(payload.version >= 3, 'export version did not move');
  const owned = store.collection.value.owned.map((entry) => entry.id);
  const { importData } = store;
  importData(payload);
  assert(
    JSON.stringify(store.collection.value.owned.map((entry) => entry.id)) === JSON.stringify(owned),
    'the cabinet changed across a round trip',
  );
});

await check('a hostile backup cannot smuggle curios or currencies', () => {
  const { importData } = store;
  importData({
    app: 'minute-muse',
    version: 3,
    data: {
      collection: {
        ink: 'lots',
        ember: -5,
        owned: [
          { id: 'not-a-real-curio', at: 'x', serial: 999 },
          { id: 'foxed-folio', at: 'not-a-date', serial: 'NaN' },
          { id: 'foxed-folio', at: new Date().toISOString(), serial: 2 },
        ],
        marks: ['not-a-mark', 'first-focus'],
        daily: { draw: 'yesterday', shelf: 42, spark: null },
      },
    },
  });
  const value = store.collection.value;
  assert(value.ink === 0 && value.ember === 0, 'bogus currencies survived normalisation');
  assert(value.owned.length === 1 && value.owned[0].id === 'foxed-folio', 'duplicate or unknown curios survived');
  assert(value.marks.length === 1 && value.marks[0] === 'first-focus', 'unknown marks survived');
  assert(value.daily.draw === null && value.daily.shelf === null, 'bogus daily dates survived');
  resetCollection({ ink: 200 });
});

await check('erasing data also erases the cabinet', () => {
  store.resetAllData();
  assert(window.localStorage.getItem('mm.collection') === null, 'the cabinet survived an erase');
  assert(store.collection.value.owned.length === 0, 'curios survived in memory');
  assert(store.collection.value.ink === 0, 'ink survived in memory');
});

/* -------------------------------------------------------------------------- */

console.log('\n  Minute Muse — cabinet, room & arrangement\n');
results.forEach((line) => console.log(`  ${line}`));
console.log(`\n  ${results.length - failures}/${results.length} checks passed\n`);

teardown({ server, dom });
process.exit(failures ? 1 : 0);
