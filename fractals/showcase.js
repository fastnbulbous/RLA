import { mountFractal } from './main.js';

const TEST_CASES = [
  // Page 1 — deep prime powers (many sibling rings)
  { n: 64,      note: '2⁶ — 6 digon rings' },
  { n: 729,     note: '3⁶ — 6 triangle rings' },
  { n: 3125,    note: '5⁵ — 5 pentagon rings' },
  { n: 2187,    note: '3⁷ — 7 triangle rings' },
  { n: 16807,   note: '7⁵ — 5 heptagon rings' },
  { n: 4096,    note: '2¹² — 12 digon rings' },
  { n: 531441,  note: '3¹² — 12 triangle rings' },
  { n: 1048576, note: '2²⁰ — 20 digon rings' },
  { n: 59049,   note: '3¹⁰ — 10 triangle rings' },
  // Page 2 — many-layer distinct primes (crowded outer rings)
  { n: 2310,    note: '2·3·5·7·11 primorial' },
  { n: 30030,   note: '2·3·5·7·11·13' },
  { n: 510510,  note: '2·3·5·7·11·13·17' },
  { n: 9699690, note: '2·3·5·7·11·13·17·19' },
  { n: 720720,  note: '2⁴·3²·5·7·11·13 highly composite' },
  { n: 831600,  note: '2⁴·3·5²·7·3·... many small factors' },
  { n: 360360,  note: '2³·3²·5·7·11·13' },
  { n: 55440,   note: '2⁴·3²·5·7·11' },
  { n: 45360,   note: '2⁴·3⁴·5·7' },
  // Page 3 — mixed composites + tricky geometry
  { n: 120,     note: '8·3·5 — octagon hub' },
  { n: 840,     note: '8·3·5·7' },
  { n: 2520,    note: '8·9·5·7 — dense' },
  { n: 5040,    note: '7! — 7 layers' },
  { n: 40320,   note: '8! — 8 layers' },
  { n: 15120,   note: '2⁴·3³·5·7' },
  { n: 705,     note: '3·5·47 — large outer prime' },
  { n: 1155,    note: '3·5·7·11 — 4 distinct primes' },
  { n: 4199,    note: '13·17·19 — 3 large primes' },
  // Page 4 — pure primes (single sphere)
  { n: 2,       note: '2 — smallest prime' },
  { n: 3,       note: '3 — triangle' },
  { n: 5,       note: '5 — pentagon' },
  { n: 7,       note: '7 — heptagon' },
  { n: 11,      note: '11 — prime circle' },
  { n: 13,      note: '13 — prime circle' },
  { n: 17,      note: '17 — prime circle' },
  { n: 23,      note: '23 — prime circle' },
  { n: 97,      note: '97 — prime circle' },
  // Page 5 — perfect numbers + special sequences
  { n: 6,       note: '2·3 — first perfect number' },
  { n: 28,      note: '4·7 — second perfect number' },
  { n: 496,     note: '16·31 — third perfect number' },
  { n: 8128,    note: '64·127 — fourth perfect number' },
  { n: 12,      note: '4·3 — first abundant number' },
  { n: 36,      note: '4·9 — 6² highly composite' },
  { n: 1024,    note: '2¹⁰ — power of two' },
  { n: 19683,   note: '3⁹ — power of three' },
  { n: 823543,  note: '7⁷ — 7 heptagon rings' },
  // Page 5 — large primes + near-primes
  { n: 101,     note: '101 — prime' },
  { n: 1009,    note: '1009 — prime' },
  { n: 9973,    note: '9973 — prime near 10k' },
  { n: 99991,   note: '99991 — prime near 100k' },
  { n: 1001,    note: '7·11·13 — three primes' },
  { n: 1729,    note: '9·192 — Hardy-Ramanujan' },
  { n: 2048,    note: '2¹¹ — 11 digon rings' },
  { n: 6561,    note: '3⁸ — 8 triangle rings' },
  { n: 7919,    note: '7919 — 1000th prime' },
  // Page 6 — highly composite numbers
  { n: 360,     note: '8·9·5 — 360°' },
  { n: 1260,    note: '4·9·5·7' },
  { n: 27720,   note: '8·9·5·7·11 — LCM(1..11)' },
  { n: 720720,  note: '2⁴·3²·5·7·11·13 — highly composite' },
  { n: 831600,  note: '2⁴·3·5²·7·11·... many factors' },
  { n: 24,      note: '8·3 — octagon pair' },
  { n: 48,      note: '16·3' },
  { n: 60,      note: '4·3·5 — triangle/square/pentagon' },
  { n: 180,     note: '4·9·5 — square/nonagon/pentagon' },
];

