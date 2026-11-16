/* =============================================================================
   soundscapes.js — the catalogue of rooms you can sit inside, and the code that
   builds each one from nothing but the Web Audio API.

   Why synthesise instead of shipping audio?
   · A hundred loops would be tens of megabytes; these recipes are a few kB.
   · Nothing needs licensing, so every bed can be used offline and forever.
   · Layers can be mixed, tuned and re-tuned in real time without seams.

   A soundscape is a small, declarative recipe: one or more layers, each of
   which is one of four engines —
     noise   filtered, looping, coloured noise (rain, wind, hush, tape)
     drone   tuned oscillators held under a filter (organ, strings, hum)
     events  scarce, randomised grains (crickets, embers, page turns, gulls)
     music   a slow generative figure from a scale (nocturnes, music boxes)
   The recipes here are data; the engines live at the bottom of the file.
   ========================================================================== */

export const CATEGORIES = [
  'Weather',
  'Water',
  'Fire',
  'Nature',
  'Places',
  'Textures',
  'Drone & music',
];

const CREDIT_SYNTH = 'synthesised here · CC0';

/* Helper so each entry stays readable: a compact noise bed. */
const noise = (color, gain, extra = {}) => ({ type: 'noise', color, gain, ...extra });
const events = (event, gain, extra = {}) => ({ type: 'events', event, gain, ...extra });
const drone = (notes, gain, extra = {}) => ({ type: 'drone', notes, gain, ...extra });

/**
 * The catalogue. `default` is the fader position a fresh session uses; keep
 * beds quiet enough that four of them can play at once without turning to mud.
 */
