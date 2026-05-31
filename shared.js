/* shared.js — Rainbow Learning Academy common library
   Works under file:// (no ES modules, no fetch). Load with <script src="shared.js"></script> */

// ── CANONICAL NAMING CONSTANTS (Workstream E) ───────────────────────────────
const APP_NAME = 'Rainbow Learning Academy';
const AREA_NAMES = {
  num:  'Number Explorers',
  calc: 'Calculation Crew',
  frac: 'Fraction Friends',
  time: 'Time Travellers'
};

// ── HELPERS ──────────────────────────────────────────────────────────────────
function safeInt(v, def) { const n = parseInt(v, 10); return isNaN(n) ? def : n; }
function safeJSON(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── THEME ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-rainbow-doggy');
  document.body.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
}

function toggleTheme() {
  const current = localStorage.getItem('rla_theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('rla_theme', next);
  applyTheme(next);
}

// Call on DOMContentLoaded or immediately after body is ready
function initTheme() {
  applyTheme(localStorage.getItem('rla_theme') || 'dark');
}

// ── AUDIO ─────────────────────────────────────────────────────────────────────
const BARK_FILES = ['bark.mp3','bark2.mp3','bark3.mp3','bark4.mp3','bark5.mp3','bark6.mp3'];
const AVA_FILES  = ['ava.mp3','ava2.mp3','ava3.mp3','ava4.mp3','ava5.mp3','ava6.mp3','ava66.mp3','avav5.mp3'];

let _avaDeck = shuffle(AVA_FILES);
let _avaPos  = 0;
let _interactionCount = 0;
let _nextAvaAt = 5 + Math.floor(Math.random() * 6);
let _idleAvaTimer = null;

function isMuted() { return localStorage.getItem('rla_muted') === 'true'; }

// Audio pool — reuse pre-decoded Audio objects instead of creating on every play
const _audioPool = new Map(); // src → Audio[]

// Pre-create and cache Audio objects for all bark and voice sources once
[...BARK_FILES, ...AVA_FILES].forEach(src => {
  const pool = [new Audio(src), new Audio(src), new Audio(src)];
  pool.forEach(a => { a.preload = 'auto'; });
  _audioPool.set(src, pool);
});

// Smoothly fade out and pause an Audio element over a duration to prevent hard clicks
function _fadeAndPause(audio, durationMs = 150) {
  if (!audio || audio.paused) return;
  if (audio.fadeTimer) {
    clearInterval(audio.fadeTimer);
  }
  const startVol = audio.volume;
  const steps = 8;
  const stepTime = durationMs / steps;
  let currentStep = 0;
  
  audio.fadeTimer = setInterval(() => {
    currentStep++;
    const nextVol = startVol * (1 - (currentStep / steps));
    if (nextVol <= 0.01 || currentStep >= steps) {
      clearInterval(audio.fadeTimer);
      audio.fadeTimer = null;
      audio.pause();
      audio.volume = startVol; // Reset volume for subsequent plays
    } else {
      audio.volume = nextVol;
    }
  }, stepTime);
}

function _pooledPlay(src, vol) {
  if (isMuted()) return;

  // Fade out other currently playing voice/bark clips to prevent overlap clutter
  _audioPool.forEach((pool, poolSrc) => {
    if (poolSrc !== src) {
      pool.forEach(a => {
        if (!a.paused && !a.ended) {
          _fadeAndPause(a, 150);
        }
      });
    }
  });

  let pool = _audioPool.get(src);
  if (!pool) {
    pool = [new Audio(src), new Audio(src), new Audio(src)];
    pool.forEach(a => { a.preload = 'auto'; });
    _audioPool.set(src, pool);
  }
  
  // Find available channel
  const a = pool.find(a => a.paused || a.ended) || pool[0];
  
  // Clear any active fade out timers on the channel we are reusing
  if (a.fadeTimer) {
    clearInterval(a.fadeTimer);
    a.fadeTimer = null;
  }
  
  a.volume = vol;
  a.currentTime = 0;
  a.play().catch(() => {});
}

function playBark() {
  const src = BARK_FILES[Math.floor(Math.random() * BARK_FILES.length)];
  _pooledPlay(src, 0.55);
}

function playNextAva(vol) {
  if (_avaPos >= _avaDeck.length) { _avaDeck = shuffle(AVA_FILES); _avaPos = 0; }
  _pooledPlay(_avaDeck[_avaPos++], vol || 0.7);
}

function tickInteraction() {
  _interactionCount++;
  if (_interactionCount >= _nextAvaAt) {
    _interactionCount = 0;
    _nextAvaAt = 5 + Math.floor(Math.random() * 6);
    playNextAva(0.7);
  }
}

// Web Audio sound effects
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

// Workstream A4 — Procedural Web Audio preset synthesizer sounds
function playSound(type) {
  if (isMuted()) return;
  try {
    const ctx = _getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime;
    
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, t);
      osc.frequency.setValueAtTime(659, t + 0.1);
      osc.frequency.setValueAtTime(784, t + 0.2);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.start(t); osc.stop(t + 0.6);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.setValueAtTime(180, t + 0.15);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
    } else if (type === 'levelup') {
      osc.type = 'sine';
      [523,659,784,1047].forEach((f, i) => osc.frequency.setValueAtTime(f, t + i * 0.1));
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.start(t); osc.stop(t + 0.8);
    } else if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.12);
    } else if (type === 'pop') {
      // Satisfying arcade pop fast chime chord
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, t); // E5
      osc.frequency.exponentialRampToValueAtTime(1046.50, t + 0.12); // C6
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.35);
    } else if (type === 'tick') {
      // Crisp click for sliders
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2500, t);
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      osc.start(t); osc.stop(t + 0.04);
    } else if (type === 'hover') {
      // Extremely quiet pointer hover tick
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1500, t);
      gain.gain.setValueAtTime(0.015, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      osc.start(t); osc.stop(t + 0.03);
    } else if (type === 'whoosh') {
      // Soft fast frequency sweep for page/mode switches
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(750, t + 0.2);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.22);
    }
  } catch (_) {}
}

