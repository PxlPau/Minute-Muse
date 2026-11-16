/* =============================================================================
   audio.js — layered ambience mixer
   Sounds fade in and out independently so layers can be blended like a mixer
   rather than switched like tracks. A handful of field recordings loop from
   /audio; every other bed is synthesised locally from the recipes in
   soundscapes.js, so the mixer is useful offline and costs almost nothing to
   ship. Each channel owns a registry of the nodes and timers it created, so
   stopping a sound tears down its generators as well as its gain.

   Rules this module enforces:
   · Nothing plays until the user has interacted (browser policy + good manners).
   · Muting and fading always ramp gain — no clicks, no surprises.
   · Focus sessions duck the ambience slightly; breaks let it breathe back.
   ========================================================================== */

import {
  SOUNDSCAPES, SOUND_BY_ID, SOUND_LIST, SOUND_PRESETS, CATEGORIES, buildSoundscape,
} from './soundscapes.js';

export { SOUNDSCAPES, SOUND_LIST, SOUND_PRESETS, CATEGORIES };

const FADE = 1.4; // seconds for toggles
const DUCK = 0.55; // multiplier while focusing
const DUCK_RAMP = 3;

export class Ambience {
  constructor(volumes = {}, { muted = false } = {}) {
    this.volumes = { ...volumes };
    this.muted = muted;
    this.ctx = null;
    this.master = null;
    this.masterGain = 1;
    this.musicDuck = 1;
    this.channels = new Map(); // id → { gain, filter, sources, playing, fadingOut }
    this.onStateChange = null;
    this.unlocked = false;
  }

  get supported() {
    return Boolean(window.AudioContext || window.webkitAudioContext);
  }

  get playingIds() {
    return [...this.channels.entries()]
      .filter(([, channel]) => channel.playing && !channel.fadingOut)
      .map(([id]) => id);
  }

  isPlaying(id) {
    const channel = this.channels.get(id);
    return Boolean(channel && channel.playing && !channel.fadingOut);
  }

  /* ---------------------------------------------------------------- context */
  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;

