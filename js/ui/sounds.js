/* =============================================================================
   ui/sounds.js — ambience panel
   Renders the mixer, remembers the last blend, and nudges the user gently when
   a browser blocks audio until the first gesture.
   ========================================================================== */

import { $, $$, icon, toast } from '../util.js';
import { settings, patchSettings } from '../store.js';
import { SOUND_LIST, SOUND_PRESETS } from '../audio.js';

export class SoundPanel {
  constructor({ ambience }) {
    this.ambience = ambience;
    this.list = $('#sound-list');
    this.presets = $('#sound-presets');
    this.muteButton = $('#btn-mute');
    this.hint = $('#audio-hint');
    this.rainLayer = $('#rain-layer');
  }

  init() {
    this.renderSounds();
    this.renderPresets();

    this.ambience.onStateChange = () => this.syncState();
    this.muteButton?.addEventListener('click', () => this.toggleMute());

    // Slight duck while focusing, breathe back during breaks.
    const applyDuck = (detail = {}) => {
      const ducked = detail.phase === 'focus' && detail.status === 'running';
      this.ambience.setMasterDuck(ducked);
    };
    window.addEventListener('mm:phase', (event) => applyDuck(event.detail));
    // A session restored from storage started before this listener existed.
    window.addEventListener('mm:ready', (event) => applyDuck(event.detail));

    // Restore the previous blend only after a real gesture, never on load —
    // and only when the last gesture was a deliberate choice, not a stray tap
    // that happened to lift an audio restriction.
    const restore = async () => {
      const last = settings.value.lastMix || [];
      window.removeEventListener('pointerdown', restore, true);
      window.removeEventListener('keydown', restore, true);
      if (!last.length) return;
      const allowed = await this.ambience.unlock();
      if (!allowed) return;
      last.forEach((id) => this.ambience.start(id));
    };
    window.addEventListener('pointerdown', restore, true);
    window.addEventListener('keydown', restore, true);
  }

  renderSounds() {
    if (!this.list) return;
    const volumes = settings.value.volumes;
    this.list.innerHTML = SOUND_LIST.map((sound) => {
      const volume = Math.round((volumes[sound.id] ?? 0.3) * 100);
      return `
        <div class="sound" data-sound-id="${sound.id}">
          <button class="sound__toggle" type="button" aria-pressed="false" aria-label="Toggle ${sound.name}">
            ${icon(sound.icon, 'icon--sm')}
          </button>
          <div class="sound__body">
            <span class="sound__name">
              <span>${sound.name}</span>
              <small data-volume-label>${volume}%</small>
            </span>
            <label class="sr-only" for="vol-${sound.id}">Volume for ${sound.name}</label>
            <input type="range" id="vol-${sound.id}" min="0" max="100" step="1" value="${volume}"
              data-volume-for="${sound.id}" style="--fill:${volume}%" />
          </div>
          <span class="field-hint" title="${sound.credit}" style="font-size:0.62rem;max-width:52px;text-align:right;overflow:hidden;">${sound.tag}</span>
        </div>`;
    }).join('');

    this.list.addEventListener('click', async (event) => {
      const toggle = event.target.closest('.sound__toggle');
      if (!toggle) return;
      const row = toggle.closest('[data-sound-id]');
      const id = row?.dataset.soundId;
      if (!id) return;

      const wasPlaying = this.ambience.isPlaying(id);
      const playing = await this.ambience.toggle(id);
      // Keep the last mix meaningful: the layer the user just switched off.
      if (wasPlaying) {
        patchSettings({ lastMix: settings.value.lastMix.filter((entry) => entry !== id) });
      } else if (playing) {
        patchSettings({ lastMix: [...new Set([...settings.value.lastMix, id])] });
      }
      this.syncState();
      if (playing && this.hint) {
        this.hint.textContent = 'Blend layers freely — each fades in on its own.';
      }
    });

    this.list.addEventListener('input', (event) => {
      const input = event.target.closest('[data-volume-for]');
      if (!input) return;
      const id = input.dataset.volumeFor;
      const value = Number(input.value);
      input.style.setProperty('--fill', `${value}%`);
      const row = input.closest('.sound');
      const label = row?.querySelector('[data-volume-label]');
      if (label) label.textContent = `${value}%`;
      this.ambience.setVolume(id, value / 100);
      const volumes = { ...settings.value.volumes, [id]: value / 100 };
      patchSettings({ volumes });
    });

    this.syncState();
  }

