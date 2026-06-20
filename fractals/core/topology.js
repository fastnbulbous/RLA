// Topology: static fractal skeleton + fast per-frame transform evaluation.
//
// DESIGN DECISION (WHY):
// - Split static structure from animated transforms:
//   Full BFS (buildInstances) recomputes radii, autoLayout, and child positions every call.
//   During layer spin animation this runs at 60fps, causing jitter from floating-point variance
//   in the autoLayout solver and unnecessary GC pressure from intermediate arrays.
//   Solution: build the skeleton once (buildTopology), store each node's parent index and
//   base placement angle, then evaluateTransforms() just walks the flat array doing cos/sin
//   per node — no BFS, no radius recomputation, no autoLayout. Stable and fast.
//
// Invalidation: any setting that changes structure (number, gap, shape mapping, layerOrder,
// zoom level for collapse, viewport size) must call buildTopology() again. Spin angle changes
// only need evaluateTransforms() + topologyToBuffers().

import { factorise, groupToComposite } from './factorise.js';
import { computeRadii, estimateInstanceCount, circleChildCount, TWO_PI, polygonVertices } from './geometry.js';
import { solveLayout } from './autoLayout.js';
import { layerColours } from './palette.js';

export const HARD_CAP_TOPO = 500_000;

/**
 * Build the static fractal skeleton.
 * Returns a topology object that can be passed to evaluateTransforms() every frame.
 * Pre-allocates GPU buffer arrays so topologyToBuffers() never allocates during animation.
 */
