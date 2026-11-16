/* =============================================================================
   music.js — the listening room

   Two kinds of music, deliberately kept apart from the ambience mixer:

   · LOCAL FILES. Bring your own records. Files are kept in IndexedDB on this
     device and played through a real transport (play/pause/next/prev, shuffle,
     repeat, seek). Nothing is uploaded anywhere.

   · STREAMING LINKS. Paste a Spotify or Apple Music link and the official
     embedded player appears in the room. No account is connected, no token is
     requested, nothing loads until a link is pasted.

   Both paths degrade honestly: if IndexedDB is unavailable (private windows,
   old browsers) imported files last only for the session; if the embed host is
   blocked by a content policy the link still opens in a new tab.
   ========================================================================== */

const DB_NAME = 'mm-music';
const DB_VERSION = 1;
const STORE = 'tracks';
const MAX_TRACKS = 300;
const MAX_BYTES = 40 * 1024 * 1024; // per file — generous, but not unlimited

/* -------------------------------------------------------------------------- */
/* Link parsing — pure functions, easy to reason about                        */
/* -------------------------------------------------------------------------- */

const SPOTIFY_TYPES = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show']);
const SPOTIFY_ID = /^[A-Za-z0-9]{10,60}$/;

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * Turn a pasted Spotify share link (or `spotify:` URI) into an embeddable
 * player. Returns null for anything that is not a Spotify item — callers should
 * treat null as "this is not a link we can show inline".
 */
