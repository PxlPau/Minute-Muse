/* =============================================================================
   curios.js — the catalogue of the Cabinet

   Ninety-odd small, particular things: a book scorpion, the isle of error, a
   cassette of your own breathing. Twelve collections of seven, each collection
   ending in a singular piece that can only be assembled from the other six.

   Everything here is invented for this room. Epigraphs are original lines
   given deliberately fictional provenance so they can never be mistaken for
   real quotations. The catalogue is pure data: no DOM, no storage, no clocks.
   ========================================================================== */

export const RARITIES = ['common', 'uncommon', 'rare', 'singular'];

export const RARITY_META = {
  common: { label: 'Common', weight: 58, echo: 12 },
  uncommon: { label: 'Uncommon', weight: 30, echo: 30 },
  rare: { label: 'Rare', weight: 12, echo: 55 },
  singular: { label: 'Singular', weight: 0, echo: 0 },
};

export const PALETTES = {
  ember: { light: '#f6c9a2', mid: '#d98055', deep: '#5c2a1e' },
  gold: { light: '#f4dda8', mid: '#c9a35c', deep: '#4a3a1a' },
  verdigris: { light: '#a8ded0', mid: '#4e9a8a', deep: '#1d3a35' },
  heather: { light: '#d3c1ee', mid: '#8a6cb8', deep: '#2e2342' },
  rose: { light: '#f0c3c6', mid: '#b96f78', deep: '#3d1f24' },
  indigo: { light: '#b9c6f2', mid: '#5a6cae', deep: '#1c2340' },
  moss: { light: '#cbdcae', mid: '#7a9455', deep: '#26301a' },
  bone: { light: '#eee7d6', mid: '#b3a88f', deep: '#3a352a' },
  cyan: { light: '#aee6f2', mid: '#4f9cb2', deep: '#153038' },
  rust: { light: '#efb99b', mid: '#b56b47', deep: '#40241a' },
};

