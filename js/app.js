/* =============================================================================
   app.js — bootstraps Minute Muse
   Owns the composition of modules, cross-module events (phase changes, sheets,
   zen mode, keyboard map) and the initial render order.
   ========================================================================== */

import { $, $$, toast, prefersReducedMotion, detectClimate } from './util.js';
import {
  settings, tasks, migrateLegacyData, timerState, exportData,
} from './store.js';
import { passages } from './quotes.js';
import { Ambience, playChime } from './audio.js';
import { SessionEngine, announcePhase } from './timer.js';
import { overlays, wireOverlay } from './ui/overlays.js';
import { Atmosphere } from './ui/backdrop.js';
import { Clock } from './ui/clock.js';
import { Reader } from './ui/reader.js';
import { TimerPanel } from './ui/timer-panel.js';
import { TaskPanel } from './ui/tasks.js';
import { SoundPanel } from './ui/sounds.js';
import { Journal } from './ui/journal.js';
import { Library } from './ui/library.js';
import { Stats } from './ui/stats.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { CollectionPanel } from './ui/collection.js';
import { ListeningRoom } from './ui/music.js';
import { DashboardLayout } from './ui/layout.js';
import { REWARDS, ensureWelcome, evaluateMarks } from './rewards.js';

const app = {};

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', boot);

async function boot() {
  migrateLegacyData();
  applyAppearance();

  /* Atmosphere & ambience are independent and can load in parallel. */
  app.atmosphere = new Atmosphere();
  app.ambience = new Ambience(settings.value.volumes, { muted: false });

  /* Timer engine is created first so panels can subscribe during init. */
  app.engine = new SessionEngine({
    getTask: (id) => tasks.value.find((task) => task.id === id) || null,
  });

  app.clock = new Clock({
    onMinute: (date) => handleMinute(date),
    onTick: ({ periodChanged }) => {
      if (periodChanged) app.atmosphere.update();
    },
  });

  app.reader = new Reader({
    onBookmarkChange: () => app.reader.syncSaveState(),
    onReflect: (passage, options) => app.journal.open({ tab: 'notes', passage, openSaved: options?.openSaved }),
    onTurn: (passage) => {
      if (!document.body) return;
      document.body.dataset.passage = passage?.key || '';
    },
  });
  app.reader.init();
  app.reader.setLoading(true);

  app.tasks = new TaskPanel({ onChange: () => handleTasksChanged() });
  app.tasks.init();

  app.timerPanel = new TimerPanel({
    engine: app.engine,
    onImmersiveChange: () => {
      // The panel owns the body class; here we only make sure the ambience
      // respects the change of scene.
      app.ambience.setMasterDuck(timerState.value.status === 'running' && timerState.value.phase === 'focus');
    },
  });
  app.timerPanel.getActiveTask = () => app.tasks.activeTask();
  app.timerPanel.init();

  app.sounds = new SoundPanel({ ambience: app.ambience });
  app.sounds.init();

  app.music = new ListeningRoom({ ambience: app.ambience });
  app.music.init();

  /* The cabinet is built after the timer: it listens to history for rewards. */
  app.cabinet = new CollectionPanel({
    overlays,
    onOpenSettings: () => app.settingsPanel.open(),
  });
  app.cabinet.init();

  app.layout = new DashboardLayout();
  app.layout.init();

  app.journal = new Journal({ overlays, reader: app.reader, engine: app.engine });
  app.journal.init();

  app.library = new Library({ overlays, reader: app.reader });
  app.library.init();

  app.stats = new Stats({ overlays });
  app.stats.init();

  app.settingsPanel = new SettingsPanel({
    overlays,
    onAppearanceChange: () => {
      applyAppearance();
      app.stats.render();
      syncSettingsToEngine();
    },
    onClimateChange: () => app.atmosphere.update({ force: true }),
  });
  app.settingsPanel.init();

  wireChrome();
  wireEvents();
  wireKeyboard();

  /* Load content, then paint. */
  const [ok] = await Promise.all([passages.load(), app.atmosphere.load()]);
  app.reader.setLoading(false);
  if (ok) {
    app.reader.renderNow({ animate: false });
  } else {
    app.reader.show(null);
    toast('The passage collection could not load — your focus tools still work.', {
      icon: 'alert',
      tone: 'warn',
      duration: 6000,
    });
  }
  app.atmosphere.update({ force: true });

  /* The cabinet is opened with a small float so day one is not empty. */
  const welcomed = ensureWelcome();
  evaluateMarks();

  const recovery = app.engine.recover();
  handleRecovery(recovery);
  if (welcomed && !recovery) {
    toast(`The cabinet is open — ${REWARDS.welcomeInk} ink and a free draw are waiting.`, {
      icon: 'cards',
      duration: 7200,
      actionLabel: 'Open',
      onAction: () => app.cabinet.open(),
    });
  }
  app.clock.start();
  app.timerPanel.render(app.engine.snapshot());
  app.stats.render();
  app.cabinet.renderAll();
  hydrateClimateLabel();
  syncSettingsToEngine();
  document.body.classList.add('is-ready');
  window.dispatchEvent(new CustomEvent('mm:ready', {
    detail: { phase: timerState.value.phase, status: timerState.value.status },
  }));
  registerServiceWorker();
}