export const SOUNDSCAPES = [
  /* ------------------------------------------------------------- Weather */
  {
    id: 'rain',
    name: 'Tropical rain',
    category: 'Weather',
    tag: 'Rain',
    icon: 'rain',
    kind: 'file',
    src: 'audio/503167__pablodavilla__tropical_rain_01.wav',
    credit: 'pablodavilla · CC0',
    blurb: 'The original recording — warm, close, a little heavy.',
    default: 0.38,
  },
  {
    id: 'rain-tin',
    name: 'Rain on a tin roof',
    category: 'Weather',
    tag: 'Rain',
    icon: 'rain',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Bright droplets over a low, resting body of rain.',
    default: 0.32,
    recipe: {
      layers: [
        noise('pink', 0.5, {
          filter: { type: 'lowpass', freq: 1600, q: 0.4 },
          lfo: [{ target: 'gain', rate: 0.045, depth: 0.14 }],
        }),
        events('droplet', 0.5, { every: [0.055, 0.16], decay: 0.05, freq: [1500, 5200] }),
        events('patter', 0.22, { every: [0.7, 2.4], decay: 0.5, freq: [300, 900] }),
      ],
    },
  },
  {
    id: 'storm-window',
    name: 'Storm at the window',
    category: 'Weather',
    tag: 'Storm',
    icon: 'rain',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Rain against glass, and thunder somewhere further off.',
    default: 0.3,
    recipe: {
      layers: [
        noise('pink', 0.42, { filter: { type: 'lowpass', freq: 2400, q: 0.5 } }),
        drone([48, 52], 0.16, { wave: 'sine', filter: { type: 'lowpass', freq: 140, q: 0.6 } }),
        events('thunder', 0.55, { every: [16, 42], decay: 3.4 }),
        events('droplet', 0.22, { every: [0.08, 0.2], decay: 0.06, freq: [2200, 6400] }),
      ],
    },
  },
  {
    id: 'wind-moor',
    name: 'Wind over the moor',
    category: 'Weather',
    tag: 'Wind',
    icon: 'wind',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Long, unhurried gusts with nothing to break them.',
    default: 0.34,
    recipe: {
      layers: [
        noise('pink', 0.5, {
          filter: { type: 'bandpass', freq: 520, q: 0.7 },
          lfo: [
            { target: 'frequency', rate: 0.035, depth: 320 },
            { target: 'gain', rate: 0.021, depth: 0.3 },
          ],
        }),
        noise('white', 0.1, {
          filter: { type: 'bandpass', freq: 2400, q: 1.4 },
          lfo: [{ target: 'frequency', rate: 0.017, depth: 900 }],
        }),
      ],
    },
  },
  {
    id: 'snow-hush',
    name: 'The hush when it snows',
    category: 'Weather',
    tag: 'Hush',
    icon: 'snow',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Almost nothing: a room with the windows closed.',
    default: 0.26,
    recipe: {
      layers: [
        noise('brown', 0.36, {
          filter: { type: 'lowpass', freq: 620, q: 0.3 },
          lfo: [{ target: 'gain', rate: 0.03, depth: 0.1 }],
        }),
        events('flurry', 0.16, { every: [3, 9], decay: 1.6, freq: [500, 1400] }),
      ],
    },
  },

  /* --------------------------------------------------------------- Water */
  {
    id: 'waves',
    name: 'Night waves',
    category: 'Water',
    tag: 'Waves',
    icon: 'waves',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Surf at three in the morning, heard from a dark beach.',
    default: 0.3,
    recipe: {
      layers: [
        noise('white', 0.55, {
          filter: { type: 'lowpass', freq: 520, q: 0.7 },
          lfo: [{ target: 'frequency', rate: 0.07, depth: 260 }],
        }),
        drone([72, 74.5], 0.1, { wave: 'sine', filter: { type: 'lowpass', freq: 180, q: 0.8 } }),
        events('swell', 0.3, { every: [7, 13], decay: 4.2 }),
      ],
    },
  },
  {
    id: 'stream',
    name: 'A stream over stones',
    category: 'Water',
    tag: 'Stream',
    icon: 'waves',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Fast water, small bubbles, cold air above it.',
    default: 0.3,
    recipe: {
      layers: [
        noise('pink', 0.42, { filter: { type: 'bandpass', freq: 1100, q: 0.8 } }),
        events('bubble', 0.36, { every: [0.08, 0.26], decay: 0.12, freq: [420, 1500] }),
        noise('white', 0.08, { filter: { type: 'highpass', freq: 3800, q: 0.6 } }),
      ],
    },
  },
  {
    id: 'tide-cave',
    name: 'Tide in a sea cave',
    category: 'Water',
    tag: 'Tide',
    icon: 'waves',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Water finding the walls, and a drip keeping time.',
    default: 0.28,
    recipe: {
      layers: [
        noise('brown', 0.44, {
          filter: { type: 'lowpass', freq: 340, q: 0.9 },
          lfo: [{ target: 'gain', rate: 0.05, depth: 0.22 }],
        }),
        events('drip', 0.4, { every: [2.4, 6.5], decay: 0.4, freq: [700, 1300] }),
        events('gull', 0.1, { every: [22, 60] }),
      ],
    },
  },
  {
    id: 'harbour-rain',
    name: 'Harbour rain',
    category: 'Water',
    tag: 'Harbour',
    icon: 'anchor',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Rain on water, rope against a mast, no voices.',
    default: 0.3,
    recipe: {
      layers: [
        noise('pink', 0.4, { filter: { type: 'lowpass', freq: 2000, q: 0.4 } }),
        events('creak', 0.26, { every: [6, 18], decay: 1.1, freq: [180, 420] }),
        events('droplet', 0.2, { every: [0.12, 0.32], decay: 0.05, freq: [1200, 4200] }),
      ],
    },
  },

  /* ---------------------------------------------------------------- Fire */
  {
    id: 'fire',
    name: 'Cozy fireplace',
    category: 'Fire',
    tag: 'Warm',
    icon: 'flame',
    kind: 'file',
    src: 'audio/760474__true_killian__fireplace.m4a',
    credit: 'true_killian · CC0',
    blurb: 'The original recording: a low fire, close by.',
    default: 0.3,
  },
  {
    id: 'embers',
    name: 'Embers settling',
    category: 'Fire',
    tag: 'Crackle',
    icon: 'flame',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'The last hour of a fire, when it starts to speak.',
    default: 0.3,
    recipe: {
      layers: [
        noise('brown', 0.4, {
          filter: { type: 'lowpass', freq: 900, q: 0.5 },
          lfo: [{ target: 'gain', rate: 0.12, depth: 0.2 }],
        }),
        events('ember', 0.5, { every: [0.12, 0.9], decay: 0.05, freq: [900, 3400] }),
        events('log', 0.24, { every: [5, 16], decay: 0.35, freq: [90, 220] }),
      ],
    },
  },
  {
    id: 'woodstove',
    name: 'A wood stove in winter',
    category: 'Fire',
    tag: 'Stove',
    icon: 'flame',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Iron ticking as it warms; heat you can hear.',
    default: 0.28,
    recipe: {
      layers: [
        noise('brown', 0.38, { filter: { type: 'lowpass', freq: 700, q: 0.6 } }),
        drone([110, 164.8], 0.06, { wave: 'sine', filter: { type: 'lowpass', freq: 420, q: 0.8 } }),
        events('tick', 0.2, { every: [0.6, 2.6], decay: 0.04 }),
        events('ember', 0.3, { every: [0.4, 2.2], decay: 0.05, freq: [800, 2600] }),
      ],
    },
  },
  {
    id: 'candle-hall',
    name: 'Candles in a stone hall',
    category: 'Fire',
    tag: 'Candle',
    icon: 'flame',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Small flames, tall room, the smallest possible echo.',
    default: 0.26,
    recipe: {
      layers: [
        noise('brown', 0.3, { filter: { type: 'lowpass', freq: 500, q: 0.4 } }),
        drone([98, 147], 0.08, { wave: 'sine', filter: { type: 'lowpass', freq: 260, q: 0.7 } }),
        events('crackle', 0.34, { every: [0.3, 1.9], decay: 0.06, freq: [1400, 4400] }),
      ],
    },
  },

  /* -------------------------------------------------------------- Nature */
  {
    id: 'forest',
    name: 'Forest birds I',
    category: 'Nature',
    tag: 'Birds',
    icon: 'leaf',
    kind: 'file',
    src: 'audio/567531__titi2__silent-forest_birds_210410_0059.wav',
    credit: 'titi2 · CC0',
    blurb: 'The original recording — an unhurried morning.',
    default: 0.24,
  },
  {
    id: 'forest2',
    name: 'Forest birds II',
    category: 'Nature',
    tag: 'Birds',
    icon: 'leaf',
    kind: 'file',
    src: 'audio/462137__sama66__forest-bird-1.wav',
    credit: 'sama66 · CC0',
    blurb: 'The original recording — one bird, very close.',
    default: 0.22,
  },
  {
    id: 'dawn-chorus',
    name: 'Dawn chorus',
    category: 'Nature',
    tag: 'Dawn',
    icon: 'leaf',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Many small voices, all certain the day has begun.',
    default: 0.26,
    recipe: {
      layers: [
        noise('pink', 0.2, { filter: { type: 'lowpass', freq: 1200, q: 0.4 } }),
        events('chirp', 0.34, { every: [0.22, 0.9], decay: 0.16, freq: [1800, 3600] }),
        events('chirp', 0.2, { every: [0.6, 2.2], decay: 0.22, freq: [2600, 4600] }),
      ],
    },
  },
  {
    id: 'crickets',
    name: 'Crickets after dark',
    category: 'Nature',
    tag: 'Night',
    icon: 'moon',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Dry grass, warm air, a hundred tiny metronomes.',
    default: 0.26,
    recipe: {
      layers: [
        events('cricket', 0.32, { every: [0.28, 0.7], decay: 0.14, freq: [3600, 4800] }),
        events('cricket', 0.18, { every: [0.5, 1.3], decay: 0.1, freq: [2600, 3400] }),
        noise('brown', 0.16, { filter: { type: 'lowpass', freq: 380, q: 0.4 } }),
      ],
    },
  },
  {
    id: 'owl-woods',
    name: 'Owls in the wood',
    category: 'Nature',
    tag: 'Owl',
    icon: 'moon',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Far apart, patient, entirely indifferent to you.',
    default: 0.24,
    recipe: {
      layers: [
        noise('brown', 0.28, { filter: { type: 'lowpass', freq: 420, q: 0.4 } }),
        events('hoot', 0.4, { every: [14, 38], decay: 1.4, freq: [290, 380] }),
        events('rustle', 0.12, { every: [6, 20], decay: 0.7, freq: [900, 2200] }),
      ],
    },
  },
  {
    id: 'meadow',
    name: 'Meadow in July',
    category: 'Nature',
    tag: 'Meadow',
    icon: 'leaf',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Bees, dry seed heads, a breeze that never quite stops.',
    default: 0.24,
    recipe: {
      layers: [
        noise('pink', 0.24, {
          filter: { type: 'bandpass', freq: 900, q: 0.5 },
          lfo: [{ target: 'gain', rate: 0.08, depth: 0.2 }],
        }),
        events('bee', 0.16, { every: [1.2, 5], decay: 1.2, freq: [180, 260] }),
        events('chirp', 0.12, { every: [2.4, 8], decay: 0.18, freq: [2800, 4200] }),
      ],
    },
  },

  /* -------------------------------------------------------------- Places */
  {
    id: 'cafe',
    name: 'Café murmur',
    category: 'Places',
    tag: 'Café',
    icon: 'coffee',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Conversation without words, cups finding saucers.',
    default: 0.26,
    recipe: {
      layers: [
        noise('brown', 0.34, {
          filter: { type: 'lowpass', freq: 900, q: 0.4 },
          lfo: [{ target: 'gain', rate: 0.11, depth: 0.3 }],
        }),
        noise('pink', 0.12, { filter: { type: 'bandpass', freq: 1600, q: 0.6 } }),
        events('clink', 0.22, { every: [2.4, 9], decay: 0.25, freq: [1800, 3200] }),
        events('chair', 0.14, { every: [5, 16], decay: 0.3, freq: [180, 420] }),
      ],
    },
  },
  {
    id: 'library',
    name: 'Library hush',
    category: 'Places',
    tag: 'Library',
    icon: 'book',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Air handling, distant footsteps, a page turning somewhere.',
    default: 0.28,
    recipe: {
      layers: [
        noise('brown', 0.36, { filter: { type: 'lowpass', freq: 520, q: 0.3 } }),
        drone([58], 0.1, { wave: 'sine', filter: { type: 'lowpass', freq: 220, q: 0.6 } }),
        events('page', 0.24, { every: [7, 22], decay: 0.4 }),
        events('chair', 0.08, { every: [10, 30], decay: 0.3, freq: [150, 320] }),
      ],
    },
  },
  {
    id: 'train',
    name: 'Night train carriage',
    category: 'Places',
    tag: 'Train',
    icon: 'train',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Steady wheels, a sway you can hear, no announcements.',
    default: 0.28,
    recipe: {
      layers: [
        noise('brown', 0.46, { filter: { type: 'lowpass', freq: 480, q: 0.5 } }),
        events('clack', 0.3, { every: [0.62, 0.66], decay: 0.07 }),
        events('clack', 0.18, { every: [1.24, 1.3], decay: 0.09 }),
        drone([62, 93], 0.05, { wave: 'sine', filter: { type: 'lowpass', freq: 260, q: 0.8 } }),
      ],
    },
  },
  {
    id: 'reading-room-clock',
    name: 'Reading room clock',
    category: 'Places',
    tag: 'Ticking',
    icon: 'clock',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'One long-case clock, and the room it has to fill.',
    default: 0.24,
    recipe: {
      layers: [
        noise('brown', 0.22, { filter: { type: 'lowpass', freq: 480, q: 0.3 } }),
        events('tock', 0.4, { every: [1, 1] }),
        events('chime', 0.12, { every: [58, 62], decay: 2.4 }),
      ],
    },
  },
  {
    id: 'late-office',
    name: 'The office at midnight',
    category: 'Places',
    tag: 'Office',
    icon: 'lamp',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Fluorescent hum, a fan, someone else’s keyboard two rows over.',
    default: 0.24,
    recipe: {
      layers: [
        drone([100, 150], 0.12, { wave: 'sawtooth', filter: { type: 'lowpass', freq: 220, q: 2.4 } }),
        noise('pink', 0.14, { filter: { type: 'bandpass', freq: 2400, q: 0.6 } }),
        events('typing', 0.22, { every: [3, 11], decay: 0.05 }),
        noise('brown', 0.12, { filter: { type: 'lowpass', freq: 300, q: 0.4 } }),
      ],
    },
  },
  {
    id: 'cathedral',
    name: 'Nave in winter',
    category: 'Places',
    tag: 'Stone',
    icon: 'building',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Cold stone, enormous air, a note still leaving.',
    default: 0.22,
    recipe: {
      layers: [
        drone([73.4, 110, 146.8, 220], 0.14, {
          wave: 'sine',
          filter: { type: 'lowpass', freq: 700, q: 0.5 },
          vibrato: { rate: 0.12, depth: 4 },
        }),
        noise('brown', 0.24, { filter: { type: 'lowpass', freq: 320, q: 0.3 } }),
        events('bell', 0.16, { every: [40, 90], decay: 5 }),
      ],
    },
  },

  /* ------------------------------------------------------------ Textures */
  {
    id: 'brown',
    name: 'Deep brown noise',
    category: 'Textures',
    tag: 'Noise',
    icon: 'coffee',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'The plainest possible hush — like a warm blanket over the ears.',
    default: 0.22,
    recipe: { layers: [noise('brown', 0.6, { filter: { type: 'lowpass', freq: 1200, q: 0.3 } })] },
  },
  {
    id: 'pink',
    name: 'Pink noise',
    category: 'Textures',
    tag: 'Noise',
    icon: 'waves',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Balanced across the spectrum; good for masking a room.',
    default: 0.2,
    recipe: { layers: [noise('pink', 0.5, { filter: { type: 'highpass', freq: 40, q: 0.4 } })] },
  },
  {
    id: 'white',
    name: 'White noise',
    category: 'Textures',
    tag: 'Noise',
    icon: 'sparkle',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Bright and blunt. The best mask, the least cosy.',
    default: 0.16,
    recipe: { layers: [noise('white', 0.34, { filter: { type: 'lowpass', freq: 7000, q: 0.3 } })] },
  },
  {
    id: 'vinyl',
    name: 'Vinyl crackle',
    category: 'Textures',
    tag: 'Crackle',
    icon: 'disc',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Surface noise, a warp, and no music on the record at all.',
    default: 0.26,
    recipe: {
      layers: [
        events('vinyl', 0.34, { every: [0.05, 0.35], decay: 0.02, freq: [1200, 6000] }),
        noise('pink', 0.1, { filter: { type: 'highpass', freq: 2000, q: 0.4 } }),
        events('thump', 0.1, { every: [1.7, 2], decay: 0.08 }),
      ],
    },
  },
  {
    id: 'tape',
    name: 'Tape hiss',
    category: 'Textures',
    tag: 'Hiss',
    icon: 'disc',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'The sound of a room recorded onto something that remembers.',
    default: 0.22,
    recipe: {
      layers: [
        noise('pink', 0.3, { filter: { type: 'highpass', freq: 1400, q: 0.3 } }),
        drone([50], 0.04, { wave: 'sine', filter: { type: 'lowpass', freq: 120, q: 0.6 } }),
      ],
    },
  },
  {
    id: 'substation',
    name: 'Distant substation',
    category: 'Textures',
    tag: 'Hum',
    icon: 'zap',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Mains hum two streets away, heard through a wall.',
    default: 0.2,
    recipe: {
      layers: [
        drone([50, 100, 150], 0.12, { wave: 'sine', filter: { type: 'lowpass', freq: 400, q: 1.2 } }),
        noise('brown', 0.16, { filter: { type: 'lowpass', freq: 260, q: 0.4 } }),
      ],
    },
  },
  {
    id: 'aquarium',
    name: 'Aquarium filter',
    category: 'Textures',
    tag: 'Bubbles',
    icon: 'waves',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Small pump, small bubbles, a green-lit room.',
    default: 0.22,
    recipe: {
      layers: [
        noise('brown', 0.22, { filter: { type: 'lowpass', freq: 500, q: 0.5 } }),
        events('bubble', 0.26, { every: [0.2, 0.7], decay: 0.09, freq: [600, 1800] }),
        drone([120], 0.05, { wave: 'sine', filter: { type: 'lowpass', freq: 300, q: 0.8 } }),
      ],
    },
  },

  /* ------------------------------------------------------- Drone & music */
  {
    id: 'jazz',
    name: 'Smooth jazz',
    category: 'Drone & music',
    tag: 'Music',
    icon: 'music',
    kind: 'file',
    src: 'audio/317673__amandedou__amande_3201.mp3',
    credit: 'amandedou · CC0',
    blurb: 'The original recording — a small band, a low ceiling.',
    default: 0.18,
  },
  {
    id: 'nocturne',
    name: 'Nocturne for one lamp',
    category: 'Drone & music',
    tag: 'Piano',
    icon: 'music',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'A slow figure in A minor that never repeats exactly.',
    default: 0.22,
    recipe: {
      layers: [
        {
          type: 'music',
          gain: 0.5,
          wave: 'triangle',
          root: 220,
          scale: [0, 3, 5, 7, 10, 12, 15, 19],
          beat: [0.72, 1.15],
          noteLength: 2.8,
          octave: [0, 1],
          chordEvery: 7,
          chord: [0, 7, 12],
        },
        noise('brown', 0.08, { filter: { type: 'lowpass', freq: 500, q: 0.3 } }),
      ],
    },
  },
  {
    id: 'music-box',
    name: 'Music box, wound down',
    category: 'Drone & music',
    tag: 'Bells',
    icon: 'music',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'A small mechanism, slightly out of tune, perfectly content.',
    default: 0.22,
    recipe: {
      layers: [
        {
          type: 'music',
          gain: 0.4,
          wave: 'sine',
          root: 523.25,
          scale: [0, 2, 4, 7, 9, 12, 14, 16],
          beat: [0.34, 0.55],
          noteLength: 1.6,
          octave: [0, 0],
          chordEvery: 9,
          chord: [0, 4, 7],
        },
        events('vinyl', 0.06, { every: [0.4, 1.4], decay: 0.02, freq: [2200, 5000] }),
      ],
    },
  },
  {
    id: 'slow-strings',
    name: 'Slow strings',
    category: 'Drone & music',
    tag: 'Strings',
    icon: 'music',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'A held chord that swells when it feels like it.',
    default: 0.24,
    recipe: {
      layers: [
        drone([146.8, 220, 293.7, 370], 0.22, {
          wave: 'sawtooth',
          filter: { type: 'lowpass', freq: 700, q: 0.6 },
          vibrato: { rate: 0.16, depth: 5 },
          swell: { rate: 0.035, depth: 0.35 },
        }),
      ],
    },
  },
  {
    id: 'glass-harmonica',
    name: 'Glass harmonica',
    category: 'Drone & music',
    tag: 'Glass',
    icon: 'prism',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'Wet fingertips on tuned glass; almost too bright to hold.',
    default: 0.2,
    recipe: {
      layers: [
        drone([523.25, 659.25, 783.99, 1046.5], 0.12, {
          wave: 'sine',
          filter: { type: 'lowpass', freq: 3000, q: 0.4 },
          vibrato: { rate: 0.22, depth: 3 },
          swell: { rate: 0.06, depth: 0.4 },
        }),
        noise('white', 0.04, { filter: { type: 'highpass', freq: 6000, q: 0.4 } }),
      ],
    },
  },
  {
    id: 'organ',
    name: 'Low organ, empty room',
    category: 'Drone & music',
    tag: 'Organ',
    icon: 'music',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'One note, held longer than is comfortable. Then longer.',
    default: 0.22,
    recipe: {
      layers: [
        drone([65.4, 98, 130.8, 196], 0.2, {
          wave: 'sine',
          filter: { type: 'lowpass', freq: 620, q: 0.5 },
          vibrato: { rate: 0.09, depth: 2.5 },
          swell: { rate: 0.02, depth: 0.3 },
        }),
        noise('brown', 0.14, { filter: { type: 'lowpass', freq: 260, q: 0.3 } }),
      ],
    },
  },
  {
    id: 'deep-space',
    name: 'Deep field',
    category: 'Drone & music',
    tag: 'Drone',
    icon: 'sparkle',
    kind: 'recipe',
    credit: CREDIT_SYNTH,
    blurb: 'The sound of a very large, very quiet distance.',
    default: 0.22,
    recipe: {
      layers: [
        drone([55, 82.4, 110, 164.8], 0.18, {
          wave: 'sine',
          filter: { type: 'lowpass', freq: 420, q: 0.6 },
          vibrato: { rate: 0.05, depth: 6 },
          swell: { rate: 0.015, depth: 0.4 },
        }),
        events('ping', 0.18, { every: [6, 18], decay: 2.6, freq: [900, 2400] }),
      ],
    },
  },
];

