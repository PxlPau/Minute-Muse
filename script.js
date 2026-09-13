/* 
   MINUTE MUSE - CORE ENGINE (Phase 1)
   - Legal Compliance & In-App Credits Integration
   - Escape-key modal accessibility
   - Mobile Viewport Friendly
*/

(() => {
  // 🎵 CC0 AUDIO REGISTRY
  const TRACKS = [
    { id: 'rain', name: 'Tropical Rain', file: 'audio/503167__pablodavilla__tropical_rain_01.wav', tags: ['tropical'] },
    { id: 'fire', name: 'Cozy Fireplace', file: 'audio/760474__true_killian__fireplace.m4a', tags: ['winter', 'north_winter', 'south_winter'] },
    { id: 'nature', name: 'Forest Birds 1', file: 'audio/567531__titi2__silent-forest_birds_210410_0059.wav', tags: ['summer', 'spring', 'north_summer', 'south_summer'] },
    { id: 'nature2', name: 'Forest Birds 2', file: 'audio/462137__sama66__forest-bird-1.wav', tags: ['summer', 'spring', 'north_summer', 'south_summer'] },
    { id: 'jazz', name: 'Smooth Jazz', file: 'audio/317673__amandedou__amande_3201.mp3', tags: ['night'] }
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
  const elNext = document.getElementById('next-change');

  // Menus & Buttons
  const btnSound = document.getElementById('btn-sound');
  const btnMusicMenu = document.getElementById('btn-music-menu');
  const elMusicMenu = document.getElementById('music-menu');
  const elTrackList = document.getElementById('track-list');
  const btnZen = document.getElementById('btn-zen');
  const btnJournal = document.getElementById('btn-journal');
  const btnNew = document.getElementById('new-quote');

  // Spotify Elements
  const btnSpotify = document.getElementById('btn-spotify');
  const elSpotify = document.getElementById('spotify-container');
  const btnCloseSpotify = document.getElementById('close-spotify');
  
  // Modals
  const elJournalOverlay = document.getElementById('journal-overlay');
  const elJournalText = document.getElementById('journal-text');
  const btnCloseJournal = document.getElementById('btn-close-journal');
  
  const elAdminOverlay = document.getElementById('admin-overlay');
  const elAdminSelect = document.getElementById('admin-location-select');
  const btnCloseAdmin = document.getElementById('btn-close-admin');

  const elCreditsOverlay = document.getElementById('credits-overlay');
  const btnOpenCredits = document.getElementById('btn-open-credits');
  const btnCloseCredits = document.getElementById('btn-close-credits');

  // Focus Timer Elements
  const btnFocus = document.getElementById('btn-focus');
  const elFocusOverlay = document.getElementById('focus-setup-overlay');
  const inpFocusMin = document.getElementById('focus-input-min');
  const btnStartFocus = document.getElementById('btn-start-focus');
  const btnCancelFocus = document.getElementById('btn-cancel-focus');
  const elFocusControls = document.getElementById('focus-controls');
  const btnFocusStop = document.getElementById('btn-focus-stop');
  const btnFocusExpand = document.getElementById('btn-focus-expand');
  const btnExitFullscreen = document.getElementById('exit-fullscreen-btn');

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
  let isUpdating = false;
  
  let focusMode = false;
  let focusTimeLeft = 0;
  let focusInterval = null;

  const PERIODS_CONFIG = {
    dawn: { label: 'Dawn' },
    morning: { label: 'Morning' },
    afternoon: { label: 'Afternoon' },
    evening: { label: 'Evening' },
    night: { label: 'Night' }
  };

  const FALLBACK_TEMPLATES = [
    "The clock showed {time}, and the quiet room welcomed deep focus."
  ];

  // --- 1. CLIMATE LOGIC ---
  function detectClimate() {
    const override = localStorage.getItem('minuteMuseAdminLocation');
    
    if (override && override !== 'auto') {
      if (override === 'tropical') { climateMode = 'tropical'; calculatedSeason = 'tropical'; } 
      else if (override.includes('north')) { climateMode = 'north'; calculatedSeason = override.includes('winter') ? 'winter' : 'summer'; } 
      else if (override.includes('south')) { climateMode = 'south'; calculatedSeason = override.includes('winter') ? 'winter' : 'summer'; }
      
      if (elSeasonBadge) elSeasonBadge.textContent = `🔧 Admin: ${override.replace('_', ' ').toUpperCase()}`;
      return;
    }

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

      if (elSeasonBadge) {
        if (detected === 'tropical') {
          calculatedSeason = 'tropical';
          elSeasonBadge.textContent = `Tropical • ${city.replace(/_/g, ' ')}`;
        } else {
          const isNorthWinter = [11, 0, 1].includes(month);
          const isLocalWinter = (detected === 'north') ? isNorthWinter : !isNorthWinter;
          calculatedSeason = isLocalWinter ? 'winter' : 'summer';
          elSeasonBadge.textContent = `${detected === 'north' ? 'Northern' : 'Southern'} • ${city.replace(/_/g, ' ')}`;
        }
      }
    } catch (e) {
      climateMode = 'north'; 
      calculatedSeason = 'winter';
    }
  }

  // --- 2. AUDIO SYSTEM ---
  function initAudioMenu() {
    if (!elTrackList) return;
    elTrackList.innerHTML = '';
    TRACKS.forEach(track => {
      const li = document.createElement('li');
      li.className = 'track-item';
      li.dataset.id = track.id;
      li.innerHTML = `<span>${track.name}</span><small style="opacity:0.6;font-size:0.75rem;">CC0</small>`;
      li.addEventListener('click', () => {
        playTrack(track.id);
        if (elMusicMenu) elMusicMenu.classList.add('hidden');
      });
      elTrackList.appendChild(li);
    });
  }

  function playTrack(trackId) {
    if (!audioPlayer) return;
    const track = TRACKS.find(t => t.id === trackId);
    if (!track) return;
    if (currentTrackId === trackId && !audioPlayer.paused) return;

    currentTrackId = trackId;
    audioPlayer.src = track.file;
    audioPlayer.volume = 0.35;
    
    document.querySelectorAll('.track-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === trackId);
    });

    if (!isMuted) {
      audioPlayer.play().catch(() => console.log("Audio autoplay prevented by browser."));
    }
    
    if (elRain) {
      elRain.style.opacity = (track.tags.includes('tropical') || track.id === 'rain') ? '0.4' : '0';
    }
  }

  function autoSelectTrack() {
    if (currentTrackId) return; 
    let bestMatch = TRACKS.find(t => t.tags.includes(calculatedSeason));
    if (!bestMatch && climateMode === 'tropical') bestMatch = TRACKS.find(t => t.id === 'rain');
    if (!bestMatch) bestMatch = TRACKS.find(t => t.id === 'nature');
    if (bestMatch) playTrack(bestMatch.id);
  }

  function toggleMute() {
    if (!audioPlayer) return;
    isMuted = !isMuted;
    if (isMuted) {
      audioPlayer.pause();
      if (btnSound) btnSound.innerHTML = '<span class="icon" aria-hidden="true">🔇</span>';
    } else {
      audioPlayer.play().catch(() => {});
      if (btnSound) btnSound.innerHTML = '<span class="icon" aria-hidden="true">🔊</span>';
    }
  }

  // --- 3. BACKGROUND IMAGES ---
  async function loadImages() {
    try {
      const res = await fetch(`images.json?t=${Date.now()}`);
      if (!res.ok) throw new Error("JSON not found");
      imageData = await res.json();
    } catch (e) {
      console.warn("Using fallback gradient - images.json not available");
    }
  }

  function updateBackground(period) {
    if (imageData && imageData[climateMode] && Array.isArray(imageData[climateMode][period])) {
      const images = imageData[climateMode][period];
      const imgObj = images[Math.floor(Math.random() * images.length)];
      
      if (imgObj && imgObj.url) {
        const img = new Image();
        img.onload = () => {
          document.body.style.backgroundImage = `url("${imgObj.url}")`;
        };
        img.src = imgObj.url;
        if (elPhotoCredit) {
          elPhotoCredit.innerHTML = `Photo by <a href="${imgObj.link}?utm_source=MinuteMuse&utm_medium=referral" target="_blank" rel="noopener noreferrer">${imgObj.name}</a> on <a href="https://unsplash.com/?utm_source=MinuteMuse&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>`;
        }
        return;
      }
    }
    document.body.style.backgroundImage = `linear-gradient(to bottom, #0f2027, #203a43, #2c5364)`;
  }

  // --- 4. FOCUS TIMER LOGIC ---
  function startFocusTimer(seconds) {
    focusMode = true;
    focusTimeLeft = seconds;
    
    if (elFocusControls) elFocusControls.classList.remove('hidden');
    if (elPeriod) elPeriod.textContent = "FOCUS SESSION";
    if (btnNew) { btnNew.style.pointerEvents = 'none'; btnNew.style.opacity = '0.4'; }

    updateTimerDisplay();

    if (focusInterval) clearInterval(focusInterval);
    focusInterval = setInterval(() => {
      focusTimeLeft--;
      updateTimerDisplay();

      if (focusTimeLeft <= 0) {
        timerFinished();
      }
    }, 1000);
  }

  function stopFocusTimer() {
    focusMode = false;
    if (focusInterval) clearInterval(focusInterval);
    document.body.classList.remove('focus-fullscreen');
    
    if (elFocusControls) elFocusControls.classList.add('hidden');
    if (btnNew) { btnNew.style.pointerEvents = 'auto'; btnNew.style.opacity = '1'; }
    
    isUpdating = false;
    performUpdate(true); 
  }

  function timerFinished() {
    stopFocusTimer();
    alert("Focus session complete! Take a deep breath.");
  }

  function updateTimerDisplay() {
    const m = Math.floor(focusTimeLeft / 60);
    const s = focusTimeLeft % 60;
    if (elTime) elTime.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // --- 5. QUOTES & CLOCK ---
  async function fetchRealQuote(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const url = `https://raw.githubusercontent.com/JohannesNE/literature-clock/master/docs/times/${hh}_${mm}.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('No quote');
      return await res.json();
    } catch (e) {
      return null;
    }
  }

 let quotesDatabase = null;

async function loadQuotesDatabase() {
  try {
    const res = await fetch(`quotes.json?t=${Date.now()}`);
    if (!res.ok) throw new Error("quotes.json not found");
    quotesDatabase = await res.json();
    console.log("📚 Local literature database loaded.");
  } catch (err) {
    console.warn("⚠️ Could not load local quotes.json; using fallback quotes.");
    quotesDatabase = {};
  }
}

function getQuoteForTime(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const timeKey = `${hh}:${mm}`;

  if (quotesDatabase && quotesDatabase[timeKey] && quotesDatabase[timeKey].length > 0) {
    const choices = quotesDatabase[timeKey];
    const picked = choices[Math.floor(Math.random() * choices.length)];
    
    // Highlight the time case word inside the quote
    let highlightedQuote = picked.quote;
    if (picked.time_case) {
      // Escape special characters for regex
      const safeCase = picked.time_case.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${safeCase})`, 'i');
      highlightedQuote = picked.quote.replace(regex, `<span class="time-highlight">$1</span>`);
    }

    return {
      text: highlightedQuote,
      author: picked.author,
      title: picked.title
    };
  }

  // Fallback quote if this minute has no entry in the dataset
  return getFallbackQuote(date);
}