export function buildTopology(opts) {
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
  if (rawFactors.length === 0) return null;

  const factors = layerOrder
    ? layerOrder.map(i => rawFactors[i]).filter(f => f !== undefined)
    : rawFactors;
  const effectiveFactors = factors.length === rawFactors.length ? factors : rawFactors;

  let radii = computeRadii(effectiveFactors, firstRadius, gap, sidesFor);

  const estCount = estimateInstanceCount(effectiveFactors, sidesFor);
  let capped = false;
  let depthLimit = effectiveFactors.length;

  if (estCount > HARD_CAP_TOPO) {
    let count = 0, branching = 1;
    depthLimit = 0;
    for (let i = 0; i < effectiveFactors.length; i++) {
      if (count + branching > HARD_CAP_TOPO) break;
      count += branching;
      const s = sidesFor(effectiveFactors[i]);
      branching *= (s === 0 ? circleChildCount(effectiveFactors[i]) : s <= 1 ? 1 : s);
      depthLimit = i + 1;
    }
    capped = true;
  }

  const resolvedLayerRotations = layerRotations.slice();
  const spacingMultipliers = new Array(effectiveFactors.length).fill(1.0);

  if (autoLayout && estCount <= HARD_CAP_TOPO * 2) {
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

  const LAYER_COLOURS = layerColours(layerColourScheme);

  // BFS to build flat node array in parent-before-child order.
  // Each node stores everything static; x/y/rot are mutable and updated by evaluateTransforms.
  const nodes = [];

  // BFS: start at origin
  let currentLayerParents = [{ idx: -1, x: 0, y: 0, rot: -Math.PI }];

  for (let layerIdx = 0; layerIdx < depthLimit; layerIdx++) {
    const factor = effectiveFactors[layerIdx];
    const r = radii[layerIdx];
    const baseExtraRot = resolvedLayerRotations[layerIdx] ?? 0;
    const spacingMult = spacingMultipliers[layerIdx] ?? 1.0;
    const sides = sidesFor(factor);
    const basePrime = factorise(factor)[0] ?? factor;
    const col = colourByLayer
      ? LAYER_COLOURS[layerIdx % LAYER_COLOURS.length]
      : colourForPrime(basePrime);

    const isLast = layerIdx === depthLimit - 1;
    const nextFactor = effectiveFactors[layerIdx + 1];
    const nextIsDigon = !isLast && sidesFor(nextFactor) === 2;

    const lEmb = layerEmboss[layerIdx];
    const lTex = layerTexture[layerIdx];
    const lTexStyle = layerTextureStyle[layerIdx];
    const normDepth = depthLimit > 1 ? layerIdx / (depthLimit - 1) : 0;
    const isLine = sides === 2;
    const drawStroke = isLine ? Math.max(0.5, strokePx * 0.6) : strokePx;

    const nextLayerParents = [];

    for (const parent of currentLayerParents) {
      const nodeIdx = nodes.length;
      const collapsed = (r / zoom) < 0.75;

      // Per-node spin seed: hash layerIdx + childIndex for chaotic mode
      const ci = parent.childIndex ?? 0;
      const h = Math.imul(layerIdx * 2654435761 ^ ci * 1013904223, 1664525) >>> 0;
      const nodeSpinDir = (h & 1) ? 1 : -1;
      const nodeSpinMult = 0.4 + ((h >>> 8) & 0xff) / 255 * 1.2; // 0.4..1.6×

      nodes.push({
        layerIdx,
        parentIdx: parent.idx,
        distFromParent: parent.idx === -1 ? 0 : parent.distFromParent,
        childIndex: ci,
        totalSiblings: parent.totalSiblings ?? 1,
        step: parent.step ?? 0,
        baseExtraRot,
        nodeSpinDir, nodeSpinMult,
        nodeSpinAngle: 0, // accumulated per-frame in chaos mode
        r, sides, col: col.slice(), basePrime, normDepth, alpha,
        drawStroke, fillMix, isLine, lEmb, lTex, lTexStyle, nextIsDigon,
        x: parent.x, y: parent.y, rot: parent.rot,
      });

      if (!isLast && !collapsed) {
        const verts = polygonVertices(sides, r * spacingMult, parent.rot + Math.PI / 2 + baseExtraRot, parent.x, parent.y, nextIsDigon, factor);
        const step = verts.length > 0 ? TWO_PI / verts.length : 0;

        for (let ci = 0; ci < verts.length; ci++) {
          const v = verts[ci];
          const dx = v.x - parent.x, dy = v.y - parent.y;
          nextLayerParents.push({
            idx: nodeIdx,
            x: v.x, y: v.y, rot: v.rot,
            distFromParent: Math.sqrt(dx*dx + dy*dy),
            childIndex: ci,
            totalSiblings: verts.length,
            step,
          });
        }
      }
    }

    currentLayerParents = nextLayerParents;
  }

  // Pre-allocate GPU buffers at exact node count — reused every frame, zero per-frame GC
  const n = nodes.length;
  const buffers = {
    centre:       new Float32Array(n * 2),
    radius:       new Float32Array(n),
    rotation:     new Float32Array(n),
    colour:       new Float32Array(n * 3),
    alpha:        new Float32Array(n),
    strokePx:     new Float32Array(n),
    fillMix:      new Float32Array(n),
    sides:        new Uint32Array(n),
    dotRadius:    new Float32Array(n),
    outlineColour: new Float32Array(n * 3),
    depth:        new Float32Array(n),
    emboss:       new Float32Array(n),
    pattern:      new Float32Array(n),
    seed:         new Float32Array(n),
  };

  // Per-layer pulse: random phase + harmonic speed derived from the factor itself.
  // The base frequency is 1/factor so small primes (2,3) pulse faster than large ones (17,19).
  // A seeded jitter (±30%) breaks perfect lock-step while preserving the harmonic ratios,
  // so layers whose factors share a common divisor drift in and out of phase naturally.
  const rootFactor = effectiveFactors[0] ?? 1;
  const layerPulsePhase = effectiveFactors.map((f, i) => {
    const h = Math.imul(f * 2654435761 ^ i * 1013904223, 1664525) >>> 0;
    return (h & 0xffff) / 0xffff * Math.PI * 2;
  });
  const layerPulseSpeed = effectiveFactors.map((f, i) => {
    const h = Math.imul(f * 1664525 ^ i * 2654435761, 1013904223) >>> 0;
    const jitter = 0.7 + ((h >>> 8) & 0xff) / 255 * 0.6; // 0.7..1.3× jitter
    const harmonic = rootFactor / f; // reciprocal ratio: root layer = 1.0, larger factors = slower
    return harmonic * jitter; // Hz — scaled by layerPulseSpeed in main.js
  });

  return {
    nodes,
    buffers,
    effectiveFactors,
    radii,
    depthLimit,
    spacingMultipliers,
    resolvedLayerRotations,
    capped,
    layerPulsePhase,  // per-layer pulse start phase (radians)
    layerPulseSpeed,  // per-layer pulse speed (Hz)
  };
}

/**
 * Walk the flat node array with current spin angles, update world positions and rotations.
 * Nodes are in BFS order so one forward pass is sufficient — parents always processed before children.
 *
 * @param {object} topology  Result of buildTopology()
 * @param {number[]} spinAngles  Per-layer animated angle additions (radians)
 */
export function evaluateTransforms(topology, spinAngles = [], chaosMode = false) {
  const { nodes } = topology;
  const ROOT_ROT = -Math.PI;

  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni];
    // Chaos mode: each node uses its own accumulated angle; otherwise use per-layer angle
    const spinAngle = chaosMode ? node.nodeSpinAngle : (spinAngles[node.layerIdx] ?? 0);

    if (node.parentIdx === -1) {
      node.x = 0;
      node.y = 0;
      node.rot = ROOT_ROT + node.baseExtraRot + spinAngle;
      continue;
    }

    const parent = nodes[node.parentIdx];
    const parentRot = parent.rot;

    const angle = parentRot + Math.PI / 2 + node.childIndex * node.step;

    node.x = parent.x + node.distFromParent * Math.cos(angle);
    node.y = parent.y + node.distFromParent * Math.sin(angle);

    node.rot = angle - Math.PI / 2 + node.baseExtraRot + spinAngle;
    if (node.isLine && node.nextIsDigon) {
      node.rot += Math.PI / 2;
    }
  }
}

