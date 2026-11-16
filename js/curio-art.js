/* =============================================================================
   curio-art.js — every collectible draws its own portrait

   No image files: each curio's artwork is generated as SVG from its palette,
   its motif, and a hash of its id. The hash seeds a small deterministic random
   generator, so a curio looks the same on every visit, on every device, forever
   — without a single byte of binary art in the repository.
   ========================================================================== */

import { PALETTES, CURIO_BY_ID, CURIO_IDS } from './curios.js';

/** FNV-1a: small, stable, and good enough to seed a drawing. */
function hash(text) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/** mulberry32: deterministic, tiny. */
function rngFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value) => Math.round(value * 10) / 10;

/* -------------------------------------------------------------------------- */
/* Motifs — each returns SVG markup for a 120 × 148 canvas                     */
/* -------------------------------------------------------------------------- */

const MOTIFS = {
  book(c) {
    return `
      <path d="M60 52c-10-7-22-10-32-10v56c10 0 22 3 32 10 10-7 22-10 32-10V42c-10 0-22 3-32 10Z" fill="${c.a}" opacity=".16"/>
      <path d="M60 52c-10-7-22-10-32-10v56c10 0 22 3 32 10 10-7 22-10 32-10V42c-10 0-22 3-32 10Z" fill="none" stroke="${c.light}" stroke-width="1.3"/>
      <path d="M60 52v56" stroke="${c.light}" stroke-width="1" opacity=".7"/>
      <path d="M36 54c7 .4 13 1.8 18 4M36 62c7 .4 13 1.8 18 4M36 70c7 .4 13 1.8 18 4" stroke="${c.a}" stroke-width=".8" opacity=".8"/>
      <path d="M84 54c-7 .4-13 1.8-18 4M84 62c-7 .4-13 1.8-18 4" stroke="${c.a}" stroke-width=".8" opacity=".5"/>`;
  },
  map(c, rng) {
    const bends = [0, 1, 2].map(() => round(40 + rng() * 32)).join(' ');
    return `
      <rect x="22" y="36" width="76" height="76" rx="3" fill="${c.a}" opacity=".1" stroke="${c.light}" stroke-width="1.1"/>
      <path d="M22 60h76M22 84h76M46 36v76M74 36v76" stroke="${c.a}" stroke-width=".5" opacity=".35"/>
      <path d="M30 104C44 92 ${bends.split(' ')[0]} 70 62 56" fill="none" stroke="${c.light}" stroke-width="1.4" stroke-dasharray="4 4"/>
      <path d="M84 46l8 8M92 46l-8 8" stroke="${c.light}" stroke-width="1.6"/>
      <circle cx="38" cy="52" r="2.2" fill="${c.light}"/>
      <path d="M26 100c10-10 14-22 10-30" fill="none" stroke="${c.mid}" stroke-width=".8" opacity=".7"/>`;
  },
  feather(c) {
    const barbs = Array.from({ length: 7 }, (_, i) => {
      const y = 52 + i * 7;
      return `<path d="M62 ${y}l${12 + i * 1.5} -${7 + i}" stroke="${c.mid}" stroke-width=".7" opacity=".75"/>
              <path d="M62 ${y}l-${12 + i * 1.5} -${7 + i}" stroke="${c.mid}" stroke-width=".7" opacity=".75"/>`;
    }).join('');
    return `
      <path d="M62 110C40 92 52 52 62 38c10 14 22 54 0 72Z" fill="${c.a}" opacity=".14"/>
      <path d="M62 110V38" stroke="${c.light}" stroke-width="1.2"/>
      ${barbs}
      <path d="M62 110c0 8-3 12-6 14" stroke="${c.light}" stroke-width="1" opacity=".7"/>`;
  },
  envelope(c) {
    return `
      <rect x="24" y="50" width="72" height="50" rx="2.5" fill="${c.a}" opacity=".12" stroke="${c.light}" stroke-width="1.1"/>
      <path d="M24 50l36 27 36-27" fill="none" stroke="${c.light}" stroke-width="1.1"/>
      <circle cx="60" cy="100" r="6" fill="${c.mid}" opacity=".75"/>
      <circle cx="60" cy="100" r="2.4" fill="${c.deep}"/>
      <path d="M34 40h52M34 34h30" stroke="${c.a}" stroke-width=".8" opacity=".5"/>`;
  },
  seed(c) {
    return `
      <path d="M60 104c-16-11-16-34 0-48 16 14 16 37 0 48Z" fill="${c.a}" opacity=".18" stroke="${c.light}" stroke-width="1.1"/>
      <path d="M60 104V60" stroke="${c.light}" stroke-width=".9"/>
      <path d="M60 62c-8-6-14-16-12-26 9 2 15 12 12 26ZM60 62c8-6 14-16 12-26-9 2-15 12-12 26Z" fill="${c.mid}" opacity=".4" stroke="${c.light}" stroke-width=".8"/>
      <path d="M44 112c8-4 24-4 32 0" stroke="${c.a}" stroke-width=".8" opacity=".6"/>`;
  },
  bell(c) {
    return `
      <path d="M60 40c-13 0-18 15-18 28 0 10-4 14-8 18h52c-4-4-8-8-8-18 0-13-5-28-18-28Z" fill="${c.a}" opacity=".15" stroke="${c.light}" stroke-width="1.2"/>
      <path d="M54 86c0 5 3 8 6 8s6-3 6-8" fill="none" stroke="${c.light}" stroke-width="1.3"/>
      <path d="M60 34v6" stroke="${c.light}" stroke-width="1.4"/>
      <path d="M80 58c6 5 6 16 0 21M38 58c-6 5-6 16 0 21" stroke="${c.mid}" stroke-width=".8" opacity=".6"/>
      <path d="M30 98h60" stroke="${c.a}" stroke-width=".9" opacity=".5"/>`;
  },
  cube(c) {
    return `
      <path d="M60 36l28 16v40L60 108 32 92V52Z" fill="${c.a}" opacity=".1" stroke="${c.light}" stroke-width="1.2"/>
      <path d="M60 36v72M32 52l28 16 28-16M32 92l28-24M88 92L60 68" fill="none" stroke="${c.light}" stroke-width=".8" opacity=".75"/>
      <circle cx="60" cy="68" r="2" fill="${c.light}"/>`;
  },
  constellation(c, rng) {
    const points = Array.from({ length: 7 }, () => ({
      x: round(30 + rng() * 60),
      y: round(42 + rng() * 64),
    }));
    const lines = points
      .map((point, index) => {
        const next = points[(index + 1) % points.length];
        if (index % 2) return '';
        return `<line x1="${point.x}" y1="${point.y}" x2="${next.x}" y2="${next.y}" stroke="${c.mid}" stroke-width=".7" opacity=".6"/>`;
      })
      .join('');
    const stars = points
      .map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="${index % 3 === 0 ? 2.4 : 1.4}" fill="${c.light}"/>`)
      .join('');
    return `${lines}${stars}
      <circle cx="60" cy="74" r="42" fill="none" stroke="${c.a}" stroke-width=".5" opacity=".3"/>`;
  },
  orrery(c) {
    return `
      <circle cx="60" cy="74" r="9" fill="${c.mid}" opacity=".65"/>
      <circle cx="60" cy="74" r="9" fill="none" stroke="${c.light}" stroke-width="1"/>
      <ellipse cx="60" cy="74" rx="34" ry="17" fill="none" stroke="${c.light}" stroke-width=".9" opacity=".8"/>
      <ellipse cx="60" cy="74" rx="22" ry="42" fill="none" stroke="${c.a}" stroke-width=".7" opacity=".55" transform="rotate(28 60 74)"/>
      <circle cx="94" cy="74" r="3.4" fill="${c.light}"/>
      <circle cx="34" cy="86" r="2.4" fill="${c.light}" opacity=".8"/>
      <circle cx="70" cy="38" r="2" fill="${c.mid}"/>
      <path d="M26 118h68" stroke="${c.a}" stroke-width=".8" opacity=".5"/>`;
  },
  moon(c) {
    return `
      <path d="M74 44a32 32 0 1 0 0 60 26 26 0 1 1 0-60Z" fill="${c.a}" opacity=".18" stroke="${c.light}" stroke-width="1.2"/>
      <path d="M86 52l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z" fill="${c.light}" opacity=".9"/>
      <path d="M94 88l1.2 3.2 3.2 1.2-3.2 1.2-1.2 3.2-1.2-3.2-3.2-1.2 3.2-1.2z" fill="${c.mid}" opacity=".8"/>
      <circle cx="84" cy="70" r="1.4" fill="${c.light}" opacity=".7"/>
      <path d="M30 116h40" stroke="${c.a}" stroke-width=".8" opacity=".45"/>`;
  },
  compass(c) {
    const ticks = Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI) / 4;
      const x1 = round(60 + Math.cos(angle) * 34);
      const y1 = round(74 + Math.sin(angle) * 34);
      const x2 = round(60 + Math.cos(angle) * 40);
      const y2 = round(74 + Math.sin(angle) * 40);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c.a}" stroke-width=".8" opacity=".7"/>`;
    }).join('');
    return `
      <circle cx="60" cy="74" r="34" fill="${c.a}" opacity=".1" stroke="${c.light}" stroke-width="1.1"/>
      <circle cx="60" cy="74" r="40" fill="none" stroke="${c.a}" stroke-width=".6" opacity=".5"/>
      ${ticks}
      <path d="M60 50l7 24-7 24-7-24z" fill="${c.light}" opacity=".85"/>
      <circle cx="60" cy="74" r="2.6" fill="${c.deep}"/>`;
  },
  ladder(c) {
    const rungs = Array.from({ length: 7 }, (_, i) => `<line x1="48" y1="${44 + i * 9}" x2="72" y2="${44 + i * 9}" stroke="${c.light}" stroke-width="1.1" opacity=".8"/>`).join('');
    return `
      <line x1="48" y1="36" x2="48" y2="112" stroke="${c.light}" stroke-width="1.6"/>
      <line x1="72" y1="36" x2="72" y2="112" stroke="${c.light}" stroke-width="1.6"/>
      ${rungs}
      <path d="M40 118c8-4 32-4 40 0" stroke="${c.a}" stroke-width=".8" opacity=".5"/>`;
  },
  prism(c) {
    return `
      <path d="M60 40L92 100H28Z" fill="${c.a}" opacity=".16" stroke="${c.light}" stroke-width="1.2"/>
      <path d="M60 40v60M28 100h64" stroke="${c.a}" stroke-width=".5" opacity=".3"/>
      <path d="M92 100h14M92 106h18M92 112h12" stroke="${c.light}" stroke-width="1.2" opacity=".85"/>
      <path d="M92 94h10" stroke="${c.mid}" stroke-width="1.2" opacity=".7"/>`;
  },
  clock(c) {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const angle = (i * Math.PI) / 6;
      const inner = i % 3 === 0 ? 26 : 29;
      return `<line x1="${round(60 + Math.cos(angle) * inner)}" y1="${round(74 + Math.sin(angle) * inner)}" x2="${round(60 + Math.cos(angle) * 32)}" y2="${round(74 + Math.sin(angle) * 32)}" stroke="${c.a}" stroke-width="${i % 3 === 0 ? 1.1 : 0.6}" opacity=".8"/>`;
    }).join('');
    return `
      <circle cx="60" cy="74" r="36" fill="${c.a}" opacity=".1" stroke="${c.light}" stroke-width="1.2"/>
      <circle cx="60" cy="74" r="32" fill="none" stroke="${c.a}" stroke-width=".7" opacity=".6"/>
      ${ticks}
      <path d="M60 74V54M60 74l15 9" stroke="${c.light}" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="60" cy="74" r="2.4" fill="${c.light}"/>`;
  },
  fern(c) {
    const fronds = Array.from({ length: 6 }, (_, i) => {
      const y = 96 - i * 10;
      const spread = 8 + i * 2.5;
      return `<path d="M60 ${y}c${spread} -3 ${spread + 6} -8 ${spread + 10} -14" fill="none" stroke="${c.mid}" stroke-width=".9" opacity=".8"/>
              <path d="M60 ${y}c-${spread} -3 -${spread + 6} -8 -${spread + 10} -14" fill="none" stroke="${c.mid}" stroke-width=".9" opacity=".8"/>`;
    }).join('');
    return `
      <path d="M60 116V44" stroke="${c.light}" stroke-width="1.3"/>
      ${fronds}
      <path d="M60 44c-5-5-5-10 0-13 5 3 5 8 0 13Z" fill="${c.light}" opacity=".7"/>`;
  },
  bottle(c) {
    return `
      <path d="M52 42h16v10l6 10v46a4 4 0 0 1-4 4H50a4 4 0 0 1-4-4V62l6-10Z" fill="${c.a}" opacity=".16" stroke="${c.light}" stroke-width="1.1"/>
      <path d="M48 88h24v20a4 4 0 0 1-4 4H52a4 4 0 0 1-4-4Z" fill="${c.mid}" opacity=".35"/>
      <rect x="51" y="36" width="18" height="7" rx="2" fill="${c.mid}" opacity=".7"/>
      <path d="M52 60h16" stroke="${c.a}" stroke-width=".7" opacity=".7"/>`;
  },
  wave(c) {
    const lines = [0, 1, 2].map((row) => {
      const y = 56 + row * 18;
      return `<path d="M24 ${y}c8-9 16-9 24 0s16 9 24 0 16-9 24 0" fill="none" stroke="${row === 1 ? c.light : c.mid}" stroke-width="${row === 1 ? 1.4 : 0.9}" opacity="${row === 1 ? 0.95 : 0.6}"/>`;
    }).join('');
    return `${lines}
      <circle cx="60" cy="112" r="2" fill="${c.a}" opacity=".6"/>
      <circle cx="42" cy="118" r="1.3" fill="${c.a}" opacity=".4"/>`;
  },
  lamp(c) {
    return `
      <path d="M42 54h36l10 30H32Z" fill="${c.a}" opacity=".22" stroke="${c.light}" stroke-width="1.1"/>
      <path d="M60 34v20" stroke="${c.light}" stroke-width="1.4"/>
      <path d="M50 84h20l4 22H46Z" fill="${c.mid}" opacity=".3" stroke="${c.light}" stroke-width=".9"/>
      <path d="M44 106h32v4H44Z" fill="${c.mid}" opacity=".6"/>
      <path d="M40 66c-6 8-6 18 0 24M80 66c6 8 6 18 0 24" stroke="${c.light}" stroke-width=".7" opacity=".45"/>`;
  },
  key(c) {
    return `
      <circle cx="60" cy="54" r="12" fill="none" stroke="${c.light}" stroke-width="1.6"/>
      <circle cx="60" cy="54" r="5" fill="none" stroke="${c.a}" stroke-width="1"/>
      <path d="M60 66v46M60 96h11M60 104h8M60 111h12" stroke="${c.light}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M48 54h-8M72 54h8" stroke="${c.mid}" stroke-width=".8" opacity=".7"/>`;
  },
  moth(c) {
    return `
      <path d="M58 74c-14-22-34-24-34-6 0 16 20 22 34 12Z" fill="${c.a}" opacity=".2" stroke="${c.light}" stroke-width="1"/>
      <path d="M62 74c14-22 34-24 34-6 0 16-20 22-34 12Z" fill="${c.a}" opacity=".2" stroke="${c.light}" stroke-width="1"/>
      <path d="M58 82c-10 16-26 18-24 4 1-9 14-14 24-8Z" fill="${c.mid}" opacity=".25" stroke="${c.light}" stroke-width=".8"/>
      <path d="M62 82c10 16 26 18 24 4-1-9-14-14-24-8Z" fill="${c.mid}" opacity=".25" stroke="${c.light}" stroke-width=".8"/>
      <path d="M60 68v26" stroke="${c.light}" stroke-width="1.4"/>
      <path d="M60 68c-4-8-8-10-12-10M60 68c4-8 8-10 12-10" stroke="${c.light}" stroke-width=".8" opacity=".8"/>
      <circle cx="60" cy="66" r="2" fill="${c.light}"/>`;
  },
  disc(c) {
    return `
      <circle cx="60" cy="74" r="40" fill="${c.deep}" opacity=".5"/>
      <circle cx="60" cy="74" r="40" fill="none" stroke="${c.light}" stroke-width="1.2"/>
      <circle cx="60" cy="74" r="31" fill="none" stroke="${c.a}" stroke-width=".5" opacity=".6"/>
      <circle cx="60" cy="74" r="24" fill="none" stroke="${c.a}" stroke-width=".5" opacity=".5"/>
      <circle cx="60" cy="74" r="10" fill="${c.mid}" opacity=".65"/>
      <circle cx="60" cy="74" r="2" fill="${c.light}"/>
      <path d="M84 48c6 4 9 10 9 16" stroke="${c.light}" stroke-width=".8" opacity=".7"/>`;
  },
  tape(c) {
    return `
      <rect x="26" y="52" width="68" height="44" rx="4" fill="${c.a}" opacity=".12" stroke="${c.light}" stroke-width="1.1"/>
      <circle cx="44" cy="74" r="10" fill="none" stroke="${c.light}" stroke-width="1.1"/>
      <circle cx="76" cy="74" r="10" fill="none" stroke="${c.light}" stroke-width="1.1"/>
      <circle cx="44" cy="74" r="3" fill="${c.mid}"/>
      <circle cx="76" cy="74" r="3" fill="${c.mid}"/>
      <path d="M44 84c8 4 24 4 32 0" stroke="${c.mid}" stroke-width="1.2" opacity=".8"/>
      <path d="M32 104h56" stroke="${c.a}" stroke-width=".8" opacity=".6"/>`;
  },
};

