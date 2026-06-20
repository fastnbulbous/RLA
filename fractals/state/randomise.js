// Seeded mulberry32 RNG + randomise logic.
// Randomise button → new seed → random layer order, per-layer rotations,
// optionally random blend mode + palette. Number stays fixed.

import { factorise, groupToComposite } from '../core/factorise.js';
import { markRebuild, markBlend, markRecolour } from './appState.js';

// mulberry32: fast, seedable, good quality for visuals
export function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const BLEND_MODES = ['normal', 'additive', 'multiply', 'screen'];
const PALETTE_NAMES = ['neon', 'pastel', 'sunset', 'mono', 'ocean'];

export function randomise(state) {
  // New seed each click
  state.randomSeed = Math.floor(Math.random() * 0xFFFFFF);
  const rand = mulberry32(state.randomSeed);

  const primes = factorise(state.number);
  const factors = state.compositeGrouping
    ? groupToComposite(primes, state.allowedComposites)
    : primes;
  const n = factors.length;

  // Random layer order: shuffle indices
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  state.layerOrder = order;

  // Random per-layer rotations
  state.layerRotations = Array.from({ length: n }, () => (rand() * 2 - 1) * Math.PI);

  // Occasionally randomise blend + palette
  if (rand() > 0.5) {
    state.blendMode = BLEND_MODES[Math.floor(rand() * BLEND_MODES.length)];
    markBlend(state);
  }
  if (rand() > 0.4) {
    state.paletteName = 'random';
    state.randomPaletteSeed = Math.floor(rand() * 65536);
    markRecolour(state);
  }

  const SWIM_MODES = ['static', 'uniform', 'seeded'];
  state.textureSwim = SWIM_MODES[Math.floor(rand() * SWIM_MODES.length)];

  markRebuild(state);
}
