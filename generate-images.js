const fs = require('fs');

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// --- 1. THEME BUCKETS ---
// We will pick ONE from here...
// --- 1. THEME BUCKETS (Expanded & Globally Diverse) ---

const SEASON_THEMES = {
  winter: [
    // Classic & Cozy
    'winter snow landscape', 'cozy fireplace cabin', 'knitted wool texture', 'steaming hot chocolate', 
    'frosty window pane', 'pine forest snow', 'frozen lake ice',
    // Global Locations
    'kyoto winter temple', 'shirakawago snow village', 'iceland glacier blue', 'swiss alps chalet', 
    'nyc central park snow', 'london rain street', 'hokkaido winter nature', 'norwegian northern lights',
    // Vibes
    'minimalist white winter', 'hygge scandinavian interior', 'moody winter storm', 'winter cinematic street'
  ],
  
  spring: [
    // Nature & Bloom
    'spring flowers bloom', 'cherry blossom sakura', 'green lush meadow', 'dutch tulip field', 
    'morning dew grass', 'butterfly garden', 'wisteria tunnel',
    // Global & Lifestyle
    'paris cafe spring', 'english cottage garden', 'california poppy superbloom', 'japanese tea garden', 
    'easter pastel aesthetic', 'picnic basket grass', 'kyoto bamboo grove',
    // Vibes
    'fresh green leaves', 'soft pastel nature', 'sunlight through trees', 'spring rain puddle'
  ],
  
  summer: [
    // Beach & Water
    'mediterranean coast amalfi', 'tropical turquoise ocean', 'summer surfing vibes', 'underwater clear blue', 
    'greek island architecture', 'italian riviera boat',
    // Heat & Adventure
    'desert road trip usa', 'california palm springs', 'sunflower field golden', 'camping tent stars', 
    'australian outback red', 'festival crowd sunset', 'tuscan vineyard',
    // Lifestyle
    'iced coffee glass', 'vintage convertible car', 'swimming pool ripples', 'summer fruit picnic', 'golden wheat field'
  ],
  
  autumn: [
    // Foliage & Harvest
    'autumn leaves orange', 'pumpkin harvest farm', 'foggy pine forest', 'dried flowers aesthetic', 
    'maple tree red', 'mushrooms forest floor',
    // Global & Moody
    'new england fall road', 'kyoto autumn temple', 'scottish highlands moody', 'london foggy morning', 
    'dark academia library', 'paris autumn street', 'rainy day window',
    // Vibes
    'cinnamon spice latte', 'reading book cozy', 'vintage leather journal', 'candle light aesthetic', 'wool blanket plaid'
  ],
  
  tropical: [
    // Singapore & Urban Nature (Biophilic)
    'singapore gardens by the bay', 'jewel changi waterfall', 'biophilic architecture green', 'vertical garden building', 
    'singapore shophouse colorful', 'modern concrete jungle plant',
    // Island & Jungle
    'bali bamboo architecture', 'costa rica rainforest bridge', 'hawaii volcanic landscape', 'thailand longtail boat', 
    'amazon river aerial', 'sri lanka tea plantation', 'monstera leaf close up',
    // Vibes & Textures
    'tropical monsoon rain', 'brutalist tropical house', 'infinity pool jungle view', 'vibrant fruit market', 
    'hammock palm trees', 'turquoise cenote mexico', 'dark moody jungle'
  ]
};

const PERIOD_THEMES = {
  dawn: [
    // Nature
    'misty mountain peak', 'foggy forest path', 'morning dew spiderweb', 'calm lake reflection', 
    'birds flying sunrise',
    // Urban & Lifestyle
    'empty city street dawn', 'fisherman boat silhouette', 'yoga meditation sunrise', 'brewing coffee steam', 
    'blue hour city', 'early morning train', 'baker shop window'
  ],
  
  morning: [
    // Routine
    'aesthetic breakfast table', 'sunlight streaming window', 'fresh newspaper coffee', 'busy morning commute', 
    'matcha latte art', 'writing journal pen',
    // Environments
    'bustling farmers market', 'bright airy workspace', 'sunbeams through blinds', 'morning run park', 
    'cafe terrace people', 'bakery fresh bread'
  ],
  
  afternoon: [
    // Work & Focus
    'modern minimalist desk', 'library bookshelves study', 'architectural shadows harsh', 'typing on laptop cafe', 
    'museum art gallery',
    // Leisure
    'siesta hammock', 'iced tea glass', 'picnic blanket grass', 'busy city crossing', 
    'cat sleeping sun', 'afternoon tea set', 'tennis court sunlight'
  ],
  
  evening: [
    // Transition
    'golden hour sunlight', 'city skyline sunset', 'long shadows street', 'commuter train sunset', 
    'warm street lights on',
    // Relaxation
    'cooking dinner kitchen', 'glass of wine aesthetic', 'restaurant table candle', 'fireplace cozy living room', 
    'reading lamp armchair', 'jazz bar interior'
  ],
  
  night: [
    // Nature & Cosmos
    'milky way starry sky', 'full moon dark clouds', 'campfire beach', 'fireflies forest', 
    'dark ocean waves',
    // Urban & Moody
    'cyberpunk neon city', 'rainy street night reflection', 'tokyo night alley', 'midnight diner', 
    'bedroom fairy lights', 'late night study lo-fi', 'empty subway station'
  ]
};