// Workstream A4 — Setup delegated pointer hover, click, and range slider listeners
function initJuice() {
  let lastHover = 0;
  
  // Delegated hover ticks on button and interactives
  document.body.addEventListener('pointerenter', e => {
    if (isMuted()) return;
    const t = e.target.closest('button, .tab-btn, .choice-btn, .kp-btn, .mode-btn, .diff-btn, .portal-card, .seesaw-bucket');
    if (!t) return;
    const now = performance.now();
    if (now - lastHover < 60) return; // Throttled to avoid overlap spam
    lastHover = now;
    playSound('hover');
  }, true);

  // Delegated click whooshes and tick sounds
  document.body.addEventListener('click', e => {
    const t = e.target.closest('button, .tab-btn, .choice-btn, .kp-btn, .mode-btn, .diff-btn, .seesaw-bucket');
    if (!t) return;
    // Section page shifts play whooshes, regular buttons play standard clicks
    if (t.classList.contains('tab-btn') || t.classList.contains('mode-btn') || t.classList.contains('diff-btn') || t.closest('.portal-card')) {
      playSound('whoosh');
    } else {
      playSound('click');
    }
  }, true);

  // Range slider tick tracking
  document.body.addEventListener('input', e => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
      playSound('tick');
    }
  }, true);
}

function toggleMute() {
  const muted = !isMuted();
  localStorage.setItem('rla_muted', muted);
  const btn = document.getElementById('muteBtn');
  if (btn) btn.textContent = muted ? '🔇 Muted' : '🔊 Sound';
  if (muted && _idleAvaTimer) clearTimeout(_idleAvaTimer);
}

function initMuteBtn() {
  const btn = document.getElementById('muteBtn');
  if (btn) btn.textContent = isMuted() ? '🔇 Muted' : '🔊 Sound';
}

// ── CHARACTERS ────────────────────────────────────────────────────────────────
const CHAR_IMAGES = {
  'Hairy Maclary':      'hairy_maclary.png',
  'Hercules Morse':     'hercules_morse.png',
  'Bottomley Potts':    'bottomley_potts.png',
  'Muffin McLay':       'muffin_mclay.png',
  'Bitzer Maloney':     'bitzer_maloney.png',
  'Schnitzel von Krumm':'schnitzel_von_krumm.png',
  'Schnitzel':          'schnitzel_von_krumm.png',
  'Slinky Malinki':     'slinky.png',
  'Scarface Claw':      'scarface.png',
  'Scarface':           'scarface.png',
  'Rainbow Doggy':      'head.png',
  'Kind Dog':           'kind dog.png',
};