/**
 * Explain what happened to a session that ran while the tab was closed.
 * The engine has already logged and paid it out; this is the human sentence.
 */
function handleRecovery(recovery) {
  if (!recovery) return;
  if (recovery.resumed) {
    const minutes = Math.max(1, Math.round(recovery.remaining / 60));
    toast(`Welcome back — ${minutes} min left on the clock. It kept running.`, {
      icon: 'timer',
      duration: 5200,
    });
    return;
  }
  if (recovery.recovered) {
    const record = recovery.record;
    if (!record) {
      toast('Your break finished while you were away — the next focus is ready when you are.', {
        icon: 'timer',
        duration: 5600,
      });
      window.dispatchEvent(new CustomEvent('mm:phase', {
        detail: { phase: timerState.value.phase, status: timerState.value.status },
      }));
      return;
    }
    const minutes = Math.max(0, Math.round(record.focusSec / 60));
    const reward = recovery.reward || {};
    const marks = reward.marks || [];
    const markInk = marks.reduce((total, mark) => total + (mark.reward?.ink || 0), 0);
    const markEmber = marks.reduce((total, mark) => total + (mark.reward?.ember || 0), 0);
    const bits = [];
    if (reward.ink || markInk) bits.push(`+${(reward.ink || 0) + markInk} ink`);
    if (reward.ember || markEmber) bits.push(`+${(reward.ember || 0) + markEmber} ember`);
    if (marks.length) bits.push(...marks.map((mark) => mark.name));
    const suffix = bits.length ? ` ${bits.join(' · ')}.` : '';
    toast(
      record?.phase === 'focus' && minutes
        ? `That session finished while the tab was closed — ${minutes} min logged.${suffix}`
        : 'A session finished while the tab was closed. It has been recorded.',
      { icon: 'sparkle', duration: 6800 },
    );
    window.dispatchEvent(new CustomEvent('mm:phase', {
      detail: { phase: timerState.value.phase, status: timerState.value.status },
    }));
  }
}

/** Offline support. Silent on insecure origins and in private windows. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) return;
  const register = () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* Offline support is a bonus, never a requirement. */
    });
  };
  // DOMContentLoaded normally precedes load, but boot can be delayed (or the
  // app can be re-initialised) after load has already fired.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

/* -------------------------------------------------------------------------- */
/* Chrome: overlays, dock, zen, sheets                                        */
/* -------------------------------------------------------------------------- */

function wireChrome() {
  ['library-overlay', 'stats-overlay', 'settings-overlay', 'credits-overlay', 'collection-overlay'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) wireOverlay(el);
  });

  $('#btn-library')?.addEventListener('click', () => app.library.open());
  $('#btn-stats')?.addEventListener('click', () => app.stats.open());
  $('#btn-settings')?.addEventListener('click', () => app.settingsPanel.open());
  $('#btn-credits')?.addEventListener('click', () => overlays.open($('#credits-overlay')));
  $('#btn-open-credits')?.addEventListener('click', () => {
    overlays.close($('#settings-overlay'));
    window.setTimeout(() => overlays.open($('#credits-overlay')), 160);
  });
  $('#btn-collection')?.addEventListener('click', () => app.cabinet.open());
  $('#btn-rail-open')?.addEventListener('click', () => app.cabinet.open());
  $('#btn-rail-draw')?.addEventListener('click', () => {
    app.cabinet.open();
    app.cabinet.setTab('draw');
  });
  $('#btn-zen')?.addEventListener('click', () => toggleZen());
  $('#zen-exit')?.addEventListener('click', () => toggleZen(false));
  $('#climate-badge')?.addEventListener('click', () => app.settingsPanel.open());

  /* Mobile sheets */
  $$('[data-sheet]').forEach((button) => {
    button.addEventListener('click', () => toggleSheet(button.dataset.sheet));
  });
  $$('[data-open]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.open === 'journal') app.journal.open();
    });
  });
  $('#sheet-backdrop')?.addEventListener('click', () => closeSheet());

  window.addEventListener('mm:open-sheet', (event) => {
    toggleSheet(event.detail?.sheet || 'focus', true);
  });
}

