/* =============================================================================
   ui/sounds.js — the ambience mixer

   Thirty-odd beds is a lot to put in a list, so the panel gains three things:
   a search field, category chips, and favourites. The mixer behaviour is
   unchanged: layers fade in independently, volumes persist, and the last blend
   is restored only after a real gesture.
   ========================================================================== */

import { $, $$, escapeHtml, icon, toast } from '../util.js';
import { patchSettings, settings } from '../store.js';
import { CATEGORIES, SOUND_LIST, SOUND_PRESETS } from '../audio.js';

export class SoundPanel {
  constructor({ ambience }) {
    this.ambience = ambience;
    this.list = $('#sound-list');
    this.presets = $('#sound-presets');
    this.muteButton = $('#btn-mute');
    this.hint = $('#audio-hint');
    this.rainLayer = $('#rain-layer');
    this.search = $('#sound-search');
    this.cats = $('#sound-cats');
    this.favouriteButton = $('#btn-sound-favourites');
    this.count = $('#sounds-count');

    this.query = '';
    this.category = 'all';
    this.onlyFavourites = false;
  }

  init() {
    this.wireList();
    this.renderCategories();
    this.renderSounds();
    this.renderPresets();
    this.wireFilters();

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
    let restoring = false;
    const detach = () => {
      window.removeEventListener('pointerdown', restore, true);
      window.removeEventListener('keydown', restore, true);
    };
    const restore = async () => {
      if (restoring) return;
      restoring = true;
      const last = settings.value.lastMix || [];
      if (!last.length) {
        detach();
        return;
      }
      const allowed = await this.ambience.unlock();
      if (!allowed) {
        restoring = false;
        return;
      }
      detach();
      last.forEach((id) => this.ambience.start(id));
    };
    window.addEventListener('pointerdown', restore, true);
    window.addEventListener('keydown', restore, true);
  }

  /* ------------------------------------------------------------------ filters */