export const SOUND_BY_ID = new Map(SOUNDSCAPES.map((sound) => [sound.id, sound]));

/** Fader defaults keyed by id — the store imports this for fresh settings. */
export const DEFAULT_VOLUMES = Object.freeze(
  Object.fromEntries(SOUNDSCAPES.map((sound) => [sound.id, sound.default])),
);

export const SOUNDSCAPE_IDS = SOUNDSCAPES.map((sound) => sound.id);

/** Public metadata for the mixer UI. */
export const SOUND_LIST = SOUNDSCAPES.map(
  ({ id, name, credit, icon, tag, category, blurb }) => ({ id, name, credit, icon, tag, category, blurb }),
);

/** Blends worth starting from. Every id here must exist in the catalogue. */
export const SOUND_PRESETS = [
  { id: 'rain-desk', label: 'Rain desk', mix: { rain: 0.42, brown: 0.14 } },
  { id: 'hearth', label: 'Hearth', mix: { fire: 0.44, brown: 0.1 } },
  { id: 'forest-window', label: 'Forest window', mix: { forest: 0.34, waves: 0.12 } },
  { id: 'library-hush', label: 'Library hush', mix: { library: 0.4, brown: 0.1 } },
  { id: 'late-night', label: 'Late night', mix: { jazz: 0.2, rain: 0.24 } },
  { id: 'tin-roof', label: 'Tin roof', mix: { 'rain-tin': 0.4, embers: 0.16 } },
  { id: 'night-train', label: 'Night train', mix: { train: 0.4, tape: 0.12 } },
  { id: 'candle-study', label: 'Candlelit study', mix: { 'candle-hall': 0.32, nocturne: 0.2 } },
  { id: 'stone-nave', label: 'Stone nave', mix: { cathedral: 0.34, 'slow-strings': 0.14 } },
  { id: 'summer-field', label: 'Summer field', mix: { meadow: 0.34, 'dawn-chorus': 0.16 } },
  { id: 'small-hours', label: 'Small hours', mix: { crickets: 0.28, 'deep-space': 0.2 } },
  { id: 'studio-quiet', label: 'Studio quiet', mix: { pink: 0.22, 'reading-room-clock': 0.14 } },
  { id: 'cafe-corner', label: 'Café corner', mix: { cafe: 0.38, vinyl: 0.14 } },
  { id: 'music-alone', label: 'Music, alone', mix: { 'music-box': 0.3, 'glass-harmonica': 0.14 } },
];