/**
 * Fill pre-allocated GPU buffers from the current evaluated topology.
 * Zero allocation — reuses topology.buffers from buildTopology().
 *
 * @param {object} topology  Result of buildTopology(), after evaluateTransforms()
 * @param {number[]} spinAngles  Current spin angles (needed to add extraRot to shape orientation)
 * @param {number} zoom
 * @param {number} viewportW
 * @param {number} viewportH
 * @param {number[]} pan  [px, py]
 * @returns {{ buffers, instanceCount }}
 */
export function topologyToBuffers(topology, spinAngles, zoom, viewportW, viewportH, pan, layerScales) {
  const { nodes, buffers } = topology;
  const { centre, radius, rotation, colour, alpha: alphaArr, strokePx: strokeArr,
          fillMix: fillArr, sides: sidesArr, dotRadius: dotRadArr, outlineColour: outlineColArr,
          depth: depthArr, emboss: embossArr, pattern: patternArr, seed: seedArr } = buffers;

  const panDist = Math.sqrt(pan[0] * pan[0] + pan[1] * pan[1]);
  const halfW = viewportW / 2, halfH = viewportH / 2;
  const screenDiag = Math.sqrt(halfW * halfW + halfH * halfH);

  let idx = 0;
  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni];
    const { x, y, rot, r, sides, col, basePrime, normDepth, alpha, drawStroke, fillMix,
            lEmb, lTex, lTexStyle } = node;

    // Viewport cull
    const ptDist = Math.sqrt(x * x + y * y);
    if (Math.max(0, ptDist - panDist - r) / zoom > screenDiag) continue;

    const scaledR = layerScales ? r * (layerScales[node.layerIdx] ?? 1.0) : r;

    // Sub-pixel collapse
    const collapsed = (scaledR / zoom) < 0.75;

    centre[idx*2]          = x;
    centre[idx*2+1]        = y;
    radius[idx]            = scaledR;
    rotation[idx]          = rot;
    colour[idx*3]          = col[0];
    colour[idx*3+1]        = col[1];
    colour[idx*3+2]        = col[2];
    outlineColArr[idx*3]   = col[0];
    outlineColArr[idx*3+1] = col[1];
    outlineColArr[idx*3+2] = col[2];
    depthArr[idx]          = normDepth;
    alphaArr[idx]          = alpha;
    strokeArr[idx]         = drawStroke;
    fillArr[idx]           = fillMix;
    sidesArr[idx]          = collapsed ? 1 : sides;
    dotRadArr[idx]         = 0;
    embossArr[idx]         = lEmb === true ? 1.0 : lEmb === false ? -1.0 : 0.0;
    patternArr[idx]        = lTex === true ? (lTexStyle != null ? lTexStyle + 1 : 1.0)
                            : lTex === false ? -1.0 : 0.0;
    seedArr[idx]           = basePrime;
    idx++;
  }

  return { buffers, instanceCount: idx };
}
