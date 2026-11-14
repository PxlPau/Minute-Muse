/* =============================================================================
   ui/timer-panel.js — the focus session panel
   Renders the engine's snapshot into the rail dial and the immersive view, and
   forwards user intent (start/pause/skip/reset, presets, immersive toggle).
   ========================================================================== */

import { $, $$, formatDuration, formatSpan, toast } from '../util.js';
import { settings, patchSettings, focusSecondsToday, timerState } from '../store.js';
import { PHASES } from '../timer.js';

const ARC = 2 * Math.PI * 46;
const FOCUS_ARC = 2 * Math.PI * 48;

const PREVIEW_MINUTES = [
  { label: '5', minutes: 5 },
  { label: '15', minutes: 15 },
  { label: '25', minutes: 25 },
  { label: '45', minutes: 45 },
  { label: '50', minutes: 50 },
  { label: '90', minutes: 90 },
];

export class TimerPanel {
  constructor({ engine, onImmersiveChange = () => {} }) {
    this.engine = engine;
    this.onImmersiveChange = onImmersiveChange;

    this.root = $('#timer');
    this.elTime = $('#timer-time');
    this.elMode = $('#timer-mode');
    this.elArc = $('#timer-arc');
    this.elDots = $('#timer-dots');
    this.elRoundLabel = $('#timer-round-label');
    this.elPrimary = $('#btn-timer-primary');
    this.elPrimaryLabel = $('#timer-primary-label');
    this.elSkip = $('#btn-timer-skip');
    this.elReset = $('#btn-timer-reset');
    this.elToday = $('#timer-today');
    this.elPlan = $('#timer-plan-label');
    this.elPresets = $('#timer-presets');

    this.statusPill = $('#status-pill');
    this.statusLabel = $('#status-label');

    this.immersive = $('#focus-view');
    this.elFocusTime = $('#focus-time');
    this.elFocusMode = $('#focus-mode');
    this.elFocusArc = $('#focus-arc');
    this.elFocusIntent = $('#focus-intent');
    this.elFocusToggle = $('#btn-focus-toggle');
    this.elFocusToggleLabel = $('#focus-toggle-label');
    this.elFocusSkip = $('#btn-focus-skip');
    this.elFocusExit = $('#focus-view-exit');

    this.immersiveOpen = false;
    this.lastSnapshot = null;
  }

  init() {
    this.elPrimary?.addEventListener('click', () => this.handlePrimary());
    this.engine.onTick = (snapshot) => this.render(snapshot);
    this.elSkip?.addEventListener('click', () => this.handleSkip());
    this.elReset?.addEventListener('click', () => this.handleReset());
    this.elFocusToggle?.addEventListener('click', () => this.engine.toggle());
    this.elFocusSkip?.addEventListener('click', () => this.handleSkip());
    this.elFocusExit?.addEventListener('click', () => this.setImmersive(false));
    this.statusPill?.addEventListener('click', () => this.focusTimerPanel());

    this.buildPresets();
    this.render(this.engine.snapshot());
  }

  buildPresets() {
    if (!this.elPresets) return;
    this.elPresets.innerHTML = PREVIEW_MINUTES.map(
      ({ label, minutes }) =>
        `<button class="preset" type="button" data-minutes="${minutes}" aria-label="Set focus length to ${minutes} minutes">${label}</button>`,
    ).join('');
    this.elPresets.addEventListener('click', (event) => {
      const button = event.target.closest('[data-minutes]');
      if (!button) return;
      const minutes = Number(button.dataset.minutes);
      if (this.engine.isActive) {
        toast('Finish or reset this session before changing its length.', {
          icon: 'alert',
          tone: 'warn',
        });
        return;
      }
      patchSettings({ focusMin: minutes });
      this.engine.onTick(this.engine.snapshot());
      toast(`Focus length set to ${minutes} minutes.`, { icon: 'timer' });
    });
  }