/* Sanity: a preset that names a missing sound would fail silently at runtime. */
for (const preset of SOUND_PRESETS) {
  for (const id of Object.keys(preset.mix)) {
    if (!SOUND_BY_ID.has(id)) {
      throw new Error(`SOUND_PRESETS "${preset.id}" references unknown sound "${id}"`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Engines                                                                    */
/* -------------------------------------------------------------------------- */

const FADE_EPSILON = 0.0001;

/** Seamless loop for noise buffers: crossfade the tail into the head. */
function loopBlend(data, sampleRate, blendSeconds = 0.35) {
  const blend = Math.min(Math.floor(sampleRate * blendSeconds), Math.floor(data.length / 2));
  for (let i = 0; i < blend; i += 1) {
    const t = i / blend;
    data[i] = data[i] * t + data[data.length - blend + i] * (1 - t);
  }
}

/**
 * Coloured noise on a loop.
 * `pink` is Paul Kellet's economy filter; `brown` is an integrated random walk.
 */
function noiseBuffer(ctx, color = 'white', seconds = 5) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (color === 'pink') {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else if (color === 'brown') {
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
  } else {
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  loopBlend(data, ctx.sampleRate, seconds > 2 ? 0.5 : 0.2);
  // Normalise loosely so a brown bed is not much louder than a white one.
  let peak = 0;
  for (let i = 0; i < length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  if (peak > 0.9) {
    const scale = 0.9 / peak;
    for (let i = 0; i < length; i += 1) data[i] *= scale;
  }
  return buffer;
}

/** A very short noise burst reused by every grain-style event. */
function grainBuffer(ctx) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * 0.06));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function buildNoise(ctx, layer, registry) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, layer.color, layer.seconds || 5);
  source.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 1;

  let tail = source;
  let filter = null;
  if (layer.filter) {
    filter = ctx.createBiquadFilter();
    filter.type = layer.filter.type || 'lowpass';
    filter.frequency.value = layer.filter.freq || 1200;
    filter.Q.value = layer.filter.q ?? 0.7;
    tail.connect(filter);
    tail = filter;
    registry.nodes.push(filter);
  }
  tail.connect(gain);

  const lfos = [];
  for (const mod of layer.lfo || []) {
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = mod.rate || 0.08;
    const depth = ctx.createGain();
    depth.gain.value = mod.depth || 0.1;
    lfo.connect(depth);
    // A frequency sweep is only meaningful when there is a filter to sweep;
    // without one, fall back to breathing the layer's level instead.
    if (mod.target === 'frequency' && filter) depth.connect(filter.frequency);
    else depth.connect(gain.gain);
    lfo.start();
    lfos.push(lfo);
    registry.nodes.push(lfo, depth);
  }

  source.start();
  return { sources: [source, ...lfos], output: gain, nodes: [gain] };
}

function buildDrone(ctx, layer, registry) {
  const output = ctx.createGain();
  output.gain.value = 1;

  let tail = output;
  if (layer.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = layer.filter.type || 'lowpass';
    filter.frequency.value = layer.filter.freq || 600;
    filter.Q.value = layer.filter.q ?? 0.7;
    output.connect(filter);
    tail = filter;
    registry.nodes.push(filter);
  }

  const bus = ctx.createGain();
  bus.gain.value = 1 / Math.max(1, layer.notes.length);
  bus.connect(tail);

  const sources = [];
  for (const frequency of layer.notes) {
    for (const detune of [-4, 4]) {
      const osc = ctx.createOscillator();
      osc.type = layer.wave || 'sine';
      osc.frequency.value = frequency;
      osc.detune.value = detune;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 1;
      osc.connect(oscGain).connect(bus);
      osc.start();
      sources.push(osc);
      registry.nodes.push(osc, oscGain);
    }
  }

  if (layer.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = layer.vibrato.rate || 0.15;
    const depth = ctx.createGain();
    depth.gain.value = layer.vibrato.depth || 4;
    lfo.connect(depth);
    for (const source of sources) depth.connect(source.detune);
    lfo.start();
    sources.push(lfo);
    registry.nodes.push(lfo, depth);
  }

  if (layer.swell) {
    const swell = ctx.createOscillator();
    swell.frequency.value = layer.swell.rate || 0.04;
    const depth = ctx.createGain();
    depth.gain.value = (layer.swell.depth || 0.3) * 0.5;
    swell.connect(depth).connect(bus.gain);
    bus.gain.value = 1 - (layer.swell.depth || 0.3) * 0.5;
    swell.start();
    sources.push(swell);
    registry.nodes.push(swell, depth);
  }

  return { sources, output, nodes: [output, bus] };
}

/* -------------------------------------------------------------------------- */
/* Grains — one function per event voice                                      */
/* -------------------------------------------------------------------------- */

function playGrain(ctx, registry, event, grainBufferRef, output, layer) {
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(output);
  const registryNode = gain;
  registry.dynamic.add(registryNode);

  const decay = layer.decay ?? 0.12;
  const [lo, hi] = layer.freq || [600, 1600];
  const frequency = lo + Math.random() * Math.max(1, hi - lo);
  const cleanup = [];

  const envelope = (node, peak, length) => {
    node.gain.setValueAtTime(0, now);
    node.gain.linearRampToValueAtTime(Math.max(FADE_EPSILON, peak), now + Math.min(0.012, length / 3));
    node.gain.exponentialRampToValueAtTime(FADE_EPSILON, now + length);
  };

  const tone = (type, f, level, length, endFrequency = null) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, now);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + length);
    const env = ctx.createGain();
    envelope(env, level, length);
    osc.connect(env).connect(gain);
    osc.start(now);
    osc.stop(now + length + 0.02);
    cleanup.push(osc, env);
    registry.dynamic.add(osc);
  };

  const noiseBurst = (level, length, filterType, filterFreq, q = 1) => {
    if (!grainBufferRef) return;
    const source = ctx.createBufferSource();
    source.buffer = grainBufferRef;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const env = ctx.createGain();
    envelope(env, level, length);
    source.connect(filter).connect(env).connect(gain);
    source.start(now);
    source.stop(now + length + 0.02);
    cleanup.push(source, filter, env);
    registry.dynamic.add(source);
  };

  switch (event) {
    case 'droplet':
      tone('sine', frequency, 0.16, Math.min(0.09, decay * 2), frequency * 1.9);
      break;
    case 'patter':
      noiseBurst(0.14, Math.max(0.18, decay * 3), 'bandpass', frequency, 0.8);
      break;
    case 'flurry':
      noiseBurst(0.06, Math.max(0.6, decay), 'bandpass', frequency, 1.4);
      break;
    case 'bubble':
      tone('sine', frequency, 0.12, 0.11, frequency * 2.4);
      break;
    case 'drip':
      tone('sine', frequency, 0.22, 0.35, frequency * 0.55);
      break;
    case 'swell':
      noiseBurst(0.18, Math.max(2, decay), 'lowpass', 420, 0.6);
      break;
    case 'thunder':
      noiseBurst(0.6, Math.max(1.5, decay), 'lowpass', 180, 0.5);
      tone('sine', 46, 0.24, Math.max(1.5, decay), 28);
      break;
    case 'ember':
      noiseBurst(0.3, Math.max(0.02, decay), 'bandpass', frequency, 2.2);
      break;
    case 'crackle':
      noiseBurst(0.24, Math.max(0.03, decay), 'highpass', 1800, 0.8);
      break;
    case 'log':
      noiseBurst(0.24, 0.4, 'lowpass', frequency, 0.6);
      break;
    case 'tick':
      noiseBurst(0.16, 0.03, 'bandpass', 2200, 3);
      tone('square', 1800, 0.05, 0.02);
      break;
    case 'tock':
      tone('sine', 320, 0.16, 0.06, 180);
      noiseBurst(0.05, 0.03, 'bandpass', 1500, 2);
      break;
    case 'chime':
      [523.25, 659.25, 783.99].forEach((f, index) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const env = ctx.createGain();
        const at = now + index * 0.06;
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(0.12, at + 0.02);
        env.gain.exponentialRampToValueAtTime(FADE_EPSILON, at + 2.2);
        osc.connect(env).connect(gain);
        osc.start(at);
        osc.stop(at + 2.3);
        cleanup.push(osc, env);
        registry.dynamic.add(osc);
      });
      break;
    case 'bell':
      [261.6, 392, 523.25, 784].forEach((f, index) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f * (1 + index * 0.002);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.1 / (index + 1), now + 0.03);
        env.gain.exponentialRampToValueAtTime(FADE_EPSILON, now + 3.5 + index * 0.4);
        osc.connect(env).connect(gain);
        osc.start(now);
        osc.stop(now + 5);
        cleanup.push(osc, env);
        registry.dynamic.add(osc);
      });
      break;
    case 'chirp': {
      const up = Math.random() > 0.35;
      const base = frequency;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i += 1) {
        const at = now + i * 0.075;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * (up ? 0.8 : 1.2), at);
        osc.frequency.exponentialRampToValueAtTime(base * (up ? 1.25 : 0.75), at + 0.05);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(0.16, at + 0.006);
        env.gain.exponentialRampToValueAtTime(FADE_EPSILON, at + 0.06);
        osc.connect(env).connect(gain);
        osc.start(at);
        osc.stop(at + 0.08);
        cleanup.push(osc, env);
        registry.dynamic.add(osc);
      }
      break;
    }
    case 'cricket': {
      const pulses = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pulses; i += 1) {
        const at = now + i * 0.028;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(0.09, at + 0.004);
        env.gain.exponentialRampToValueAtTime(FADE_EPSILON, at + 0.02);
        osc.connect(env).connect(gain);
        osc.start(at);
        osc.stop(at + 0.03);
        cleanup.push(osc, env);
        registry.dynamic.add(osc);
      }
      break;
    }
    case 'hoot': {
      const at = now;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, at);
      osc.frequency.linearRampToValueAtTime(frequency * 0.94, at + 0.8);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(0.12, at + 0.12);
      env.gain.linearRampToValueAtTime(0.08, at + 0.55);
      env.gain.exponentialRampToValueAtTime(FADE_EPSILON, at + 0.95);
      osc.connect(env).connect(gain);
      osc.start(at);
      osc.stop(at + 1);
      cleanup.push(osc, env);
      registry.dynamic.add(osc);
      break;
    }
    case 'gull': {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.35);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.05, now + 0.02);
      env.gain.exponentialRampToValueAtTime(FADE_EPSILON, now + 0.4);
      osc.connect(env).connect(gain);
      osc.start(now);
      osc.stop(now + 0.45);
      cleanup.push(osc, env);
      registry.dynamic.add(osc);
      break;
    }
    case 'creak': {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.linearRampToValueAtTime(frequency * 1.35, now + decay);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.05, now + 0.18);
      env.gain.exponentialRampToValueAtTime(FADE_EPSILON, now + decay);
      osc.connect(env).connect(gain);
      osc.start(now);
      osc.stop(now + decay + 0.05);
      cleanup.push(osc, env);
      registry.dynamic.add(osc);
      break;
    }
    case 'clink':
      tone('sine', frequency, 0.07, 0.22);
      tone('sine', frequency * 1.62, 0.05, 0.16);
      noiseBurst(0.03, 0.05, 'bandpass', frequency * 1.4, 2);
      break;
    case 'chair':
      noiseBurst(0.1, Math.max(0.18, decay), 'bandpass', frequency, 1.2);
      break;
    case 'page':
      noiseBurst(0.1, 0.32, 'bandpass', 2600, 0.9);
      noiseBurst(0.06, 0.22, 'highpass', 3800, 0.7);
      break;
    case 'rustle':
      noiseBurst(0.05, Math.max(0.4, decay), 'bandpass', frequency, 1.1);
      break;
    case 'typing': {
      const strokes = 3 + Math.floor(Math.random() * 6);
      for (let i = 0; i < strokes; i += 1) {
        const at = now + i * (0.055 + Math.random() * 0.05);
        const source = ctx.createBufferSource();
        source.buffer = grainBufferRef;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800 + Math.random() * 1600;
        filter.Q.value = 3;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(0.1, at + 0.002);
        env.gain.exponentialRampToValueAtTime(FADE_EPSILON, at + 0.035);
        source.connect(filter).connect(env).connect(gain);
        source.start(at);
        source.stop(at + 0.05);
        cleanup.push(source, filter, env);
        registry.dynamic.add(source);
      }
      break;
    }
    case 'clack': {
      noiseBurst(0.16, 0.05, 'bandpass', 1200, 1.6);
      tone('sine', 140, 0.1, 0.06);
      break;
    }
    case 'bee': {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190 + Math.random() * 60, now);
      osc.frequency.linearRampToValueAtTime(170 + Math.random() * 50, now + 1);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.05, now + 0.3);
      env.gain.linearRampToValueAtTime(0.03, now + 0.7);
      env.gain.exponentialRampToValueAtTime(FADE_EPSILON, now + Math.max(0.8, decay));
      osc.connect(filter).connect(env).connect(gain);
      osc.start(now);
      osc.stop(now + decay + 0.1);
      cleanup.push(osc, filter, env);
      registry.dynamic.add(osc);
      break;
    }
    case 'vinyl':
      noiseBurst(0.16, 0.012, 'highpass', 1800, 0.7);
      break;
    case 'thump':
      tone('sine', 62, 0.1, 0.09, 40);
      break;
    case 'ping': {
      const f = frequency;
      [f, f * 1.5, f * 2.02].forEach((partial, index) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = partial;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.05 / (index + 1), now + 0.02);
        env.gain.exponentialRampToValueAtTime(FADE_EPSILON, now + Math.max(0.8, decay));
        osc.connect(env).connect(gain);
        osc.start(now);
        osc.stop(now + decay + 0.1);
        cleanup.push(osc, env);
        registry.dynamic.add(osc);
      });
      break;
    }
    default:
      noiseBurst(0.08, 0.06, 'bandpass', frequency, 1.2);
      break;
  }

  // Tear down the grain's own nodes shortly after it has finished.
  const lifetime = Math.max(0.2, decay * 1.6, 0.4) * 1000;
  let timer = 0;
  timer = window.setTimeout(() => {
    // A playing bed creates one grain at a time and one cleanup timer with it;
    // forgetting old ids here would grow the registry for as long as it plays.
    registry.timers = registry.timers.filter((entry) => entry !== timer);
    gain.disconnect();
    cleanup.forEach((node) => {
      try {
        node.disconnect?.();
      } catch {
        /* already gone */
      }
      registry.dynamic.delete(node);
    });
    registry.dynamic.delete(gain);
  }, lifetime);
  registry.timers.push(timer);
}