const GRID_SIZE = 9;

const grid      = document.getElementById('grid');
const elPrev    = document.getElementById('sc-prev');
const elPlay    = document.getElementById('sc-play');
const elNext    = document.getElementById('sc-next');
const elBloom   = document.getElementById('sc-bloom');
const elEmboss  = document.getElementById('sc-emboss');
const elSpot    = document.getElementById('sc-spot');
const elTex     = document.getElementById('sc-tex');
const elPageInd = document.getElementById('page-indicator');

// Build GRID_SIZE cells synchronously so they exist in the DOM for layout
const cells = Array.from({ length: GRID_SIZE }, () => {
  const cell = document.createElement('div');
  cell.className = 'cell';

  const canvas = document.createElement('canvas');
  cell.appendChild(canvas);

  const label = document.createElement('div');
  label.className = 'cell-label';
  label.innerHTML = '<span class="lbl-n"></span><span class="lbl-note"></span><span class="lbl-style"></span>';
  cell.appendChild(label);

  grid.appendChild(cell);

  return {
    canvas,
    labelN:     label.querySelector('.lbl-n'),
    labelNote:  label.querySelector('.lbl-note'),
    labelStyle: label.querySelector('.lbl-style'),
    fractal:    null,
  };
});

// Effect state (shared across all cells)
const fx = { bloom: false, emboss: false, spotlight: false, texture: false };

function applyFx(doRebuild) {
  cells.forEach(({ fractal }) => {
    if (!fractal) return;
    const { state, rebuild, triggerRender } = fractal;
    state.bloomEnabled     = fx.bloom;
    state.embossEnabled    = fx.emboss;
    state.spotlightEnabled = fx.spotlight;
    state.textureEnabled   = fx.texture;
    if (doRebuild) rebuild();
    triggerRender();
  });
}

let pageStart = 0;
const totalPages = Math.ceil(TEST_CASES.length / GRID_SIZE);

const FILL_MODES   = ['fill', 'both', 'gradient', 'neon', 'depth-fade'];
const SPIN_MODES   = ['alternating', 'uniform', 'per-layer', 'seeded', 'chaos'];
const BLEND_MODES  = ['additive', 'normal', 'screen'];
const SWIM_MODES   = ['static', 'uniform', 'seeded'];

function _randomiseCellStyle(state) {
  state.fillMode         = FILL_MODES[Math.floor(Math.random() * FILL_MODES.length)];
  state.colourByLayer    = Math.random() > 0.3;
  state.layerColourScheme = Math.random() > 0.5 ? 'neon' : 'accessible';
  state.blendMode        = BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)];
  state.textureEnabled   = fx.texture || Math.random() > 0.4;
  state.textureStyle     = Math.floor(Math.random() * 3);
  state.textureSwim      = SWIM_MODES[Math.floor(Math.random() * SWIM_MODES.length)];
  state.layerSpinEnabled = Math.random() > 0.5;
  state.layerSpinSpeed   = (Math.random() * 4 + 0.5) * (Math.random() > 0.5 ? 1 : -1);
  state.layerSpinMode    = SPIN_MODES[Math.floor(Math.random() * SPIN_MODES.length)];
  state.layerSpinAngles  = [];
  state.layerPulseEnabled = Math.random() > 0.5;
  state.layerPulseSpeed   = 0.3 + Math.random() * 2.0;
  state.gap              = 0.08 + Math.random() * 0.18;
}