function getFallbackQuote(date) {
  const t = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const tmpl = FALLBACK_TEMPLATES[0];
  return { 
    text: tmpl.replace("{time}", `<span class="time-highlight">${t}</span>`), 
    author: "Minute Muse", 
    title: "Focus Room" 
  };
}

  function updateDisplay(quoteData, periodLabel) {
    if (!elQuote || !elAuthor) return;
    elQuote.classList.add('fade-out');
    elAuthor.classList.add('fade-out');
    
    setTimeout(() => {
      let qText = quoteData.text ? quoteData.text.replace(/<br>/g, ' ') : "Reading…"; 
      elQuote.innerHTML = `“${qText}”`;
      if (quoteData.title) {
        elAuthor.innerHTML = `<span class="author-name">${quoteData.author}</span><br><em>${quoteData.title}</em>`;
      } else {
        elAuthor.textContent = quoteData.author || "Unknown";
      }
      
      if (elPeriod && !focusMode) elPeriod.textContent = periodLabel;
      
      elQuote.classList.remove('fade-out');
      elAuthor.classList.remove('fade-out');
      elQuote.classList.add('fade-in');
      elAuthor.classList.add('fade-in');
      
      setTimeout(() => {
        elQuote.classList.remove('fade-in');
        elAuthor.classList.remove('fade-in');
      }, 600);
    }, 400);
  }

  function getPeriod(h) {
    if (h >= 5 && h < 8) return 'dawn';
    if (h >= 8 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  async function performUpdate(force = false) {
  if (focusMode) return; 
  if (isUpdating && !force) return; 
  isUpdating = true;

  const now = new Date();
  const h = now.getHours();
  const period = getPeriod(h);

  if (force || period !== lastPeriod) {
    lastPeriod = period;
    detectClimate(); 
    updateBackground(period);
    autoSelectTrack(); 
  }

  // Instant local lookup (Zero network latency)
  const quoteData = getQuoteForTime(now);

  const greetings = ["Good Night", "Good Morning", "Good Afternoon", "Good Evening", "Deep Work Night"];
  const gIndex = h < 5 ? 0 : h < 12 ? 1 : h < 17 ? 2 : h < 22 ? 3 : 4;
  if (elGreeting) elGreeting.textContent = greetings[gIndex];

  updateDisplay(quoteData, PERIODS_CONFIG[period].label);
  
  const hh = String(h).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  if (elTime) elTime.textContent = `${hh}:${mm}`;
  
  isUpdating = false;
}

  function startClock() {
    const now = new Date();
    if (elNext) elNext.textContent = `Next page in ${60 - now.getSeconds()}s`;

    setInterval(() => {
      const currentNow = new Date();
      const s = currentNow.getSeconds();
      
      if (elNext && !focusMode) elNext.textContent = `Next page in ${60 - s}s`;
      if (s === 0) performUpdate();
    }, 1000);
  }

  // --- 6. EVENT INITIALIZATION ---
  function closeAllModals() {
    [elJournalOverlay, elFocusOverlay, elAdminOverlay, elCreditsOverlay].forEach(modal => {
      if (modal) modal.classList.add('hidden');
    });
    if (elMusicMenu) elMusicMenu.classList.add('hidden');
  }

  (async function init() {
    startClock();
    initAudioMenu();
    
    if (btnSound) btnSound.addEventListener('click', toggleMute);
    if (btnZen) btnZen.addEventListener('click', () => document.body.classList.toggle('zen-active'));
    if (btnNew) btnNew.addEventListener('click', () => performUpdate(true));
    
    // Music Menu
    if (btnMusicMenu && elMusicMenu) {
      btnMusicMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        elMusicMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', (e) => {
        if (!elMusicMenu.contains(e.target) && !btnMusicMenu.contains(e.target)) {
          elMusicMenu.classList.add('hidden');
        }
      });
    }

    // Spotify Player
    if (btnSpotify && elSpotify) {
      btnSpotify.addEventListener('click', () => {
        if (elMusicMenu) elMusicMenu.classList.add('hidden');
        if (audioPlayer && !audioPlayer.paused) toggleMute();
        elSpotify.classList.remove('hidden');
      });
      if (btnCloseSpotify) btnCloseSpotify.addEventListener('click', () => elSpotify.classList.add('hidden'));
    }

    // Journal Modal
    if (btnJournal && elJournalOverlay) {
      btnJournal.addEventListener('click', () => {
        elJournalText.value = localStorage.getItem('minuteMuseJournal') || "";
        elJournalOverlay.classList.remove('hidden');
        elJournalText.focus();
      });
      btnCloseJournal.addEventListener('click', () => {
        localStorage.setItem('minuteMuseJournal', elJournalText.value);
        elJournalOverlay.classList.add('hidden');
      });
    }

    // Credits & Legal Modal
    if (btnOpenCredits && elCreditsOverlay) {
      btnOpenCredits.addEventListener('click', () => elCreditsOverlay.classList.remove('hidden'));
    }
    if (btnCloseCredits && elCreditsOverlay) {
      btnCloseCredits.addEventListener('click', () => elCreditsOverlay.classList.add('hidden'));
    }

    // Admin Secret Click (5 taps)
    if (elSeasonBadge) {
      elSeasonBadge.addEventListener('click', () => {
        adminClicks++;
        if (adminClicks >= 5) {
          adminClicks = 0;
          if (elAdminSelect) elAdminSelect.value = localStorage.getItem('minuteMuseAdminLocation') || 'auto';
          if (elAdminOverlay) elAdminOverlay.classList.remove('hidden');
        }
      });
    }
    if (btnCloseAdmin) {
      btnCloseAdmin.addEventListener('click', () => {
        localStorage.setItem('minuteMuseAdminLocation', elAdminSelect.value);
        elAdminOverlay.classList.add('hidden');
        performUpdate(true); 
      });
    }

    // Focus Timer
    if (btnFocus && elFocusOverlay) {
      btnFocus.addEventListener('click', () => {
        if (focusMode) return;
        elFocusOverlay.classList.remove('hidden');
        if (inpFocusMin) inpFocusMin.focus();
      });
    }
    if (btnStartFocus) {
      btnStartFocus.addEventListener('click', () => {
        const mins = parseInt(inpFocusMin.value) || 25;
        startFocusTimer(mins * 60);
        elFocusOverlay.classList.add('hidden');
      });
    }
    if (btnCancelFocus) btnCancelFocus.addEventListener('click', () => elFocusOverlay.classList.add('hidden'));
    if (btnFocusStop) btnFocusStop.addEventListener('click', stopFocusTimer);
    if (btnFocusExpand) btnFocusExpand.addEventListener('click', () => document.body.classList.add('focus-fullscreen'));
    if (btnExitFullscreen) btnExitFullscreen.addEventListener('click', () => document.body.classList.remove('focus-fullscreen'));

    // Global Keybinds
    document.addEventListener('keydown', (e) => {
      if (e.key === "Escape") {
        if (document.body.classList.contains('focus-fullscreen')) {
          document.body.classList.remove('focus-fullscreen');
        } else {
          closeAllModals();
        }
      }
      if (e.code === 'Space' && e.target === document.body && !focusMode) {
        e.preventDefault();
        performUpdate(true);
      }
    });

    // Close overlays by clicking backdrop
    [elJournalOverlay, elFocusOverlay, elAdminOverlay, elCreditsOverlay].forEach(overlay => {
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) overlay.classList.add('hidden');
        });
      }
    });

    // Load initial data
     await loadQuotesDatabase();
    await loadImages(); 
    detectClimate();
    await performUpdate(true);
  })();

})();
