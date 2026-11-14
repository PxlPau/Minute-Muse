const fs = require('fs');

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

const SEASON_THEMES = {
  winter: [
    'winter snow landscape', 'cozy fireplace cabin', 'knitted wool texture', 'steaming hot chocolate', 
    'frosty window pane', 'pine forest snow', 'frozen lake ice',
    'kyoto winter temple', 'shirakawago snow village', 'iceland glacier blue', 'swiss alps chalet', 
    'nyc central park snow', 'london rain street', 'hokkaido winter nature', 'norwegian northern lights',
    'minimalist white winter', 'hygge scandinavian interior', 'moody winter storm', 'winter cinematic street'
  ],
  spring: [
    'spring flowers bloom', 'cherry blossom sakura', 'green lush meadow', 'dutch tulip field', 
    'morning dew grass', 'butterfly garden', 'wisteria tunnel',
    'paris cafe spring', 'english cottage garden', 'california poppy superbloom', 'japanese tea garden', 
    'easter pastel aesthetic', 'picnic basket grass', 'kyoto bamboo grove',
    'fresh green leaves', 'soft pastel nature', 'sunlight through trees', 'spring rain puddle'
  ],
  summer: [
    'mediterranean coast amalfi', 'tropical turquoise ocean', 'summer surfing vibes', 'underwater clear blue', 
    'greek island architecture', 'italian riviera boat',
    'desert road trip usa', 'california palm springs', 'sunflower field golden', 'camping tent stars', 
    'australian outback red', 'festival crowd sunset', 'tuscan vineyard',
    'iced coffee glass', 'vintage convertible car', 'swimming pool ripples', 'summer fruit picnic', 'golden wheat field'
  ],
  autumn: [
    'autumn leaves orange', 'pumpkin harvest farm', 'foggy pine forest', 'dried flowers aesthetic', 
    'maple tree red', 'mushrooms forest floor',
    'new england fall road', 'kyoto autumn temple', 'scottish highlands moody', 'london foggy morning', 
    'dark academia library', 'paris autumn street', 'rainy day window',
    'cinnamon spice latte', 'reading book cozy', 'vintage leather journal', 'candle light aesthetic', 'wool blanket plaid'
  ],
  tropical: [
    'bali rice terrace ubud', 'traditional bamboo architecture', 'indonesia volcano sunrise', 
    'thailand limestone cliffs', 'ancient tropical temple', 'floating market boat',
    'amazon rainforest aerial', 'winding jungle river', 'rio de janeiro beach vibe', 
    'colonial colorful architecture brazil', 'iguazu falls mist', 'dense jungle canopy',
    'turquoise cenote mexico', 'tropical monsoon rain', 'palm tree shadows sand', 
    'monstera leaf water drops', 'hammock ocean view', 'exotic tropical fruit market',
    'misty rainforest morning', 'dark moody jungle path'
  ]
};