/** Every curio in the cabinet. Sets are declared in order below. */
const SETS_DATA = [
  {
    id: 'marginalia',
    name: 'The Marginalists',
    blurb: 'Everything that happens in the white space around a text.',
    palette: 'bone',
    items: [
      {
        id: 'pencil-note',
        name: 'Pencil Note, Undated',
        rarity: 'common',
        motif: 'book',
        epigraph: '“Not this. Try again in the morning.”',
        source: 'pencil, on the verso of a title page',
      },
      {
        id: 'foxed-folio',
        name: 'Foxed Folio',
        rarity: 'common',
        motif: 'map',
        epigraph: '“Age is a weather that happens indoors.”',
        source: 'A Note on Paper, 3rd ed.',
      },
      {
        id: 'dog-ear',
        name: 'The Dog-Ear',
        rarity: 'common',
        motif: 'feather',
        epigraph: '“I folded the corner. The sentence folded me.”',
        source: 'Reader’s margin, unnamed',
      },
      {
        id: 'errata-slip',
        name: 'Errata Slip',
        rarity: 'uncommon',
        motif: 'envelope',
        epigraph: '“For ‘world’, read ‘word’. The sense survives.”',
        source: 'Printer’s insert, 1911',
      },
      {
        id: 'bookworm',
        name: 'Bookworm',
        rarity: 'uncommon',
        motif: 'seed',
        epigraph: '“It read the dictionary from the inside out.”',
        source: 'Entomology of Libraries, vol. II',
      },
      {
        id: 'colophon',
        name: 'Colophon',
        rarity: 'rare',
        motif: 'bell',
        epigraph: '“Finished on the ninth of March, in the rain, badly.”',
        source: 'the last page of a small press book',
      },
      {
        id: 'bookplate',
        name: 'Ex Libris, Reversed',
        rarity: 'singular',
        motif: 'cube',
        epigraph: '“This book belongs to whoever it changes.”',
        source: 'a plate printed from the wrong side',
      },
    ],
  },
  {
    id: 'orrery',
    name: 'The Orrery Club',
    blurb: 'Minutes of a society that met only when the sky allowed it.',
    palette: 'indigo',
    items: [
      {
        id: 'comet-fragment',
        name: 'Comet, Fragmentary',
        rarity: 'common',
        motif: 'constellation',
        epigraph: '“Seen for four nights. Presumed a mistake by the fifth.”',
        source: 'The Orrery Club, minutes of 1897',
      },
      {
        id: 'analemma',
        name: 'Analemma',
        rarity: 'common',
        motif: 'orrery',
        epigraph: '“The sun is never where the clock says. That is the arrangement.”',
        source: 'Sundials & Their Discontents',
      },
      {
        id: 'perigee',
        name: 'Perigee',
        rarity: 'common',
        motif: 'moon',
        epigraph: '“Closest approach. Nothing was said.”',
        source: 'observation log, unnumbered',
      },
      {
        id: 'meridian',
        name: 'The Meridian',
        rarity: 'uncommon',
        motif: 'compass',
        epigraph: '“An imaginary line with excellent posture.”',
        source: 'Elementary Astronomy for the Impatient',
      },
      {
        id: 'zenith',
        name: 'Zenith, Unobserved',
        rarity: 'uncommon',
        motif: 'ladder',
        epigraph: '“The point directly overhead. Mind the step.”',
        source: 'a lecture, badly transcribed',
      },
      {
        id: 'redshift',
        name: 'Redshift',
        rarity: 'rare',
        motif: 'prism',
        epigraph: '“Everything leaving us leaves a warmer colour.”',
        source: 'Light, Measured Slowly',
      },
      {
        id: 'sidereal-clock',
        name: 'Sidereal Clock',
        rarity: 'singular',
        motif: 'clock',
        epigraph: '“It keeps star time. You will be late for everything.”',
        source: 'the club’s only surviving instrument',
      },
    ],
  },
  {
    id: 'nightbloom',
    name: 'Botanicals of the Small Hours',
    blurb: 'Plants that keep the hours you keep.',
    palette: 'moss',
    items: [
      {
        id: 'moonflower',
        name: 'Moonflower',
        rarity: 'common',
        motif: 'moon',
        epigraph: '“Opens at dusk; forgets by breakfast.”',
        source: 'A Night Garden',
      },
      {
        id: 'cereus',
        name: 'Night-Blooming Cereus',
        rarity: 'common',
        motif: 'fern',
        epigraph: '“One night a year, and no announcement.”',
        source: 'field note, pressed between pages 44 and 45',
      },
      {
        id: 'fern-spore',
        name: 'Fern Spore',
        rarity: 'common',
        motif: 'seed',
        epigraph: '“A whole forest the size of a full stop.”',
        source: 'Microscopy for the Patient',
      },
      {
        id: 'lichen',
        name: 'Lichen on a Gravestone',
        rarity: 'uncommon',
        motif: 'map',
        epigraph: '“It is older than the name it is eating.”',
        source: 'Stones, Slowly',
      },
      {
        id: 'mycelium',
        name: 'Mycelium',
        rarity: 'uncommon',
        motif: 'constellation',
        epigraph: '“The forest is one thing wearing many hats.”',
        source: 'Underground Correspondence',
      },
      {
        id: 'dew-gauge',
        name: 'Dew Gauge',
        rarity: 'rare',
        motif: 'bottle',
        epigraph: '“Measured the morning. Received eight inches of night.”',
        source: 'a garden ledger, in pencil',
      },
      {
        id: 'ghost-orchid',
        name: 'Ghost Orchid',
        rarity: 'singular',
        motif: 'fern',
        epigraph: '“Photographed never. Described often.”',
        source: 'the last leaf of a lost herbarium',
      },
    ],
  },
  {
    id: 'lighthouse',
    name: 'The Lighthouse Ledger',
    blurb: 'A keeper’s inventory, kept against the dark and the damp.',
    palette: 'cyan',
    items: [
      {
        id: 'oil-ration',
        name: 'Oil Ration',
        rarity: 'common',
        motif: 'bottle',
        epigraph: '“Four hours of light in the can. Spend it kindly.”',
        source: 'Ledger of the Sable Lighthouse, 1904',
      },
      {
        id: 'fog-signal',
        name: 'Fog Signal',
        rarity: 'common',
        motif: 'bell',
        epigraph: '“Sound does the work the light cannot.”',
        source: 'keeper’s log, 12th of November',
      },
      {
        id: 'tide-table',
        name: 'Tide Table',
        rarity: 'common',
        motif: 'wave',
        epigraph: '“High water, 04:12. Low water, whenever it likes.”',
        source: 'printed card, water-stained',
      },
      {
        id: 'fresnel',
        name: 'Fresnel Lens',
        rarity: 'uncommon',
        motif: 'prism',
        epigraph: '“A beehive of glass with one idea.”',
        source: 'The Optics of Warning',
      },
      {
        id: 'drowned-bell',
        name: 'The Drowned Bell',
        rarity: 'uncommon',
        motif: 'bell',
        epigraph: '“Rung once a year by the sea, without permission.”',
        source: 'coastal folklore, unsourced',
      },
      {
        id: 'gull-feather',
        name: 'Gull Feather',
        rarity: 'rare',
        motif: 'feather',
        epigraph: '“Weightless, waterproof, entirely unbothered.”',
        source: 'windowsill, second floor',
      },
      {
        id: 'last-light',
        name: 'The Last Light',
        rarity: 'singular',
        motif: 'lamp',
        epigraph: '“Automated in 1987. The keeper left the lamp on anyway.”',
        source: 'the final entry in the ledger',
      },
    ],
  },
  {
    id: 'instruments',
    name: 'Instruments & Implements',
    blurb: 'Tools that measured things nobody had asked to know.',
    palette: 'gold',
    items: [
      {
        id: 'sextant',
        name: 'Brass Sextant',
        rarity: 'common',
        motif: 'compass',
        epigraph: '“Finds you by finding the horizon.”',
        source: 'Navigational Aids, plate IX',
      },
      {
        id: 'tuning-fork',
        name: 'Tuning Fork, A440',
        rarity: 'common',
        motif: 'wave',
        epigraph: '“The note before the music. Some prefer it.”',
        source: 'The Standard Pitch Dispute',
      },
      {
        id: 'slide-rule',
        name: 'Slide Rule',
        rarity: 'common',
        motif: 'cube',
        epigraph: '“Two numbers meet in the middle and agree.”',
        source: 'Engineering, Familiar',
      },
      {
        id: 'spirit-level',
        name: 'Spirit Level',
        rarity: 'uncommon',
        motif: 'bottle',
        epigraph: '“A bubble with strong opinions about truth.”',
        source: 'a builder’s notebook',
      },
      {
        id: 'letterpress-sort',
        name: 'Letterpress Sort, “e”',
        rarity: 'uncommon',
        motif: 'key',
        epigraph: '“The most-used letter, worn down to a suggestion.”',
        source: 'cases and cabinets',
      },
      {
        id: 'cyanotype',
        name: 'Cyanotype Test Strip',
        rarity: 'rare',
        motif: 'map',
        epigraph: '“Fourteen shades of blue, all of them time.”',
        source: 'An Atlas of Exposures',
      },
      {
        id: 'pocket-prism',
        name: 'Pocket Prism',
        rarity: 'singular',
        motif: 'prism',
        epigraph: '“It does not make colour. It admits what was hidden.”',
        source: 'a coat pocket, unclaimed',
      },
    ],
  },
  {
    id: 'fieldnotes',
    name: 'Field Notes of Nowhere',
    blurb: 'Papers from places that were never quite on the way.',
    palette: 'rust',
    items: [
      {
        id: 'unsent-postcard',
        name: 'Unsent Postcard',
        rarity: 'common',
        motif: 'envelope',
        epigraph: '“Weather fine. Wish you were someone else.”',
        source: 'message side, never addressed',
      },
      {
        id: 'hotel-key',
        name: 'Hotel Key, Room 11',
        rarity: 'common',
        motif: 'key',
        epigraph: '“Brass, heavy, and for a hotel that closed in 1962.”',
        source: 'found in a paperback',
      },
      {
        id: 'timetable',
        name: 'Timetable for a Town That Isn’t',
        rarity: 'common',
        motif: 'map',
        epigraph: '“Departs 06:14. Arrives never. Platform two.”',
        source: 'railway ephemera, unverifiable',
      },
      {
        id: 'passport-stamp',
        name: 'Passport Stamp, Illegible',
        rarity: 'uncommon',
        motif: 'compass',
        epigraph: '“Admitted. The country is a matter of opinion.”',
        source: 'border, unspecified',
      },
      {
        id: 'weather-balloon',
        name: 'Weather Balloon, Recovered',
        rarity: 'uncommon',
        motif: 'orrery',
        epigraph: '“It went up to look. It came down with news.”',
        source: 'a hedge in the next county',
      },
      {
        id: 'map-legend',
        name: 'Map Legend, Incomplete',
        rarity: 'rare',
        motif: 'map',
        epigraph: '“— : a road. ···· : a rumour.”',
        source: 'cartographer’s key, final line lost',
      },
      {
        id: 'blank-atlas',
        name: 'The Blank Atlas',
        rarity: 'singular',
        motif: 'book',
        epigraph: '“Every page ruled. Every page empty. Extremely useful.”',
        source: 'shelf mark 0.0',
      },
    ],
  },
  {
    id: 'bestiary',
    name: 'The Paper Bestiary',
    blurb: 'Creatures that live in folds, glue, and the gutter of a book.',
    palette: 'heather',
    items: [
      {
        id: 'origami-moth',
        name: 'Origami Moth',
        rarity: 'common',
        motif: 'moth',
        epigraph: '“Attracted to the lamp, afraid of the crease.”',
        source: 'Folds for the Impatient',
      },
      {
        id: 'paper-wasp',
        name: 'Paper Wasp',
        rarity: 'common',
        motif: 'moth',
        epigraph: '“Builds a home from a book it has finished.”',
        source: 'Hymenoptera of the Desk',
      },
      {
        id: 'ink-squid',
        name: 'Ink Squid',
        rarity: 'common',
        motif: 'bottle',
        epigraph: '“Escapes criticism by producing more of it.”',
        source: 'Natural History of the Nib',
      },
      {
        id: 'book-scorpion',
        name: 'Book Scorpion',
        rarity: 'uncommon',
        motif: 'seed',
        epigraph: '“Harmless. Eats the things that are not.”',
        source: 'a true entry, oddly',
      },
      {
        id: 'tissue-ghost',
        name: 'Tissue Ghost',
        rarity: 'uncommon',
        motif: 'moth',
        epigraph: '“A page that was never written, still hoping.”',
        source: 'the space between endpapers',
      },
      {
        id: 'folded-crane',
        name: 'Crane, Folded from an Index',
        rarity: 'rare',
        motif: 'feather',
        epigraph: '“Every entry it once contained is now a wing.”',
        source: 'an index, decommissioned',
      },
      {
        id: 'vellum-whale',
        name: 'Vellum Whale',
        rarity: 'singular',
        motif: 'wave',
        epigraph: '“Bound in what was already a story.”',
        source: 'a bestiary’s missing page',
      },
    ],
  },
  {
    id: 'sonics',
    name: 'Sonic Curiosities',
    blurb: 'Recordings of things that were only ever sound.',
    palette: 'verdigris',
    items: [
      {
        id: 'shellac-rain',
        name: 'Shellac Disc of Rain',
        rarity: 'common',
        motif: 'disc',
        epigraph: '“One take. The weather did the performing.”',
        source: '78 rpm, label missing',
      },
      {
        id: 'substation-hum',
        name: 'Substation Hum',
        rarity: 'common',
        motif: 'wave',
        epigraph: '“Fifty cycles a second, and never once off duty.”',
        source: 'field recording, 02:00',
      },
      {
        id: 'room-tone',
        name: 'Room Tone',
        rarity: 'common',
        motif: 'envelope',
        epigraph: '“The sound of a room trying not to be noticed.”',
        source: 'thirty seconds of nothing',
      },
      {
        id: 'b-side',
        name: 'A Jukebox B-Side',
        rarity: 'uncommon',
        motif: 'disc',
        epigraph: '“The song nobody chose, played for the wall.”',
        source: 'flip side, worn smooth',
      },
      {
        id: 'whale-52',
        name: 'Whale, 52 Hz',
        rarity: 'uncommon',
        motif: 'wave',
        epigraph: '“Singing at a frequency no one answers.”',
        source: 'hydrophone, North Pacific',
      },
      {
        id: 'singing-sand',
        name: 'Singing Sand',
        rarity: 'rare',
        motif: 'constellation',
        epigraph: '“The dune hums when the wind gets the angle right.”',
        source: 'desert recording, no date',
      },
      {
        id: 'last-tape',
        name: 'The Last Tape',
        rarity: 'singular',
        motif: 'tape',
        epigraph: '“Labelled ‘YOU’. Mostly breathing. Some of it yours.”',
        source: 'C90, unspooled once',
      },
    ],
  },
  {
    id: 'cartographers',
    name: 'The Cartographers’ Guild',
    blurb: 'The errors, jokes and confessions of mapmakers.',
    palette: 'cyan',
    items: [
      {
        id: 'sea-monster',
        name: 'Sea Monster, Decorative',
        rarity: 'common',
        motif: 'wave',
        epigraph: '“Occupies the empty corner of the Atlantic.”',
        source: 'plate 3, north-west margin',
      },
      {
        id: 'rhumb-line',
        name: 'Rhumb Line',
        rarity: 'common',
        motif: 'constellation',
        epigraph: '“A straight line, on a lie about the shape of the sea.”',
        source: 'Navigation for Believers',
      },
      {
        id: 'isle-of-error',
        name: 'The Isle of Error',
        rarity: 'common',
        motif: 'moon',
        epigraph: '“Charted for eighty years. Visited never.”',
        source: 'Admiralty correction, 1873',
      },
      {
        id: 'map-gore',
        name: 'Map Gore',
        rarity: 'uncommon',
        motif: 'map',
        epigraph: '“The wedge where a globe meets itself and argues.”',
        source: 'Globes & Their Seams',
      },
      {
        id: 'declination',
        name: 'Magnetic Declination',
        rarity: 'uncommon',
        motif: 'compass',
        epigraph: '“North, approximately. The magnet is doing its best.”',
        source: 'a note in the margin of a chart',
      },
      {
        id: 'phantom-island',
        name: 'Phantom Island',
        rarity: 'rare',
        motif: 'ladder',
        epigraph: '“Appears in fog. Absent in sunlight. Survives on charts.”',
        source: 'Hydrographic gossip',
      },
      {
        id: 'here-be-nothing',
        name: 'Here Be Nothing',
        rarity: 'singular',
        motif: 'cube',
        epigraph: '“The cartographer’s most honest annotation.”',
        source: 'an otherwise empty ocean',
      },
    ],
  },
  {
    id: 'small-loves',
    name: 'Sundries & Small Loves',
    blurb: 'The objects a room accumulates by paying attention.',
    palette: 'ember',
    items: [
      {
        id: 'trimmed-wick',
        name: 'A Wick, Trimmed Just So',
        rarity: 'common',
        motif: 'lamp',
        epigraph: '“Half a millimetre, and the whole evening changes.”',
        source: 'household practice',
      },
      {
        id: 'creaking-chair',
        name: 'The Chair That Creaks in D',
        rarity: 'common',
        motif: 'wave',
        epigraph: '“Not a defect. A tuning.”',
        source: 'a room, in use',
      },
      {
        id: 'hairline-crack',
        name: 'Hairline Crack in a Mug',
        rarity: 'common',
        motif: 'moon',
        epigraph: '“Holds everything except the idea of being new.”',
        source: 'kitchen shelf, second from the left',
      },
      {
        id: 'cinema-ticket',
        name: 'Bookmark Made of a Cinema Ticket',
        rarity: 'uncommon',
        motif: 'envelope',
        epigraph: '“Row F, seat 12, and a chapter it never left.”',
        source: 'a paperback’s halfway point',
      },
      {
        id: 'lamp-moth',
        name: 'Moth in the Lampshade',
        rarity: 'uncommon',
        motif: 'moth',
        epigraph: '“It came for the light and stayed for the shade.”',
        source: 'observed, gently',
      },
      {
        id: 'key-to-nothing',
        name: 'A Key That Opens Nothing',
        rarity: 'rare',
        motif: 'key',
        epigraph: '“Kept because the loss it implies is interesting.”',
        source: 'the tin of unlabelled keys',
      },
      {
        id: 'library-card',
        name: 'Card from a Library That Closed',
        rarity: 'singular',
        motif: 'book',
        epigraph: '“Last stamp: 14 June. Four books were still out.”',
        source: 'the cabinet behind the desk',
      },
    ],
  },
  {
    id: 'machinery',
    name: 'The Quiet Machinery',
    blurb: 'Inherited computation, running very slowly in a corner.',
    palette: 'bone',
    items: [
      {
        id: 'turing-tape',
        name: 'Turing Tape, Torn',
        rarity: 'common',
        motif: 'tape',
        epigraph: '“One instruction, repeated with great confidence.”',
        source: 'a strip of paper, 5 cm',
      },
      {
        id: 'relay-click',
        name: 'Relay Click',
        rarity: 'common',
        motif: 'bell',
        epigraph: '“The smallest possible decision, made loudly.”',
        source: 'telephony, in retirement',
      },
      {
        id: 'punched-card',
        name: 'Punched Card',
        rarity: 'common',
        motif: 'map',
        epigraph: '“A hole is a yes. The absence of a hole is also a yes.”',
        source: 'Data Processing, ch. 1',
      },
      {
        id: 'abacus-bead',
        name: 'Abacus Bead',
        rarity: 'uncommon',
        motif: 'orrery',
        epigraph: '“Faster than the machine, until it isn’t.”',
        source: 'a market in the old quarter',
      },
      {
        id: 'escapement',
        name: 'Escapement',
        rarity: 'uncommon',
        motif: 'clock',
        epigraph: '“It allows time to pass, one tooth at a time.”',
        source: 'Clockwork, republished',
      },
      {
        id: 'null-modem',
        name: 'Null Modem',
        rarity: 'rare',
        motif: 'key',
        epigraph: '“Two machines agree on nothing whatsoever, perfectly.”',
        source: 'a drawer of obsolete cables',
      },
      {
        id: 'difference-engine',
        name: 'The Difference Engine',
        rarity: 'singular',
        motif: 'cube',
        epigraph: '“Never finished. Still, in a sense, calculating.”',
        source: 'a museum’s honest placard',
      },
    ],
  },
  {
    id: 'illuminations',
    name: 'Illuminations & Lamps',
    blurb: 'Ways of making a small amount of light last.',
    palette: 'gold',
    items: [
      {
        id: 'lamplighter-ladder',
        name: 'Lamplighter’s Ladder',
        rarity: 'common',
        motif: 'ladder',
        epigraph: '“Twelve rungs, forty lamps, one cold evening.”',
        source: 'municipal record, undated',
      },
      {
        id: 'gas-mantle',
        name: 'Gas Mantle',
        rarity: 'common',
        motif: 'lamp',
        epigraph: '“Fragile, ash-white, briefly brilliant.”',
        source: 'the box of spares',
      },
      {
        id: 'firefly-jar',
        name: 'Firefly Jar, Emptied',
        rarity: 'common',
        motif: 'bottle',
        epigraph: '“Looked at, then let go. That is the whole ritual.”',
        source: 'a summer, recalled',
      },
      {
        id: 'whale-oil',
        name: 'Whale Oil Lamp',
        rarity: 'uncommon',
        motif: 'lamp',
        epigraph: '“A smell that invented the idea of the evening.”',
        source: 'household inventory, 1840',
      },
      {
        id: 'candle-clock',
        name: 'Candle Clock',
        rarity: 'uncommon',
        motif: 'clock',
        epigraph: '“Time, measured by what has already been spent.”',
        source: 'Horology of the Poor',
      },
      {
        id: 'safelight',
        name: 'Darkroom Safelight',
        rarity: 'rare',
        motif: 'prism',
        epigraph: '“The only red light that means nothing is wrong.”',
        source: 'a developing tray, 03:00',
      },
      {
        id: 'light-left-on',
        name: 'The Light Left On',
        rarity: 'singular',
        motif: 'lamp',
        epigraph: '“Nobody is coming. It stays on regardless.”',
        source: 'a window seen from the street',
      },
    ],
  },
];