function buildEvents(ctx, layer, registry, grains) {
  const output = ctx.createGain();
  output.gain.value = 1;
  const [minEvery, maxEvery] = layer.every || [1, 3];
  let nextAt = 0;
  let cancelled = false;

  const schedule = () => {
    if (cancelled) return;
    const now = performanceNow();
    if (nextAt === 0) nextAt = now + Math.random() * (maxEvery - minEvery) + minEvery;
    // Look ahead far enough to survive a throttled tab without bunching.
    while (nextAt < now + 1.2) {
      playGrain(ctx, registry, layer.event, grains, output, layer);
      nextAt += minEvery + Math.random() * Math.max(0, maxEvery - minEvery);
    }
  };

  schedule();
  const timer = window.setInterval(schedule, 400);
  registry.timers.push(timer);
  registry.stoppers.push(() => {
    cancelled = true;
    window.clearInterval(timer);
  });

  return { sources: [], output, nodes: [output] };
}

/* A monotonic clock that prefers the audio context's own time when available. */
function performanceNow() {
  return (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) / 1000;
}

function buildMusic(ctx, layer, registry) {
  const output = ctx.createGain();
  output.gain.value = 1;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2600;
  filter.Q.value = 0.4;
  filter.connect(output);
  registry.nodes.push(filter);

  const scale = layer.scale || [0, 2, 4, 7, 9];
  const root = layer.root || 220;
  const [beatMin, beatMax] = layer.beat || [0.7, 1.2];
  const octaves = layer.octave || [0, 1];
  let step = 0;
  let cancelled = false;
  let last = 0;

  const frequencyFor = (degree) => {
    const octave = octaves[Math.floor(step / Math.max(1, layer.chordEvery || 8)) % octaves.length] || 0;
    const semitone = scale[degree % scale.length] + 12 * octave;
    return root * 2 ** (semitone / 12);
  };

  const note = (frequency, at, length, level) => {
    const osc = ctx.createOscillator();
    osc.type = layer.wave || 'triangle';
    osc.frequency.value = frequency;
    const detune = ctx.createOscillator();
    detune.type = 'sine';
    detune.frequency.value = 4.5;
    const detuneDepth = ctx.createGain();
    detuneDepth.gain.value = 3;
    detune.connect(detuneDepth).connect(osc.detune);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + 0.02);
    env.gain.exponentialRampToValueAtTime(FADE_EPSILON, at + length);
    osc.connect(env).connect(filter);
    osc.start(at);
    osc.stop(at + length + 0.05);
    detune.start(at);
    detune.stop(at + length + 0.05);
    registry.dynamic.add(osc);
    registry.dynamic.add(detune);
  };

  const schedule = () => {
    if (cancelled) return;
    const now = ctx.currentTime;
    if (last === 0) last = now + 0.1;
    while (last < now + 1.5) {
      const beat = beatMin + Math.random() * Math.max(0, beatMax - beatMin);
      const degree = Math.floor(Math.random() * scale.length);
      note(frequencyFor(degree), last, layer.noteLength || 2.4, 0.1 * (layer.gain ?? 0.5) + 0.02);
      // A held chord every few notes keeps the figure from feeling aimless.
      if (step > 0 && step % (layer.chordEvery || 8) === 0) {
        for (const chordDegree of layer.chord || [0, 4, 7]) {
          note(root * 2 ** ((scale[chordDegree % scale.length] + 12) / 12), last, (layer.noteLength || 2.4) * 1.6, 0.035);
        }
      }
      last += beat;
      step += 1;
    }
  };

  schedule();
  const timer = window.setInterval(schedule, 400);
  registry.timers.push(timer);
  registry.stoppers.push(() => {
    cancelled = true;
    window.clearInterval(timer);
  });

  return { sources: [], output, nodes: [output] };
}

