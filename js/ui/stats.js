/* =============================================================================
   ui/stats.js — the focus record
   Fourteen days of real data, a few honest summary numbers, and the recent
   session log. No vanity metrics: only time actually spent focusing counts.
   ========================================================================== */

import {
  $, dayKey, escapeHtml, formatStatMinutes, formatSpan, formatTimeOfDay, relativeDay, downloadFile,
} from '../util.js';
import {
  history, focusSecondsToday, focusStreak, focusSecondsForDay, exportData,
} from '../store.js';

export class Stats {
  constructor({ overlays }) {
    this.overlays = overlays;
    this.overlay = $('#stats-overlay');
    this.hero = $('#stats-hero');
    this.bars = $('#stats-bars');
    this.sessions = $('#stats-sessions');
    this.empty = $('#stats-empty');
    this.streak = $('#stats-streak');
  }

  init() {
    $('#btn-export-data')?.addEventListener('click', () => {
      downloadFile(`minute-muse-${dayKey()}.json`, JSON.stringify(exportData(), null, 2));
    });
    history.subscribe(() => {
      if (this.overlays.isOpen(this.overlay)) this.render();
    });
  }

  open() {
    this.render();
    this.overlays.open(this.overlay);
  }

  render() {
    const list = history.value;
    const focusSessions = list.filter((entry) => entry.phase === 'focus' && entry.focusSec > 0);
    const today = focusSecondsToday();
    const streak = focusStreak();
    const week = this.sumSeconds(this.lastDays(7));
    const completed = focusSessions.filter((entry) => entry.completed).length;
    const average = focusSessions.length
      ? focusSessions.reduce((sum, entry) => sum + entry.focusSec, 0) / focusSessions.length
      : 0;

    const todayStat = formatStatMinutes(today);
    const weekStat = formatStatMinutes(week);
    const avgStat = formatStatMinutes(average);

    this.hero.innerHTML = `
      ${this.tile('Today', todayStat.value, todayStat.unit, `${focusSessions.filter((s) => dayKey(new Date(s.endedAt)) === dayKey()).length} session(s)`)}
      ${this.tile('This week', weekStat.value, weekStat.unit, 'last 7 days')}
      ${this.tile('Typical session', avgStat.value, avgStat.unit, `${completed} completed all-time`)}
      ${this.tile('Current streak', String(streak), streak === 1 ? 'day' : 'days', streak ? 'keep it gentle' : 'start today')}
    `;

    this.renderBars();
    this.renderSessions(focusSessions);
    if (this.empty) this.empty.hidden = focusSessions.length > 0;

    if (this.streak) {
      if (streak >= 2) {
        this.streak.innerHTML = `<div class="streak-note"><svg class="icon"><use href="#i-sparkle"></use></svg><span><strong>${streak} days in a row.</strong> Steady beats intense — well held.</span></div>`;
      } else if (streak === 1) {
        this.streak.innerHTML = `<div class="streak-note"><svg class="icon"><use href="#i-leaf"></use></svg><span><strong>You focused today.</strong> That is the whole habit.</span></div>`;
      } else {
        this.streak.innerHTML = '';
      }
    }
  }

  tile(label, value, unit, sub) {
    return `
      <div class="stat-tile">
        <span class="stat-label">${label}</span>
        <p class="stat-value">${value}<small>${unit}</small></p>
        <span class="stat-sub">${sub}</span>
      </div>`;
  }

  /** Array of {key, seconds} for the last n days, oldest first. */
  lastDays(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = dayKey(date);
      days.push({ key, date, seconds: focusSecondsForDay(key) });
    }
    return days;
  }

  sumSeconds(days) {
    return days.reduce((total, day) => total + day.seconds, 0);
  }

  renderBars() {
    if (!this.bars) return;
    const days = this.lastDays(14);
    const max = Math.max(1, ...days.map((day) => day.seconds));
    const todayKey = dayKey();
    this.bars.innerHTML = days
      .map((day) => {
        const height = day.seconds ? Math.max(4, Math.round((day.seconds / max) * 100)) : 2;
        const isToday = day.key === todayKey;
        const label = day.date.toLocaleDateString([], { weekday: 'narrow' });
        const title = `${relativeDay(day.key)} · ${formatSpan(day.seconds)}`;
        return `
          <div class="bar-col${isToday ? ' is-today' : ''}" title="${title}">
            <span class="bar-track"><span class="bar${day.seconds ? '' : ' bar--empty'}" style="height:${height}%"></span></span>
            <span class="bar-label">${label}</span>
          </div>`;
      })
      .join('');
  }

  renderSessions(focusSessions) {
    if (!this.sessions) return;
    const recent = focusSessions.slice(0, 12);
    this.sessions.innerHTML = recent
      .map((entry) => {
        const minutes = Math.max(1, Math.round(entry.focusSec / 60));
        const when = `${relativeDay(dayKey(new Date(entry.endedAt)))} · ${formatTimeOfDay(entry.endedAt)}`;
        const label = entry.task ? escapeHtml(entry.task) : entry.intent ? escapeHtml(entry.intent) : 'Open focus';
        return `
          <div class="result" style="cursor:default;">
            <span class="result__quote" style="font-family:var(--font-sans);font-size:0.84rem;">${label}</span>
            <span class="result__meta">
              <span>${when}</span>
              <span>·</span>
              <span>${minutes} min</span>
              <span>·</span>
              <span style="color:${entry.completed ? 'var(--ok)' : 'var(--ink-4)'}">${entry.completed ? 'completed' : 'left early'}</span>
            </span>
          </div>`;
      })
      .join('');
  }
}