    // A gentle shelf keeps layered beds from turning muddy.
    const shelf = this.ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 7200;
    shelf.gain.value = -4;
    this.master.connect(shelf).connect(this.ctx.destination);
    this.unlocked = true;
    return this.ctx;
  }

  /** Called from a user gesture to satisfy autoplay policies. */
  async unlock() {
    if (!this.supported) return false;
    const ctx = this.ensureContext();
    if (ctx && ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    this.unlocked = ctx ? ctx.state === 'running' : false;
    return this.unlocked;
  }

  setMasterDuck(ducked) {
    this.masterGain = ducked ? DUCK : 1;
    this.applyMaster(ducked ? 0.5 : DUCK_RAMP);
  }

  /**
   * Music and ambience should not fight. While a record is playing the beds step
   * back a little, and step forward again when the record stops.
   */
  setMusicDuck(ducked) {
    this.musicDuck = ducked ? 0.62 : 1;
    this.applyMaster(2.2);
  }

  /** The one place master gain is computed, so the two ducks compose. */
  applyMaster(seconds = 0.6) {
    if (!this.ctx || !this.master) return;
    const target = this.muted ? 0 : this.masterGain * this.musicDuck;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(target, now + seconds);
  }

  setMuted(muted) {
    this.muted = muted;
    this.applyMaster(muted ? 0.5 : FADE);
    this.emit();
  }

  setVolume(id, volume) {
    const next = Math.min(1, Math.max(0, Number(volume) || 0));
    this.volumes[id] = next;
    const channel = this.channels.get(id);
    if (channel && !channel.fadingOut) {
      this.rampGain(channel.gain, this.targetFor(id), 0.18);
    }
    this.emit();
  }

  targetFor(id) {
    return Math.max(0, Math.min(1, this.volumes[id] ?? 0));
  }

  /* ------------------------------------------------------------------ toggles */
  async toggle(id) {
    if (this.isPlaying(id)) {
      this.stop(id, { fade: FADE });
      return false;
    }
    const started = await this.start(id);
    return Boolean(started);
  }

  async start(id) {
    const def = SOUND_BY_ID.get(id);
    if (!def) return false;
    if (this.isPlaying(id)) return true;

    const ctx = this.ensureContext();
    if (!ctx) return false;
    await this.unlock();
    if (!this.ctx || this.ctx !== ctx) return false;
    if (this.isPlaying(id)) return true; // another start won while unlocking

    // If a stop is mid-fade, finish it instantly before restarting. Passing
    // the old channel through prevents its pending timer from killing the new
    // channel a second later.
    const existing = this.channels.get(id);
    if (existing) this.disposeChannel(ctx, id, 0, existing);

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);

    const channel = {
      id,
      gain,
      filter: null,
      sources: [],
      audio: null,
      nodes: [],
      playing: true,
      fadingOut: false,
      token: Symbol(id),
      registry: { nodes: [], timers: [], dynamic: new Set(), stoppers: [] },
    };
    let node;
    try {
      node = def.kind === 'file'
        ? this.buildFile(ctx, def)
        : buildSoundscape(ctx, def, channel.registry);
    } catch (error) {
      console.warn('[ambience] could not start', id, error);
      gain.disconnect();
      return false;
    }
    if (!node) {
      gain.disconnect();
      return false;
    }

    if (node.filter) {
      channel.filter = node.filter;
      node.output.connect(node.filter).connect(gain);
    } else {
      node.output.connect(gain);
    }
    channel.sources = node.sources || [];
    channel.audio = node.audio || null;
    channel.nodes = node.nodes || [node.output];
    this.channels.set(id, channel);

    this.rampGain(gain, this.targetFor(id), FADE);
    // Builders own their start/stop lifecycle: recipe engines start their
    // generators themselves and hand back the nodes so disposal can reach them.
    // (A MediaElementAudioSourceNode has no start(), and double-starting an
    // oscillator or buffer would throw.)
    this.emit();
    return true;
  }

  stop(id, { fade = FADE } = {}) {
    const channel = this.channels.get(id);
    if (!channel || channel.fadingOut) return;
    const seconds = Math.max(0, Number(fade) || 0);
    channel.playing = false;
    channel.fadingOut = true;
    this.rampGain(channel.gain, 0, seconds);
    setTimeout(() => {
      if (this.channels.get(id) !== channel) return;
      this.disposeChannel(this.ctx, id, 0, channel);
    }, seconds * 1000 + 80);
    this.emit();
  }

  stopAll({ fade = 0.6 } = {}) {
    [...this.channels.keys()].forEach((id) => this.stop(id, { fade }));
  }

  disposeChannel(ctx, id, delaySeconds = 0, expectedChannel = null) {
    const channel = this.channels.get(id);
    if (!channel || (expectedChannel && channel !== expectedChannel)) return;
    this.channels.delete(id);
    const kill = () => {
      // Recipe channels own scheduled grains and oscillators. Stop scheduling
      // first, then clear any pending cleanup timers, then tear down whatever
      // is still ringing.
      for (const stop of channel.registry?.stoppers || []) {
        try {
          stop();
        } catch {
          /* ignore */
        }
      }
      for (const timer of channel.registry?.timers || []) {
        try {
          window.clearTimeout(timer);
          window.clearInterval(timer);
        } catch {
          /* ignore */
        }
      }
      for (const node of channel.registry?.dynamic || []) {
        try {
          node.stop?.();
        } catch {
          /* ignore */
        }
        try {
          node.disconnect?.();
        } catch {
          /* ignore */
        }
      }
      channel.registry?.dynamic?.clear();
      channel.sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* already stopped, or a media-element source has no stop() */
        }
        try {
          source.disconnect();
        } catch {
          /* ignore */
        }
      });
      // MediaElementAudioSourceNode is not an AudioScheduledSourceNode: the
      // HTMLAudioElement itself must be paused or it plays on invisibly.
      if (channel.audio) {
        try {
          channel.audio.pause();
          channel.audio.removeAttribute('src');
        } catch {
          /* ignore */
        }
      }
      for (const node of channel.nodes || []) {
        try {
          node.disconnect();
        } catch {
          /* ignore */
        }
      }
      try {
        channel.filter?.disconnect();
        channel.gain.disconnect();
      } catch {
        /* ignore */
      }
    };
    if (delaySeconds > 0) setTimeout(kill, delaySeconds * 1000);
    else kill();
  }

  /* ------------------------------------------------------------------ builders */
  buildFile(ctx, def) {
    // `window.Audio` rather than the bare global: the module should not depend
    // on ambient globals that differ between environments.
    const AudioCtor = window.Audio || (typeof Audio !== 'undefined' ? Audio : null);
    if (!AudioCtor) throw new Error('HTMLAudioElement unavailable');
    const audio = new AudioCtor();
    audio.src = def.src;
    audio.loop = true;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    const source = ctx.createMediaElementSource(audio);
    audio.play().catch(() => {
      // The play promise rejects if the gesture didn't count; retry once the
      // context is running (e.g. after the next tap), but never resurrect a
      // layer that has since been stopped.
      const retry = () => {
        const stillActive = [...this.channels.values()].some((channel) => channel.audio === audio);
        if (stillActive) audio.play().catch(() => {});
      };
      setTimeout(retry, 300);
    });
    return { sources: [source], output: source, filter: null, audio, nodes: [] };
  }

  /**
   * Kept as the mixer's extension point: any non-file sound is a soundscape
   * recipe from soundscapes.js. Returns null when the recipe is unusable.
   */
  buildSynth(ctx, def) {
    return buildSoundscape(ctx, def, {
      nodes: [],
      timers: [],
      dynamic: new Set(),
      stoppers: [],
    });
  }

  /* ------------------------------------------------------------------ helpers */
  rampGain(node, value, seconds) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const target = Math.max(0, Math.min(1, value));
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    // Equal-power-ish feel: use a curve for long fades, linear for micro ramps.
    if (seconds > 0.3) {
      node.gain.linearRampToValueAtTime(target, now + seconds);
    } else {
      node.gain.setTargetAtTime(target, now, Math.max(0.02, seconds / 3));
    }
  }

  emit() {
    this.onStateChange?.({ playing: this.playingIds, muted: this.muted });
  }

  dispose() {
    const ctx = this.ctx;
    [...this.channels.keys()].forEach((id) => this.disposeChannel(ctx, id, 0));
    ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
  }
}

/* -------------------------------------------------------------------------- */
/* Chime — a soft, brief bell for phase transitions                          */
/* -------------------------------------------------------------------------- */

let chimeCtx = null;

export async function playChime({ volume = 0.32 } = {}) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    chimeCtx = chimeCtx || new Ctx();
    if (chimeCtx.state === 'suspended') await chimeCtx.resume();
    const ctx = chimeCtx;
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, at: 0, length: 1.6 },
      { freq: 783.99, at: 0.16, length: 1.5 },
      { freq: 1046.5, at: 0.34, length: 1.3 },
    ];
    notes.forEach(({ freq, at, length }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + at);
      gain.gain.linearRampToValueAtTime(volume, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + length + 0.05);
    });
  } catch {
    /* Silent failure is acceptable — a chime is a courtesy, not a feature. */
  }
}