function getCharImage(name) {
  return CHAR_IMAGES[name] || 'hairy_maclary.png';
}

function injectInlineIcons(text, hidePortraits) {
  const charList = Object.keys(CHAR_IMAGES);
  let result = text;
  charList.forEach(name => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<strong>${escaped}<\\/strong>`, 'g');
    const img = hidePortraits ? '' :
      `<img src="${CHAR_IMAGES[name]}" alt="${name}" style="width:22px;height:22px;border-radius:50%;object-fit:contain;vertical-align:middle;margin:0 2px;border:1.5px solid var(--border);">`;
    result = result.replace(re,
      `<span class="char-inline-span" style="display:inline-flex;align-items:center;gap:2px;">${img}<strong>${name}</strong></span>`
    );
  });
  return result;
}

// ── CONFETTI ──────────────────────────────────────────────────────────────────
let _confAnim = null;

function triggerConfetti() {
  let confC = document.getElementById('confettiCanvas');
  if (!confC) {
    confC = document.createElement('canvas');
    confC.id = 'confettiCanvas';
    confC.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1000;';
    document.body.appendChild(confC);
  }
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  confC.width = w * dpr;
  confC.height = h * dpr;
  confC.style.width = w + 'px';
  confC.style.height = h + 'px';
  const cCtx = confC.getContext('2d');
  cCtx.scale(dpr, dpr);
  // Bubblegum candy palette (lemon/apple/lagoon/blueberry/grape/strawberry)
  const cols = ['#d4e04a','#5ec975','#4ab8d4','#7b8fec','#c07de8','#f5634a'];
  const parts = [];
  for (let i = 0; i < 80; i++) {
    parts.push({
      x: Math.random() * w, y: -10,
      sx: Math.random() * 4 - 2,     sy: Math.random() * 5 + 4,
      rot: Math.random() * 360,       rs: Math.random() * 6 - 3,
      sz: Math.random() * 8 + 4,     col: cols[Math.floor(Math.random() * cols.length)]
    });
  }
  if (_confAnim) cancelAnimationFrame(_confAnim);
  (function anim() {
    cCtx.clearRect(0, 0, confC.width, confC.height);
    let done = true;
    parts.forEach(p => {
      p.y += p.sy; p.x += p.sx; p.rot += p.rs;
      if (p.y < confC.height) done = false;
      cCtx.save(); cCtx.translate(p.x, p.y); cCtx.rotate(p.rot * Math.PI / 180);
      cCtx.fillStyle = p.col; cCtx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz);
      cCtx.restore();
    });
    if (!done) {
      _confAnim = requestAnimationFrame(anim);
    } else {
      cCtx.clearRect(0, 0, confC.width, confC.height);
      _confAnim = null;
    }
  })();
}

// ── ANSWER MODAL ──────────────────────────────────────────────────────────────
function showAnswerModal(isCorrect, summaryHtml, helpUsed) {
  let modal = document.getElementById('answerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'answerModal';
    modal.innerHTML = `
      <div class="answer-modal-box">
        <div id="answerModalIcon" style="font-size:3rem;margin-bottom:8px;"></div>
        <div id="answerModalTitle" style="font-family:'Outfit',sans-serif;font-weight:900;font-size:1.4rem;margin-bottom:10px;"></div>
        <div id="answerModalBody" style="font-size:.9rem;line-height:1.6;color:var(--text2);margin-bottom:18px;"></div>
        <button id="answerModalNext" onclick="dismissAnswerModal()" style="
          background:linear-gradient(135deg,var(--area-num, var(--accent)),var(--purple));
          border:none;border-radius:14px;padding:12px 28px;
          font-family:'Outfit',sans-serif;font-weight:800;font-size:1rem;
          color:white;cursor:pointer;width:100%;
        ">🎲 Next Question</button>
      </div>`;
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:1001;background:var(--modal-overlay);backdrop-filter:blur(6px);align-items:center;justify-content:center;';
    document.body.appendChild(modal);
  }
  const icon  = document.getElementById('answerModalIcon');
  const title = document.getElementById('answerModalTitle');
  const body  = document.getElementById('answerModalBody');
  if (isCorrect) {
    icon.textContent  = helpUsed ? '💡' : '⭐';
    title.textContent = helpUsed ? 'Correct with Help!' : 'Brilliant! ⭐';
    title.style.color = 'var(--green)';
  } else {
    icon.textContent  = '🐾';
    title.textContent = 'Not quite — keep going!';
    title.style.color = 'var(--red)';
  }
  body.innerHTML = summaryHtml || '';
  // Reset next button
  const nextBtn = document.getElementById('answerModalNext');
  nextBtn.textContent = '🎲 Next Question';
  nextBtn.onclick = dismissAnswerModal;
  modal.style.display = 'flex';
}

// ── SCORE ECONOMY ─────────────────────────────────────────────────────────────
// Shared storage keys. Stars/streak shared across all modes.
function getStars()  { return safeInt(localStorage.getItem('time_stars'),  0); }
function getStreak() { return safeInt(localStorage.getItem('time_streak'), 0); }
function setStars(n)  { safeSet('time_stars',  n); }
function setStreak(n) { safeSet('time_streak', n); }

function bumpCorrect(usedHelp, onUpdate) {
  const stars = getStars() + 1;
  const streak = usedHelp ? getStreak() : getStreak() + 1;
  setStars(stars); setStreak(streak);
  tickInteraction();
  playSound('pop'); // Workstream A4 pop sound
  triggerConfetti();
  if (typeof rpjSuccess === 'function') rpjSuccess();
  if (onUpdate) onUpdate(stars, streak);
}

function bumpWrong(onUpdate) {
  setStreak(0);
  playSound('wrong');
  if (onUpdate) onUpdate(getStars(), 0);
}

function updateStatsDisplay() {
  const s = document.getElementById('starsCount');
  const k = document.getElementById('streakCount');
  if (s) s.textContent = getStars();
  if (k) k.textContent = getStreak();
}

// ── RAINBOW PJ MASCOT ────────────────────────────────────────────────────────
function initRpj() {
  const rpj = document.getElementById('rpj');
  if (!rpj) return;
  let hideTimer = null;
  let driftTimer = null;

  // Corners: [bottom, right] (randomly bottom-left or bottom-right corners)
  const corners = [
    ['18px', '18px'],               // Bottom-Right
    ['18px', 'calc(100vw - 98px)'], // Bottom-Left
  ];
  let lastCorner = 0;

  function rpjHide() {
    rpj.style.opacity = '0';
    const delay = 8000 + Math.random() * 14000;
    hideTimer = setTimeout(() => {
      let c = Math.floor(Math.random() * corners.length);
      if (c === lastCorner) c = (c + 1) % corners.length;
      lastCorner = c;
      rpj.style.transition = 'none';
      rpj.style.bottom = corners[c][0];
      rpj.style.right  = corners[c][1];
      requestAnimationFrame(() => requestAnimationFrame(() => {
        rpj.style.transition = 'opacity .6s ease, transform .4s ease';
        rpj.style.opacity = '0.22';
      }));
    }, delay);
  }

  window.rpjClick = function () {
    playNextAva(0.75);
    rpj.style.opacity = '0.9';
    rpj.style.transform = 'scale(1.3) rotate(12deg)';
    setTimeout(() => { rpj.style.transform = ''; rpjHide(); }, 600);
  };

  window.rpjSuccess = function () {
    clearTimeout(hideTimer);
    playNextAva(0.75);
    const vw = window.innerWidth, vh = window.innerHeight;
    const size = Math.min(vw, vh) * 0.42;
    const spins = (2 + Math.floor(Math.random() * 3)) * 360;

    rpj.style.transition = 'none';
    rpj.style.transform = 'scaleX(0) scale(0.3)';
    rpj.style.opacity = '0';
    rpj.style.width  = size + 'px';
    rpj.style.height = size + 'px';
    rpj.style.bottom = ((vh - size) / 2) + 'px';
    rpj.style.right  = ((vw - size) / 2) + 'px';

    requestAnimationFrame(() => requestAnimationFrame(() => {
      rpj.style.transition = 'opacity .35s ease, transform .55s cubic-bezier(.175,.885,.32,1.8)';
      rpj.style.opacity = '0.95';
      rpj.style.transform = `rotate(${spins}deg) rotateY(${spins}deg) scale(1.1)`;
    }));

    setTimeout(() => { rpj.style.transform = `rotate(${spins}deg) scale(1.05)`; }, 600);

    setTimeout(() => {
      rpj.style.transition = 'opacity .5s ease, transform .7s cubic-bezier(.4,0,.2,1), bottom .7s cubic-bezier(.4,0,.2,1), right .7s cubic-bezier(.4,0,.2,1), width .7s cubic-bezier(.4,0,.2,1), height .7s cubic-bezier(.4,0,.2,1)';
      rpj.style.width = '80px'; rpj.style.height = '80px';
      rpj.style.bottom = '18px'; rpj.style.right = '18px';
      rpj.style.transform = `rotate(${spins + 360}deg) rotateY(180deg) scale(0.8)`;
    }, 2200);

    setTimeout(() => {
      rpj.style.transition = 'opacity .3s ease, transform .3s ease';
      rpj.style.transform = '';
      rpjHide();
    }, 2950);
  };

  rpj.addEventListener('mouseover', () => { if (rpj.style.opacity !== '0') { rpj.style.opacity = '0.85'; rpj.style.transform = 'scale(1.15) rotate(8deg)'; } });
  rpj.addEventListener('mouseout',  () => { if (parseFloat(rpj.style.opacity || 0) < 0.9) { rpj.style.opacity = '0.22'; rpj.style.transform = ''; } });
}

// ── MASCOT CENTER HOVER CARD ──────────────────────────────────────────────────
function initMascotHover() {
  let card = document.getElementById('mascotCenterCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'mascotCenterCard';
    card.style.cssText = `
      position:fixed;z-index:500;
      background:var(--card);border:1px solid var(--border);border-radius:18px;
      padding:14px 16px;text-align:center;max-width:200px;
      pointer-events:none;opacity:0;transition:opacity .2s;
      box-shadow:0 8px 30px rgba(0,0,0,.4);
    `;
    document.body.appendChild(card);
  }
  const mascotQuotes = {
    'Hairy Maclary':      "Woof! Let's solve this together! 🍕🐶",
    'Hercules Morse':     "Woof! Big problems need big dogs! 🐶",
    'Bottomley Potts':    "Woof! Spot the pattern! 🕵️‍♂️🐶",
    'Muffin McLay':       "Woof! Let's find the answer! 📊🐶",
    'Bitzer Maloney':     "Woof! Comparing is fun! ⚖️🐶",
    'Schnitzel von Krumm':"Woof! Help me share these! 🦴🐶",
    'Slinky Malinki':     "Meow! I want the biggest slice! 🐈‍⬛",
    'Scarface Claw':      "Hiss! Don't mess this up! 😼",
    'Rainbow Doggy':      "Avvavavava! Let's go! 🌈🐶",
    'Kind Dog':           "Woof! Sharing is caring! 💖🐶",
  };

  document.body.addEventListener('mouseenter', e => {
    const target = e.target.closest('.char-inline-span');
    if (!target) return;
    const strongEl = target.querySelector('strong');
    if (!strongEl) return;
    const name = strongEl.textContent.trim();
    const img = CHAR_IMAGES[name] || 'head.png';
    const quote = mascotQuotes[name] || 'Avvavava! 🐾';
    card.innerHTML = `<img src="${img}" alt="${name}" style="width:48px;height:48px;border-radius:50%;object-fit:contain;margin-bottom:6px;border:2px solid var(--border);"><div style="font-weight:800;font-size:.85rem;color:var(--text1);">${name}</div><div style="font-size:.75rem;color:var(--text2);margin-top:4px;">"${quote}"</div>`;
    const rect = target.getBoundingClientRect();
    card.style.top  = (rect.bottom + 8 + window.scrollY) + 'px';
    card.style.left = Math.max(8, rect.left - 60) + 'px';
    card.style.opacity = '1';
  }, true);

  document.body.addEventListener('mouseleave', e => {
    if (!e.target.closest('.char-inline-span')) return;
    card.style.opacity = '0';
  }, true);
}

// ── KEYPAD ────────────────────────────────────────────────────────────────────
function makeKeypad(containerId, displayId, onSubmit, opts) {
  const container = document.getElementById(containerId);
  const display   = document.getElementById(displayId);
  const allowNeg  = opts && opts.allowNegative;
  let current = '';

  function updateDisplay() {
    display.textContent = current === '' ? '_' : current;
  }

  function press(val) {
    if (val === 'del') {
      current = current.slice(0, -1);
    } else if (val === 'neg') {
      if (allowNeg) current = current.startsWith('-') ? current.slice(1) : (current ? '-' + current : '-');
    } else if (val === 'submit') {
      if (current !== '' && current !== '-') {
        onSubmit(parseInt(current, 10));
        current = '';
        updateDisplay();
      }
      return;
    } else {
      if (current.length < 5) current += val;
    }
    updateDisplay();
  }

  container.innerHTML = '';
  const keys = allowNeg
    ? ['7','8','9','4','5','6','1','2','3','neg','0','submit']
    : ['7','8','9','4','5','6','1','2','3','del','0','submit'];
  keys.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'kp-btn' + (v === 'submit' ? ' submit' : (v === 'del' || v === 'neg') ? ' del' : '');
    btn.textContent = v === 'submit' ? '✓ Check' : v === 'del' ? '⌫' : v === 'neg' ? '±' : v;
    btn.addEventListener('click', () => press(v));
    container.appendChild(btn);
  });

  function keyHandler(e) {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (!container.offsetParent) return;
    if (e.key >= '0' && e.key <= '9') press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') press('submit');
    else if (e.key === '-' && allowNeg) press('neg');
  }
  document.addEventListener('keydown', keyHandler);

  return {
    reset() { current = ''; updateDisplay(); },
    destroy() { document.removeEventListener('keydown', keyHandler); },
  };
}

// ── INTRO MODAL ───────────────────────────────────────────────────────────────
function showIntroModal(areaKey, innerHtml, narratorName) {
  if (sessionStorage.getItem('rla_intro_' + areaKey)) return;
  let modal = document.getElementById('introModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'introModal';
    modal.style.cssText = 'display:flex;position:fixed;inset:0;z-index:1002;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);align-items:center;justify-content:center;';
    modal.innerHTML = `<div class="answer-modal-box" style="max-width:640px;text-align:left;">
      <div id="introModalNarr" style="display:flex;align-items:center;gap:12px;margin-bottom:14px;"></div>
      <div id="introModalBody" style="font-size:.92rem;line-height:1.65;color:var(--text2);margin-bottom:18px;"></div>
      <button id="introModalBtn" class="primary-btn" style="width:100%;justify-content:center;" onclick="dismissIntroModal()">Let\'s go! 🐾</button>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.dataset.areaKey = areaKey;
  const img = getCharImage(narratorName || 'Rainbow Doggy');
  document.getElementById('introModalNarr').innerHTML = `<img src="${img}" alt="${narratorName}" style="width:52px;height:52px;border-radius:50%;object-fit:contain;border:2px solid var(--border);"><strong style="font-size:1rem;color:var(--text1);">${narratorName || 'Rainbow Doggy'}</strong>`;
  document.getElementById('introModalBody').innerHTML = innerHtml;
  modal.style.display = 'flex';
}

function dismissIntroModal() {
  const modal = document.getElementById('introModal');
  if (!modal) return;
  sessionStorage.setItem('rla_intro_' + modal.dataset.areaKey, '1');
  modal.style.display = 'none';
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMuteBtn();
  updateStatsDisplay();
  initMascotHover();
  initJuice(); // Hook up Web Audio delegated listeners globally

  // Stop nav-pulse animations after first user interaction (reduces continuous repaints)
  const stopNavPulse = () => {
    document.body.classList.add('user-interacted');
    document.removeEventListener('pointerdown', stopNavPulse);
  };
  document.addEventListener('pointerdown', stopNavPulse);
});