// Helper: Pick random item from array
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function getCurrentSeasons() {
  const month = new Date().getMonth(); 
  // North: Winter(11,0,1) | South: Summer
  if (month === 11 || month === 0 || month === 1) return { north: 'winter', south: 'summer' };
  if (month >= 2 && month <= 4) return { north: 'spring', south: 'autumn' };
  if (month >= 5 && month <= 7) return { north: 'summer', south: 'winter' };
  return { north: 'autumn', south: 'spring' };
}

async function fetchImages(seasonKey, period, count = 3) {
  // 1. MIX & MATCH LOGIC
  // Pick a random specific theme for this category
  const sTheme = pick(SEASON_THEMES[seasonKey]);
  const pTheme = pick(PERIOD_THEMES[period]);
  
  // Construct Query: e.g. "singapore architecture green morning coffee"
  // Using spaces allows Unsplash to match broadly
  const query = `${sTheme} ${pTheme}`;
  
  console.log(`      🔎 Query: "${query}"`);

  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high&count=${count}&client_id=${UNSPLASH_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if(res.status === 404) return await fetchFallback(seasonKey, count); // Retry if too specific
      throw new Error(`Status ${res.status}`);
    }
    const data = await res.json();
    
    // Save minimal data to JSON
    return data.map(img => ({
      url: img.urls.regular,
      name: img.user.name,
      link: img.user.links.html
    }));

  } catch (error) {
    console.error(`      ❌ Error: ${error.message}`);
    // Fallback
    return Array(count).fill({
      url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1600',
      name: 'Unsplash',
      link: 'https://unsplash.com'
    });
  }
}

async function fetchFallback(seasonKey, count) {
  // If "tropical architecture" fails, just search "tropical"
  console.log(`      ⚠️ Fallback search: "${seasonKey}"`);
  const url = `https://api.unsplash.com/photos/random?query=${seasonKey}&orientation=landscape&content_filter=high&count=${count}&client_id=${UNSPLASH_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.map(img => ({ url: img.urls.regular, name: img.user.name, link: img.user.links.html }));
  } catch(e) { return []; }
}

async function main() {
  const currentSeasons = getCurrentSeasons();
  console.log(`📅 Date detected. North: ${currentSeasons.north} | South: ${currentSeasons.south}`);

  const collection = { north: {}, south: {}, tropical: {} };
  
  // Tropical First (Priority)
  const CATEGORIES = [
    { id: 'tropical', vibe: 'tropical' },
    { id: 'north', vibe: currentSeasons.north },
    { id: 'south', vibe: currentSeasons.south }
  ];

  for (const cat of CATEGORIES) {
    console.log(`\n📸 Processing: ${cat.id.toUpperCase()} (${cat.vibe})`);
    
    for (const period of Object.keys(PERIOD_THEMES)) {
      process.stdout.write(`   Fetching ${period}... \n`);
      
      // 2s Delay to be safe
      await new Promise(r => setTimeout(r, 2000));
      
      const images = await fetchImages(cat.vibe, period, 3);
      collection[cat.id][period] = images;
      
      if(images.length && images[0].name !== 'Unsplash') console.log(`   ✅ OK (${images.length} images)`);
      else console.log(`   ⚠️ Used Fallback`);
    }
  }

  fs.writeFileSync('images.json', JSON.stringify(collection, null, 2));
  console.log("\n✅ Variety images.json generated!");
}

main();