const PERIOD_THEMES = {
  dawn: [
    'misty mountain peak', 'foggy forest path', 'morning dew spiderweb', 'calm lake reflection', 
    'birds flying sunrise', 'empty city street dawn', 'fisherman boat silhouette', 'yoga meditation sunrise', 
    'brewing coffee steam', 'blue hour city', 'early morning train', 'baker shop window'
  ],
  morning: [
    'aesthetic breakfast table', 'sunlight streaming window', 'fresh newspaper coffee', 'busy morning commute', 
    'matcha latte art', 'writing journal pen', 'bustling farmers market', 'bright airy workspace', 
    'sunbeams through blinds', 'morning run park', 'cafe terrace people', 'bakery fresh bread'
  ],
  afternoon: [
    'modern minimalist desk', 'library bookshelves study', 'architectural shadows harsh', 'typing on laptop cafe', 
    'museum art gallery', 'siesta hammock', 'iced tea glass', 'picnic blanket grass', 'busy city crossing', 
    'cat sleeping sun', 'afternoon tea set', 'tennis court sunlight'
  ],
  evening: [
    'golden hour sunlight', 'city skyline sunset', 'long shadows street', 'commuter train sunset', 
    'warm street lights on', 'cooking dinner kitchen', 'glass of wine aesthetic', 'restaurant table candle', 
    'fireplace cozy living room', 'reading lamp armchair', 'jazz bar interior'
  ],
  night: [
    'milky way starry sky', 'full moon dark clouds', 'campfire beach', 'fireflies forest', 
    'dark ocean waves', 'cyberpunk neon city', 'rainy street night reflection', 'tokyo night alley', 
    'midnight diner', 'bedroom fairy lights', 'late night study lo-fi', 'empty subway station'
  ]
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function getCurrentSeasons() {
  const month = new Date().getMonth(); 
  if (month === 11 || month === 0 || month === 1) return { north: 'winter', south: 'summer' };
  if (month >= 2 && month <= 4) return { north: 'spring', south: 'autumn' };
  if (month >= 5 && month <= 7) return { north: 'summer', south: 'winter' };
  return { north: 'autumn', south: 'spring' };
}


async function runUnsplashSearch(query, count) {
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high&count=${count}&client_id=${UNSPLASH_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null; 
    const data = await res.json();
    return data.map(img => ({
      url: img.urls.regular,
      name: img.user.name,
      link: img.user.links.html
    }));
  } catch (error) {
    return null;
  }
}

async function fetchImages(seasonKey, period, count = 3) {
  const randomS = pick(SEASON_THEMES[seasonKey]);
  const randomP = pick(PERIOD_THEMES[period]);

  const isSeasonPrimary = Math.random() > 0.5;

  const primaryDetail = isSeasonPrimary ? randomS : randomP;
  const secondaryContext = isSeasonPrimary ? period : seasonKey;

  const mainQuery = `${primaryDetail} ${secondaryContext}`;
  console.log(`      🔎 Query: "${mainQuery}"`);
  
  let images = await runUnsplashSearch(mainQuery, count);

  if (!images) {
    console.log(`      ⚠️ Retrying detail only: "${primaryDetail}"`);
    images = await runUnsplashSearch(primaryDetail, count);
  }

  if (!images) {
    const genericQuery = `${seasonKey} ${period}`;
    console.log(`      ⚠️ Fallback to generic: "${genericQuery}"`);
    images = await runUnsplashSearch(genericQuery, count);
  }

  if (!images) {
    console.error(`      ❌ API error or rate limit — reusing the last known good set.`);
    return null;
  }

  return images;
}

/** Load the existing curation so a partial failure never loses good images. */
function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync('images.json', 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  if (!UNSPLASH_KEY) {
    console.error('❌ UNSPLASH_ACCESS_KEY is not set. Nothing to do; images.json left untouched.');
    process.exitCode = 1;
    return;
  }

  const currentSeasons = getCurrentSeasons();
  console.log(`📅 North: ${currentSeasons.north} | South: ${currentSeasons.south}`);

  const existing = loadExisting();
  const collection = { north: {}, south: {}, tropical: {} };
  const CATEGORIES = [
    { id: 'tropical', vibe: 'tropical' },
    { id: 'north', vibe: currentSeasons.north },
    { id: 'south', vibe: currentSeasons.south },
  ];

  let fetched = 0;
  let reused = 0;

  for (const cat of CATEGORIES) {
    console.log(`\n📸 ${cat.id.toUpperCase()} (${cat.vibe})`);
    for (const period of Object.keys(PERIOD_THEMES)) {
      await new Promise((r) => setTimeout(r, 1200));
      const images = await fetchImages(cat.vibe, period, 4);

      if (images && images.length) {
        collection[cat.id][period] = images;
        fetched += 1;
        console.log(`   ✅ ${period}: ${images.length} images`);
      } else {
        // Keep yesterday's photographs rather than shipping dead links.
        const previous = existing?.[cat.id]?.[period];
        if (Array.isArray(previous) && previous.length) {
          collection[cat.id][period] = previous;
          reused += 1;
          console.log(`   ↺ ${period}: kept the previous set`);
        } else {
          collection[cat.id][period] = [];
          console.log(`   ⚠️ ${period}: no images available`);
        }
      }
    }
  }

  if (fetched === 0) {
    console.error('\n❌ Unsplash returned nothing; images.json left untouched.');
    process.exitCode = 1;
    return;
  }

  // Drop empty buckets so the client falls back to its quiet gradient.
  for (const cat of Object.values(collection)) {
    for (const [period, list] of Object.entries(cat)) {
      if (!list.length) delete cat[period];
    }
  }

  fs.writeFileSync('images.json', `${JSON.stringify(collection, null, 2)}\n`);
  console.log(`\n✅ images.json written — ${fetched} buckets refreshed, ${reused} kept.`);
}

main().catch((error) => {
  console.error('❌ Unexpected failure:', error);
  process.exitCode = 1;
});
