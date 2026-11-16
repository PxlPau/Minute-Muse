/* =============================================================================
   timer.js — the focus session engine

   A pomodoro that behaves like a clock rather than a metronome: a running phase
   stores the wall-clock time it will end, so a refresh, a locked screen, or a
   throttled background tab can never make the countdown drift. Paused phases
   store their remaining seconds instead.

   Phases: focus → short break (or long break every Nth round) → focus …
   ========================================================================== */

import { timerState, recordSession, settings } from './store.js';
import { toast } from './util.js';
import { awardSession, awardCycle } from './rewards.js';

/**
 * How long a finished session remains believable when you come back to it.
 * The phase keeps running on the wall clock whether or not the tab is open, so
 * a session that finished a minute — or a night — ago can still be settled when
 * the page returns. Beyond this window it is closed quietly: a session that
 * ended a week ago is a fact about a closed tab, not a fact about your focus.
 */
export const AWAY_CLAIM_WINDOW = 24 * 60 * 60; // 24 hours, in seconds

export const PHASES = {
  focus: { id: 'focus', label: 'Focus', short: 'Focus', kind: 'focus' },
  short: { id: 'short', label: 'Short break', short: 'Break', kind: 'break' },
  long: { id: 'long', label: 'Long break', short: 'Long break', kind: 'break' },
};

const TICK_MS = 250;

export class SessionEngine {
  constructor({ onTick = () => {}, onEvent = () => {}, getTask = () => null } = {}) {
    this.onTick = onTick;
    this.onEvent = onEvent;
    this.getTask = getTask;
    this.raf = null;
    this.interval = null;
    this.lastSecond = null;
    this.completing = false;

    if (document.addEventListener) document.addEventListener('visibilitychange', () => this.checkDrift());
    window.addEventListener('focus', () => this.checkDrift());
  }

  /* --------------------------------------------------------------- derived */
  /** A fresh phase always uses current settings. */
  durationForPhase(phase) {
    const { focusMin, shortMin, longMin } = settings.value;
    if (phase === 'short') return shortMin * 60;
    if (phase === 'long') return longMin * 60;
    return focusMin * 60;
  }

  /**
   * Active phases keep the duration they began with; editing a duration in
   * Settings must not retroactively change the countdown, progress bar, or
   * logged focus time. Idle phases use the latest preference.
   */
  plannedSeconds(phase = timerState.value.phase) {
    const state = timerState.value;
    const frozen = Number(state.plannedSec);
    if (
      state.status !== 'idle' &&
      phase === state.phase &&
      Number.isFinite(frozen) &&
      frozen > 0
    ) {
      return frozen;
    }
    return this.durationForPhase(phase);
  }

  get isRunning() {
    return timerState.value.status === 'running';
  }

  get isActive() {
    return timerState.value.status !== 'idle';
  }

  get remaining() {
    const state = timerState.value;
    if (state.status === 'running' && state.endsAt) {
      return Math.max(0, Math.round((new Date(state.endsAt).getTime() - Date.now()) / 1000));
    }
    if (state.status === 'paused' && typeof state.remainingSec === 'number') {
      return Math.max(0, Math.round(state.remainingSec));
    }
    return this.plannedSeconds(state.phase);
  }

  /** 0 → 1 progress through the current phase. */
  get progress() {
    const planned = this.plannedSeconds();
    if (!planned) return 0;
    return Math.min(1, Math.max(0, 1 - this.remaining / planned));
  }

  /* --------------------------------------------------------------- actions */
  begin({ phase = 'focus', round = 1, intent = null, taskId = null } = {}) {
    const planned = this.durationForPhase(phase);
    timerState.set({
      phase,
      status: 'running',
      round,
      endsAt: new Date(Date.now() + planned * 1000).toISOString(),
      remainingSec: null,
      plannedSec: planned,
      startedAt: new Date().toISOString(),
      focusSec: 0,
      taskId,
      intent,
    });
    this.run();
    this.emit('begin', { phase, round });
  }

  /** Start from idle (or restart a finished phase) using current settings. */
  start({ intent = null, taskId = null } = {}) {
    const state = timerState.value;
    if (state.status === 'idle') {
      this.begin({ phase: state.phase || 'focus', round: state.round || 1, intent, taskId });
      return;
    }
    if (state.status === 'paused') {
      this.resume();
      return;
    }
  }

  resume() {
    const state = timerState.value;
    if (state.status !== 'paused') return;
    const remaining = typeof state.remainingSec === 'number' ? state.remainingSec : this.plannedSeconds();
    timerState.set({
      ...state,
      status: 'running',
      endsAt: new Date(Date.now() + remaining * 1000).toISOString(),
      remainingSec: null,
      startedAt: state.startedAt || new Date().toISOString(),
    });
    this.run();
    this.emit('resume');
  }

  pause() {
    const state = timerState.value;
    if (state.status !== 'running') return;
    const remaining = this.remaining;
    timerState.set({ ...state, status: 'paused', endsAt: null, remainingSec: remaining });
    this.stopTicking();
    this.onTick(this.snapshot());
    this.emit('pause');
  }