/* Normalise set palettes: one typo in the data above must not break the art. */
const paletteFor = (name) => (PALETTES[name] ? name : 'gold');

export const SETS = SETS_DATA.map((set, index) => ({
  id: set.id,
  name: set.name,
  blurb: set.blurb,
  palette: paletteFor(set.palette),
  number: index + 1,
  curioIds: set.items.map((item) => item.id),
  singularId: set.items.find((item) => item.rarity === 'singular')?.id || null,
}));

export const CURIOS = SETS_DATA.flatMap((set) =>
  set.items.map((item, index) => ({
    ...item,
    set: set.id,
    setName: set.name,
    palette: paletteFor(set.palette),
    index,
  })),
);

export const CURIO_BY_ID = new Map(CURIOS.map((curio) => [curio.id, curio]));
export const CURIO_IDS = new Set(CURIOS.map((curio) => curio.id));

export const setById = (id) => SETS.find((set) => set.id === id) || null;
export const curiosOf = (setId) => CURIOS.filter((curio) => curio.set === setId);

/** Everything that can appear in a draw — singulars are assembled, not drawn. */
export const DRAWABLE = CURIOS.filter((curio) => curio.rarity !== 'singular');

/* -------------------------------------------------------------------------- */
/* Marks — the cabinet's achievements                                         */
/* -------------------------------------------------------------------------- */

