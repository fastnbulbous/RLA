export const SHAPE_NAMES = {
  0: 'circle', 1: 'dot', 2: 'line', 3: 'triangle', 4: 'square', 5: 'pentagon',
  6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 11: 'hendecagon',
};

// Shape mapping: number → sides count used in SDF renderer.
// 0 = circle sentinel, 1 = dot, 2 = digon/capsule, 3..11 = regular polygons.
// Primes >= 13 always render as circles.

const DEFAULT_MAPPING = {
  1:  1,   // dot
  2:  2,   // digon / line
  3:  3,   // triangle
  4:  4,   // square
  5:  5,   // pentagon
  6:  6,   // hexagon
  7:  7,   // heptagon
  8:  8,   // octagon
  9:  9,   // nonagon
  10: 10,  // decagon
  11: 11,  // hendecagon
};

export function createShapeModel(customMapping = {}) {
  const mapping = { ...DEFAULT_MAPPING, ...customMapping };

  function sidesFor(factor) {
    if (factor <= 11) return mapping[factor] ?? factor;
    return 0; // circle for large primes
  }

  return { sidesFor, mapping };
}