  toggle() {
    const state = timerState.value;
    if (state.status === 'running') this.pause();
    else if (state.status === 'paused') this.resume();
    else this.start();
  }

  /**
   * Advance manually (skip). Logs whatever focus time was genuinely earned and
   * moves to the next natural phase without pretending anything was completed.
   */
  skip() {
    const state = timerState.value;
    if (state.status === 'idle') return;
    const elapsed = Math.max(0, this.plannedSeconds() - this.remaining);
    let reward = null;
    if (state.phase === 'focus' && elapsed >= 30) {
      this.logSession({ focusSec: elapsed, completed: false, phase: 'focus' });
      reward = this.lastAward;
    }
    const next = state.phase === 'focus'
      ? this.nextAfterFocus(state.round)
      : this.nextAfterBreak(state.phase, state.round);
    timerState.set({
      ...state,
      phase: next.phase,
      round: next.round,
      status: 'idle',
      endsAt: null,
      remainingSec: null,
      plannedSec: null,
      startedAt: null,
      focusSec: 0,
      intent: next.phase === 'focus' ? null : state.intent,
      taskId: next.phase === 'focus' ? null : state.taskId,
    });
    this.stopTicking();
    this.onTick(this.snapshot());
    this.emit('skip', { phase: next.phase, reward });
  }

  reset() {
    const state = timerState.value;
    timerState.set({
      ...state,
      status: 'idle',
      endsAt: null,
      remainingSec: null,
      plannedSec: null,
      startedAt: null,
      focusSec: 0,
      phase: 'focus',
      round: state.phase === 'focus' ? state.round : Math.max(1, state.round || 1),
      intent: null,
      taskId: null,
    });
    this.stopTicking();
    this.onTick(this.snapshot());
    this.emit('reset');
  }

  /**
   * Called when a running phase reaches zero.
   * `recovered` marks a phase that finished while the page was closed: it is
   * logged and rewarded exactly once, and its break is *not* auto-started in
   * the past (nobody was here to take it).
   */
  complete({ silent = false, recovered = false } = {}) {
    if (this.completing) return null;
    this.completing = true;
    this.lastAward = null;
    const state = timerState.value;
    const planned = this.plannedSeconds();
    let nextPhase = state.phase;
    let nextRound = state.round;
    let record = null;
    let reward = null;

    if (state.phase === 'focus') {
      record = this.logSession({ focusSec: planned, completed: true, phase: 'focus', recovered });
      reward = this.lastAward;
      const next = this.nextAfterFocus(state.round);
      nextPhase = next.phase;
      nextRound = next.round;
      if (nextPhase === 'long') {
        this.cycleAward = awardCycle();
        if (this.cycleAward) reward = mergeRewards(reward, this.cycleAward);
      }
    } else {
      const next = this.nextAfterBreak(state.phase, state.round);
      nextPhase = next.phase;
      nextRound = next.round;
    }

    timerState.set({
      ...state,
      phase: nextPhase,
      round: nextRound,
      status: 'idle',
      endsAt: null,
      remainingSec: null,
      plannedSec: null,
      startedAt: null,
      focusSec: 0,
      intent: nextPhase === 'focus' ? null : state.intent,
      taskId: nextPhase === 'focus' ? null : state.taskId,
    });
    this.stopTicking();
    this.onTick(this.snapshot());
    this.emit('complete', {
      finished: state.phase,
      next: nextPhase,
      round: nextRound,
      silent,
      recovered,
      record,
      reward,
    });

    const autoStart = settings.value.autoStartBreaks && nextPhase !== 'focus' && !recovered;
    if (autoStart) this.begin({ phase: nextPhase, round: nextRound });
    this.completing = false;
    return record;
  }

  /** After a focus round: a short break, or a long one on the Nth round. */
  nextAfterFocus(round = 1) {
    const { roundsBeforeLong } = settings.value;
    const useLong = round > 0 && round % roundsBeforeLong === 0;
    return { phase: useLong ? 'long' : 'short', round };
  }

  /** After a break: back to focus, resetting the cycle on a long break. */
  nextAfterBreak(currentPhase, round = 1) {
    return { phase: 'focus', round: currentPhase === 'long' ? 1 : (round || 1) + 1 };
  }

  logSession({ focusSec, completed, phase, recovered = false }) {
    const state = timerState.value;
    let taskLabel = null;
    try {
      const task = state.taskId ? this.getTask(state.taskId) : null;
      taskLabel = task ? task.text : null;
    } catch {
      taskLabel = null;
    }
    const record = recordSession({
      phase,
      startedAt: state.startedAt,
      plannedSec: this.plannedSeconds(),
      focusSec,
      completed,
      recovered,
      task: taskLabel,
      intent: state.intent,
    });
    // Pay the session out immediately: currency, marks, and the odd curio.
    this.lastAward = awardSession(record);
    this.emit('logged', { record, reward: this.lastAward });
    return record;
  }