/**
 * Each mark has a `test(ctx)` predicate. `ctx` is computed once per evaluation
 * in rewards.js, so predicates stay cheap and dependency-free.
 */
export const MARKS = [
  {
    id: 'first-focus',
    name: 'First Page',
    hint: 'Finish one focus session.',
    reward: { ink: 40, ember: 1 },
    test: (c) => c.focusSessions >= 1,
  },
  {
    id: 'ten-sessions',
    name: 'Ten Turns',
    hint: 'Finish ten focus sessions.',
    reward: { ink: 120 },
    test: (c) => c.focusSessions >= 10,
  },
  {
    id: 'hundred-sessions',
    name: 'The Long Habit',
    hint: 'Finish a hundred focus sessions.',
    reward: { ink: 600, ember: 5 },
    test: (c) => c.focusSessions >= 100,
  },
  {
    id: 'ten-hours',
    name: 'Ten Deep Hours',
    hint: 'Log ten hours of focus.',
    reward: { ink: 250 },
    test: (c) => c.focusSec >= 10 * 3600,
  },
  {
    id: 'fifty-hours',
    name: 'Fifty Deep Hours',
    hint: 'Log fifty hours of focus.',
    reward: { ink: 900, ember: 6 },
    test: (c) => c.focusSec >= 50 * 3600,
  },
  {
    id: 'streak-3',
    name: 'Three Days Running',
    hint: 'Focus three days in a row.',
    reward: { ink: 150, ember: 2 },
    test: (c) => c.streak >= 3,
  },
  {
    id: 'streak-7',
    name: 'A Week of Pages',
    hint: 'Focus seven days in a row.',
    reward: { ink: 400, ember: 4 },
    test: (c) => c.streak >= 7,
  },
  {
    id: 'streak-30',
    name: 'A Month of Small Hours',
    hint: 'Focus thirty days in a row.',
    reward: { ink: 1500, ember: 12 },
    test: (c) => c.streak >= 30,
  },
  {
    id: 'marathon',
    name: 'The Marathon',
    hint: 'Complete a single focus session of 90 minutes or more.',
    reward: { ink: 300, ember: 3 },
    test: (c) => c.longestSession >= 90 * 60,
  },
  {
    id: 'night-owl',
    name: 'Small Hours',
    hint: 'Begin a focus session between midnight and 4 a.m.',
    reward: { ink: 120, ember: 1 },
    test: (c) => c.nightOwl,
  },
  {
    id: 'early-bird',
    name: 'Before the Birds',
    hint: 'Begin a focus session between 5 and 7 a.m.',
    reward: { ink: 120, ember: 1 },
    test: (c) => c.earlyBird,
  },
  {
    id: 'full-cycle',
    name: 'The Full Round',
    hint: 'Reach a long break.',
    reward: { ink: 200, ember: 2 },
    test: (c) => c.longBreaks >= 1,
  },
  {
    id: 'task-keeper',
    name: 'Task Keeper',
    hint: 'Complete twenty-five tasks.',
    reward: { ink: 200 },
    test: (c) => c.tasksDone >= 25,
  },
  {
    id: 'bookworm',
    name: 'Bookworm',
    hint: 'Save twenty-five passages.',
    reward: { ink: 180 },
    test: (c) => c.bookmarks >= 25,
  },
  {
    id: 'annotator',
    name: 'Annotator',
    hint: 'Write notes on ten different days.',
    reward: { ink: 220, ember: 1 },
    test: (c) => c.noteDays >= 10,
  },
  {
    id: 'cabinet-five',
    name: 'A Beginning',
    hint: 'Own five curios.',
    reward: { ink: 150 },
    test: (c) => c.curios >= 5,
  },
  {
    id: 'cabinet-twenty-five',
    name: 'The Cabinet Wants More',
    hint: 'Own twenty-five curios.',
    reward: { ink: 450, ember: 3 },
    test: (c) => c.curios >= 25,
  },
  {
    id: 'set-complete',
    name: 'A Complete Collection',
    hint: 'Finish one collection.',
    reward: { ink: 400, ember: 4 },
    test: (c) => c.setsComplete >= 1,
  },
  {
    id: 'three-sets',
    name: 'Polymath',
    hint: 'Finish three collections.',
    reward: { ink: 900, ember: 8 },
    test: (c) => c.setsComplete >= 3,
  },
  {
    id: 'ink-thousand',
    name: 'Ink-Stained',
    hint: 'Earn a thousand ink in total.',
    reward: { ember: 3 },
    test: (c) => c.inkEarned >= 1000,
  },
  {
    id: 'ember-keeper',
    name: 'Keeper of Embers',
    hint: 'Earn twenty-five embers in total.',
    reward: { ink: 500 },
    test: (c) => c.emberEarned >= 25,
  },
  {
    id: 'all-sets',
    name: 'The Whole Cabinet',
    hint: 'Finish all twelve collections.',
    reward: { ink: 5000, ember: 30 },
    test: (c) => c.setsComplete >= SETS.length,
  },
];