function toggleSheet(sheet, forceOpen = false) {
  if (window.matchMedia('(min-width: 1060px)').matches) return;
  const open = document.body.classList.contains('sheet-open');
  const currentSheet = document.body.dataset.sheet;
  if (open && !forceOpen && currentSheet === sheet) {
    closeSheet();
    return;
  }
  document.body.dataset.sheet = sheet;
  document.body.classList.add('sheet-open');
  $$('.dock__btn').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.sheet === sheet);
  });
}

function closeSheet() {
  document.body.classList.remove('sheet-open');
  $$('.dock__btn').forEach((button) => button.classList.remove('is-active'));
}

function toggleZen(force = null) {
  const next = typeof force === 'boolean' ? force : !document.body.classList.contains('zen');
  document.body.classList.toggle('zen', next);
  $('#btn-zen')?.setAttribute('aria-pressed', String(next));
  if (next) {
    closeSheet();
    toast('Zen reading. Z or Escape brings you back.', { icon: 'eye', duration: 3200 });
  }
}

/* -------------------------------------------------------------------------- */
/* Behaviour                                                                  */
/* -------------------------------------------------------------------------- */

function handleMinute(date) {
  if (!settings.value.autoTurn) {
    // "Turn the page every minute" is off: keep the passage, but let the reader
    // ask for the next one when they're ready.
    app.reader.pinCurrent();
    app.reader.pendingMinute(date);
  } else {
    app.reader.releasePin();
    app.reader.onMinute(date);
  }
  app.atmosphere.update();
  hydrateClimateLabel();
}

function handleTasksChanged() {
  // If the current session had no intention, adopt the first open task.
  const active = app.tasks.activeTask();
  const state = timerState.value;
  if (state.status === 'idle' && active && !state.intent) {
    timerState.set({ ...state, intent: active.text, taskId: active.id });
  }
  app.journal.renderIntention();
  app.timerPanel.render(app.engine.snapshot());
}

function wireEvents() {
  /* Phase transitions → ambience ducking, chime, notifications, stats. */
  app.engine.onEvent = (event) => {
    switch (event.type) {
      case 'complete':
        // A phase recovered after the tab was closed is announced with its
        // reward in one sentence by handleRecovery() instead.
        if (!event.silent) announcePhase(event, playChime);
        app.cabinet.notifyReward(event.reward, { quiet: event.silent });
        window.dispatchEvent(new CustomEvent('mm:phase', {
          detail: { phase: event.next, status: timerState.value.status },
        }));
        app.timerPanel.render(app.engine.snapshot());
        app.stats.render();
        app.cabinet.renderAll();
        break;
      case 'lapsed':
        window.dispatchEvent(new CustomEvent('mm:phase', {
          detail: { phase: timerState.value.phase, status: timerState.value.status },
        }));
        app.timerPanel.render(app.engine.snapshot());
        toast('That session ran past its end — it has been closed quietly.', { icon: 'clock' });
        break;
      case 'begin':
      case 'resume':
      case 'pause':
      case 'reset':
        window.dispatchEvent(new CustomEvent('mm:phase', {
          detail: { phase: timerState.value.phase, status: timerState.value.status },
        }));
        app.timerPanel.render(app.engine.snapshot());
        break;
      case 'skip':
        app.cabinet.notifyReward(event.reward);
        window.dispatchEvent(new CustomEvent('mm:phase', {
          detail: { phase: timerState.value.phase, status: timerState.value.status },
        }));
        app.timerPanel.render(app.engine.snapshot());
        app.cabinet.renderAll();
        break;
      default:
        break;
    }
  };

  /* A session beginning anywhere clears the mobile sheet so the reader is visible. */
  window.addEventListener('mm:phase', (event) => {
    if (event.detail?.status === 'running') closeSheet();
  });

  /* Settings that affect the clock need an immediate repaint. */
  let lastAutoTurn = settings.value.autoTurn;
  settings.subscribe((next) => {
    applyAppearance();
    hydrateClimateLabel();
    if (next.autoTurn !== lastAutoTurn) {
      if (next.autoTurn) {
        app.reader.releasePin();
        app.reader.renderNow({ animate: true });
      } else {
        app.reader.pinCurrent();
      }
      lastAutoTurn = next.autoTurn;
    }
    app.reader.updatePreviewFlag();
    app.clock.render();
    app.timerPanel.render(app.engine.snapshot());
  });

  window.addEventListener('mm:settings', () => app.timerPanel.render(app.engine.snapshot()));

  window.addEventListener('mm:data-erased', () => {
    // Erasing data settles any running phase and stops the engine's interval.
    app.engine.reset();
  });

  window.addEventListener('mm:data-restored', () => {
    app.tasks.render();
    app.cabinet.renderAll();
    app.journal.hydrate();
    app.journal.renderSaved();
    app.journal.renderIntention();
    app.stats.render();
    app.timerPanel.render(app.engine.snapshot());
  });

  /* Ambience should not start on its own; if the user has never gestured we
     simply leave the mixer quiet until they do. */
}