  /**
   * Settle the persisted session on boot.
   *
   * A session keeps running on the wall clock after the tab is closed, so a
   * phase whose end time has passed is settled here: it is logged, rewarded
   * and announced. If it ended more than AWAY_CLAIM_WINDOW ago, it is closed
   * quietly instead — we do not invent a night of focus.
   *
   * @returns {{resumed?: boolean, remaining?: number, recovered?: boolean,
   *            record?: object|null, overdue?: number, expired?: boolean}|null}
   */
  recover() {
    const state = timerState.value;
    if (state.status !== 'running' || !state.endsAt) return null;
    const overdue = (Date.now() - new Date(state.endsAt).getTime()) / 1000;
    if (overdue < 0) {
      // Still running: the countdown is already correct, but the UI wants to
      // say "welcome back" rather than pretend nothing happened.
      this.run();
      return { resumed: true, remaining: this.remaining, phase: state.phase };
    }
    if (overdue <= AWAY_CLAIM_WINDOW) {
      const record = this.complete({ recovered: true, silent: true });
      return { recovered: true, record, overdue, reward: this.lastAward };
    }
    timerState.set({
      ...state,
      status: 'idle',
      endsAt: null,
      remainingSec: null,
      plannedSec: null,
      startedAt: null,
      focusSec: 0,
      intent: null,
      taskId: null,
    });
    this.stopTicking();
    this.onTick(this.snapshot());
    this.emit('lapsed', { overdue });
    return { expired: true, overdue };
  }

  /** Nudge the engine after the tab regained focus or the machine woke up. */
  checkDrift() {
    const state = timerState.value;
    if (state.status === 'running' && this.remaining <= 0) {
      const overdue = state.endsAt
        ? (Date.now() - new Date(state.endsAt).getTime()) / 1000
        : 0;
      // A tab restored from the back/forward cache can come back days later.
      // The same claim window as a reload applies, so a forgotten tab cannot
      // invent a night of focus.
      if (overdue > AWAY_CLAIM_WINDOW) {
        timerState.set({
          ...state,
          status: 'idle',
          endsAt: null,
          remainingSec: null,
          plannedSec: null,
          startedAt: null,
          focusSec: 0,
          intent: null,
          taskId: null,
        });
        this.stopTicking();
        this.onTick(this.snapshot());
        this.emit('lapsed', { overdue });
        return;
      }
      // A phase that lapsed while the tab slept is settled like a recovery;
      // one that ended while the screen was merely locked is business as usual.
      this.complete({ recovered: overdue > 120 });
    } else {
      this.tick(true);
    }
  }

  /* --------------------------------------------------------------- ticking */
  run() {
    this.stopTicking();
    this.lastSecond = null;
    this.tick(true);
    // A light interval is plenty: values are derived from the wall clock, and
    // a throttled tab will still settle correctly when it next wakes.
    this.interval = window.setInterval(() => this.tick(), TICK_MS);
    this.raf = true;
  }

  stopTicking() {
    if (this.interval) window.clearInterval(this.interval);
    this.interval = null;
    this.raf = null;
  }

  tick(force = false) {
    const state = timerState.value;
    if (state.status !== 'running') return;
    const remaining = this.remaining;
    if (remaining <= 0) {
      this.complete();
      return;
    }
    if (force || remaining !== this.lastSecond) {
      this.lastSecond = remaining;
      this.onTick(this.snapshot());
    }
  }

  snapshot() {
    const state = timerState.value;
    const planned = this.plannedSeconds();
    return {
      phase: state.phase,
      phaseLabel: PHASES[state.phase]?.label || 'Focus',
      status: state.status,
      round: state.round,
      remaining: this.remaining,
      planned,
      progress: this.progress,
      intent: state.intent,
      taskId: state.taskId,
      isFocus: state.phase === 'focus',
    };
  }

  emit(type, detail = {}) {
    this.onEvent({ type, ...detail });
  }
}

/** Combine two award results into one, for a single celebration. */
function mergeRewards(a, b) {
  const base = a || { ink: 0, ember: 0, marks: [] };
  const extra = b || { ink: 0, ember: 0, marks: [] };
  return {
    ink: (base.ink || 0) + (extra.ink || 0),
    ember: (base.ember || 0) + (extra.ember || 0),
    marks: [...(base.marks || []), ...(extra.marks || [])],
    spark: Boolean(base.spark || extra.spark),
    duplicate: Boolean(base.duplicate && extra.duplicate),
  };
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

export function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, silent: true, tag: 'minute-muse' });
  } catch {
    /* Some browsers require a service worker; the in-app toast still shows. */
  }
}

/** Announce a phase transition through every channel the user has allowed. */
export function announcePhase(engineEvent, playChimeFn) {
  const { finished, next } = engineEvent;
  const finishedLabel = PHASES[finished]?.label || 'Session';
  const nextLabel = PHASES[next]?.label || 'Focus';
  const message =
    finished === 'focus'
      ? `Focus complete. ${nextLabel} begins when you're ready.`
      : `Break over. Ready for ${nextLabel.toLowerCase()}?`;

  toast(message, { icon: finished === 'focus' ? 'sparkle' : 'timer' });
  if (settings.value.chime) playChimeFn?.();
  if (settings.value.notify) notify(`Minute Muse · ${finishedLabel} finished`, message);
}
