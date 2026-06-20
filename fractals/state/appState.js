// Single source of truth for all app state + dirty flags.

export function createAppState() {
  return {
    // Number
    number: 210,

    // Geometry
    gap: 0.15,
    firstRadiusFraction: 0.38, // fraction of min(viewW, viewH)

    // Palette / theme
    paletteName: 'neon',
    theme: 'dark',
    randomPaletteSeed: 0,

    // Blend
    blendMode: 'additive',

    // Fill / outline
    fillMode: 'gradient',   // 'fill' | 'outline' | 'both' | 'neon' | 'gradient' | 'outline-fill' | 'depth-fade'
    strokePx: 2.0,

    // Rotation
    globalRotation: 0,
    autoRotate: false,
    autoRotateSpeed: 15.0, // degrees per second
    layerRotations: [],   // per-layer static offset (radians)
    layerSpinEnabled: true,
    layerSpinSpeed: 3.0,
    layerSpinMode: 'alternating', // 'uniform' | 'alternating' | 'per-layer' | 'seeded' | 'chaos'
    layerSpinAngles: [],
    layerPulseEnabled: true,
    layerPulseSpeed: 0.3,

    // Layer order / randomisation
    layerOrder: null,     // null = natural, or array of indices
    randomSeed: 1,

    // Colour mode
    colourByLayer: true,
    layerColourScheme: 'neon', // 'neon' | 'accessible' (Okabe-Ito)

    // Factorisation mode
    compositeGrouping: true,  // group repeated primes into composites ≤ 11
    allowedComposites: { 4:true, 8:true, 9:true }, // prime-power composites only

    // Shape mapping overrides
    shapeMappingOverrides: {},

    // Auto-layout
    autoLayout:          true,
    autoLayoutStrength:  1.0,

    // Bloom
    bloomEnabled:    false,
    bloomThreshold:  1.0,
    bloomIntensity:  1.2,
    bloomRadius:     1.0,
    bloomExposure:   1.0,
    emissiveStrength: 1.0,

    embossEnabled:   false,
    embossStrength:  0.6,
    spotlightEnabled: false,
    spotlightSpeed:   0.4,
    spotlightFalloff: 0.3,
    textureEnabled:  true,
    textureStyle:    1,
    textureSwim:     'static', // 'static' | 'uniform-static' | 'uniform' | 'seeded'
    debug:           false,
    layerEmboss:       [],
    layerTexture:      [],
    layerTextureStyle: [],

    // Autoplay ping-pong
    autoPlayEnabled:   false,
    autoPlaySpeed:     500,  // interval in ms
    autoPlayMin:       2,
    autoPlayMax:       500,
    autoPlayDirection: 1,    // 1 = up, -1 = down

    // Camera
    pan: [0, 0],
    zoom: 1.0, // world units per pixel

    // Dirty flags
    dirty: {
      rebuild: true,    // need to rerun instanceBuilder
      recolour: false,  // only colours changed (subset of rebuild)
      blendState: false, // only blend mode changed
      uniforms: false,  // only uniforms (pan/zoom/rotation)
    },
  };
}

export function markRebuild(state) {
  state.dirty.rebuild = true;
}

export function markRecolour(state) {
  state.dirty.recolour = true;
}

export function markBlend(state) {
  state.dirty.blendState = true;
}

export function markUniforms(state) {
  state.dirty.uniforms = true;
}

export function clearDirty(state) {
  state.dirty.rebuild = false;
  state.dirty.recolour = false;
  state.dirty.blendState = false;
  state.dirty.uniforms = false;
}
