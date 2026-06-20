// Number Factor Fractals — visualise integers as nested geometric shapes, one layer per prime factor.
// Idea from: https://www.youtube.com/watch?v=hP-DZMmQBng

import { createGLContext } from './gl/context.js';
import { ShapeRenderer } from './gl/renderer.js';
import { BackgroundRenderer } from './gl/background.js';
import { BloomRenderer } from './gl/bloom.js';
import { createAppState, clearDirty, markUniforms } from './state/appState.js';
import { createShapeModel, SHAPE_NAMES } from './core/shapeModel.js';
import { createPaletteResolver, THEME_BACKGROUNDS } from './core/palette.js';
import { buildInstances } from './core/instanceBuilder.js';
import { buildTopology, evaluateTransforms, topologyToBuffers } from './core/topology.js';
import { GEOMETRY_VERSION } from './core/geometry.js';
import { attachCamera } from './ui/camera.js';
import { attachControls } from './ui/controls.js';
import { attachPanel } from './ui/panel.js';
import { randomise } from './state/randomise.js';
import { factorise, groupToComposite } from './core/factorise.js';

const FILL_MIX_MAP    = { fill: 1.0, outline: 0.0, both: 0.5, neon: 0.0, gradient: 0.5, 'outline-fill': 0.5, 'depth-fade': 0.5 };
const FILL_MODE_INT   = { fill: 0, outline: 0, both: 0, neon: 3, gradient: 4, 'outline-fill': 5, 'depth-fade': 6 };

/**
 * Mount the fractal visualiser onto a canvas element.
 * Can be called externally for embedding: mountFractal(canvasEl, opts).
 */
