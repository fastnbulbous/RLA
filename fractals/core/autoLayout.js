// Auto-layout solver: reduces sibling sub-tree overlap via rotation search + extra spacing + size packing.
// Runs at build time (not per-frame), only when autoLayout is enabled.

import { polygonVertices, TWO_PI, computeSubtreeRadii } from './geometry.js';

/**
 * Given a factor array, per-layer radii, rotation offsets, and sidesFor mapping,
 * compute adjusted per-layer rotations and a spacing multiplier that reduce sibling overlap.
 *
 * Strategy (least-disruptive first):
 *   1. For each layer with > 1 sibling, try N rotation offsets; keep the least-overlapping.
 *   2. If overlap persists after rotation, push children further out (spacing multiplier > 1).
 *   3. If still overlapping, shrink the subtree radius estimate until siblings clear.
 *
 * Returns: { layerRotations, spacingMultipliers, radii }
 * spacingMultipliers[i] = factor to multiply the placement radius at layer i.
 */

export function solveLayout(factors, radii, existingLayerRotations, sidesFor, opts = {}) {
  const {
    rotationSteps   = 12,   // how many rotation offsets to try per layer
  } = opts;

  const n = factors.length;
  const layerRotations = existingLayerRotations.slice();
  // Fill missing entries
  while (layerRotations.length < n) layerRotations.push(0);

  // DESIGN DECISION (WHY):
  // - Spacing push is disabled (hardcoded to 1.0 spacing multiplier):
  //   Pushing child shapes outward from their parents to avoid overlap breaks the core visual constraint
  //   of the fractal—that a child shape's center must lie EXACTLY on its parent's vertex.
  //   Allowing spacing > 1.0 creates a "detached floaters" look, which is visually unappealing and structurally wrong.
  const spacingMultipliers = new Array(n).fill(1.0);

  // Bottom-up: compute each layer's subtree bounding radius.
  // subtreeR[i] = the radius of the circle enclosing the whole subtree rooted at layer i.
  const subtreeR = computeSubtreeRadii(factors, radii, sidesFor);

  // Top-down: for each layer i, optimise its children's rotation to reduce overlap
  // between the subtrees sitting on each vertex of the layer-i polygon.
  let points = [{ x: 0, y: 0, rot: -Math.PI }];

  for (let i = 0; i < n - 1; i++) {
    const sides = sidesFor(factors[i]);
    if (sides <= 1 || points.length === 0) { points = []; break; }

    const r = radii[i];
    const childSides = sidesFor(factors[i + 1]);
    const nextIsDigon = childSides === 2;
    const childExtent = subtreeR[i + 1]; // bounding radius of each child subtree

    // DESIGN DECISION (WHY):
    // - Depth-dependent overlap tolerance:
    //   Outer layers are highly visible and must remain perfectly clean to establish a strong structural rhythm (tolerance = 0.02 to 0.05).
    //   As we go deeper, nested subtrees become extremely dense. Forcing strict 0% overlap at deep layers would trigger
    //   excessive size-shrinking, rendering inner layers invisible. Allowing depth-dependent kissing corners (0.15+) preserves visual details.
    const layerTolerance = (i === 0) ? 0.02 : (i === 1) ? 0.05 : 0.15 + (i - 2) * 0.1;

    // --- Step 1: rotation search ---
    const baseRot = layerRotations[i] ?? 0;
    let bestRot = baseRot;
    let bestOverlap = _measureLayerOverlap(points, sides, r, baseRot, childExtent, i, factors, sidesFor);

    if (bestOverlap > layerTolerance && sides >= 3) {
      for (let s = 1; s < rotationSteps; s++) {
        const tryRot = baseRot + (s / rotationSteps) * TWO_PI / sides;
        const ov = _measureLayerOverlap(points, sides, r, tryRot, childExtent, i, factors, sidesFor);
        if (ov < bestOverlap) {
          bestOverlap = ov;
          bestRot = tryRot;
        }
      }
      layerRotations[i] = bestRot;
    }

    // --- Step 2: spacing push (DISABLED/CAPPED to 1.0) ---
    // Children stay attached to parent vertices at all times.

    // Advance points to next layer
    const nextPoints = [];
    for (const pt of points) {
      const verts = polygonVertices(sides, r, pt.rot + Math.PI / 2 + layerRotations[i], pt.x, pt.y, nextIsDigon, factors[i]);
      for (const v of verts) nextPoints.push(v);
    }
    points = nextPoints;
  }

  // DESIGN DECISION (WHY):
  // - Step 3: Size Packing:
  //   If rotation optimization alone cannot clear sibling subtrees within the specified depth tolerance,
  //   we proportionally scale down the radii of all deeper nested levels. This acts as a protective boundary:
  //   instead of detaching shapes (Step 2), we mathematically pack them into the available sibling clearance zone.
  const adjustedRadii = radii.slice();
  for (let i = 0; i < n - 1; i++) {
    const sides = sidesFor(factors[i]);
    if (sides < 3) continue;
    const r = adjustedRadii[i];
    const minSep = 2 * r * Math.sin(Math.PI / sides);
    const childExtent = subtreeR[i + 1];
    const layerTolerance = (i === 0) ? 0.02 : (i === 1) ? 0.05 : 0.15 + (i - 2) * 0.1;

    // If child extent exceeds parent separating boundary (with depth-forgiving tolerance)
    if (childExtent > minSep * 0.5 - layerTolerance * adjustedRadii[i]) {
      const scale = (minSep * (0.5 - layerTolerance * 0.4)) / Math.max(childExtent, 0.001);
      if (scale < 1.0) {
        // Scale all deeper radii proportionally
        for (let j = i + 1; j < n; j++) {
          adjustedRadii[j] *= scale;
        }
      }
    }
  }

  return { layerRotations, spacingMultipliers, radii: adjustedRadii };
}

// Estimate total overlap for a given rotation at layer i.
// Returns total fractional overlap (0 = no overlap, 1+ = heavy).
function _measureLayerOverlap(points, sides, r, extraRot, childExtent, layerIdx, factors, sidesFor) {
  let totalOverlap = 0;
  const step = TWO_PI / sides;
  const nextIsDigon = layerIdx + 1 < factors.length && sidesFor(factors[layerIdx + 1]) === 2;

  for (const pt of points) {
    const baseAngle = pt.rot + Math.PI / 2 + extraRot;
    const verts = [];
    for (let k = 0; k < sides; k++) {
      const angle = baseAngle + k * step;
      verts.push({ x: pt.x + r * Math.cos(angle), y: pt.y + r * Math.sin(angle) });
    }
    // Check all pairs
    for (let a = 0; a < verts.length; a++) {
      for (let b = a + 1; b < verts.length; b++) {
        const dx = verts[a].x - verts[b].x;
        const dy = verts[a].y - verts[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = 2 * childExtent;
        if (dist < minDist) {
          totalOverlap += (minDist - dist) / minDist;
        }
      }
    }
  }
  return totalOverlap;
}


