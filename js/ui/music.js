/* =============================================================================
   ui/music.js — the listening room

   Local files get a proper transport; streaming links get the official embed.
   The panel is deliberately compact in the rail and expands into the mobile
   sheet like every other tool.
   ========================================================================== */

import { $, $$, escapeHtml, formatDuration, icon, toast } from '../util.js';
import { patchSettings, settings } from '../store.js';
import {
  MusicLibrary, isAudioFile, parseMusicLink, searchLink,
} from '../music.js';

const SERVICE_LABEL = { local: 'Local', spotify: 'Spotify', apple: 'Apple Music' };

export class ListeningRoom {
  constructor({ ambience }) {
    this.ambience = ambience;
    this.library = new MusicLibrary({ volume: settings.value.musicVolume });

    this.root = $('#panel-music');
    this.sourceGroup = $('#music-source');
    this.localPane = $('#music-local');
    this.embedPane = $('#music-embed');
    this.nowTitle = $('#music-now');
    this.nowSub = $('#music-sub');
    this.meta = $('#music-meta');
    this.progress = $('#music-progress');
    this.progressFill = $('#music-progress-fill');
    this.playButton = $('#btn-music-play');
    this.prevButton = $('#btn-music-prev');
    this.nextButton = $('#btn-music-next');
    this.shuffleButton = $('#btn-music-shuffle');
    this.repeatButton = $('#btn-music-repeat');
    this.volumeInput = $('#music-volume');
    this.fileInput = $('#music-file');
    this.addButton = $('#btn-music-add');
    this.dropZone = $('#music-drop');
    this.list = $('#music-list');
    this.hint = $('#music-hint');
    this.linkInput = $('#music-link');
    this.linkButton = $('#btn-music-embed');
    this.embedSlot = $('#music-embed-slot');
    this.embedHint = $('#music-embed-hint');
    this.embedService = $('#music-embed-service');
    this.quick = $('#music-quick');

    this.source = settings.value.musicSource || 'local';
    this.embedLoaded = false;
    this.lastTime = 0;
  }

  async init() {
    this.bindSource();
    this.bindLocal();
    this.bindEmbed();
    this.renderSource();
    this.renderQuickLinks();
    this.syncState();

    this.library.onStateChange = (state) => this.syncState(state);
    this.library.onTime = ({ time, duration }) => this.syncTime(time, duration);
    this.applyDuck(false);

    // Preferences can also change from an import or another tab, not just from
    // this panel's controls.
    let lastVolume = settings.value.musicVolume;
    let lastSource = this.source;
    settings.subscribe((value) => {
      this.applyDuck(this.library.playing);
      if (Math.abs(Number(value.musicVolume) - lastVolume) > 0.001) {
        lastVolume = Number(value.musicVolume);
        this.library.setVolume(lastVolume);
        if (this.volumeInput) {
          const percent = Math.round(lastVolume * 100);
          this.volumeInput.value = String(percent);
          this.volumeInput.style.setProperty('--fill', `${percent}%`);
        }
      }
      if (value.musicSource !== lastSource) {
        lastSource = value.musicSource;
        this.source = value.musicSource;
        this.renderSource();
        this.renderQuickLinks();
      }
    });

    const report = await this.library.init();
    if (!report.persistent) {
      this.hint.textContent = 'This browser will not keep imported files — they last until you close the tab.';
    } else if (!this.library.tracks.length) {
      this.hint.textContent = 'Files are kept in this browser, on this device. Nothing is uploaded.';
    }
    this.renderList();
    this.syncState();
  }

  /* ------------------------------------------------------------------- source */