/**
 * Build one soundscape channel.
 * @param {AudioContext} ctx
 * @param {object} def catalogue entry
 * @param {{nodes: any[], timers: number[], dynamic: Set<any>, stoppers: Function[]}} registry
 */
export function buildSoundscape(ctx, def, registry) {
  if (!def || def.kind !== 'recipe' || !def.recipe) return null;
  const layers = def.recipe.layers || [];
  const output = ctx.createGain();
  output.gain.value = 0.9;
  registry.nodes.push(output);
  const sources = [];
  const grains = grainBuffer(ctx);

  for (const layer of layers) {
    let built = null;
    if (layer.type === 'noise') built = buildNoise(ctx, layer, registry);
    else if (layer.type === 'drone') built = buildDrone(ctx, layer, registry);
    else if (layer.type === 'events') built = buildEvents(ctx, layer, registry, grains);
    else if (layer.type === 'music') built = buildMusic(ctx, layer, registry);
    if (!built) continue;
    const layerGain = ctx.createGain();
    layerGain.gain.value = layer.gain ?? 0.3;
    built.output.connect(layerGain).connect(output);
    registry.nodes.push(layerGain);
    sources.push(...built.sources);
    registry.nodes.push(...built.nodes);
  }

  return { sources, output, filter: null, nodes: [output] };
}
