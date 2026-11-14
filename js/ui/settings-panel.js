/* =============================================================================
   ui/settings-panel.js — preferences, data portability, and erase
   Every control reads from the settings signal on open and writes back on
   change, so the panel can never drift out of sync with reality.
   ========================================================================== */

import { $, $$, toast, confirmDialog, downloadFile, dayKey } from '../util.js';
import {
  settings, patchSettings, exportData, importData, resetAllData,
} from '../store.js';
import { ensureNotificationPermission } from '../timer.js';

export class SettingsPanel {
  constructor({ overlays, onAppearanceChange = () => {}, onClimateChange = () => {} }) {
    this.overlays = overlays;
    this.overlay = $('#settings-overlay');
    this.onAppearanceChange = onAppearanceChange;
    this.onClimateChange = onClimateChange;
  }

  init() {
    this.bindTheme();
    this.bindTextSize();
    this.bindToggle('setting-quiet', 'quietBackdrop');
    this.bindToggle('setting-motion', 'reduceMotion');
    this.bindToggle('setting-24h', 'hour24');
    this.bindToggle('setting-autoturn', 'autoTurn');
    this.bindToggle('setting-autobreak', 'autoStartBreaks');
    this.bindToggle('setting-chime', 'chime');
    this.bindToggle('setting-tabtitle', 'tabTitle');
    this.bindToggle('setting-notify', 'notify', async (checked) => {
      if (!checked) return true;
      const granted = await ensureNotificationPermission();
      if (!granted) {
        toast('Notifications were not allowed — the in-app chime still works.', { icon: 'alert', tone: 'warn' });
        return false;
      }
      return true;
    });

    $('#setting-climate')?.addEventListener('change', (event) => {
      patchSettings({ climate: event.target.value });
      this.onClimateChange();
      toast('Atmosphere updated.', { icon: 'leaf' });
    });

    ['setting-focus-min', 'setting-short-min', 'setting-long-min'].forEach((id) => {
      $(`#${id}`)?.addEventListener('change', (event) => {
        const map = { 'setting-focus-min': 'focusMin', 'setting-short-min': 'shortMin', 'setting-long-min': 'longMin' };
        const key = map[id];
        const value = Number(event.target.value);
        const limits = { focusMin: [1, 180], shortMin: [1, 60], longMin: [1, 90] }[key];
        const clamped = Math.min(limits[1], Math.max(limits[0], Math.round(value) || limits[0]));
        event.target.value = clamped;
        patchSettings({ [key]: clamped });
        window.dispatchEvent(new CustomEvent('mm:settings'));
        toast('Session lengths updated.', { icon: 'timer' });
      });
    });

    $('#btn-export-data-2')?.addEventListener('click', () => {
      downloadFile(`minute-muse-${dayKey()}.json`, JSON.stringify(exportData(), null, 2));
      toast('Backup downloaded.', { icon: 'download' });
    });

    const importInput = $('#import-file');
    $('#btn-import-data')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      const ok = await confirmDialog({
        title: 'Restore from this backup?',
        message: 'This replaces your current tasks, notes, saved passages and session history.',
        confirmLabel: 'Restore',
      });
      if (!ok) return;
      try {
        const text = await file.text();
        importData(JSON.parse(text));
        toast('Backup restored.', { icon: 'upload' });
        window.dispatchEvent(new CustomEvent('mm:data-restored'));
        this.syncFromSettings();
      } catch (error) {
        toast(error.message || 'That file could not be read.', { icon: 'alert', tone: 'warn' });
      }
    });

    $('#btn-reset-data')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Erase everything on this device?',
        message: 'Tasks, notes, saved passages, session history and all preferences will be removed. This cannot be undone.',
        confirmLabel: 'Erase all data',
        danger: true,
      });
      if (!ok) return;
      resetAllData();
      window.dispatchEvent(new CustomEvent('mm:data-restored'));
      this.syncFromSettings();
      toast('All local data erased.', { icon: 'trash' });
    });

    this.syncFromSettings();
  }

  bindTheme() {
    const group = $('#setting-theme');
    group?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button) return;
      patchSettings({ theme: button.dataset.value });
      this.syncFromSettings();
      this.onAppearanceChange();
    });
  }

  bindTextSize() {
    const group = $('#setting-text');
    group?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button) return;
      patchSettings({ textSize: button.dataset.value });
      this.syncFromSettings();
      this.onAppearanceChange();
    });
  }

  bindToggle(id, key, guard = null) {
    const input = $(`#${id}`);
    if (!input) return;
    input.addEventListener('change', async () => {
      const next = input.checked;
      if (guard) {
        const allowed = await guard(next);
        if (!allowed) {
          input.checked = !next;
          patchSettings({ [key]: !next });
          return;
        }
      }
      patchSettings({ [key]: next });
      this.onAppearanceChange();
      if (key === 'reduceMotion' || key === 'quietBackdrop') this.onClimateChange();
    });
  }

  open() {
    this.syncFromSettings();
    this.overlays.open(this.overlay);
  }

  syncFromSettings() {
    const current = settings.value;
    $$('#setting-theme [data-value]').forEach((button) => {
      const active = button.dataset.value === current.theme;
      button.setAttribute('aria-pressed', String(active));
    });
    $$('#setting-text [data-value]').forEach((button) => {
      const active = button.dataset.value === current.textSize;
      button.setAttribute('aria-pressed', String(active));
    });

    const setChecked = (id, value) => {
      const input = $(`#${id}`);
      if (input) input.checked = Boolean(value);
    };
    setChecked('setting-quiet', current.quietBackdrop);
    setChecked('setting-motion', current.reduceMotion);
    setChecked('setting-24h', current.hour24);
    setChecked('setting-autoturn', current.autoTurn);
    setChecked('setting-autobreak', current.autoStartBreaks);
    setChecked('setting-chime', current.chime);
    setChecked('setting-notify', current.notify);
    setChecked('setting-tabtitle', current.tabTitle);

    const climate = $('#setting-climate');
    if (climate) climate.value = current.climate;

    const focus = $('#setting-focus-min');
    const short = $('#setting-short-min');
    const long = $('#setting-long-min');
    if (focus) focus.value = current.focusMin;
    if (short) short.value = current.shortMin;
    if (long) long.value = current.longMin;
  }
}