  renderPresets() {
    if (!this.presets) return;
    this.presets.innerHTML = SOUND_PRESETS.map(
      (preset) => `<button class="chip-mini" type="button" data-preset="${preset.id}">${preset.label}</button>`,
    ).join('');
    this.presets.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-preset]');
      if (!button) return;
      const preset = SOUND_PRESETS.find((item) => item.id === button.dataset.preset);
      if (!preset) return;
      await this.applyPreset(preset);
    });
  }

  async applyPreset(preset) {
    // Stop anything not in the preset, fade to the preset's levels.
    const wanted = new Set(Object.keys(preset.mix));
    [...this.ambience.channels.keys()].forEach((id) => {
      if (!wanted.has(id)) this.ambience.stop(id);
    });
    const volumes = { ...settings.value.volumes };
    for (const [id, volume] of Object.entries(preset.mix)) {
      volumes[id] = volume;
      this.ambience.setVolume(id, volume);
      if (!this.ambience.isPlaying(id)) await this.ambience.start(id);
      if (!(settings.value.lastMix || []).includes(id)) {
        patchSettings({ lastMix: [...new Set([...(settings.value.lastMix || []), id])] });
      }
    }
    patchSettings({ volumes });
    this.syncControls();
    this.persistMix();
    toast(`${preset.label} is playing.`, { icon: 'waves' });
  }

  syncControls() {
    const volumes = settings.value.volumes;
    $$('[data-volume-for]', this.list).forEach((input) => {
      const value = Math.round((volumes[input.dataset.volumeFor] ?? 0.3) * 100);
      input.value = String(value);
      input.style.setProperty('--fill', `${value}%`);
      const label = input.closest('.sound')?.querySelector('[data-volume-label]');
      if (label) label.textContent = `${value}%`;
    });
  }

  syncState() {
    const playing = new Set(this.ambience.playingIds);
    $$('.sound', this.list).forEach((row) => {
      const id = row.dataset.soundId;
      const on = playing.has(id);
      row.classList.toggle('is-on', on);
      row.classList.toggle('is-off', !on);
      row.querySelector('.sound__toggle')?.setAttribute('aria-pressed', String(on));
    });

    const muted = this.ambience.muted;
    if (this.muteButton) {
      this.muteButton.setAttribute('aria-pressed', String(muted));
      this.muteButton.setAttribute('aria-label', muted ? 'Unmute ambience' : 'Mute all ambience');
      const use = this.muteButton.querySelector('use');
      if (use) use.setAttribute('href', muted ? '#i-volume-off' : '#i-volume');
    }
    if (this.rainLayer) {
      this.rainLayer.classList.toggle('is-on', playing.has('rain') && !muted);
    }
    patchSettings({ ambienceOn: playing.size > 0 && !muted, lastMix: [...playing] });
  }

  toggleMute() {
    this.ambience.setMuted(!this.ambience.muted);
    if (!this.ambience.muted && !this.ambience.playingIds.length) {
      toast('Ambience unmuted.', { icon: 'volume' });
    }
    this.syncState();
  }

  persistMix() {
    patchSettings({ lastMix: this.ambience.playingIds, ambienceOn: this.ambience.playingIds.length > 0 });
  }

  /** Keyboard: mute toggled via the engine's API from elsewhere. */
  setMuted(muted) {
    this.ambience.setMuted(muted);
    this.syncState();
  }

  /** Start a named blend from elsewhere (e.g. the start of a focus session). */
  async playPreset(id) {
    const preset = SOUND_PRESETS.find((item) => item.id === id);
    if (preset) await this.applyPreset(preset);
  }
}