  handlePrimary() {
    if (this.engine.isRunning) {
      this.engine.pause();
    } else if (timerState.value.status === 'paused') {
      this.engine.resume();
    } else {
      const active = this.getActiveTask?.();
      this.engine.start({
        intent: active ? active.text : this.currentIntention(),
        taskId: active ? active.id : null,
      });
    }
  }

  currentIntention() {
    const active = this.getActiveTask?.();
    return active ? active.text : null;
  }

  handleSkip() {
    const snapshot = this.engine.snapshot();
    if (snapshot.status === 'idle') {
      toast('No session running — start one when you are ready.', { icon: 'timer' });
      return;
    }
    const wasFocus = snapshot.phase === 'focus';
    this.engine.skip();
    toast(wasFocus ? 'Break time. Step away for a moment.' : 'Break skipped — back to the desk.', {
      icon: 'skip',
    });
  }

  async handleReset() {
    const snapshot = this.engine.snapshot();
    if (snapshot.status === 'idle') return;
    this.engine.reset();
    toast('Session reset.', { icon: 'reset' });
  }

  /** Bring the timer into view: scroll on desktop, raise the sheet on mobile. */
  focusTimerPanel() {
    if (window.matchMedia('(min-width: 1060px)').matches) {
      $('#rail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.dispatchEvent(new CustomEvent('mm:open-sheet', { detail: { sheet: 'focus' } }));
  }

  /* ---------------------------------------------------------------- render */
  render(snapshot) {
    if (!snapshot) return;
    this.lastSnapshot = snapshot;
    const { phase, status, remaining, progress, round, isFocus } = snapshot;

    const inSession = status !== 'idle';
    const display = status === 'idle' ? this.engine.plannedSeconds(phase) : remaining;

    if (this.elTime) this.elTime.textContent = formatDuration(display);
    if (this.elMode) {
      this.elMode.textContent = status === 'idle' ? `${PHASES[phase]?.label || 'Focus'} · ready` : status === 'paused' ? `${PHASES[phase]?.label || 'Focus'} · paused` : PHASES[phase]?.label || 'Focus';
    }
    this.root?.classList.toggle('timer--running', status === 'running');
    this.root?.classList.toggle('timer--paused', status === 'paused');
    this.root?.classList.toggle('timer--idle', status === 'idle');
    // Give the whole railway a mood so the rail can quietly react too.
    const rail = this.root?.closest('.rail');
    if (rail) rail.dataset.phaseState = status;

    if (this.elArc) {
      const offset = ARC * (status === 'idle' ? 1 : 1 - progress);
      this.elArc.style.strokeDasharray = String(ARC);
      this.elArc.style.strokeDashoffset = String(offset);
    }

    this.renderDots(round, phase);
    if (this.elRoundLabel) {
      const rounds = settings.value.roundsBeforeLong;
      this.elRoundLabel.textContent = phase === 'focus' ? `Round ${round} of ${rounds}` : 'Break';
    }

    if (this.elPrimaryLabel) {
      this.elPrimaryLabel.textContent =
        status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : isFocus ? 'Start focus' : `Start ${PHASES[phase]?.label.toLowerCase() || 'break'}`;
    }
    if (this.elPrimary) {
      const use = status === 'running' ? 'i-pause' : 'i-play';
      this.elPrimary.querySelector('use')?.setAttribute('href', `#${use}`);
    }

    if (this.elToday) this.elToday.textContent = formatSpan(focusSecondsToday());
    if (this.elPlan) {
      const { focusMin, shortMin, longMin, roundsBeforeLong } = settings.value;
      this.elPlan.textContent = `${focusMin} / ${shortMin} / ${longMin} min · long after ${roundsBeforeLong}`;
    }

    this.syncPresets();
    this.renderStatus(snapshot);
    this.renderImmersive(snapshot);
    this.syncDocumentTitle(snapshot);
  }

  renderDots(round, phase) {
    if (!this.elDots) return;
    const total = settings.value.roundsBeforeLong;
    const dots = [];
    for (let i = 1; i <= total; i += 1) {
      const done = phase !== 'focus' ? i <= round : i < round;
      const current = phase === 'focus' && i === round;
      dots.push(`<span class="dot${done ? ' is-done' : ''}${current ? ' is-current' : ''}"></span>`);
    }
    this.elDots.innerHTML = dots.join('');
  }

  syncPresets() {
    if (!this.elPresets) return;
    $$('.preset', this.elPresets).forEach((button) => {
      const active = Number(button.dataset.minutes) === settings.value.focusMin;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  renderStatus(snapshot) {
    if (!this.statusLabel || !this.statusPill) return;
    const { status, phase, remaining } = snapshot;
    const running = status === 'running';
    const paused = status === 'paused';
    this.statusPill.classList.toggle('topbar__status--paused', !running);
    if (running) {
      this.statusLabel.textContent = `${PHASES[phase]?.short || 'Focus'} · ${formatDuration(remaining)} left`;
      this.statusPill.dataset.tooltip = 'Pause or open the timer';
    } else if (paused) {
      this.statusLabel.textContent = `Paused · ${formatDuration(remaining)} left`;
      this.statusPill.dataset.tooltip = 'Resume the session';
    } else {
      this.statusLabel.textContent = 'Ready to focus';
      this.statusPill.dataset.tooltip = 'Start a focus session';
    }
  }

  /* ------------------------------------------------------------- immersive */
  setImmersive(open) {
    if (!this.immersive) return;
    const unchanged = open === this.immersiveOpen;
    // Keep the body class truthful even when the call is a no-op (e.g. opening
    // on load with a session already running).
    document.body.classList.toggle('immersive', open);
    if (unchanged) return;
    this.immersiveOpen = open;
    if (open) {
      this.immersive.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => this.immersive.classList.remove('is-closing')));
      const closeBtn = this.elFocusExit;
      closeBtn?.focus({ preventScroll: true });
    } else {
      this.immersive.classList.add('is-closing');
      setTimeout(() => {
        this.immersive.hidden = true;
        this.immersive.classList.remove('is-closing');
      }, 300);
    }
    this.onImmersiveChange(open);
    if (this.lastSnapshot) this.renderImmersive(this.lastSnapshot);
  }

  renderImmersive(snapshot) {
    const { remaining, progress, phase, status } = snapshot;
    const display = status === 'idle' ? this.engine.plannedSeconds(phase) : remaining;
    if (this.elFocusTime) this.elFocusTime.textContent = formatDuration(display);
    if (this.elFocusMode) {
      this.elFocusMode.textContent = `${PHASES[phase]?.label || 'Focus'}${status === 'paused' ? ' · paused' : ''}`;
    }
    if (this.elFocusArc) {
      const offset = FOCUS_ARC * (1 - progress);
      this.elFocusArc.style.strokeDasharray = String(FOCUS_ARC);
      this.elFocusArc.style.strokeDashoffset = String(offset);
    }
    if (this.elFocusToggleLabel) {
      this.elFocusToggleLabel.textContent =
        status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : 'Begin session';
    }
    if (this.elFocusToggle) {
      const use = this.elFocusToggle.querySelector('use');
      if (use) use.setAttribute('href', `#${status === 'running' ? 'i-pause' : 'i-play'}`);
    }
    if (this.elFocusIntent) {
      const active = this.getActiveTask?.();
      const intention = active?.text || snapshot.intent;
      this.elFocusIntent.innerHTML = intention
        ? `This session is for <strong>${escape(intention)}</strong>.`
        : 'One thing, one page, one breath at a time.';
    }
  }

  syncDocumentTitle(snapshot) {
    if (!settings.value.tabTitle) {
      document.title = 'Minute Muse — A Literary Focus Workspace';
      return;
    }
    if (snapshot.status === 'running') {
      document.title = `${formatDuration(snapshot.remaining)} · ${PHASES[snapshot.phase]?.short || 'Focus'} — Minute Muse`;
    } else if (snapshot.status === 'paused') {
      document.title = `Paused · ${formatDuration(snapshot.remaining)} — Minute Muse`;
    } else {
      document.title = 'Minute Muse — A Literary Focus Workspace';
    }
  }
}

function escape(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
