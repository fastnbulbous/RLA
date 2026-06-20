// Geometry: polygon metrics + gap-aware child radius derivation.

export const TWO_PI = Math.PI * 2;
export const GEOMETRY_VERSION = 44;
export const CIRCLE_CHILD_COUNT = 12; // fallback when factor is unknown

// DESIGN DECISION (WHY):
// - No cap on circle child count: a circle has no natural vertex count so the prime itself
//   is the count — 13 gets 13 children, 257 gets 257. Above ~200 the ring is sub-pixel and
//   instanceBuilder collapses each child to a dot anyway, so there's no visual difference
//   between 251 and 99991. The HARD_CAP handles any instance explosion before it hits the GPU.
//   Capping at an arbitrary number would be dishonest to the math for zero visual gain.
export function circleChildCount(factor) {
  return factor > 1 ? factor : CIRCLE_CHILD_COUNT;
}

/**
 * For a regular polygon with circumradius R and n sides:
 *   edge length  e = 2R sin(π/n)
 *
 * Adjacent children on neighbouring vertices are exactly e apart, so their circumcircles
 * are tangent when r_child = e/2 = R·sin(π/n).  That is the geometric maximum before
 * circumcircles overlap; gap (0..1) shrinks from there for breathing room.
 *
 *   r_child = R · sin(π/n) · (1 − gap)
 *
 * Special cases:
 *   n == 2 (digon): endpoints 2R apart → r_child = R · (1 − gap)
 *   n == 0 (circle): r_child = π·R / count · (1 − gap)
 */
export function childRadius(parentRadius, parentSides, gap, childCount) {
  const g = Math.max(0, Math.min(0.99, gap));
  
  // DESIGN DECISION (WHY):
  // - parentSides === 2 (digon): Since digons represent lines, their endpoints are at ±parentRadius,
  //   making the distance between them 2 * parentRadius. To ensure child shapes resting on the
  //   endpoints do not overlap, each child's maximum radius is capped at exactly half the parentRadius
  //   (multiplied by the gap breathing factor).
  if (parentSides === 2) {
    return parentRadius * 0.5 * (1 - g);
  }
  
  // DESIGN DECISION (WHY):
  // - parentSides === 0 (circle): Children are distributed evenly along the parent's perimeter
  //   (circumference = 2 * PI * parentRadius). For tangent children, the diameter equals perimeter / childCount.
  //   Dividing by 2 yields a maximum child radius of (PI * parentRadius) / childCount.
  if (parentSides === 0) {
    return (Math.PI * parentRadius) / Math.max(childCount, 1) * (1 - g);
  }
  
  // DESIGN DECISION (WHY):
  // - TANGENCY_CAP = 0.5: While mathematically children can be as large as R * sin(π/n), for low side
  //   counts (like triangles where sin(π/3) ≈ 0.866), children would bloom excessively large and completely
  //   swallow the parent shape. Setting a cap at 0.5 maintains clean nested proportions across all side counts.
  const TANGENCY_CAP = 0.5;
  return parentRadius * Math.min(Math.sin(Math.PI / parentSides), TANGENCY_CAP) * (1 - g);
}

/**
 * Vertices of a regular polygon (or digon endpoints) in world space.
 * Starting at the top (angle = -π/2) and stepping CCW.
 *
 * @param {number} sides  Number of sides; 2 = digon (line endpoints).
 * @param {number} radius Circumradius.
 * @param {number} baseAngle  Current accumulated rotation (radians).
 * @param {number} cx World-space centre X.
 * @param {number} cy World-space centre Y.
 * @param {boolean} nextIsDigon  If true, child layer is also a digon → +90° nudge.
 * @returns {{ x, y, rot }[]}
 */
export function polygonVertices(sides, radius, baseAngle, cx, cy, nextIsDigon, factor = CIRCLE_CHILD_COUNT) {
  const verts = [];
  // Circle (sides===0): use the actual prime as child count so 13-circles look
  // different from 17-circles. sides===1 (dot): no children.
  const count = sides === 0 ? circleChildCount(factor) : sides;
  if (count <= 1) return verts;
  const step = TWO_PI / count;

  for (let i = 0; i < count; i++) {
    const angle = baseAngle + i * step;
    // GPU: vertex-0 at local (0,-1), after rotation by rot appears at screen direction rot+π/2.
    // To point outward (at `angle`): rot = angle - π/2.
    let childRot = angle - Math.PI / 2;
    
    // DESIGN DECISION (WHY):
    // - Digon-on-Digon orthorotation: When nesting a digon line directly inside another digon line,
    //   applying a +90° (Math.PI / 2) nudge prevents subsequent child lines from stacking collinearly.
    //   This forces nested lines to branch perpendicularly, creating a beautiful symmetric grid.
    if (sides === 2 && nextIsDigon) childRot += Math.PI / 2;

    // Digons: children spawn from sphere centres at 0.82r, not the geometric tip
    const placement = (sides === 2) ? radius * 0.89 : radius;
    verts.push({
      x:   cx + placement * Math.cos(angle),
      y:   cy + placement * Math.sin(angle),
      rot: childRot,
    });
  }
  return verts;
}

/**
 * Compute all layer radii from outermost to innermost.
 * factors[0] is the outermost layer.
 *
 * @param {number[]} factors     Prime factors array.
 * @param {number}   firstRadius Circumradius of the first (outermost) layer.
 * @param {number}   gap         Gap fraction (0..1).
 * @param {function} sidesFor    Maps factor → sides count.
 * @returns {number[]}  One radius per factor.
 */
export function computeRadii(factors, firstRadius, gap, sidesFor) {
  const radii = [firstRadius];
  for (let i = 0; i < factors.length - 1; i++) {
    const parentSides = sidesFor(factors[i]);
    const childCount  = parentSides === 0 ? circleChildCount(factors[i]) : parentSides;
    radii.push(childRadius(radii[i], parentSides, gap, childCount));
  }
  return radii;
}

/**
 * Estimate total instance count for a factor array without building all instances.
 * Each layer multiplies by the parent's vertex count.
 */
export function estimateInstanceCount(factors, sidesFor) {
  let count = 0;
  let branching = 1;
  for (const f of factors) {
    count += branching;
    const s = sidesFor(f);
    branching *= (s === 0 ? circleChildCount(f) : s === 1 ? 1 : s);
  }
  return count;
}

/**
 * Compute subtree bounding radii bottom-up.
 * subtreeR[i] = bounding radius from the centre of a shape at layer i to the farthest point in its subtree.
 */
export function computeSubtreeRadii(factors, radii, sidesFor) {
  const n = factors.length;
  const sub = radii.slice();

  for (let i = n - 2; i >= 0; i--) {
    const sides = sidesFor(factors[i]);
    const childSub = sub[i + 1];
    // Child centres are at distance radii[i] from this shape's centre.
    sub[i] = radii[i] + childSub;
  }
  return sub;
}
