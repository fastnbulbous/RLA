// Settings panel: all controls that map to state changes.
import { markRebuild, markRecolour, markBlend, markUniforms } from '../state/appState.js';
import { factorise, groupToComposite } from '../core/factorise.js';
import { PALETTES } from '../core/palette.js';
import { SHAPE_NAMES } from '../core/shapeModel.js';

export function attachPanel(state, onRebuild, onRecolour, onBlend, triggerRender) {
  const panelEl        = document.getElementById('settings-panel');
  const toggleBtn      = document.getElementById('panel-toggle-btn');

  if (!panelEl) return { rebuildLayerUI: () => {}, syncAutoplayUI: () => {} };

  toggleBtn.addEventListener('click', () => {
    panelEl.classList.toggle('hidden');
    toggleBtn.textContent = panelEl.classList.contains('hidden') ? 'Settings ▾' : 'Settings ▴';
  });

  // Theme
  const themeSelect = document.getElementById('theme-select');
  themeSelect.value = state.theme;
  themeSelect.addEventListener('change', () => {
    state.theme = themeSelect.value;
    document.body.className = `theme-${state.theme}`;
    markRebuild(state); onRebuild();
  });

  // Hoist so palette handlers can reference it
  const colourByLayerToggle = document.getElementById('colour-by-layer-toggle');

  // Palette
  const paletteSelect = document.getElementById('palette-select');
  paletteSelect.value = state.paletteName;
  paletteSelect.addEventListener('change', () => {
    state.paletteName = paletteSelect.value;
    state.colourByLayer = false;
    if (colourByLayerToggle) colourByLayerToggle.checked = false;
    markRecolour(state); onRecolour();
  });

  const randomPaletteBtn = document.getElementById('random-palette-btn');
  randomPaletteBtn.addEventListener('click', () => {
    state.paletteName = 'random';
    state.randomPaletteSeed = Math.floor(Math.random() * 65536);
    paletteSelect.value = 'random';
    state.colourByLayer = false;
    if (colourByLayerToggle) colourByLayerToggle.checked = false;
    markRecolour(state); onRecolour();
  });

  // Bloom controls
  function wireBloomSlider(id, valId, stateKey, factor = 1) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (!el) return;
    el.value = state[stateKey];
    if (valEl) valEl.textContent = state[stateKey];
    el.addEventListener('input', () => {
      state[stateKey] = Number(el.value) * factor;
      if (valEl) valEl.textContent = el.value;
      // Wakes the demand-driven loop on slider changes
      triggerRender();
    });
  }
  const bloomToggle = document.getElementById('bloom-toggle');
  if (bloomToggle) {
    bloomToggle.checked = state.bloomEnabled;
    bloomToggle.addEventListener('change', () => {
      state.bloomEnabled = bloomToggle.checked;
      triggerRender();
    });
  }
  wireBloomSlider('bloom-threshold', 'bloom-threshold-val', 'bloomThreshold');
  wireBloomSlider('bloom-intensity',  'bloom-intensity-val',  'bloomIntensity');
  wireBloomSlider('bloom-radius',     'bloom-radius-val',     'bloomRadius');
  wireBloomSlider('bloom-exposure',   'bloom-exposure-val',   'bloomExposure');
  wireBloomSlider('emissive-slider',  'emissive-val',         'emissiveStrength');

  // Blend mode
  const blendSelect = document.getElementById('blend-select');
  const BLEND_MODES = ['normal', 'additive', 'multiply', 'screen'];
  blendSelect.value = state.blendMode;
  blendSelect.addEventListener('change', () => {
    let mode = blendSelect.value;
    if (mode === 'random') {
      mode = BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)];
    }
    state.blendMode = mode;
    markBlend(state); onBlend();
  });

  // Fill mode
  const fillModeSelect = document.getElementById('fill-mode-select');
  fillModeSelect.value = state.fillMode;
  fillModeSelect.addEventListener('change', () => {
    state.fillMode = fillModeSelect.value;
    markRebuild(state); onRebuild();
  });

  // Stroke weight
  const strokeSlider = document.getElementById('stroke-slider');
  const strokeVal    = document.getElementById('stroke-val');
  strokeSlider.value = state.strokePx;
  strokeVal.textContent = state.strokePx;
  strokeSlider.addEventListener('input', () => {
    state.strokePx = Number(strokeSlider.value);
    strokeVal.textContent = state.strokePx;
    markRebuild(state); onRebuild();
  });

  // Global rotation
  const globalRotSlider = document.getElementById('global-rot-slider');
  const globalRotVal    = document.getElementById('global-rot-val');
  globalRotSlider.addEventListener('input', () => {
    state.globalRotation = Number(globalRotSlider.value) * Math.PI / 180;
    globalRotVal.textContent = globalRotSlider.value;
    markUniforms(state);
    triggerRender();
  });

  const autoRotateToggle = document.getElementById('auto-rotate-toggle');
  autoRotateToggle.addEventListener('change', () => {
    state.autoRotate = autoRotateToggle.checked;
    triggerRender();
  });

  const layerSpinToggle   = document.getElementById('layer-spin-toggle');
  const layerSpinSpeed    = document.getElementById('layer-spin-speed');
  const layerSpinSpeedVal = document.getElementById('layer-spin-speed-val');
  const layerSpinMode     = document.getElementById('layer-spin-mode');
  if (layerSpinToggle) {
    layerSpinToggle.checked = state.layerSpinEnabled;
    layerSpinToggle.addEventListener('change', () => {
      state.layerSpinEnabled = layerSpinToggle.checked;
      if (!state.layerSpinEnabled) state.layerSpinAngles = [];
      onRebuild();
    });
  }
  if (layerSpinSpeed) {
    layerSpinSpeed.value = state.layerSpinSpeed;
    if (layerSpinSpeedVal) layerSpinSpeedVal.textContent = state.layerSpinSpeed;
    layerSpinSpeed.addEventListener('input', () => {
      state.layerSpinSpeed = Number(layerSpinSpeed.value);
      if (layerSpinSpeedVal) layerSpinSpeedVal.textContent = layerSpinSpeed.value;
    });
  }
  if (layerSpinMode) {
    layerSpinMode.value = state.layerSpinMode;
    layerSpinMode.addEventListener('change', () => {
      state.layerSpinMode = layerSpinMode.value;
      state.layerSpinAngles = [];
      triggerRender();
    });
  }

  const layerPulseToggle   = document.getElementById('layer-pulse-toggle');
  const layerPulseSpeedEl  = document.getElementById('layer-pulse-speed');
  const layerPulseSpeedVal = document.getElementById('layer-pulse-speed-val');
  if (layerPulseToggle) {
    layerPulseToggle.checked = state.layerPulseEnabled;
    layerPulseToggle.addEventListener('change', () => {
      state.layerPulseEnabled = layerPulseToggle.checked;
      onRebuild();
    });
  }
  if (layerPulseSpeedEl) {
    layerPulseSpeedEl.value = state.layerPulseSpeed ?? 1.0;
    layerPulseSpeedEl.addEventListener('input', () => {
      state.layerPulseSpeed = Number(layerPulseSpeedEl.value);
      if (layerPulseSpeedVal) layerPulseSpeedVal.textContent = layerPulseSpeedEl.value;
      triggerRender();
    });
  }

  // Gap slider
  const gapSlider = document.getElementById('gap-slider');
  const gapVal    = document.getElementById('gap-val');
  gapSlider.value = Math.round(state.gap * 100);
  gapVal.textContent = Math.round(state.gap * 100);
  gapSlider.addEventListener('input', () => {
    state.gap = Number(gapSlider.value) / 100;
    gapVal.textContent = gapSlider.value;
    markRebuild(state); onRebuild();
  });

  // Visual presets
  const presetSelect = document.getElementById('preset-select');
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const preset = presetSelect.value;
      if (preset === 'soft-gradient') {
        state.fillMode = 'gradient';
        state.bloomEnabled = false;
        state.strokePx = 6.0;
        state.textureEnabled = false;
        state.textureSwim = 'static';
        state.emissiveStrength = 1.0;
      } else if (preset === 'crystalline') {
        state.fillMode = 'gradient';
        state.textureEnabled = true;
        state.textureStyle = 1;
        state.textureSwim = 'seeded';
        state.bloomEnabled = false;
        state.strokePx = 2.0;
        state.emissiveStrength = 1.0;
      } else if (preset === 'neon-bloom') {
        state.fillMode = 'fill';
        state.bloomEnabled = true;
        state.strokePx = 2.0;
        state.textureEnabled = false;
        state.textureSwim = 'static';
        state.emissiveStrength = 1.5;
      } else if (preset === 'flat') {
        state.fillMode = 'both';
        state.bloomEnabled = false;
        state.textureEnabled = false;
        state.textureSwim = 'static';
        state.strokePx = 2.0;
        state.emissiveStrength = 1.0;
      }

      // Sync DOM controls to match new state
      const bloomToggle = document.getElementById('bloom-toggle');
      if (bloomToggle) bloomToggle.checked = state.bloomEnabled;
      const fillModeSelect = document.getElementById('fill-mode-select');
      if (fillModeSelect) fillModeSelect.value = state.fillMode;
      const strokeSlider = document.getElementById('stroke-slider');
      const strokeVal    = document.getElementById('stroke-val');
      if (strokeSlider) {
        strokeSlider.value = state.strokePx;
        if (strokeVal) strokeVal.textContent = state.strokePx;
      }
      const textureToggle = document.getElementById('texture-toggle');
      if (textureToggle) textureToggle.checked = state.textureEnabled;
      const textureStyleSel = document.getElementById('texture-style');
      if (textureStyleSel) textureStyleSel.value = state.textureStyle;
      const emissiveSlider = document.getElementById('emissive-slider');
      const emissiveVal = document.getElementById('emissive-val');
      if (emissiveSlider) {
        emissiveSlider.value = state.emissiveStrength;
        if (emissiveVal) emissiveVal.textContent = state.emissiveStrength;
      }

      markRebuild(state);
      onRebuild();
      triggerRender();
    });
  }

  // Autoplay ping-pong controls
  const autoplayToggle = document.getElementById('autoplay-toggle');
  const autoplaySpeed = document.getElementById('autoplay-speed');
  const autoplaySpeedVal = document.getElementById('autoplay-speed-val');
  const autoplayMin = document.getElementById('autoplay-min');
  const autoplayMax = document.getElementById('autoplay-max');

  if (autoplayToggle) {
    autoplayToggle.checked = state.autoPlayEnabled;
    autoplayToggle.addEventListener('change', () => {
      state.autoPlayEnabled = autoplayToggle.checked;
      triggerRender();
    });
  }
  if (autoplaySpeed) {
    autoplaySpeed.value = state.autoPlaySpeed;
    if (autoplaySpeedVal) autoplaySpeedVal.textContent = state.autoPlaySpeed;
    autoplaySpeed.addEventListener('input', () => {
      state.autoPlaySpeed = Number(autoplaySpeed.value);
      if (autoplaySpeedVal) autoplaySpeedVal.textContent = autoplaySpeed.value;
    });
  }
  if (autoplayMin) {
    autoplayMin.value = state.autoPlayMin;
    autoplayMin.addEventListener('change', () => {
      state.autoPlayMin = Math.max(1, Number(autoplayMin.value));
      autoplayMin.value = state.autoPlayMin;
    });
  }
  if (autoplayMax) {
    autoplayMax.value = state.autoPlayMax;
    autoplayMax.addEventListener('change', () => {
      state.autoPlayMax = Math.max(state.autoPlayMin + 1, Number(autoplayMax.value));
      autoplayMax.value = state.autoPlayMax;
    });
  }

  let lastFactorsJSON = '';

  // Layer order + per-layer rotations (rebuilt when number changes)
  function rebuildLayerUI() {
    const primes = factorise(state.number);
    const rawFactors = state.compositeGrouping ? groupToComposite(primes, state.allowedComposites) : primes;

    const factorsJSON = JSON.stringify(rawFactors);
    if (factorsJSON !== lastFactorsJSON) {
      state.layerOrder = null;
      state.layerRotations = [];
      state.layerSpinAngles = [];
      state.layerEmboss = [];
      state.layerTexture = [];
      state.layerTextureStyle = [];
      lastFactorsJSON = factorsJSON;
    }

    const effectiveFactors = state.layerOrder
      ? state.layerOrder.map(idx => rawFactors[idx]).filter(f => f !== undefined)
      : rawFactors;
    const list = document.getElementById('layer-order-list');
    list.innerHTML = '';
    state.layerRotations = state.layerRotations.slice(0, effectiveFactors.length);

    effectiveFactors.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.dataset.index = i;

      const label = document.createElement('span');
      label.className = 'layer-row-label';
      label.textContent = `Layer ${i + 1}: ×${f}`;

      const rotSlider = document.createElement('input');
      rotSlider.type = 'range';
      rotSlider.className = 'layer-rot-slider';
      rotSlider.min = '-180'; rotSlider.max = '180'; rotSlider.value = 0;
      rotSlider.addEventListener('input', () => {
        state.layerRotations[i] = Number(rotSlider.value) * Math.PI / 180;
        markRebuild(state); onRebuild();
      });

      row.appendChild(label);
      row.appendChild(rotSlider);

      const opts = document.createElement('div');
      opts.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:0.8em;margin-top:2px;';

      const embossLbl = document.createElement('label');
      embossLbl.style.cssText = 'display:flex;align-items:center;gap:2px;';
      const embossCb = document.createElement('input');
      embossCb.type = 'checkbox';
      embossCb.indeterminate = true;
      embossCb.title = 'Emboss (unchecked=global, checked=on, click again=off)';
      const embossState = [null, true, false];
      let embossIdx = 0;
      if (state.layerEmboss[i] === true) embossIdx = 1;
      else if (state.layerEmboss[i] === false) embossIdx = 2;
      embossCb.checked = embossIdx === 1;
      embossCb.indeterminate = embossIdx === 0;
      embossCb.addEventListener('click', () => {
        embossIdx = (embossIdx + 1) % 3;
        state.layerEmboss[i] = embossState[embossIdx];
        embossCb.checked = embossIdx === 1;
        embossCb.indeterminate = embossIdx === 0;
        markRebuild(state); onRebuild();
      });
      embossLbl.appendChild(embossCb);
      embossLbl.appendChild(document.createTextNode('Emb'));

      const texLbl = document.createElement('label');
      texLbl.style.cssText = 'display:flex;align-items:center;gap:2px;';
      const texCb = document.createElement('input');
      texCb.type = 'checkbox';
      texCb.indeterminate = true;
      texCb.title = 'Texture (unchecked=global, checked=on, click again=off)';
      const texState = [null, true, false];
      let texIdx = 0;
      if (state.layerTexture[i] === true) texIdx = 1;
      else if (state.layerTexture[i] === false) texIdx = 2;
      texCb.checked = texIdx === 1;
      texCb.indeterminate = texIdx === 0;
      texCb.addEventListener('click', () => {
        texIdx = (texIdx + 1) % 3;
        state.layerTexture[i] = texState[texIdx];
        texCb.checked = texIdx === 1;
        texCb.indeterminate = texIdx === 0;
        markRebuild(state); onRebuild();
      });
      texLbl.appendChild(texCb);
      texLbl.appendChild(document.createTextNode('Tex'));

      const texStyleSel = document.createElement('select');
      texStyleSel.style.fontSize = '0.75em';
      [['—', ''], ['Noise', '0'], ['Voronoi', '1'], ['Stripes', '2']].forEach(([label, val]) => {
        const o = document.createElement('option');
        o.value = val; o.textContent = label;
        texStyleSel.appendChild(o);
      });
      texStyleSel.value = state.layerTextureStyle[i] != null ? String(state.layerTextureStyle[i]) : '';
      texStyleSel.addEventListener('change', () => {
        state.layerTextureStyle[i] = texStyleSel.value === '' ? null : Number(texStyleSel.value);
        markRebuild(state); onRebuild();
      });

      opts.appendChild(embossLbl);
      opts.appendChild(texLbl);
      opts.appendChild(texStyleSel);
      row.appendChild(opts);
      list.appendChild(row);
    });
  }

  // Shape mapping grid
  function rebuildShapeGrid() {
    const grid = document.getElementById('shape-mapping-grid');
    grid.innerHTML = '';
    for (let n = 1; n <= 11; n++) {
      const lbl = document.createElement('label');
      lbl.textContent = n;

      const sel = document.createElement('select');
      for (const [sides, name] of Object.entries(SHAPE_NAMES)) {
        const opt = document.createElement('option');
        opt.value = sides;
        opt.textContent = name;
        sel.appendChild(opt);
      }
      sel.value = state.shapeMappingOverrides[n] ?? n;
      sel.addEventListener('change', () => {
        state.shapeMappingOverrides[n] = Number(sel.value);
        markRebuild(state); onRebuild();
      });

      grid.appendChild(lbl);
      grid.appendChild(sel);
    }
  }

  // Colour by layer toggle
  if (colourByLayerToggle) {
    colourByLayerToggle.checked = state.colourByLayer;
    colourByLayerToggle.addEventListener('change', () => {
      state.colourByLayer = colourByLayerToggle.checked;
      markRebuild(state); onRebuild();
    });
  }

  // Layer colour scheme select
  const layerColourSchemeSelect = document.getElementById('layer-colour-scheme');
  if (layerColourSchemeSelect) {
    layerColourSchemeSelect.value = state.layerColourScheme ?? 'neon';
    layerColourSchemeSelect.addEventListener('change', () => {
      state.layerColourScheme = layerColourSchemeSelect.value;
      markRebuild(state); onRebuild();
    });
  }

  // Shuffle / Reset layer order buttons
  const shuffleBtn = document.getElementById('layer-shuffle-btn');
  const resetBtn   = document.getElementById('layer-reset-btn');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      const primes = factorise(state.number);
      const factors = state.compositeGrouping ? groupToComposite(primes, state.allowedComposites) : primes;
      const n = factors.length;
      const order = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      state.layerOrder = order;
      markRebuild(state); onRebuild(); rebuildLayerUI();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.layerOrder = null;
      markRebuild(state); onRebuild(); rebuildLayerUI();
    });
  }

  // Auto-layout
  const autoLayoutToggle = document.getElementById('auto-layout-toggle');
  const autoLayoutStrengthSlider = document.getElementById('auto-layout-strength');
  const autoLayoutStrengthVal = document.getElementById('auto-layout-strength-val');
  if (autoLayoutToggle) {
    autoLayoutToggle.checked = state.autoLayout;
    autoLayoutToggle.addEventListener('change', () => {
      state.autoLayout = autoLayoutToggle.checked;
      markRebuild(state); onRebuild();
    });
  }
  if (autoLayoutStrengthSlider) {
    autoLayoutStrengthSlider.value = state.autoLayoutStrength;
    autoLayoutStrengthSlider.addEventListener('input', () => {
      state.autoLayoutStrength = Number(autoLayoutStrengthSlider.value);
      if (autoLayoutStrengthVal) autoLayoutStrengthVal.textContent = autoLayoutStrengthSlider.value;
      if (state.autoLayout) { markRebuild(state); onRebuild(); }
    });
  }

  // Composite grouping
  const compositeToggle = document.getElementById('composite-toggle');
  const compositeCbs = document.querySelectorAll('.composite-cb');
  if (compositeToggle) {
    compositeToggle.checked = state.compositeGrouping;
    compositeToggle.addEventListener('change', () => {
      state.compositeGrouping = compositeToggle.checked;
      markRebuild(state); onRebuild(); rebuildLayerUI();
    });
  }
  compositeCbs.forEach(cb => {
    const val = Number(cb.dataset.val);
    cb.checked = !!state.allowedComposites[val];
    cb.addEventListener('change', () => {
      state.allowedComposites[val] = cb.checked;
      markRebuild(state); onRebuild(); rebuildLayerUI();
    });
  });

  const embossToggle = document.getElementById('emboss-toggle');
  const embossStrSlider = document.getElementById('emboss-strength');
  const embossStrVal = document.getElementById('emboss-strength-val');
  if (embossToggle) {
    embossToggle.checked = state.embossEnabled;
    embossToggle.addEventListener('change', () => {
      state.embossEnabled = embossToggle.checked;
      triggerRender();
    });
  }
  if (embossStrSlider) {
    embossStrSlider.value = state.embossStrength;
    embossStrSlider.addEventListener('input', () => {
      state.embossStrength = Number(embossStrSlider.value);
      if (embossStrVal) embossStrVal.textContent = embossStrSlider.value;
      triggerRender();
    });
  }

  const spotToggle = document.getElementById('spotlight-toggle');
  const spotSpeedSlider = document.getElementById('spotlight-speed');
  const spotSpeedVal = document.getElementById('spotlight-speed-val');
  const spotFalloffSlider = document.getElementById('spotlight-falloff');
  const spotFalloffVal = document.getElementById('spotlight-falloff-val');
  if (spotToggle) {
    spotToggle.checked = state.spotlightEnabled;
    spotToggle.addEventListener('change', () => {
      state.spotlightEnabled = spotToggle.checked;
      triggerRender();
    });
  }
  if (spotSpeedSlider) {
    spotSpeedSlider.value = state.spotlightSpeed;
    spotSpeedSlider.addEventListener('input', () => {
      state.spotlightSpeed = Number(spotSpeedSlider.value);
      if (spotSpeedVal) spotSpeedVal.textContent = spotSpeedSlider.value;
      triggerRender();
    });
  }
  if (spotFalloffSlider) {
    spotFalloffSlider.value = state.spotlightFalloff;
    spotFalloffSlider.addEventListener('input', () => {
      state.spotlightFalloff = Number(spotFalloffSlider.value);
      if (spotFalloffVal) spotFalloffVal.textContent = spotFalloffSlider.value;
      triggerRender();
    });
  }

  const textureToggle = document.getElementById('texture-toggle');
  const textureSwimSelect = document.getElementById('texture-swim-select');
  const textureStyleSel = document.getElementById('texture-style');
  if (textureToggle) {
    textureToggle.checked = state.textureEnabled;
    textureToggle.addEventListener('change', () => {
      state.textureEnabled = textureToggle.checked;
      triggerRender();
    });
  }
  if (textureSwimSelect) {
    textureSwimSelect.value = state.textureSwim;
    textureSwimSelect.addEventListener('change', () => {
      state.textureSwim = textureSwimSelect.value;
      triggerRender();
    });
  }
  if (textureStyleSel) {
    textureStyleSel.value = state.textureStyle;
    textureStyleSel.addEventListener('change', () => {
      state.textureStyle = Number(textureStyleSel.value);
      triggerRender();
    });
  }

  rebuildLayerUI();
  rebuildShapeGrid();

  return {
    rebuildLayerUI,
    syncAutoplayUI: () => {
      if (autoplayToggle) autoplayToggle.checked = state.autoPlayEnabled;
    }
  };
}
