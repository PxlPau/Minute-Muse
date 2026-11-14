/* =============================================================================
   audio.js — layered ambience mixer
   Sounds fade in and out independently so layers can be blended like a mixer
   rather than switched like tracks. File sounds loop from /audio; two extra
   beds (waves, deep noise) are synthesised locally with the Web Audio API, so
   the mixer is useful offline too.

   Rules this module enforces:
   · Nothing plays until the user has interacted (browser policy + good manners).
   · Muting and fading always ramp gain — no clicks, no surprises.
   · Focus sessions duck the ambience slightly; breaks let it breathe back.
   ========================================================================== */

const SOUNDS = [
  {
    id: 'rain',
    name: 'Tropical rain',
    credit: 'pablodavilla · CC0',
    kind: 'file',
    icon: 'rain',
    src: 'audio/503167__pablodavilla__tropical_rain_01.wav',
    tag: 'Rain',
  },
  {
    id: 'fire',
    name: 'Cozy fireplace',
    credit: 'true_killian · CC0',
    kind: 'file',
    icon: 'flame',
    src: 'audio/760474__true_killian__fireplace.m4a',
    tag: 'Warm',
  },
  {
    id: 'forest',
    name: 'Forest birds I',
    credit: 'titi2 · CC0',
    kind: 'file',
    icon: 'leaf',
    src: 'audio/567531__titi2__silent-forest_birds_210410_0059.wav',
    tag: 'Nature',
  },
  {
    id: 'forest2',
    name: 'Forest birds II',
    credit: 'sama66 · CC0',
    kind: 'file',
    icon: 'leaf',
    src: 'audio/462137__sama66__forest-bird-1.wav',
    tag: 'Nature',
  },
  {
    id: 'jazz',
    name: 'Smooth jazz',
    credit: 'amandedou · CC0',
    kind: 'file',
    icon: 'music',
    src: 'audio/317673__amandedou__amande_3201.mp3',
    tag: 'Music',
  },
  {
    id: 'waves',
    name: 'Night waves',
    credit: 'synthesised · CC0',
    kind: 'synth-waves',
    icon: 'waves',
    tag: 'Synthetic',
  },
  {
    id: 'brown',
    name: 'Deep brown noise',
    credit: 'synthesised · CC0',
    kind: 'synth-brown',
    icon: 'coffee',
    tag: 'Synthetic',
  },
];

export const SOUND_LIST = SOUNDS.map(({ id, name, credit, icon, tag }) => ({ id, name, credit, icon, tag }));

export const SOUND_PRESETS = [
  { id: 'rain', label: 'Rain desk', mix: { rain: 0.42, brown: 0.14 } },
  { id: 'hearth', label: 'Hearth', mix: { fire: 0.44, brown: 0.1 } },
  { id: 'forest', label: 'Forest window', mix: { forest: 0.34, waves: 0.12 } },
  { id: 'library', label: 'Library hush', mix: { brown: 0.36, rain: 0.1 } },
  { id: 'late', label: 'Late night', mix: { jazz: 0.2, rain: 0.24 } },
];

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
    const target = (this.muted ? 0 : 1) * (ducked ? DUCK : 1);
    this.masterGain = ducked ? DUCK : 1;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : target, now + DUCK_RAMP);
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : this.masterGain, now + (muted ? 0.5 : FADE));
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
    const def = SOUNDS.find((sound) => sound.id === id);
    if (!def) return false;
    if (this.isPlaying(id)) return true;

    const ctx = this.ensureContext();
    if (!ctx) return false;
    await this.unlock();

    // If a stop is mid-fade, finish it instantly before restarting.
    const existing = this.channels.get(id);
    if (existing) {
      this.disposeChannel(ctx, id, 0.05);
    }

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);

    const channel = { id, gain, filter: null, sources: [], playing: true, fadingOut: false };
    let node;
    try {
      node = def.kind === 'file' ? this.buildFile(ctx, def) : this.buildSynth(ctx, def);
    } catch (error) {
      console.warn('[ambience] could not start', id, error);
      gain.disconnect();
      return false;
    }
    if (!node) return false;

    if (node.filter) {
      channel.filter = node.filter;
      node.output.connect(node.filter).connect(gain);
    } else {
      node.output.connect(gain);
    }
    channel.sources = node.sources;
    this.channels.set(id, channel);

    this.rampGain(gain, this.targetFor(id), FADE);
    node.sources.forEach((source) => {
      try {
        source.start();
      } catch (error) {
        console.warn('[ambience] source start failed', error);
      }
    });
    this.emit();
    return true;
  }

  stop(id, { fade = FADE } = {}) {
    const channel = this.channels.get(id);
    if (!channel) return;
    channel.playing = false;
    channel.fadingOut = true;
    this.rampGain(channel.gain, 0, fade);
    setTimeout(() => this.disposeChannel(this.ctx, id, 0), fade * 1000 + 80);
    this.emit();
  }

  stopAll({ fade = 0.6 } = {}) {
    [...this.channels.keys()].forEach((id) => this.stop(id, { fade }));
  }

  disposeChannel(ctx, id, delaySeconds = 0) {
    const channel = this.channels.get(id);
    if (!channel) return;
    this.channels.delete(id);
    const kill = () => {
      channel.sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
        try {
          source.disconnect();
        } catch {
          /* ignore */
        }
      });
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
      // context is running (e.g. after the next tap).
      const retry = () => {
        audio.play().catch(() => {});
      };
      setTimeout(retry, 300);
    });
    return { sources: [source], output: source, filter: null, audio };
  }

  buildSynth(ctx, def) {
    const output = ctx.createGain();
    output.gain.value = 0.9;

    if (def.kind === 'synth-brown') {
      const seconds = 6;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
      // Seamless loop: crossfade the tail into the head.
      const blend = Math.floor(ctx.sampleRate * 0.4);
      for (let i = 0; i < blend; i += 1) {
        const t = i / blend;
        data[i] = data[i] * t + data[data.length - blend + i] * (1 - t);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(output);
      return { sources: [source], output, filter: null };
    }

    if (def.kind === 'synth-waves') {
      // Long, slow swells of filtered noise that rise and fall like surf.
      const seconds = 8;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      const blend = Math.floor(ctx.sampleRate * 0.5);
      for (let i = 0; i < blend; i += 1) {
        const t = i / blend;
        data[i] = data[i] * t + data[data.length - blend + i] * (1 - t);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 520;
      lowpass.Q.value = 0.7;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(lowpass.frequency);

      const swells = ctx.createGain();
      swells.gain.value = 0.9;
      const swellLfo = ctx.createOscillator();
      swellLfo.frequency.value = 0.045;
      const swellDepth = ctx.createGain();
      swellDepth.gain.value = 0.28;
      swellLfo.connect(swellDepth).connect(swells.gain);

      source.connect(lowpass).connect(swells).connect(output);
      return { sources: [source, lfo, swellLfo], output, filter: null };
    }

    return null;
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
    [...this.channels.keys()].forEach((id) => this.disposeChannel(this.ctx, id));
    this.ctx?.close().catch(() => {});
    this.ctx = null;
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