export function mountFractal(canvas, opts = {}) {
  const state = createAppState();
  Object.assign(state, opts);

  const { gl, shapeProgram, bgProgram: _bgProgram, resize, setBlendMode } = createGLContext(canvas);

  const bgRenderer    = new BackgroundRenderer(gl);
  const shapeRenderer = new ShapeRenderer(gl, shapeProgram);
  const bloomRenderer = new BloomRenderer(gl);

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    console.warn('[NFF] WebGL context lost — waiting for restore');
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
  });

  canvas.addEventListener('webglcontextrestored', () => {
    console.log('[NFF] WebGL context restored — reinitialising');
    const fresh = createGLContext(canvas);
    bgRenderer.reinit();
    shapeRenderer.reinit(fresh.shapeProgram);
    bloomRenderer.reinit();
    const s = resize();
    viewW = s.w; viewH = s.h; dpr = s.dpr;
    bloomRenderer.resize(s.pw, s.ph);
    rebuild();
    triggerRender();
  });

  let shapeModel   = createShapeModel(state.shapeMappingOverrides);
  let paletteRsv   = createPaletteResolver(state.paletteName, state.randomPaletteSeed);
  let instanceCount = 0;
  let expectedCount = 0;
  let capped = false;
  let layerStats = [];
  let totalLayers = 0;
  let depthLimit = 0;
  let topology = null; // static skeleton, rebuilt on structural changes, reused during spin

  let rebuildLayerUI = null;
  let panelReady = false;

  // DESIGN DECISION (WHY):
  // - Loop & render states declared early:
  //   Declaring rafId, lastAutoRotTime, lastFrameTime, and fps at the very top of mountFractal
  //   avoids Temporal Dead Zone (TDZ) reference errors when triggerRender() is called during
  //   the initial synchronous build/rebuild cycle.
  let rafId = null;       // requestAnimationFrame handle
  let timeoutId = null;   // setTimeout handle (used during zero-size polling)
  let needsRender = true; // true on first frame, then set by triggerRender / animations
  let lastAutoRotTime = performance.now();
  let lastFrameTime = performance.now();
  let fps = 60;
  let lastAutoPlayStepTime = 0;
  let lastRebuildZoom = 1.0;

  let { w: viewW, h: viewH, dpr, pw: initPw, ph: initPh } = resize();
  bloomRenderer.resize(initPw, initPh);

  const ro = new ResizeObserver(() => {
    const s = resize();
    if (s.pw === 0 || s.ph === 0) return; // skip zero-size (minimised window etc.)
    if (s.w !== viewW || s.h !== viewH) {
      viewW = s.w; viewH = s.h; dpr = s.dpr;
      bloomRenderer.resize(s.pw, s.ph);
      rebuild();
      triggerRender();
    }
  });
  ro.observe(canvas);

  function getFirstRadius() {
    const base = Math.min(viewW, viewH) * 0.5 * state.firstRadiusFraction;
    const primes = factorise(state.number);
    const factors = state.compositeGrouping ? groupToComposite(primes, state.allowedComposites) : primes;
    const depth = factors.length;
    if (depth <= 3) return base;
    const shrink = Math.pow(0.88, depth - 3);
    return Math.max(base * shrink, base * 0.35);
  }

  function _buildOpts(includeSpinAngles) {
    return {
      number:        state.number,
      firstRadius:   getFirstRadius(),
      gap:           state.gap,
      layerOrder:    state.layerOrder,
      layerRotations: includeSpinAngles && state.layerSpinAngles?.length
        ? state.layerSpinAngles.map((a, i) => (state.layerRotations[i] ?? 0) + a)
        : state.layerRotations,
      sidesFor:      shapeModel.sidesFor,
      colourForPrime: paletteRsv.colourForPrime,
      compositeGrouping: state.compositeGrouping,
      allowedComposites: state.allowedComposites,
      autoLayout:        state.autoLayout,
      autoLayoutStrength: state.autoLayoutStrength,
      colourByLayer: state.colourByLayer,
      layerColourScheme: state.layerColourScheme,
      fillMix:       FILL_MIX_MAP[state.fillMode] ?? 0.5,
      strokePx:      state.strokePx,
      alpha:         1.0,
      zoom:          state.zoom,
      viewportMin:   Math.min(viewW, viewH),
      viewportW:     viewW,
      viewportH:     viewH,
      pan:           state.pan,
      layerEmboss:           state.layerEmboss,
      layerTexture:          state.layerTexture,
      layerTextureStyle:     state.layerTextureStyle,
    };
  }

  function rebuild() {
    lastRebuildZoom = state.zoom;
    shapeModel = createShapeModel(state.shapeMappingOverrides);
    paletteRsv = createPaletteResolver(state.paletteName, state.randomPaletteSeed);

    if (state.layerSpinEnabled || state.layerPulseEnabled) {
      // Topology path: needed for spin and/or pulse
      topology = buildTopology(_buildOpts(false));
      if (!topology) return;

      const spinRows = topology.effectiveFactors.slice(0, topology.depthLimit).map((f, i) => {
        let dir = 1;
        if (state.layerSpinMode === 'alternating') dir = i === 0 ? 1 : (i % 2 === 0 ? 2 : -2);
        else if (state.layerSpinMode === 'per-layer') dir = i % 2 === 0 ? 1 : -1;
        else if (state.layerSpinMode === 'seeded') dir = ((f * 2654435761) >>> 16) % 2 === 0 ? 1 : -1;
        return `  L${i+1} ×${f}: ${(state.layerSpinSpeed * dir).toFixed(2)}°/s (${dir > 0 ? 'CCW' : 'CW'})`;
      });
      console.log(`[NFF] topology rebuilt (${topology.nodes.length} nodes) — spin rates:\n${spinRows.join('\n')}`);

      evaluateTransforms(topology, state.layerSpinAngles ?? []);
      const { buffers, instanceCount: ic } = topologyToBuffers(topology, state.layerSpinAngles ?? [], state.zoom, viewW, viewH, state.pan);
      shapeRenderer.uploadInstances(buffers, ic);
      instanceCount = ic;
      expectedCount = ic;
      capped = topology.capped;
      depthLimit = topology.depthLimit ?? 0;
      totalLayers = topology.effectiveFactors?.length ?? 0;
      layerStats = [];
    } else {
      // No spin: use buildInstances directly, clear stale topology
      topology = null;
      const result = buildInstances(_buildOpts(false));
      shapeRenderer.uploadInstances(result.buffers, result.instanceCount);
      instanceCount = result.instanceCount;
      expectedCount = result.expectedCount ?? result.instanceCount;
      capped = result.capped;
      layerStats = result.layers ?? [];
      depthLimit = result.depthLimit ?? 0;
      totalLayers = result.totalLayers ?? 0;
    }

    // Concise change-time logging (always visible)
    if (layerStats && layerStats.length > 0) {
      const factorsStr = factorise(state.number).join('×');
      const activeModes = [];
      if (state.bloomEnabled) activeModes.push('bloom');
      if (state.textureEnabled) activeModes.push(`texture(${state.textureStyle})`);
      if (state.embossEnabled) activeModes.push('emboss');
      if (state.spotlightEnabled) activeModes.push('spotlight');
      if (state.layerSpinEnabled) activeModes.push(`spin(${state.layerSpinSpeed.toFixed(1)}°/s ${state.layerSpinMode})`);
      console.log(`[NFF] ${state.number} (${factorsStr})
  instances:  ${instanceCount}${capped ? ' (capped)' : ''}
  fillMode:   ${state.fillMode}
  colour:     byLayer=${state.colourByLayer} scheme=${state.layerColourScheme}
  blend:      ${state.blendMode}
  gap:        ${state.gap.toFixed(3)}
  effects:    ${activeModes.length ? activeModes.join(', ') : 'none'}
  layers:     ${layerStats.map((l, i) => `L${i+1}×${l.factor}(${l.sides === 0 ? 'circle' : l.sides === 2 ? 'line' : l.sides + '-gon'})`).join(' → ')}`);
    }

    // Emit scaling log to console.table if debug mode is active (Q5)
    if (state.debug && layerStats.length > 0) {
      const logData = layerStats.map((l, i) => ({
        'Layer': i + 1,
        'Factor': l.factor,
        'Sides': l.sides,
        'Radius (World)': Number(l.radius.toFixed(4)),
        'Radius (Px)': Number(l.radiusPx.toFixed(1)),
        'Child/Parent Ratio': Number(l.ratio.toFixed(4)),
        'Subtree Radius': Number(l.subtreeRadius.toFixed(4)),
        'Flags': l.flags
      }));
      console.table(logData);
    }
  }

  function recolour() {
    paletteRsv = createPaletteResolver(state.paletteName, state.randomPaletteSeed);
    // Recolour requires a full rebuild since colours are baked into the instance buffer
    rebuild();
    triggerRender();
  }

  // Initial build — reset camera to avoid stale pan/zoom from any prior session
  state.pan = [0, 0];
  state.zoom = 1.0;
  rebuild();
  setBlendMode(state.blendMode);
  triggerRender();

  // UI wiring
  // Pass triggerRender as a callback to attachCamera to re-render on mouse pan/zoom/pinch events
  attachCamera(canvas, state, () => {
    // Manual camera pan/zoom automatically pauses autoplay to avoid input conflicts
    if (state.autoPlayEnabled) {
      state.autoPlayEnabled = false;
      if (panel && panel.syncAutoplayUI) panel.syncAutoplayUI();
    }
    // Rebuild when zoom changes by 2× so collapsed dots resolve to real shapes on zoom-in
    const zoomRatio = state.zoom / lastRebuildZoom;
    if (zoomRatio < 0.5 || zoomRatio > 2.0) rebuild();
    triggerRender();
  });

  const controls = attachControls(state, () => {
    rebuild();
    if (panelReady && rebuildLayerUI) rebuildLayerUI();
    if (panel && panel.syncAutoplayUI) panel.syncAutoplayUI();
    triggerRender();
  }, triggerRender);

  const panel = attachPanel(
    state,
    () => { rebuild(); triggerRender(); },
    recolour,
    () => { setBlendMode(state.blendMode); triggerRender(); },
    triggerRender
  );
  rebuildLayerUI = panel.rebuildLayerUI;
  panelReady = true;

  const randomiseBtn = document.getElementById('randomise-btn');
  if (randomiseBtn) {
    randomiseBtn.addEventListener('click', () => {
      // Manual randomise pauses autoplay
      state.autoPlayEnabled = false;
      if (panel.syncAutoplayUI) panel.syncAutoplayUI();
      randomise(state);
      
      // Reset camera view on randomise to avoid getting lost
      state.pan = [0, 0];
      state.zoom = 1.0;
      markUniforms(state);

      rebuild();
      setBlendMode(state.blendMode);
      rebuildLayerUI();
      triggerRender();
    });
  }

  // Global rotation
  const globalRotSlider = document.getElementById('global-rot-slider');
  const globalRotVal    = document.getElementById('global-rot-val');
  if (globalRotSlider) {
    globalRotSlider.addEventListener('input', () => {
      state.globalRotation = Number(globalRotSlider.value) * Math.PI / 180;
      if (globalRotVal) globalRotVal.textContent = globalRotSlider.value;
      markUniforms(state);
      triggerRender();
    });
  }

  const autoRotateToggle = document.getElementById('auto-rotate-toggle');
  if (autoRotateToggle) {
    autoRotateToggle.addEventListener('change', () => {
      state.autoRotate = autoRotateToggle.checked;
      triggerRender();
    });
  }

  // Debug overlay
  const debugOverlay = document.getElementById('debug-overlay');
  const versionDisplay = document.getElementById('version-display');
  if (versionDisplay) versionDisplay.textContent = `v${GEOMETRY_VERSION}`;

  // HUD panel
  const hudPanel     = document.getElementById('hud-panel');
  const hudToggleBtn = document.getElementById('hud-toggle-btn');
  const hudFps       = document.getElementById('hud-fps');
  const hudInstances = document.getElementById('hud-instances');
  const hudFactors   = document.getElementById('hud-factors');
  const hudEffects   = document.getElementById('hud-effects');
  const hudCamera    = document.getElementById('hud-camera');
  if (hudToggleBtn && hudPanel) {
    hudToggleBtn.addEventListener('click', () => {
      hudPanel.classList.toggle('hidden');
      hudToggleBtn.textContent = hudPanel.classList.contains('hidden') ? 'HUD ▾' : 'HUD ▴';
      triggerRender();
    });
  }

  function triggerRender() {
    needsRender = true;
    if (rafId === null) {
      lastAutoRotTime = performance.now();
      lastFrameTime = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    rafId = null;
    needsRender = false;

    const dt = (now - lastAutoRotTime) / 1000;
    lastAutoRotTime = now;

    const isAnimating = state.autoRotate || state.spotlightEnabled || state.autoPlayEnabled || state.layerSpinEnabled || state.layerPulseEnabled || (state.textureSwim === 'uniform' || state.textureSwim === 'seeded');

    // DESIGN DECISION (WHY):
    // - Smooth Frame-Synchronized Autoplay:
    //   Instead of running an asynchronous setInterval loop (which causes frame stutter and race conditions),
    //   we update the autoplay step directly inside the requestAnimationFrame render loop.
    //   This ensures the counting transition matches the screen refresh rate, keeping slide scrub animations
    //   and canvas renders perfectly fluid and in-sync.
    if (state.autoPlayEnabled) {
      if (now - lastAutoPlayStepTime > state.autoPlaySpeed) {
        lastAutoPlayStepTime = now;
        let nextN = state.number + state.autoPlayDirection;
        if (nextN >= state.autoPlayMax) {
          nextN = state.autoPlayMax;
          state.autoPlayDirection = -1; // reverse to count down
        } else if (nextN <= state.autoPlayMin) {
          nextN = state.autoPlayMin;
          state.autoPlayDirection = 1; // reverse to count up
        }
        if (controls && typeof controls.applyNumber === 'function') {
          controls.applyNumber(nextN, false); // isManual = false prevents pausing itself
        }
      }
    }

    // Auto-rotate
    if (state.autoRotate) {
      state.globalRotation += state.autoRotateSpeed * dt * Math.PI / 180;
    }

    // Topology animation — spin and/or pulse, both use the skeleton fast path
    if ((state.layerSpinEnabled || state.layerPulseEnabled) && topology) {
      const primes = factorise(state.number);
      const factors = state.compositeGrouping ? groupToComposite(primes, state.allowedComposites) : primes;
      const n = factors.length;

      if (state.layerSpinEnabled) {
        const speedRad = state.layerSpinSpeed * dt * Math.PI / 180;
        if (!state.layerSpinAngles || state.layerSpinAngles.length !== n) {
          state.layerSpinAngles = new Array(n).fill(0);
        }
        for (let i = 0; i < n; i++) {
          let dir = 1;
          if (state.layerSpinMode === 'alternating') {
            dir = i === 0 ? 1 : (i % 2 === 0 ? 2 : -2);
          } else if (state.layerSpinMode === 'per-layer') {
            dir = i % 2 === 0 ? 1 : -1;
          } else if (state.layerSpinMode === 'seeded') {
            dir = ((factors[i] * 2654435761) >>> 16) % 2 === 0 ? 1 : -1;
          }
          state.layerSpinAngles[i] += speedRad * dir;
        }
        const chaosMode = state.layerSpinMode === 'chaos';
        if (chaosMode) {
          for (let ni = 0; ni < topology.nodes.length; ni++) {
            const node = topology.nodes[ni];
            node.nodeSpinAngle += speedRad * node.nodeSpinDir * node.nodeSpinMult / (node.layerIdx + 1);
          }
        }
      }

      // Pulse: base tempo (state.layerPulseSpeed) × per-layer harmonic ratio from factor
      let layerScales = null;
      if (state.layerPulseEnabled && topology.layerPulsePhase) {
        layerScales = topology.layerPulsePhase.map((phase, i) => {
          const t = now * 0.001 * topology.layerPulseSpeed[i] * state.layerPulseSpeed;
          return 1.0 + Math.sin(phase + t * Math.PI * 2) * 0.15;
        });
      }

      const chaosMode = state.layerSpinMode === 'chaos';
      evaluateTransforms(topology, state.layerSpinAngles ?? [], chaosMode);
      const { buffers, instanceCount: ic } = topologyToBuffers(topology, state.layerSpinAngles ?? [], state.zoom, viewW, viewH, state.pan, layerScales);
      shapeRenderer.uploadInstances(buffers, ic);
      instanceCount = ic;
      expectedCount = ic;
    }

    // Handle resize
    const s = resize();
    if (s.pw === 0 || s.ph === 0) {
      // Zero-size canvas — poll slowly until size returns, then draw immediately
      timeoutId = setTimeout(() => { timeoutId = null; triggerRender(); }, 500);
      return;
    }
    if (s.w !== viewW || s.h !== viewH) {
      viewW = s.w; viewH = s.h; dpr = s.dpr;
      bloomRenderer.resize(s.pw, s.ph);
      rebuild(); // radii depend on viewport
    }

    const bg = THEME_BACKGROUNDS[state.theme] ?? THEME_BACKGROUNDS.dark;
    const useBloom = state.bloomEnabled && bloomRenderer.enabled;

    if (useBloom) {
      bloomRenderer.bindSceneFbo();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, s.pw, s.ph);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    bgRenderer.draw(bg.top, bg.bottom);

    setBlendMode(state.blendMode);
    shapeRenderer.draw({
      u_pan:       state.pan,
      u_zoom:      state.zoom,
      u_globalRot: state.globalRotation,
      u_viewport:  [s.pw, s.ph],
      u_fillMode:  FILL_MODE_INT[state.fillMode] ?? 0,
      u_emissive:  state.emissiveStrength,
      u_embossOn:       state.embossEnabled ? 1.0 : 0.0,
      u_embossStrength: state.embossStrength,
      u_spotlightOn:    state.spotlightEnabled ? 1.0 : 0.0,
      u_lightPos:       [Math.cos(now * 0.001 * state.spotlightSpeed) * Math.min(viewW, viewH) * 0.35 * state.zoom,
                         Math.sin(now * 0.001 * state.spotlightSpeed) * Math.min(viewW, viewH) * 0.35 * state.zoom],
      u_spotFalloff:    state.spotlightFalloff,
      u_time:           now * 0.001,
      u_textureOn:     state.textureEnabled ? 1.0 : 0.0,
      u_textureStyle:  state.textureStyle,
      u_textureSwimMode: state.textureSwim === 'uniform' ? 1 : state.textureSwim === 'seeded' ? 2 : state.textureSwim === 'uniform-static' ? 3 : state.textureSwim === 'prime-only' ? 4 : 0,
    });

    if (useBloom) {
      bloomRenderer.composite({
        threshold: state.bloomThreshold,
        intensity: state.bloomIntensity,
        radius:    state.bloomRadius,
        exposure:  state.bloomExposure,
      });
    }

    clearDirty(state);

    if (hudPanel && !hudPanel.classList.contains('hidden')) {
      if (hudFps) hudFps.textContent = isAnimating ? `fps  ${fps.toFixed(0)}` : `fps  —`;
      if (hudInstances) {
        const mismatch = instanceCount !== expectedCount;
        hudInstances.textContent = mismatch
          ? `inst  ${instanceCount.toLocaleString()} / exp ${expectedCount.toLocaleString()}`
          : `inst  ${instanceCount.toLocaleString()}`;
        hudInstances.style.color = mismatch ? '#f83' : '';
      }
      if (hudFactors) {
        const primes = factorise(state.number);
        const factors = state.compositeGrouping ? groupToComposite(primes, state.allowedComposites) : primes;
        hudFactors.textContent = `n  ${state.number} = ${factors.join('×')}`;
      }
      if (hudEffects) {
        const fx = [
          state.bloomEnabled    ? 'bloom'     : null,
          state.embossEnabled   ? 'emboss'    : null,
          state.spotlightEnabled? 'spot'      : null,
          state.textureEnabled  ? 'tex'       : null,
        ].filter(Boolean);
        hudEffects.textContent = `fx  ${fx.length ? fx.join(' ') : 'none'}  ${state.fillMode}  ${state.blendMode}`;
      }
      if (hudCamera) {
        const atOrigin = state.pan[0] === 0 && state.pan[1] === 0 && state.zoom === 1.0;
        if (atOrigin) {
          hudCamera.textContent = '';
        } else {
          const px = state.pan[0].toFixed(0);
          const py = state.pan[1].toFixed(0);
          const zm = state.zoom.toFixed(3);
          hudCamera.textContent = `cam  ${px}, ${py}  ×${zm}`;
        }
      }
    }

    // FPS — only updated during continuous animation; stale when idle
    const elapsed = now - lastFrameTime;
    lastFrameTime = now;
    if (isAnimating) fps = fps * 0.9 + (1000 / elapsed) * 0.1;

    if (debugOverlay) {
      const layerLines = layerStats.map((l, i) => {
        const name = SHAPE_NAMES[l.sides] ?? `${l.sides}-gon`;
        const dots = l.dots > 0 ? ` <span style="opacity:0.5">(·${l.dots} dots)</span>` : '';
        return `L${i+1} ×${l.factor} ${name} ${l.count}${dots}`;
      }).join('<br>');
      const cappedLine = capped ? `<br><span style="color:#f80">capped ${depthLimit}/${totalLayers} layers</span>` : '';

      let tableHtml = '';
      if (layerStats && layerStats.length > 0) {
        tableHtml = `
          <details style="margin-top:8px;font-size:11px;background:rgba(0,0,0,0.55);padding:6px;border-radius:4px;cursor:pointer;text-align:left;">
            <summary style="color:#0cf;font-weight:bold;outline:none;">Scaling Log</summary>
            <table style="width:100%;text-align:left;border-collapse:collapse;margin-top:4px;font-family:monospace;font-size:10px;color:#fff;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.25);">
                  <th style="padding:2px 4px 2px 0;">L</th>
                  <th style="padding:2px 4px;">×</th>
                  <th style="padding:2px 4px;">S</th>
                  <th style="padding:2px 4px;">R(w)</th>
                  <th style="padding:2px 4px;">Ratio</th>
                  <th style="padding:2px 4px;">SubR</th>
                  <th style="padding:2px 0 2px 4px;">Flags</th>
                </tr>
              </thead>
              <tbody>
                ${layerStats.map((l, idx) => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <td style="padding:2px 4px 2px 0;opacity:0.8;">${idx+1}</td>
                    <td style="padding:2px 4px;font-weight:bold;">${l.factor}</td>
                    <td style="padding:2px 4px;opacity:0.8;">${l.sides}</td>
                    <td style="padding:2px 4px;">${l.radius.toFixed(3)}</td>
                    <td style="padding:2px 4px;">${l.ratio.toFixed(2)}</td>
                    <td style="padding:2px 4px;">${l.subtreeRadius.toFixed(2)}</td>
                    <td style="padding:2px 0 2px 4px;color:${l.flags !== 'none' ? '#f80' : '#888'};font-size:9px;">${l.flags}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </details>
        `;
      }

      const countMismatch = (instanceCount !== expectedCount);
      const countStyle = countMismatch ? 'color:#ff3333;font-weight:bold;' : '';
      const countStr = countMismatch
        ? `<span style="${countStyle}">actual: ${instanceCount.toLocaleString()} / expected: ${expectedCount.toLocaleString()}</span>`
        : `${instanceCount.toLocaleString()} inst`;

      const activeFx = [
        state.bloomEnabled     ? 'bloom'   : null,
        state.embossEnabled    ? 'emboss'  : null,
        state.spotlightEnabled ? 'spot'    : null,
        state.textureEnabled   ? `tex:${['noise','voronoi','stripes'][state.textureStyle]??state.textureStyle}` : null,
        state.layerSpinEnabled ? `spin:${state.layerSpinMode}` : null,
        state.layerPulseEnabled ? 'pulse'  : null,
        state.autoRotate       ? 'rot'     : null,
      ].filter(Boolean).join(' · ');

      const primes = factorise(state.number);
      const factors = state.compositeGrouping ? groupToComposite(primes, state.allowedComposites) : primes;
      const factorStr = factors.join(' × ');

      debugOverlay.innerHTML =
        `<div style="font-size:13px;color:rgba(255,255,255,0.9);font-weight:600">${state.number} = ${factorStr}</div>` +
        `<div style="opacity:0.6;font-size:10px;">v${GEOMETRY_VERSION} · ${countStr}${capped ? ' (cap)' : ''} · ${isAnimating ? fps.toFixed(0)+' fps' : '—'}</div>` +
        `<div style="opacity:0.55;font-size:10px;">${state.fillMode} · ${state.blendMode} · ${state.colourByLayer ? state.layerColourScheme : 'palette'}</div>` +
        (activeFx ? `<div style="opacity:0.5;font-size:10px;">${activeFx}</div>` : '') +
        (layerLines ? `<div style="margin-top:4px;font-size:10px;opacity:0.7;">${layerLines}${cappedLine}</div>` : '') +
        tableHtml;
    }

    // Re-schedule: keep looping while animating or dirty, go idle otherwise.
    if ((isAnimating || needsRender) && rafId === null) {
      needsRender = false;
      rafId = requestAnimationFrame(frame);
    }
    // else: go idle — next triggerRender() call will restart the loop
  }

  // DESIGN DECISION (WHY):
  // - WebGL Context Leak & Memory Protection:
  //   Browsers have a strict cap on the number of simultaneous active WebGL contexts (usually 8 to 16).
  //   If you dynamically mount and unmount canvases without cleaning up active frame requests, contexts
  //   are leaked, eventually causing WebGL initialization crashes.
  //   Providing an explicit `destroy()` hook cancels any pending requestAnimationFrame and cleans up
  //   all resources during unmounts, completely resolving context starvation.
  function destroy() {
    ro.disconnect();
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
  }

  return { state, rebuild, triggerRender, destroy };
}

// Auto-mount block commented out to allow manual mounting from RLA's controller
// const canvas = document.getElementById('fractal-canvas');
// if (canvas) {
//   requestAnimationFrame(() => mountFractal(canvas));
// }
