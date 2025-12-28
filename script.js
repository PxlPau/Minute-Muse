/* 
   MINUTE MUSE - CURATOR EDITION (JSON)
   Features:
   - Loads from images.json (No API Key needed here!)
   - Admin Mode (Click Season Badge 5x)
   - Dynamic Music Menu
   - Journal & Zen Mode
*/

(() => {
  // 🎵 PLAYLIST CONFIGURATION
  // Ensure these files exist in your 'audio/' folder on GitHub
  const TRACKS = [
    { id: 'rain', name: 'Tropical Rain', file: 'audio/Jomon Grove - The Mini Vandals.mp3', tags: ['tropical'] },
    { id: 'fire', name: 'Cozy Fireplace', file: 'audio/fire.mp3', tags: ['winter', 'north_winter', 'south_winter'] },
    { id: 'nature', name: 'Forest Birds', file: 'audio/nature.mp3', tags: ['summer', 'spring', 'north_summer', 'south_summer'] },
    // Add more here easily:
    // { id: 'jazz', name: 'Smooth Jazz', file: 'audio/jazz.mp3', tags: ['night'] }
  ];

  // --- DOM ELEMENTS ---
  const elQuote = document.getElementById('quote');
  const elAuthor = document.getElementById('author');
  const elTime = document.getElementById('time');
  const elPeriod = document.getElementById('period');
  const elGreeting = document.getElementById('greeting');
  const elSeasonBadge = document.getElementById('season-badge');
  const elPhotoCredit = document.getElementById('photo-credit');
  const elRain = document.getElementById('rain-effect');

  // Menus & Modals
  const btnSound = document.getElementById('btn-sound');
  const btnMusicMenu = document.getElementById('btn-music-menu');
  const elMusicMenu = document.getElementById('music-menu');
  const elTrackList = document.getElementById('track-list');
  const btnZen = document.getElementById('btn-zen');
  const btnJournal = document.getElementById('btn-journal');
  const btnNew = document.getElementById('new-quote');
  
  const elJournalOverlay = document.getElementById('journal-overlay');
  const elJournalText = document.getElementById('journal-text');
  const btnCloseJournal = document.getElementById('btn-close-journal');
  
  const elAdminOverlay = document.getElementById('admin-overlay');
  const elAdminSelect = document.getElementById('admin-location-select');
  const btnCloseAdmin = document.getElementById('btn-close-admin');

  // Audio Player
  const audioPlayer = document.getElementById('bgm-player');

  // --- STATE ---
  let lastPeriod = null;
  let currentQuoteData = null;
  let climateMode = 'north'; 
  let calculatedSeason = 'winter';
  let imageData = null;
  let isMuted = true;
  let currentTrackId = null;
  let adminClicks = 0; 

  const PERIODS_CONFIG = {
    dawn: { label: 'Dawn' },
    morning: { label: 'Morning' },
    afternoon: { label: 'Afternoon' },
    evening: { label: 'Evening' },
    night: { label: 'Night' }
  };

  const FALLBACK_TEMPLATES = [
    "The clock showed {time}, and the world held its breath."
  ];

  // --- 1. CLIMATE & ADMIN LOGIC ---

  function detectClimate() {
    // Check for Admin Override first
    const override = localStorage.getItem('minuteMuseAdminLocation');
    
    if (override && override !== 'auto') {
      console.log("🔧 Admin Override:", override);
      
      // Map Admin selection to JSON keys
      if (override === 'tropical') {
        climateMode = 'tropical';
        calculatedSeason = 'tropical';
      } else if (override.includes('north')) {
        climateMode = 'north';
        calculatedSeason = override.includes('winter') ? 'winter' : 'summer';
      } else if (override.includes('south')) {
        climateMode = 'south';
        calculatedSeason = override.includes('winter') ? 'winter' : 'summer';
      }
      
      elSeasonBadge.textContent = `🔧 ADMIN MODE: ${override.toUpperCase()}`;
      return;
    }

    // Standard Detection
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const city = tz.split('/')[1] || tz;
      
      const TROPICAL_KEYWORDS = ['Singapore','Jakarta','Bangkok','Ho_Chi_Minh','Kuala_Lumpur','Manila','Phnom_Penh','Colombo','Maldives','Honolulu','Jamaica','Bogota','Lagos','Darwin'];
      const SOUTHERN_KEYWORDS = ['Australia','New_Zealand','Auckland','Sydney','Melbourne','Brisbane','Perth','Johannesburg','Cape_Town','Buenos_Aires','Santiago','Sao_Paulo'];

      let detected = 'north';
      if (TROPICAL_KEYWORDS.some(k => tz.includes(k))) detected = 'tropical';
      else if (SOUTHERN_KEYWORDS.some(k => tz.includes(k))) detected = 'south';

      climateMode = detected;
      const month = new Date().getMonth();

      if (detected === 'tropical') {
        calculatedSeason = 'tropical';
        elSeasonBadge.textContent = `Tropical Climate • ${city.replace(/_/g, ' ')}`;
      } else {
        // Simple Season Logic for Audio
        const isNorthWinter = [11, 0, 1].includes(month);
        const isLocalWinter = (detected === 'north') ? isNorthWinter : !isNorthWinter;
        calculatedSeason = isLocalWinter ? 'winter' : 'summer';
        
        elSeasonBadge.textContent = `${detected === 'north' ? 'Northern' : 'Southern'} Hemisphere • ${city.replace(/_/g, ' ')}`;
      }
    } catch (e) {
      climateMode = 'north'; 
      calculatedSeason = 'winter';
    }
  }

  // --- 2. AUDIO SYSTEM ---

  function initAudioMenu() {
    elTrackList.innerHTML = '';
    TRACKS.forEach(track => {
      const li = document.createElement('li');
      li.className = 'track-item';
      li.dataset.id = track.id;
      li.innerHTML = `<span>${track.name}</span>`;
      li.addEventListener('click', () => {
        playTrack(track.id);
        elMusicMenu.classList.add('hidden');
      });
      elTrackList.appendChild(li);
    });
  }

  function playTrack(trackId) {
    const track = TRACKS.find(t => t.id === trackId);
    if (!track) return;
    if (currentTrackId === trackId && !audioPlayer.paused) return;

    currentTrackId = trackId;
    audioPlayer.src = track.file;
    audioPlayer.volume = 0.3; 
    
    // UI Update
    document.querySelectorAll('.track-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === trackId);
    });

    if (!isMuted) audioPlayer.play().catch(e => console.log("Autoplay blocked"));
    
    // Visual Rain toggle
    if(track.tags.includes('tropical') || track.id === 'rain') {
      if(elRain) elRain.style.opacity = '0.4';
    } else {
      if(elRain) elRain.style.opacity = '0';
    }
  }

  function autoSelectTrack() {
    if (currentTrackId) return; // Don't override user choice

    // Find track matching calculated season
    let bestMatch = TRACKS.find(t => t.tags.includes(calculatedSeason));
    
    // Fallbacks
    if (!bestMatch && climateMode === 'tropical') bestMatch = TRACKS.find(t => t.id === 'rain');
    if (!bestMatch) bestMatch = TRACKS.find(t => t.id === 'nature');

    if (bestMatch) playTrack(bestMatch.id);
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (isMuted) {
      audioPlayer.pause();
      btnSound.innerHTML = '<span class="icon">🔇</span>';
    } else {
      audioPlayer.play();
      btnSound.innerHTML = '<span class="icon">🔊</span>';
    }
  }

  // --- 3. DATA LOADING (JSON) ---

  async function loadImages() {
    try {
      // Add timestamp to ensure we get the fresh hourly update
      const res = await fetch(`images.json?t=${new Date().getTime()}`);
      if (!res.ok) throw new Error("JSON not found");
      imageData = await res.json();
    } catch (e) { console.warn("Fallback mode"); }
  }

  function updateBackground(period) {
    // In JSON, keys are 'north', 'south', 'tropical'
    // climateMode matches these exactly.
    if (imageData && imageData[climateMode] && Array.isArray(imageData[climateMode][period])) {
      
      const images = imageData[climateMode][period];
      const imgObj = images[Math.floor(Math.random() * images.length)];
      
      if(imgObj && imgObj.url) {
        const img = new Image();
        img.onload = () => { document.body.style.backgroundImage = `url("${imgObj.url}")`; };
        img.src = imgObj.url;

        // Attribution
        elPhotoCredit.innerHTML = `Photo by <a href="${imgObj.link}?utm_source=MinuteMuse&utm_medium=referral" target="_blank">${imgObj.name}</a> on <a href="https://unsplash.com/?utm_source=MinuteMuse&utm_medium=referral" target="_blank">Unsplash</a>`;
        return;
      }
    }
    // Fallback
    document.body.style.backgroundImage = `linear-gradient(to bottom, #0f2027, #2c5364)`;
  }

  // --- 4. CORE LOOP ---

  async function fetchRealQuote(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const url = `https://raw.githubusercontent.com/JohannesNE/literature-clock/master/docs/times/${hh}_${mm}.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('No quote');
      return await res.json();
    } catch (e) { return null; }
  }

  function getFallbackQuote(date) {
    const t = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const tmpl = FALLBACK_TEMPLATES[0];
    return { text: tmpl.replace("{time}", t), author: "The Narrator", title: "Life" };
  }

  function updateDisplay(quoteData, periodLabel) {
    elQuote.classList.add('fade-out');
    elAuthor.classList.add('fade-out');
    setTimeout(() => {
      let qText = quoteData.text ? quoteData.text.replace(/<br>/g, ' ') : "Thinking..."; 
      elQuote.innerHTML = `“${qText}”`;
      if (quoteData.title) elAuthor.innerHTML = `<span class="author-name">${quoteData.author}</span><br><em>${quoteData.title}</em>`;
      else elAuthor.textContent = quoteData.author || "Unknown";
      elPeriod.textContent = periodLabel;
      elQuote.classList.remove('fade-out'); elAuthor.classList.remove('fade-out');
      elQuote.classList.add('fade-in'); elAuthor.classList.add('fade-in');
      setTimeout(() => { elQuote.classList.remove('fade-in'); elAuthor.classList.remove('fade-in'); }, 800);
    }, 500);
  }

  function getPeriod(h) {
    if (h >= 5 && h < 8) return 'dawn';
    if (h >= 8 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  async function performUpdate(force = false) {
    const now = new Date();
    const h = now.getHours();
    const period = getPeriod(h);

    if (force || period !== lastPeriod) {
      lastPeriod = period;
      detectClimate(); // Re-check (handles admin override)
      updateBackground(period);
      autoSelectTrack(); 
    }

    if (!currentQuoteData || force || now.getSeconds() === 0) {
      currentQuoteData = await fetchRealQuote(now);
    }
    
    const g = h < 5 ? "Good Night" : h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : h < 22 ? "Good Evening" : "Sleep Well";
    if(elGreeting) elGreeting.textContent = g;

    let finalQuote;
    if (currentQuoteData && currentQuoteData.length) {
      const r = currentQuoteData[Math.floor(Math.random() * currentQuoteData.length)];
      finalQuote = {
        text: `${r.quote_first} ${r.quote_time_case} ${r.quote_last}`,
        author: r.author, title: r.title
      };
    } else {
      finalQuote = getFallbackQuote(now);
    }

    updateDisplay(finalQuote, PERIODS_CONFIG[period].label);
    const hh = String(h).padStart(2,'0'); const mm = String(now.getMinutes()).padStart(2,'0');
    elTime.textContent = `${hh}:${mm}`;
  }

  // --- INIT & LISTENERS ---

  (async function init() {
    initAudioMenu();
    await loadImages(); // Load JSON
    detectClimate();
    await performUpdate(true);
    
    // Event Listeners
    btnSound.addEventListener('click', toggleMute);
    btnZen.addEventListener('click', () => document.body.classList.toggle('zen-active'));
    btnNew.addEventListener('click', () => performUpdate(true));
    
    // Music Menu
    btnMusicMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      elMusicMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!elMusicMenu.contains(e.target) && !btnMusicMenu.contains(e.target)) {
            elMusicMenu.classList.add('hidden');
        }
    });

    // Journal
    btnJournal.addEventListener('click', () => {
      elJournalText.value = localStorage.getItem('minuteMuseJournal') || "";
      elJournalOverlay.classList.remove('hidden');
    });
    btnCloseJournal.addEventListener('click', () => {
      localStorage.setItem('minuteMuseJournal', elJournalText.value);
      elJournalOverlay.classList.add('hidden');
    });
    
    // Admin Trigger (5 Clicks on Season Badge)
    elSeasonBadge.addEventListener('click', () => {
       adminClicks++;
       if (adminClicks >= 5) {
           adminClicks = 0;
           elAdminSelect.value = localStorage.getItem('minuteMuseAdminLocation') || 'auto';
           elAdminOverlay.classList.remove('hidden');
       }
    });
    
    btnCloseAdmin.addEventListener('click', () => {
        const val = elAdminSelect.value;
        localStorage.setItem('minuteMuseAdminLocation', val);
        elAdminOverlay.classList.add('hidden');
        // Reload images based on new location setting
        performUpdate(true); 
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { e.preventDefault(); performUpdate(true); }
    });

    setInterval(() => {
      const now = new Date();
      if(elNext) elNext.textContent = `Next page in ${60 - now.getSeconds()}s`;
      if(now.getSeconds() === 0) performUpdate();
    }, 1000);
  })();

})();