  bindSource() {
    this.sourceGroup?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-source]');
      if (!button) return;
      this.setSource(button.dataset.source);
    });
  }

  setSource(source) {
    if (!SERVICE_LABEL[source]) return;
    this.source = source;
    patchSettings({ musicSource: source });
    this.renderSource();
    this.renderQuickLinks();
    if (source !== 'local') this.showStoredEmbed();
  }

  renderSource() {
    $$('[data-source]', this.sourceGroup).forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.source === this.source));
    });
    if (this.localPane) this.localPane.hidden = this.source !== 'local';
    if (this.embedPane) this.embedPane.hidden = this.source === 'local';
    if (this.meta) this.meta.textContent = SERVICE_LABEL[this.source];
    if (this.embedService) this.embedService.textContent = SERVICE_LABEL[this.source] || 'Spotify';
    if (this.linkInput) {
      this.linkInput.placeholder = this.source === 'apple'
        ? 'https://music.apple.com/album/…'
        : 'https://open.spotify.com/playlist/…';
    }
  }

  /* -------------------------------------------------------------------- local */

  bindLocal() {
    this.addButton?.addEventListener('click', () => this.fileInput?.click());
    this.fileInput?.addEventListener('change', async () => {
      const files = this.fileInput.files;
      this.fileInput.value = '';
      if (files?.length) await this.importFiles(files);
    });

    // Drag and drop: the whole panel is a target, but only audio is accepted.
    const stop = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    ['dragenter', 'dragover'].forEach((type) => {
      this.root?.addEventListener(type, (event) => {
        if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
        stop(event);
        this.dropZone?.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach((type) => {
      this.root?.addEventListener(type, (event) => {
        if (type === 'dragleave' && event.relatedTarget && this.root.contains(event.relatedTarget)) return;
        this.dropZone?.classList.remove('is-over');
        if (type === 'dragleave') return;
        stop(event);
        const files = event.dataTransfer?.files;
        if (files?.length) this.importFiles(files);
      });
    });

    this.playButton?.addEventListener('click', () => this.library.toggle());
    this.nextButton?.addEventListener('click', () => this.library.next());
    this.prevButton?.addEventListener('click', () => this.library.prev());
    this.shuffleButton?.addEventListener('click', () => this.library.toggleShuffle());
    this.repeatButton?.addEventListener('click', () => this.library.cycleRepeat());

    this.progress?.addEventListener('click', (event) => {
      const rect = this.progress.getBoundingClientRect();
      if (!rect.width) return;
      this.library.seek((event.clientX - rect.left) / rect.width);
    });

    this.volumeInput?.addEventListener('input', (event) => {
      const value = Number(event.target.value) / 100;
      this.library.setVolume(value);
      patchSettings({ musicVolume: value });
      this.volumeInput.style.setProperty('--fill', `${Math.round(value * 100)}%`);
    });
    if (this.volumeInput) {
      const volume = Math.round(this.library.volume * 100);
      this.volumeInput.value = String(volume);
      this.volumeInput.style.setProperty('--fill', `${volume}%`);
    }

    this.list?.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        this.library.remove(remove.dataset.remove);
        this.renderList();
        return;
      }
      const play = event.target.closest('[data-play]');
      if (play) this.library.playTrack(play.dataset.play);
    });
  }

  async importFiles(files) {
    const audio = Array.from(files).filter(isAudioFile);
    if (!audio.length) {
      toast('Those files are not audio.', { icon: 'alert', tone: 'warn' });
      return;
    }
    const report = await this.library.addFiles(audio);
    this.renderList();
    if (report.added) {
      const skipped = report.skipped.length ? ` ${report.skipped.length} skipped.` : '';
      toast(`${report.added} track${report.added === 1 ? '' : 's'} added.${skipped}`, { icon: 'music' });
    }
    if (!report.persistent) {
      this.hint.textContent = 'Storage refused these files — they will play only for this session.';
    }
    if (report.added === 1 && this.library.tracks.length === 1) {
      this.library.playTrack(this.library.tracks[0].id);
    }
  }

  renderList() {
    if (!this.list) return;
    const tracks = this.library.tracks;
    if (!tracks.length) {
      this.list.innerHTML = `<li class="music-list__empty">No records on the shelf yet.</li>`;
      return;
    }
    const current = this.library.currentId;
    this.list.innerHTML = tracks.map((track) => `
      <li class="music-row${track.id === current ? ' is-current' : ''}">
        <button class="music-row__play" type="button" data-play="${track.id}"
          aria-label="Play ${escapeHtml(track.title)}">
          ${icon(track.id === current && this.library.playing ? 'pause' : 'play', 'icon--sm')}
        </button>
        <span class="music-row__title">${escapeHtml(track.title)}</span>
        <span class="music-row__meta">${track.size ? `${Math.max(1, Math.round(track.size / 1024 / 1024))} MB` : ''}</span>
        <button class="music-row__remove" type="button" data-remove="${track.id}"
          aria-label="Remove ${escapeHtml(track.title)}">${icon('x', 'icon--sm')}</button>
      </li>`).join('');
  }

  syncTime(time, duration) {
    this.lastTime = time;
    const ratio = duration > 0 ? Math.min(1, time / duration) : 0;
    if (this.progressFill) this.progressFill.style.width = `${Math.round(ratio * 100)}%`;
    if (this.progress) {
      this.progress.dataset.tooltip = `${formatDuration(time, { padded: false })} / ${formatDuration(duration, { padded: false })}`;
    }
  }

  syncState(state = null) {
    if (state?.error) toast(state.error, { icon: 'alert', tone: 'warn', duration: 5600 });
    const current = state?.current ?? this.library.current;
    const playing = state?.playing ?? this.library.playing;
    if (this.nowTitle) this.nowTitle.textContent = current ? current.title : 'Nothing playing';
    if (this.nowSub) {
      this.nowSub.textContent = current
        ? playing ? 'Playing from your shelf' : 'Paused'
        : this.library.tracks.length ? 'Choose a record below' : 'Import a few files to begin';
    }
    if (this.playButton) {
      this.playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      this.playButton.setAttribute('aria-pressed', String(playing));
      const use = this.playButton.querySelector('use');
      if (use) use.setAttribute('href', `#${playing ? 'i-pause' : 'i-play'}`);
    }
    if (this.shuffleButton) this.shuffleButton.setAttribute('aria-pressed', String(this.library.shuffle));
    if (this.repeatButton) {
      const mode = this.library.repeat;
      this.repeatButton.setAttribute('aria-pressed', String(mode !== 'off'));
      this.repeatButton.dataset.mode = mode;
      this.repeatButton.setAttribute('aria-label', `Repeat: ${mode}`);
      const badge = this.repeatButton.querySelector('[data-repeat-mode]');
      if (badge) badge.textContent = mode === 'one' ? '1' : '';
    }
    this.renderList();
    this.applyDuck(Boolean(playing));
  }

  /** Step the ambience back while a record plays. */
  applyDuck(playing) {
    if (!settings.value.duckAmbienceForMusic) {
      this.ambience.setMusicDuck(false);
      return;
    }
    this.ambience.setMusicDuck(playing);
  }

  /* -------------------------------------------------------------------- embed */

  bindEmbed() {
    this.linkButton?.addEventListener('click', () => this.loadLink());
    this.linkInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.loadLink();
      }
    });
    this.quick?.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[data-search]');
      if (!anchor) return;
      // Opening a new tab from here is a normal link; nothing is fetched by us.
      anchor.setAttribute('rel', 'noopener noreferrer');
    });
  }

  showStoredEmbed() {
    const stored = this.source === 'apple' ? settings.value.appleUrl : settings.value.spotifyUrl;
    if (stored) this.mountEmbed(stored, { silent: true });
  }

  loadLink() {
    const raw = this.linkInput?.value || '';
    const parsed = parseMusicLink(raw, this.source);
    if (!parsed) {
      toast(
        this.source === 'apple'
          ? 'That does not look like an Apple Music album, song or playlist link.'
          : 'That does not look like a Spotify link. Try Share → Copy link in the app.',
        { icon: 'alert', tone: 'warn' },
      );
      return;
    }
    this.mountEmbed(raw, { parsed });
    patchSettings(this.source === 'apple' ? { appleUrl: raw } : { spotifyUrl: raw });
    this.lastParsed = parsed;
  }

  mountEmbed(raw, { parsed = null, silent = false } = {}) {
    const link = parsed || parseMusicLink(raw, this.source);
    if (!link || !this.embedSlot) return;
    this.lastParsed = link;
    // A fresh iframe each time: swapping src on a live player can leave the old
    // track playing inside a panel the user thinks they have replaced.
    this.embedSlot.innerHTML = `
      <iframe
        title="${escapeHtml(`${SERVICE_LABEL[this.source]} ${link.label} player`)}"
        src="${link.embed}"
        width="100%"
        height="352"
        frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
      <p class="field-hint">
        ${escapeHtml(SERVICE_LABEL[this.source])} · ${escapeHtml(link.label)}
        <a href="${link.url}" target="_blank" rel="noopener noreferrer">open in ${escapeHtml(SERVICE_LABEL[this.source])}</a>
      </p>`;
    this.embedLoaded = true;
    if (!silent) toast(`${SERVICE_LABEL[this.source]} player loaded.`, { icon: 'music' });
  }

  renderQuickLinks() {
    if (!this.quick) return;
    const moods = [
      { label: 'Deep focus', query: 'deep focus' },
      { label: 'Late night', query: 'late night ambient' },
      { label: 'Rainy piano', query: 'rain piano' },
      { label: 'Bookshop jazz', query: 'jazz bookshop' },
    ];
    this.quick.innerHTML = moods
      .map((mood) => `<a class="chip-mini" data-search href="${searchLink(this.source, mood.query)}"
        target="_blank" rel="noopener noreferrer">${icon('external', 'icon--sm')} ${mood.label}</a>`)
      .join('');
  }
}