  wireFilters() {
    this.search?.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.renderSounds();
      this.syncState();
    });

    this.cats?.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-category]');
      if (!chip) return;
      this.category = chip.dataset.category;
      this.renderCategories();
      this.renderSounds();
      this.syncState();
    });

    this.favouriteButton?.addEventListener('click', () => {
      this.onlyFavourites = !this.onlyFavourites;
      this.favouriteButton.setAttribute('aria-pressed', String(this.onlyFavourites));
      this.renderSounds();
      this.syncState();
    });
  }

  renderCategories() {
    if (!this.cats) return;
    const all = [{ id: 'all', label: 'All' }, ...CATEGORIES.map((name) => ({ id: name, label: name }))];
    this.cats.innerHTML = all.map(
      (category) => `<button type="button" class="chip-mini${category.id === this.category ? ' is-active' : ''}"
        data-category="${escapeHtml(category.id)}" aria-pressed="${category.id === this.category}">${escapeHtml(category.label)}</button>`,
    ).join('');
  }

  visibleSounds() {
    const favourites = new Set(settings.value.soundFavourites || []);
    return SOUND_LIST.filter((sound) => {
      if (this.onlyFavourites && !favourites.has(sound.id)) return false;
      if (this.category !== 'all' && sound.category !== this.category) return false;
      if (!this.query) return true;
      const haystack = `${sound.name} ${sound.tag} ${sound.category} ${sound.blurb || ''}`.toLowerCase();
      return haystack.includes(this.query);
    });
  }

  renderSounds() {
    if (!this.list) return;
    const volumes = settings.value.volumes;
    const favourites = new Set(settings.value.soundFavourites || []);
    const sounds = this.visibleSounds();

    if (this.count) {
      const filtered = this.query || this.category !== 'all' || this.onlyFavourites;
      this.count.textContent = filtered
        ? `${sounds.length} of ${SOUND_LIST.length} beds`
        : `${SOUND_LIST.length} beds`;
    }

    if (!sounds.length) {
      this.list.innerHTML = `<p class="empty-inline">No beds match that. Try a shorter word, or clear the filter.</p>`;
      return;
    }

    let currentCategory = null;
    const rows = [];
    for (const sound of sounds) {
      if (sound.category !== currentCategory && this.category === 'all' && !this.query) {
        currentCategory = sound.category;
        rows.push(`<p class="sound-group">${escapeHtml(currentCategory)}</p>`);
      }
      const volume = Math.round((volumes[sound.id] ?? 0.3) * 100);
      const isFavourite = favourites.has(sound.id);
      rows.push(`
        <div class="sound" data-sound-id="${sound.id}" title="${escapeHtml(sound.blurb || '')}">
          <button class="sound__toggle" type="button" aria-pressed="false" aria-label="Toggle ${escapeHtml(sound.name)}">
            ${icon(sound.icon, 'icon--sm')}
          </button>
          <div class="sound__body">
            <span class="sound__name">
              <span>${escapeHtml(sound.name)}</span>
              <small data-volume-label>${volume}%</small>
            </span>
            <label class="sr-only" for="vol-${sound.id}">Volume for ${escapeHtml(sound.name)}</label>
            <input type="range" id="vol-${sound.id}" min="0" max="100" step="1" value="${volume}"
              data-volume-for="${sound.id}" style="--fill:${volume}%" />
          </div>
          <button class="sound__fav${isFavourite ? ' is-on' : ''}" type="button"
            data-favourite="${sound.id}" aria-pressed="${isFavourite}"
            aria-label="${isFavourite ? 'Remove' : 'Add'} ${escapeHtml(sound.name)} ${isFavourite ? 'from' : 'to'} favourites">
            ${icon('star', 'icon--sm')}
          </button>
        </div>`);
    }
    this.list.innerHTML = rows.join('');
    this.syncState();
  }

  /* ------------------------------------------------------------------- render */

  renderPresets() {
    if (!this.presets) return;
    this.presets.innerHTML = SOUND_PRESETS.map(
      (preset) => `<button class="chip-mini" type="button" data-preset="${preset.id}">${escapeHtml(preset.label)}</button>`,
    ).join('');
  }

  applyPreset(preset) {
    // Stop anything not in the preset, fade to the preset's levels.
    const wanted = new Set(Object.keys(preset.mix));
    [...this.ambience.channels.keys()].forEach((id) => {
      if (!wanted.has(id)) this.ambience.stop(id);
    });
    const volumes = { ...settings.value.volumes };
    const tasks = [];
    for (const [id, volume] of Object.entries(preset.mix)) {
      volumes[id] = volume;
      this.ambience.setVolume(id, volume);
      if (!this.ambience.isPlaying(id)) tasks.push(this.ambience.start(id));
      if (!(settings.value.lastMix || []).includes(id)) {
        patchSettings({ lastMix: [...new Set([...(settings.value.lastMix || []), id])] });
      }
    }
    patchSettings({ volumes });
    Promise.all(tasks).then(() => {
      this.syncControls();
      this.syncState();
      toast(`${preset.label} is playing.`, { icon: 'waves' });
    });
    // Reflect the new levels immediately, before the audio promise settles.
    this.syncControls();
    this.persistMix();
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
      this.rainLayer.classList.toggle('is-on', (playing.has('rain') || playing.has('rain-tin')) && !muted);
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
    patchSettings({
      lastMix: this.ambience.playingIds,
      ambienceOn: this.ambience.playingIds.length > 0 && !this.ambience.muted,
    });
  }

  setMuted(muted) {
    this.ambience.setMuted(muted);
    this.syncState();
  }

  /** Start a named blend from elsewhere (e.g. the start of a focus session). */
  async playPreset(id) {
    const preset = SOUND_PRESETS.find((item) => item.id === id);
    if (preset) await this.applyPreset(preset);
  }

  /* ------------------------------------------------------------------ events */

  /** One delegated click handler, installed once by init(). */
  wireList() {
    this.list?.addEventListener('click', async (event) => {
      const fav = event.target.closest('[data-favourite]');
      if (fav) {
        const id = fav.dataset.favourite;
        const current = new Set(settings.value.soundFavourites || []);
        const nowFavourite = !current.has(id);
        if (nowFavourite) current.add(id);
        else current.delete(id);
        patchSettings({ soundFavourites: [...current] });
        // Update in place so keyboard focus is not thrown away by a re-render.
        fav.classList.toggle('is-on', nowFavourite);
        fav.setAttribute('aria-pressed', String(nowFavourite));
        if (this.onlyFavourites) this.renderSounds();
        return;
      }

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

    this.list?.addEventListener('input', (event) => {
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

    this.presets?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-preset]');
      if (!button) return;
      const preset = SOUND_PRESETS.find((item) => item.id === button.dataset.preset);
      if (preset) this.applyPreset(preset);
    });
  }
}