export const MARK_BY_ID = new Map(MARKS.map((mark) => [mark.id, mark]));

/* -------------------------------------------------------------------------- */
/* Ranks — derived entirely from logged focus time                             */
/* -------------------------------------------------------------------------- */

export const RANKS = [
  { at: 0, name: 'Curious' },
  { at: 60 * 60, name: 'Apprentice of the Reading Room' },
  { at: 5 * 60 * 60, name: 'Amanuensis' },
  { at: 15 * 60 * 60, name: 'Annotator' },
  { at: 30 * 60 * 60, name: 'Marginal Scholar' },
  { at: 60 * 60 * 60, name: 'Night Librarian' },
  { at: 120 * 60 * 60, name: 'Keeper of the Lamp' },
  { at: 250 * 60 * 60, name: 'The Long Read' },
];

/** Rank for a total number of focus seconds. */
export function rankFor(focusSec) {
  let current = RANKS[0];
  let next = null;
  for (const rank of RANKS) {
    if (focusSec >= rank.at) current = rank;
    else {
      next = rank;
      break;
    }
  }
  const floor = current.at;
  const ceiling = next ? next.at : null;
  return {
    name: current.name,
    next: next ? next.name : null,
    progress: ceiling === null ? 1 : Math.min(1, (focusSec - floor) / Math.max(1, ceiling - floor)),
    remainingSec: ceiling === null ? 0 : Math.max(0, ceiling - focusSec),
  };
}
