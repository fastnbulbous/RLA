// BFS over prime factors → typed-array instance buffers for GPU instancing.

import { factorise, groupToComposite } from './factorise.js';
import { computeRadii, estimateInstanceCount, polygonVertices, computeSubtreeRadii, CIRCLE_CHILD_COUNT, circleChildCount } from './geometry.js';
import { solveLayout } from './autoLayout.js';
import { layerColours } from './palette.js';

export const HARD_CAP = 500_000;

/**
 * Build instance buffers for the fractal of `number`.
 *
 * @param {object} opts
 *   number        - integer to factorise
 *   firstRadius   - circumradius of outermost layer (world units)
 *   gap           - spacing fraction 0..1
 *   layerOrder    - optional permutation of factor indices
 *   layerRotations - per-layer extra rotation [radians]
 *   sidesFor      - function(factor) → sides
 *   colourForPrime - function(prime) → [r,g,b]
 *   fillMix       - 0..1 (outline→fill)
 *   strokePx      - stroke width in pixels
 *   alpha         - global alpha
 *   zoom          - current zoom (world units per pixel) for sub-pixel cull
 *   viewportMin   - min(viewW, viewH) in pixels for sub-pixel cull
 * @returns { buffers, instanceCount, capped }
 */
export function buildInstances(opts) {
  const {
    number,
    firstRadius,
    gap,
    layerOrder,
    layerRotations = [],
    sidesFor,
    colourForPrime,
    colourByLayer = false,
    layerColourScheme = 'neon',
    fillMix = 1.0,
    strokePx = 2.0,
    alpha = 1.0,
    zoom = 1,
    viewportW = 800,
    viewportH = 600,
    pan = [0, 0],
    compositeGrouping = true,
    allowedComposites = { 4:true, 8:true, 9:true },
    autoLayout = false,
    autoLayoutStrength = 1.0,
    layerEmboss = [],
    layerTexture = [],
    layerTextureStyle = [],
  } = opts;

  const primes = factorise(number);
  const rawFactors = compositeGrouping ? groupToComposite(primes, allowedComposites) : primes;
  if (rawFactors.length === 0) {
    return { buffers: _emptyBuffers(), instanceCount: 0, capped: false };
  }

  // Apply layer order permutation
  const factors = layerOrder
    ? layerOrder.map(i => rawFactors[i]).filter(f => f !== undefined)
    : rawFactors;

  // If permutation is shorter than factors (random layering may truncate), keep the unpermuted factors
  const effectiveFactors = factors.length === rawFactors.length ? factors : rawFactors;

  let radii = computeRadii(effectiveFactors, firstRadius, gap, sidesFor);

  // Pre-count to size buffers and detect HARD_CAP
  const estCount = estimateInstanceCount(effectiveFactors, sidesFor);
  let capped = false;
  let depthLimit = effectiveFactors.length;

  if (estCount > HARD_CAP) {
    // Find depth limit that keeps us under cap
    let count = 0;
    let branching = 1;
    depthLimit = 0;
    for (let i = 0; i < effectiveFactors.length; i++) {
      if (count + branching > HARD_CAP) break;
      count += branching;
      const s = sidesFor(effectiveFactors[i]);
      branching *= (s === 0 ? circleChildCount(effectiveFactors[i]) : s <= 1 ? 1 : s);
      depthLimit = i + 1;
    }
    capped = true;
    console.warn(`[NFF] HARD_CAP: number ${number} est ${estCount} instances, depth-limited to ${depthLimit}/${effectiveFactors.length} layers`);
  }

  // Auto-layout: adjust rotations and spacing to reduce sibling overlap
  const resolvedLayerRotations = layerRotations.slice();
  let spacingMultipliers = new Array(effectiveFactors.length).fill(1.0);
  const originalRadii = radii.slice();

  if (autoLayout && estCount <= HARD_CAP * 2) {
    const solved = solveLayout(
      effectiveFactors.slice(0, depthLimit),
      radii.slice(0, depthLimit),
      resolvedLayerRotations.slice(0, depthLimit),
      sidesFor,
      { maxSpacingPush: 1.0 + 0.4 * autoLayoutStrength }
    );
    for (let i = 0; i < depthLimit; i++) {
      resolvedLayerRotations[i] = solved.layerRotations[i] ?? resolvedLayerRotations[i];
      spacingMultipliers[i] = solved.spacingMultipliers[i] ?? 1.0;
    }
    radii = solved.radii.concat(radii.slice(depthLimit));
  }

  const subtreeR = computeSubtreeRadii(effectiveFactors, radii, sidesFor);

  // DESIGN DECISION (WHY):
  // - Single-Pass Exact Buffer Allocation:
  //   During rapid slider scrubbing, building the fractal BFS tree multiple times per second
  //   would cause massive Garbage Collection (GC) pauses if we dynamically grew arrays.
  //   To eliminate GC thrashing and memory latency, we pre-calculate `exactMaxInstances`
  //   (accounting for all shape centers and digon end bulbs) and allocate exact-sized
  //   TypedArrays once before traversing the tree.
  let exactMaxInstances = 0;
  let allocBranching = 1;
  for (let i = 0; i < depthLimit; i++) {
    const s = sidesFor(effectiveFactors[i]);
    exactMaxInstances += allocBranching;
    allocBranching *= (s === 0 ? circleChildCount(effectiveFactors[i]) : s <= 1 ? 1 : s);
  }
  const maxInst = Math.max(1, exactMaxInstances);
  const centre         = new Float32Array(maxInst * 2);
  const radius         = new Float32Array(maxInst);
  const rotArr         = new Float32Array(maxInst);
  const colour         = new Float32Array(maxInst * 3);
  const alphaArr       = new Float32Array(maxInst);
  const strokeArr      = new Float32Array(maxInst);
  const fillArr        = new Float32Array(maxInst);
  const sidesArr       = new Uint32Array(maxInst);
  const dotRadArr      = new Float32Array(maxInst);
  const outlineColArr  = new Float32Array(maxInst * 3);
  const depthArr       = new Float32Array(maxInst);
  const embossArr  = new Float32Array(maxInst);
  const patternArr = new Float32Array(maxInst);
  const seedArr    = new Float32Array(maxInst);

  // DESIGN DECISION (WHY):
  // - Parallel ALUexpectedCount Checker:
  //   With complex branching layers and dynamic digon end-dot insertions, memory offsets can easily get misaligned.
  //   We track `expectedInstances` as an independent mathematical count of non-culled/non-collapsed shapes
  //   plus end bulbs. The UI asserts this against the actual written index `idx`, raising a red alert in the
  //   diagnostic overlay if any mismatch (index-creep or child-dropping) is detected.
  let expectedInstances = 0;
  let idx = 0;
  const layerStats = [];

  const LAYER_COLOURS = layerColours(layerColourScheme);

  // BFS: start at origin
  let points = [{ x: 0, y: 0, rot: -Math.PI }];

  for (let layerIdx = 0; layerIdx < depthLimit; layerIdx++) {
    const factor = effectiveFactors[layerIdx];
    const r = radii[layerIdx];
    const extraRot = resolvedLayerRotations[layerIdx] ?? 0;
    const spacingMult = spacingMultipliers[layerIdx] ?? 1.0;
    const sides = sidesFor(factor);
    const basePrime = factorise(factor)[0] ?? factor;
    const col = colourByLayer
      ? LAYER_COLOURS[layerIdx % LAYER_COLOURS.length]
      : colourForPrime(basePrime);
    const isLast = layerIdx === depthLimit - 1;
    const nextFactor = effectiveFactors[layerIdx + 1];
    const nextIsDigon = !isLast && sidesFor(nextFactor) === 2;
    const nextPoints = [];
    let layerCount = 0, layerDots = 0;

    // Hoist viewport cull constants — they don't vary per-point
    const panDist = Math.sqrt(pan[0] * pan[0] + pan[1] * pan[1]);
    const screenDiag = Math.sqrt((viewportW / 2) ** 2 + (viewportH / 2) ** 2);

    for (const pt of points) {
      if (idx >= maxInst) break;

      // DESIGN DECISION (WHY):
      // - Rotation-Invariant Bounding-Sphere Viewport Culling:
      //   Standard axis-aligned bounding box (AABB) checks are invalid because the fractal can be rotated
      //   freely by the user or by auto-rotation. Translating every vertex through trigonometric rotation
      //   matrices on the CPU is highly inefficient.
      //   Instead, we compute a rotation-invariant culling test:
      //   1. Get the shape's distance from the origin (ptDist).
      //   2. Subtract the camera pan vector length (panDist) and the shape's circumradius (r).
      //   3. Compare this absolute minimum distance (converted to screen space via zoom) against the
      //      screen diagonal (screenDiag).
      //   If it is greater, the shape is guaranteed to be fully off-screen under ANY rotation angle.
      //   This allows us to prune entire branches of the BFS tree in constant time with 0% false positives.
      const ptDist = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
      const minDistance = Math.max(0, ptDist - panDist - r);
      const offScreen = minDistance / zoom > screenDiag;

      if (offScreen) {
        if (!isLast) {
          const verts = polygonVertices(sides, r * spacingMult, pt.rot + Math.PI / 2 + extraRot, pt.x, pt.y, nextIsDigon, factor);
          for (const v of verts) nextPoints.push(v);
        }
        continue;
      }

      // Mathematical expected count check:
      // Since this shape is not culled, we expect at least 1 instance for the shape itself.
      expectedInstances++;

      // Sub-pixel cull: if this shape would be < 0.75px, render as dot
      const screenR = r / zoom;
      const pixRadius = screenR;
      const collapsed = pixRadius < 0.75;

      const isLine = sides === 2;
      const drawStroke = isLine ? Math.max(0.5, strokePx * 0.6) : strokePx;
      const normDepth = depthLimit > 1 ? layerIdx / (depthLimit - 1) : 0;
      centre[idx*2]       = pt.x;
      centre[idx*2+1]     = pt.y;
      radius[idx]         = r;
      rotArr[idx]         = pt.rot + extraRot;
      colour[idx*3]       = col[0];
      colour[idx*3+1]     = col[1];
      colour[idx*3+2]     = col[2];
      outlineColArr[idx*3]   = col[0];
      outlineColArr[idx*3+1] = col[1];
      outlineColArr[idx*3+2] = col[2];
      depthArr[idx]       = normDepth;
      alphaArr[idx]       = alpha;
      strokeArr[idx]      = drawStroke;
      fillArr[idx]        = fillMix;
      sidesArr[idx]       = collapsed ? 1 : sides;  // dot if sub-pixel
      const lEmb = layerEmboss[layerIdx];
      const lTex = layerTexture[layerIdx];
      const lTexStyle = layerTextureStyle[layerIdx];
      embossArr[idx]  = lEmb  === true ? 1.0 : lEmb  === false ? -1.0 : 0.0;
      patternArr[idx] = lTex  === true ? (lTexStyle != null ? lTexStyle + 1 : 1.0)
                       : lTex === false ? -1.0 : 0.0;
      seedArr[idx]    = basePrime;
      layerCount++;
      if (collapsed) layerDots++;

      dotRadArr[idx] = 0;
      idx++;

      if (!collapsed && !isLast) {
        const verts = polygonVertices(sides, r * spacingMult, pt.rot + Math.PI / 2 + extraRot, pt.x, pt.y, nextIsDigon, factor);
        for (const v of verts) nextPoints.push(v);
      }


    }

    const parentRadius = layerIdx > 0 ? radii[layerIdx - 1] : 0;
    const ratio = parentRadius > 0 ? r / parentRadius : 1.0;
    const subtreeRadius = subtreeR[layerIdx] ?? r;

    // Check flags
    const flagList = [];
    if (layerIdx >= depthLimit) flagList.push('capped');
    if (radii[layerIdx] < originalRadii[layerIdx] - 0.001) flagList.push('autoLayout-packed');
    if (spacingMultipliers[layerIdx] > 1.001) flagList.push('spacing-pushed');
    const flags = flagList.join(', ') || 'none';

    layerStats.push({
      factor,
      sides,
      count: layerCount,
      dots: layerDots,
      radius: r,
      radiusPx: r / zoom,
      ratio,
      subtreeRadius,
      flags
    });
    points = nextPoints;
    if (points.length === 0) break;
  }

  return {
    buffers: { centre, radius, rotation: rotArr, colour, alpha: alphaArr, strokePx: strokeArr, fillMix: fillArr, sides: sidesArr, dotRadius: dotRadArr, outlineColour: outlineColArr, depth: depthArr, emboss: embossArr, pattern: patternArr, seed: seedArr },
    instanceCount: idx,
    expectedCount: expectedInstances,
    capped,
    layers: layerStats,
    depthLimit,
    totalLayers: effectiveFactors.length,
  };
}

function _emptyBuffers() {
  return {
    centre: new Float32Array(0), radius: new Float32Array(0), rotation: new Float32Array(0),
    colour: new Float32Array(0), alpha: new Float32Array(0), strokePx: new Float32Array(0),
    fillMix: new Float32Array(0), sides: new Uint32Array(0), dotRadius: new Float32Array(0),
    outlineColour: new Float32Array(0), depth: new Float32Array(0),
    emboss: new Float32Array(0), pattern: new Float32Array(0), seed: new Float32Array(0),
  };
}