/* Gradient ids must be unique per instance: the same curio can be on screen
   twice (shelf and collection, say), and duplicate SVG ids resolve unpredictably. */
let artSerial = 0;

/**
 * Render a curio as SVG markup.
 * Unknown motifs fall back to an orrery so the cabinet can never show nothing.
 */
export function curioArt(curio, { title = '' } = {}) {
  if (!curio) return '';
  const palette = PALETTES[curio.palette] || PALETTES.gold;
  const seed = hash(String(curio.id || 'unknown'));
  const rng = rngFrom(seed);
  const motif = MOTIFS[curio.motif] || MOTIFS.orrery;
  // A second seed gives every piece a small pose of its own, so two curios
  // that share a motif (two ferns, two moons) are still distinguishable.
  const variant = rngFrom(hash(`${curio.id}:pose`));
  const tilt = round((variant() - 0.5) * 5);
  const pose = round(0.94 + variant() * 0.1);
  const ticks = Array.from({ length: 2 + Math.floor(variant() * 3) }, (_, index) => {
    const y = round(14 + index * 4.2);
    const length = round(2.5 + variant() * 5);
    return `<path d="M${round(105 - length)} ${y}h${length}"/>`;
  }).join('');
  artSerial += 1;
  const id = `cg-${seed.toString(36)}-${artSerial.toString(36)}`;
  const label = title || curio.name || 'A curio';
  const stars = Array.from({ length: 14 }, () => {
    const x = round(12 + rng() * 96);
    const y = round(10 + rng() * 128);
    return `<circle cx="${x}" cy="${y}" r="${round(0.4 + rng() * 0.8)}" fill="${palette.light}" opacity="${round(0.15 + rng() * 0.35)}"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" class="curio__art" viewBox="0 0 120 148" role="img" aria-label="${escapeAttr(label)}" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="${palette.deep}"/>
        <stop offset="0.55" stop-color="${palette.deep}" stop-opacity="0.82"/>
        <stop offset="1" stop-color="#05060a"/>
      </linearGradient>
      <radialGradient id="${id}-glow" cx="0.5" cy="0.45" r="0.6">
        <stop offset="0" stop-color="${palette.mid}" stop-opacity="0.4"/>
        <stop offset="1" stop-color="${palette.mid}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="120" height="148" fill="url(#${id})"/>
    <rect width="120" height="148" fill="url(#${id}-glow)"/>
    ${stars}
    <g transform="translate(60 74) rotate(${tilt}) scale(${pose}) translate(-60 -74)"
      stroke-linecap="round" stroke-linejoin="round">${motif(palette, rng)}</g>
    <g fill="none" stroke="${palette.light}" stroke-width="0.7" opacity="0.32">${ticks}</g>
    <rect x="5.5" y="5.5" width="109" height="137" rx="6" fill="none" stroke="${palette.light}" stroke-width="0.6" opacity="0.28"/>
  </svg>`;
}

/** Look up a curio by id and draw it; unknown ids yield an empty string. */
export function artForId(id) {
  return CURIO_IDS.has(id) ? curioArt(CURIO_BY_ID.get(id)) : '';
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const MOTIF_NAMES = Object.keys(MOTIFS);
