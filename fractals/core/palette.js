// Curated palettes + random palette generator.
// Each palette is an array of [r,g,b] in linear sRGB (0..1).
// Colours are assigned to primes by primeIndex (stable across numbers).

import { primeIndex } from './factorise.js';

// ── Curated palettes ──────────────────────────────────────────────────────

function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255].map(srgbToLinear);
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export const PALETTES = {
  neon: [
    hex('#ff2d78'), hex('#00e5ff'), hex('#b2ff59'), hex('#ffea00'),
    hex('#e040fb'), hex('#ff6d00'), hex('#1de9b6'), hex('#f8bbd0'),
  ],
  pastel: [
    hex('#f48fb1'), hex('#90caf9'), hex('#a5d6a7'), hex('#fff59d'),
    hex('#ce93d8'), hex('#ffcc80'), hex('#80deea'), hex('#bcaaa4'),
  ],
  sunset: [
    hex('#ff5722'), hex('#ff9800'), hex('#ffc107'), hex('#ff7043'),
    hex('#e91e63'), hex('#9c27b0'), hex('#673ab7'), hex('#ff4081'),
  ],
  mono: [
    hex('#ffffff'), hex('#cccccc'), hex('#aaaaaa'), hex('#888888'),
    hex('#666666'), hex('#444444'), hex('#222222'), hex('#111111'),
  ],
  ocean: [
    hex('#0077b6'), hex('#00b4d8'), hex('#90e0ef'), hex('#caf0f8'),
    hex('#023e8a'), hex('#48cae4'), hex('#ade8f4'), hex('#03045e'),
  ],
};

// ── Random palette generator ──────────────────────────────────────────────

function hslToLinear(h, s, l) {
  // h: 0..360, s: 0..1, l: 0..1 → linear RGB
  h = h % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [srgbToLinear(f(0)), srgbToLinear(f(8)), srgbToLinear(f(4))];
}

export function generateRandomPalette(seed) {
  // Golden-ratio hue spacing in HSL with constrained lightness/chroma
  const PHI = 0.618033988749895;
  let h = (seed * PHI * 360) % 360;
  const colours = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const s = 0.65 + (((seed * 13 + i * 7) & 0xff) / 0xff) * 0.25;
    const l = 0.45 + (((seed * 31 + i * 11) & 0xff) / 0xff) * 0.20;
    colours.push(hslToLinear(h, s, l));
    h = (h + PHI * 360) % 360;
  }
  return colours;
}

// ── Oklab/Oklch colour utilities ──────────────────────────────────────────

function oklchToLinearRGB(L, C, H) {
  // Oklch → Oklab
  const hRad = H * Math.PI / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  // Oklab → LMS (cube root space)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  // LMS → linear sRGB
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    Math.max(0, +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

// ── Layer colour palettes (used by instanceBuilder + topology) ────────────
// All entries use Oklch with fixed L so every layer has equal perceived brightness.
// Neon: L=0.78, C=0.20 — vivid, equal-brightness hues spaced 60° apart
// Accessible (Okabe-Ito inspired): L=0.68, C=0.13 — muted, colour-blind-safe hues
export const LAYER_COLOURS_NEON = [
  oklchToLinearRGB(0.78, 0.20,  200), // cyan
  oklchToLinearRGB(0.78, 0.20,  340), // pink
  oklchToLinearRGB(0.82, 0.17,  108), // yellow
  oklchToLinearRGB(0.78, 0.20,  280), // violet
  oklchToLinearRGB(0.78, 0.20,  155), // green
  oklchToLinearRGB(0.72, 0.22,   38), // orange-red
];
export const LAYER_COLOURS_CB = [
  oklchToLinearRGB(0.68, 0.13,  220), // blue
  oklchToLinearRGB(0.68, 0.13,   55), // orange
  oklchToLinearRGB(0.68, 0.13,  165), // bluish green
  oklchToLinearRGB(0.68, 0.13,   95), // yellow
  oklchToLinearRGB(0.68, 0.13,  240), // deep blue
  oklchToLinearRGB(0.68, 0.13,   25), // vermillion
];
export function layerColours(scheme) {
  return scheme === 'accessible' ? LAYER_COLOURS_CB : LAYER_COLOURS_NEON;
}

// ── Palette resolver ──────────────────────────────────────────────────────

export function createPaletteResolver(paletteName, randomSeed = 0) {
  let colours;
  if (paletteName === 'random') {
    colours = generateRandomPalette(randomSeed);
  } else {
    colours = PALETTES[paletteName] ?? PALETTES.neon;
  }

  function colourForPrime(prime) {
    const idx = primeIndex(prime);
    return colours[idx % colours.length];
  }

  return { colourForPrime, colours };
}

// ── Theme background colours ──────────────────────────────────────────────

export const THEME_BACKGROUNDS = {
  dark:  { top: [0.05, 0.05, 0.10], bottom: [0.10, 0.10, 0.18] },
  light: { top: [0.91, 0.92, 0.96], bottom: [0.77, 0.79, 0.91] },
};
