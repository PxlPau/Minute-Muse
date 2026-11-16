/* =============================================================================
   ui/clock.js — the timepiece and the page-turner
   Owns the single second-hand Interval for the whole app. Everything that cares
   about "the minute has changed" subscribes here instead of starting its own
   timer.
   ========================================================================== */

import {
  $, formatClock, formatLongDate, greetingOf, minuteKey, periodOf, PERIOD_LABELS,
} from '../util.js';
import { settings } from '../store.js';

export class Clock {
  constructor({ onMinute = () => {}, onTick = () => {} } = {}) {
    this.elTime = $('#clock-time');
    this.elAmPm = $('#clock-ampm');
    this.elGreeting = $('#greeting');
    this.elPeriod = $('#period-label');
    this.elDate = $('#date-label');
    this.elTickFill = $('#tick-fill');
    this.elNextTime = $('#next-time');

    this.onMinute = onMinute;
    this.onTick = onTick;
    this.lastMinute = minuteKey();
    this.lastPeriod = periodOf();
    this.interval = null;
    this.second = null;
    this.visibilityBound = false;
  }

  start() {
    this.sync();
    if (this.interval) window.clearInterval(this.interval);
    this.interval = window.setInterval(() => this.loop(), 1000);
    // Bind once: start() may be called again by tests or a hot reload.
    if (!this.visibilityBound) {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.sync();
      });
      this.visibilityBound = true;
    }
  }

  stop() {
    window.clearInterval(this.interval);
    this.interval = null;
  }

  loop() {
    const now = new Date();
    this.sync(now);
    this.onTick({ second: now.getSeconds() });
  }

  /**
   * Render and settle transitions in one place. Background tabs are throttled
   * and may skip the tick at second zero entirely, so transitions are detected
   * on *every* tick and when the page becomes visible again — not by hoping a
   * timer fires at exactly `getSeconds() === 0`.
   */
  sync(now = new Date()) {
    this.render(now);
    const key = minuteKey(now);
    if (key !== this.lastMinute) {
      this.lastMinute = key;
      this.onMinute(now);
    }
    const period = periodOf(now);
    if (period !== this.lastPeriod) {
      this.lastPeriod = period;
      this.onTick({ periodChanged: true });
    }
  }

  render(now = new Date()) {
    const { time, suffix } = formatClock(now, settings.value.hour24);
    if (this.elTime) this.elTime.textContent = time;
    if (this.elAmPm) this.elAmPm.textContent = suffix;

    const period = periodOf(now);
    if (this.elGreeting) this.elGreeting.textContent = greetingOf(now);
    if (this.elPeriod) this.elPeriod.textContent = `${PERIOD_LABELS[period]} hour`;
    if (this.elDate) this.elDate.textContent = formatLongDate(now);

    const remaining = 60 - now.getSeconds();
    // The reader owns this label while a page is held or a preview is active.
    if (this.elNextTime && this.elNextTime.dataset.turnLabel !== 'true') {
      this.elNextTime.textContent =
        remaining === 60 ? 'Turning the page…' : `Next passage in ${remaining}s`;
    }
    if (this.elTickFill) {
      this.elTickFill.style.width = `${((60 - remaining) / 60) * 100}%`;
    }
  }
}