/* -------------------------------------------------------------------------- */
/* Appearance                                                                 */
/* -------------------------------------------------------------------------- */

function applyAppearance() {
  const { theme, textSize, reduceMotion, quietBackdrop } = settings.value;
  document.body.dataset.theme = theme;
  document.body.dataset.text = textSize;
  document.body.dataset.motion = reduceMotion || prefersReducedMotion() ? 'reduced' : 'full';
  document.body.classList.toggle('quiet-backdrop', quietBackdrop);

  const themeColor = theme === 'moonlight' ? '#070a11' : '#0a0b0f';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
}

function hydrateClimateLabel() {
  const el = $('#climate-label');
  if (!el) return;
  const climate = detectClimate(new Date(), settings.value.climate);
  el.textContent = climate.label;
  el.parentElement?.setAttribute(
    'title',
    climate.overridden
      ? 'Climate pinned in settings. Choose Auto-detect to follow your timezone.'
      : 'Estimated from your timezone. Change it in settings.',
  );
}

function syncSettingsToEngine() {
  app.timerPanel.render(app.engine.snapshot());
}

/* -------------------------------------------------------------------------- */
/* Keyboard                                                                   */
/* -------------------------------------------------------------------------- */

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.matches('input, textarea, select') || target.isContentEditable)
  );
}

function wireKeyboard() {
  document.addEventListener('keydown', (event) => {
    // The overlay manager has already handled this key; don't close a second
    // surface (Zen, immersive, preview) with the same Escape press.
    if (event.defaultPrevented) return;
    const typing = isTypingTarget(event.target);
    const modifier = event.metaKey || event.ctrlKey || event.altKey;

    // The overlay manager owns Escape while a dialog is open.
    if (overlays.top) return;

    if (event.key === 'Escape') {
      if (app.timerPanel.immersiveOpen) {
        event.preventDefault();
        app.timerPanel.setImmersive(false);
        return;
      }
      if (document.body.classList.contains('zen')) {
        event.preventDefault();
        toggleZen(false);
        return;
      }
      if (document.body.classList.contains('sheet-open')) {
        event.preventDefault();
        closeSheet();
        return;
      }
      if (app.reader.previewOffset !== 0 || app.reader.stayOnPassage) {
        app.reader.returnToNow();
        return;
      }
      return;
    }

    if (typing || modifier) return;

    switch (event.key.toLowerCase()) {
      case ' ':
        // Avoid hijacking Space when a control already has focus.
        if (event.target === document.body || event.target === document.documentElement) {
          event.preventDefault();
          app.engine.toggle();
        }
        break;
      case 'n':
        event.preventDefault();
        app.reader.advance();
        break;
      case 's':
        event.preventDefault();
        app.reader.toggleSave();
        break;
      case 'j':
        event.preventDefault();
        app.journal.open();
        break;
      case 'c':
        event.preventDefault();
        app.cabinet.open();
        break;
      case '/':
        event.preventDefault();
        app.library.open();
        break;
      case 'z':
        event.preventDefault();
        toggleZen();
        break;
      case 'f':
        event.preventDefault();
        app.timerPanel.setImmersive(!app.timerPanel.immersiveOpen);
        break;
      case 'm':
        event.preventDefault();
        app.sounds.toggleMute();
        break;
      case 'arrowleft':
        event.preventDefault();
        if (!overlays.top) app.reader.shiftMinute(-1);
        break;
      case 'arrowright':
        event.preventDefault();
        if (!overlays.top) app.reader.shiftMinute(1);
        break;
      default:
        break;
    }
  });

  /* Visible focus hint on first load for keyboard users only. */
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') document.body.classList.add('using-keyboard');
  }, { once: true });
}

/* -------------------------------------------------------------------------- */
/* Exports for debugging (harmless, and useful in the console)                */
/* -------------------------------------------------------------------------- */

/* A single inspector for the console and for automated smoke tests. */
app.passages = passages;
app.overlays = overlays;
app.settingsSignal = settings;
app.state = { settings, tasks };
app.tasksStore = tasks;
app.playChime = playChime;
app.store = { exportData };
// Getters, not snapshots: these modules are created during boot, after this
// module has finished evaluating (and after tests have imported it).
Object.defineProperties(app, {
  cabinetPanel: { enumerable: true, get: () => app.cabinet },
  musicRoom: { enumerable: true, get: () => app.music },
  layoutPanel: { enumerable: true, get: () => app.layout },
  soundsPanel: { enumerable: true, get: () => app.sounds },
});
window.minuteMuse = app;