export function parseSpotifyLink(input) {
  const text = String(input || '').trim();
  if (!text) return null;

  const uri = text.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/);
  if (uri && SPOTIFY_ID.test(uri[2])) {
    const [, type, id] = uri;
    return {
      service: 'spotify',
      type,
      id,
      label: `${type[0].toUpperCase()}${type.slice(1)}`,
      url: `https://open.spotify.com/${type}/${id}`,
      embed: `https://open.spotify.com/embed/${type}/${id}?theme=0`,
    };
  }

  const url = safeUrl(text);
  if (!url || !/(^|\.)spotify\.com$/.test(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  // Regional links look like /intl-de/playlist/<id>; find the item type anywhere.
  const index = parts.findIndex((part) => SPOTIFY_TYPES.has(part));
  if (index === -1) return null;
  const type = parts[index];
  const id = (parts[index + 1] || '').split('?')[0];
  if (!SPOTIFY_ID.test(id)) return null;
  return {
    service: 'spotify',
    type,
    id,
    label: `${type[0].toUpperCase()}${type.slice(1)}`,
    url: `https://open.spotify.com/${type}/${id}`,
    embed: `https://open.spotify.com/embed/${type}/${id}?theme=0`,
  };
}

/**
 * Apple Music links share the same path on the embed host, so this is a host
 * swap rather than a re-parse. Song, album, playlist, artist and curator
 * paths are all supported by Apple's embed player.
 */
export function parseAppleLink(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  const url = safeUrl(text);
  if (!url) return null;
  if (!/(^|\.)music\.apple\.com$/.test(url.hostname) && !/(^|\.)itunes\.apple\.com$/.test(url.hostname)) {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const index = parts.findIndex((part) => ['album', 'playlist', 'song', 'artist', 'curator'].includes(part));
  if (index === -1) return null;
  const type = parts[index];
  const embed = `https://embed.music.apple.com${url.pathname}${url.search}`;
  return {
    service: 'apple',
    type,
    id: parts[index + 1] || '',
    label: `${type[0].toUpperCase()}${type.slice(1)}`,
    url: url.href,
    embed,
  };
}

export function parseMusicLink(input, service = 'spotify') {
  return service === 'apple' ? parseAppleLink(input) : parseSpotifyLink(input);
}

/** A search deep link, for when someone wants to browse rather than paste. */
export function searchLink(service, query) {
  const text = encodeURIComponent(String(query || 'focus').trim() || 'focus');
  return service === 'apple'
    ? `https://music.apple.com/search?term=${text}`
    : `https://open.spotify.com/search/${text}`;
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const uid = () => `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function titleFromFilename(name = '') {
  return String(name)
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/^\s*\d{1,2}[\s._-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 160) || 'Untitled';
}

export const AUDIO_TYPES = /^audio\/|\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i;

export function isAudioFile(file) {
  if (!file) return false;
  return String(file.type || '').startsWith('audio/') || AUDIO_TYPES.test(file.name || '');
}

/* -------------------------------------------------------------------------- */
/* IndexedDB                                                                  */
/* -------------------------------------------------------------------------- */

function openDatabase() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let factory = null;
    try {
      factory = window.indexedDB || null;
    } catch {
      factory = null;
    }
    if (!factory) {
      done(null);
      return;
    }
    // A blocked or slow database must never hold up the room.
    setTimeout(() => done(null), 2000);
    try {
      const request = factory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => done(request.result);
      request.onerror = () => done(null);
      request.onblocked = () => done(null);
    } catch {
      done(null);
    }
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* -------------------------------------------------------------------------- */
/* The library and the transport                                              */
/* -------------------------------------------------------------------------- */

/**
 * A small, dependable queue player for local files.
 * The UI listens to `onStateChange`; time updates are pushed separately so a
 * progress bar can be cheap to animate.
 */
export class MusicLibrary {
  constructor({ volume = 0.55 } = {}) {
    this.tracks = [];
    this.db = null;
    this.persistent = false;
    this.audio = null;
    this.objectUrl = null;
    this.currentId = null;
    this.playing = false;
    this.shuffle = false;
    this.repeat = 'off'; // off | all | one
    this.volume = Math.min(1, Math.max(0, Number(volume) || 0.55));
    this.onStateChange = null;
    this.onTime = null;
    this.order = [];
  }

  /** Load stored tracks. Safe to call more than once. */
  async init() {
    this.db = await openDatabase();
    if (!this.db) {
      this.persistent = false;
      this.emit();
      return { persistent: false, tracks: 0 };
    }
    this.persistent = true;
    try {
      const tx = this.db.transaction(STORE, 'readonly');
      const records = await requestToPromise(tx.objectStore(STORE).getAll());
      this.tracks = (Array.isArray(records) ? records : [])
        .filter((record) => record && record.id && record.blob)
        .sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)))
        .slice(0, MAX_TRACKS)
        .map((record) => ({
          id: record.id,
          title: record.title || titleFromFilename(record.name),
          name: record.name || '',
          size: record.size || record.blob.size || 0,
          addedAt: record.addedAt || new Date().toISOString(),
          blob: record.blob,
        }));
    } catch {
      this.tracks = [];
      this.persistent = false;
    }
    this.rebuildOrder();
    this.emit();
    return { persistent: this.persistent, tracks: this.tracks.length };
  }

  async put(record) {
    if (!this.db) return false;
    try {
      const tx = this.db.transaction(STORE, 'readwrite');
      await requestToPromise(tx.objectStore(STORE).put(record));
      return true;
    } catch {
      return false;
    }
  }

  async removeRecord(id) {
    if (!this.db) return false;
    try {
      const tx = this.db.transaction(STORE, 'readwrite');
      await requestToPromise(tx.objectStore(STORE).delete(id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Import files. Returns a report the UI can read out: how many were added and
   * why any were skipped.
   */
  async addFiles(fileList) {
    const files = Array.from(fileList || []);
    const added = [];
    const skipped = [];
    for (const file of files) {
      if (this.tracks.length >= MAX_TRACKS) {
        skipped.push({ name: file.name, reason: 'The shelf is full (300 tracks).' });
        continue;
      }
      if (!isAudioFile(file)) {
        skipped.push({ name: file.name, reason: 'Not an audio file.' });
        continue;
      }
      if (Number(file.size) > MAX_BYTES) {
        skipped.push({ name: file.name, reason: 'Larger than 40 MB.' });
        continue;
      }
      const record = {
        id: uid(),
        title: titleFromFilename(file.name),
        name: file.name,
        size: file.size,
        addedAt: new Date().toISOString(),
        blob: file,
      };
      const stored = await this.put(record);
      this.tracks.push({
        id: record.id,
        title: record.title,
        name: record.name,
        size: record.size,
        addedAt: record.addedAt,
        blob: file,
      });
      added.push(record.id);
      if (!stored && this.persistent) {
        // Storage refused (quota, private mode): keep it for this session only.
        this.persistent = false;
      }
    }
    this.rebuildOrder();
    this.emit();
    return { added: added.length, skipped, persistent: this.persistent };
  }

  async remove(id) {
    if (this.currentId === id) this.stop();
    this.tracks = this.tracks.filter((track) => track.id !== id);
    await this.removeRecord(id);
    this.rebuildOrder();
    this.emit();
  }

  async clear() {
    this.stop();
    for (const track of [...this.tracks]) await this.removeRecord(track.id);
    this.tracks = [];
    this.rebuildOrder();
    this.emit();
  }

  rebuildOrder() {
    this.order = this.tracks.map((_, index) => index);
    if (this.shuffle) {
      for (let i = this.order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
      }
    }
  }

  get current() {
    return this.tracks.find((track) => track.id === this.currentId) || null;
  }

  get currentIndex() {
    return this.tracks.findIndex((track) => track.id === this.currentId);
  }

  /* -------------------------------------------------------------- transport */

  ensureAudio() {
    if (this.audio) return this.audio;
    const AudioCtor = window.Audio || (typeof Audio !== 'undefined' ? Audio : null);
    if (!AudioCtor) return null;
    const audio = new AudioCtor();
    audio.preload = 'metadata';
    audio.addEventListener('ended', () => this.handleEnded());
    audio.addEventListener('play', () => {
      this.playing = true;
      this.emit();
    });
    audio.addEventListener('pause', () => {
      this.playing = false;
      this.emit();
    });
    audio.addEventListener('timeupdate', () => {
      this.onTime?.({
        time: audio.currentTime || 0,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        id: this.currentId,
      });
    });
    audio.addEventListener('error', () => {
      this.playing = false;
      this.emit({ error: 'This file could not be played by your browser.' });
    });
    this.audio = audio;
    return audio;
  }

  loadAudio(track) {
    const audio = this.ensureAudio();
    if (!audio || !track) return null;
    if (this.objectUrl) {
      try {
        URL.revokeObjectURL(this.objectUrl);
      } catch {
        /* ignore */
      }
      this.objectUrl = null;
    }
    try {
      this.objectUrl = URL.createObjectURL(track.blob);
      audio.src = this.objectUrl;
      audio.volume = this.volume;
    } catch {
      // No object URLs here (or an unusable blob): the transport stays visible
      // but silent rather than throwing on every render.
      this.objectUrl = null;
    }
    return audio;
  }

  async playTrack(id) {
    const index = this.tracks.findIndex((track) => track.id === id);
    if (index === -1) return false;
    const track = this.tracks[index];
    if (this.currentId !== id) {
      this.currentId = id;
      this.loadAudio(track);
    }
    const audio = this.audio;
    if (audio && audio.src) {
      try {
        await audio.play();
      } catch {
        // Autoplay policy: the transport will try again on the next gesture.
        this.playing = false;
      }
    }
    this.emit();
    return true;
  }

  async toggle() {
    if (!this.currentId) {
      const first = this.tracks[this.order[0] ?? 0];
      if (first) return this.playTrack(first.id);
      return false;
    }
    if (this.playing) {
      this.audio?.pause();
      this.playing = false;
      this.emit();
      return false;
    }
    return this.playTrack(this.currentId);
  }

  stop() {
    try {
      this.audio?.pause();
    } catch {
      /* ignore */
    }
    this.playing = false;
    this.currentId = null;
    if (this.objectUrl) {
      try {
        URL.revokeObjectURL(this.objectUrl);
      } catch {
        /* ignore */
      }
      this.objectUrl = null;
    }
    this.emit();
  }

  position() {
    const index = this.order.indexOf(this.currentIndex);
    return index === -1 ? 0 : index;
  }

  async next({ automatic = false } = {}) {
    if (!this.tracks.length) return false;
    if (automatic && this.repeat === 'one') {
      if (this.audio) this.audio.currentTime = 0;
      return this.playTrack(this.currentId);
    }
    const order = this.order.length ? this.order : this.tracks.map((_, i) => i);
    const position = this.position();
    const nextPosition = position + 1;
    if (nextPosition >= order.length) {
      if (this.repeat === 'all' || !automatic) {
        return this.playTrack(this.tracks[order[0]].id);
      }
      this.playing = false;
      this.emit();
      return false;
    }
    return this.playTrack(this.tracks[order[nextPosition]].id);
  }

  async prev() {
    if (!this.tracks.length) return false;
    if (this.audio && this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return true;
    }
    const order = this.order.length ? this.order : this.tracks.map((_, i) => i);
    const position = this.position();
    if (position <= 0) return this.playTrack(this.tracks[order[order.length - 1]].id);
    return this.playTrack(this.tracks[order[position - 1]].id);
  }

  handleEnded() {
    this.next({ automatic: true });
    this.emit();
  }

  seek(fraction) {
    const audio = this.audio;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const ratio = Math.min(1, Math.max(0, Number(fraction) || 0));
    audio.currentTime = ratio * audio.duration;
    this.onTime?.({ time: audio.currentTime, duration: audio.duration, id: this.currentId });
  }

  setVolume(value) {
    this.volume = Math.min(1, Math.max(0, Number(value) || 0));
    if (this.audio) this.audio.volume = this.volume;
    this.emit();
  }

  setRepeat(mode) {
    this.repeat = ['off', 'all', 'one'].includes(mode) ? mode : 'off';
    this.emit();
  }

  cycleRepeat() {
    const order = ['off', 'all', 'one'];
    this.setRepeat(order[(order.indexOf(this.repeat) + 1) % order.length]);
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    const current = this.currentIndex;
    this.rebuildOrder();
    if (current !== -1) {
      // Keep the playing track at the head of the new order.
      this.order = [current, ...this.order.filter((index) => index !== current)];
    }
    this.emit();
  }

  emit(extra = {}) {
    this.onStateChange?.({
      tracks: this.tracks,
      current: this.current,
      currentId: this.currentId,
      playing: this.playing,
      shuffle: this.shuffle,
      repeat: this.repeat,
      volume: this.volume,
      persistent: this.persistent,
      ...extra,
    });
  }
}