function loadPage(start) {
  pageStart = Math.max(0, Math.min(
    Math.floor(((start % TEST_CASES.length) + TEST_CASES.length) % TEST_CASES.length / GRID_SIZE) * GRID_SIZE,
    (totalPages - 1) * GRID_SIZE
  ));

  cells.forEach((cell, i) => {
    const tc = TEST_CASES[(pageStart + i) % TEST_CASES.length];
    if (!cell.fractal) return;
    const { state, rebuild, triggerRender } = cell.fractal;
    state.number = tc.n;
    _randomiseCellStyle(state);
    rebuild();
    triggerRender();
    cell.labelN.textContent    = tc.n.toLocaleString();
    cell.labelNote.textContent = tc.note;
    if (cell.labelStyle) {
      const parts = [
        state.fillMode,
        state.blendMode,
        state.colourByLayer ? state.layerColourScheme : 'palette',
        state.textureEnabled ? `tex:${['noise','voronoi','stripes'][state.textureStyle]}` : null,
        state.layerSpinEnabled ? `spin:${state.layerSpinMode}` : null,
        state.layerPulseEnabled ? 'pulse' : null,
      ].filter(Boolean).join(' · ');
      cell.labelStyle.textContent = parts;
    }
    console.log(`[showcase] cell ${i+1} — ${tc.n} (${tc.note})
  fillMode:         ${state.fillMode}
  colourByLayer:    ${state.colourByLayer} (${state.layerColourScheme})
  blendMode:        ${state.blendMode}
  texture:          ${state.textureEnabled} style=${state.textureStyle} swim=${state.textureSwim}
  gap:              ${state.gap.toFixed(3)}
  layerSpin:        ${state.layerSpinEnabled} speed=${state.layerSpinSpeed.toFixed(2)}°/s mode=${state.layerSpinMode}
  layerPulse:       ${state.layerPulseEnabled} speed=${state.layerPulseSpeed?.toFixed(2)}×`);
  });

  const page = Math.floor(pageStart / GRID_SIZE) + 1;
  elPageInd.textContent = `page ${page} / ${totalPages}`;
}

function syncBtn(el, active) { el.classList.toggle('active', active); }
let playInterval = null;

function togglePlay() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
    elPlay.textContent = '⏯ Play';
    elPlay.classList.remove('active');
  } else {
    elPlay.textContent = '⏸ Pause';
    elPlay.classList.add('active');
    playInterval = setInterval(() => {
      loadPage(pageStart + GRID_SIZE);
    }, 2500);
  }
}

elPrev.addEventListener('click', () => {
  if (playInterval) togglePlay();
  loadPage(pageStart - GRID_SIZE);
});

elPlay.addEventListener('click', togglePlay);

elNext.addEventListener('click', () => {
  if (playInterval) togglePlay();
  loadPage(pageStart + GRID_SIZE);
});

elBloom.addEventListener('click', () => { fx.bloom = !fx.bloom; syncBtn(elBloom, fx.bloom); applyFx(false); });
elEmboss.addEventListener('click', () => { fx.emboss = !fx.emboss; syncBtn(elEmboss, fx.emboss); applyFx(false); });
elSpot.addEventListener('click', () => { fx.spotlight = !fx.spotlight; syncBtn(elSpot, fx.spotlight); applyFx(false); });
elTex.addEventListener('click', () => { fx.texture = !fx.texture; syncBtn(elTex, fx.texture); applyFx(true); });

syncBtn(elBloom,  fx.bloom);
syncBtn(elEmboss, fx.emboss);
syncBtn(elSpot,   fx.spotlight);
syncBtn(elTex,    fx.texture);

// Mount after layout so canvas.clientWidth/clientHeight are non-zero
requestAnimationFrame(() => {
  cells.forEach(cell => {
    cell.fractal = mountFractal(cell.canvas);
  });
  applyFx(false);
  loadPage(0);

});
