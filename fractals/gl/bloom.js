// HDR bloom post-processor.
// Pipeline: scene (RGBA16F FBO) → bright-pass → Kawase blur (3 mips) → composite + ACES tonemap → canvas.

import * as twgl from '../../twgl.module.js';

// ── Shader sources ────────────────────────────────────────────────────────

const FULLSCREEN_VERT = /* glsl */`#version 300 es
precision highp float;
const vec2 QUAD[4] = vec2[4](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(1,1));
out vec2 v_uv;
void main() {
  vec2 p = QUAD[gl_VertexID];
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

// Bright-pass: extract pixels above threshold
const BRIGHT_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColour;
uniform sampler2D u_scene;
uniform float u_threshold;
void main() {
  vec3 c = texture(u_scene, v_uv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float knee = 0.2;
  float w = smoothstep(u_threshold - knee, u_threshold + knee, lum);
  fragColour = vec4(c * w, 1.0);
}
`;

// Kawase single-pass blur (one offset per call)
const BLUR_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColour;
uniform sampler2D u_tex;
uniform vec2  u_texel;
uniform float u_offset;
void main() {
  vec2 h = (u_offset + 0.5) * u_texel;
  vec4 c  = texture(u_tex, v_uv + vec2( h.x,  h.y));
       c += texture(u_tex, v_uv + vec2(-h.x,  h.y));
       c += texture(u_tex, v_uv + vec2( h.x, -h.y));
       c += texture(u_tex, v_uv + vec2(-h.x, -h.y));
  fragColour = c * 0.25;
}
`;

// Composite: scene + bloom, ACES tonemap, gamma
const COMPOSITE_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColour;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_bloomIntensity;
uniform float u_exposure;

vec3 aces(vec3 x) {
  float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

void main() {
  vec3 scene = texture(u_scene, v_uv).rgb;
  vec3 bloom = texture(u_bloom, v_uv).rgb;
  vec3 hdr   = scene + bloom * u_bloomIntensity;
  vec3 tonemapped = aces(hdr * u_exposure);
  vec3 gamma = pow(tonemapped, vec3(1.0 / 2.2));
  fragColour = vec4(gamma, 1.0);
}
`;

// ── BloomRenderer ─────────────────────────────────────────────────────────

export class BloomRenderer {
  constructor(gl) {
    this._gl = gl;
    this._w = 0;
    this._h = 0;
    this._sceneFbo  = null;
    this._pingFbo   = null;
    this._pongFbo   = null;
    this._brightProg    = null;
    this._blurProg      = null;
    this._compositeProg = null;
    this._enabled = false;

    // Check float texture support
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (ext) {
      this._floatSupported = true;
    } else {
      console.warn('[NFF] EXT_color_buffer_float not supported — bloom disabled');
      this._floatSupported = false;
      return;
    }

    this._brightProg    = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, BRIGHT_FRAG]);
    this._blurProg      = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, BLUR_FRAG]);
    this._compositeProg = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, COMPOSITE_FRAG]);
    this._enabled = true;

    // Create FBOs at 1×1 size; resize() will resize them in-place
    const fmt = { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, min: gl.LINEAR, mag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE };
    this._fmt = fmt;
    this._sceneFbo = twgl.createFramebufferInfo(gl, [fmt], 1, 1);
    this._pingFbo  = twgl.createFramebufferInfo(gl, [fmt], 1, 1);
    this._pongFbo  = twgl.createFramebufferInfo(gl, [fmt], 1, 1);
  }

  get enabled() { return this._enabled; }

  /** Reinitialise GPU resources after a WebGL context restore. */
  reinit() {
    const gl = this._gl;
    this._enabled = false;

    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      console.warn('[NFF] EXT_color_buffer_float not supported after restore — bloom disabled');
      return;
    }
    this._floatSupported = true;

    this._brightProg    = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, BRIGHT_FRAG]);
    this._blurProg      = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, BLUR_FRAG]);
    this._compositeProg = twgl.createProgramInfo(gl, [FULLSCREEN_VERT, COMPOSITE_FRAG]);

    const fmt = { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT, min: gl.LINEAR, mag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE };
    this._fmt = fmt;
    this._sceneFbo = twgl.createFramebufferInfo(gl, [fmt], 1, 1);
    this._pingFbo  = twgl.createFramebufferInfo(gl, [fmt], 1, 1);
    this._pongFbo  = twgl.createFramebufferInfo(gl, [fmt], 1, 1);
    this._w = 0; this._h = 0; // force resize() to re-run after reinit
    this._enabled = true;
  }

  /** Call when canvas size changes. Resizes FBOs in-place without leaking. */
  resize(w, h) {
    if (!this._enabled) return;
    if (this._w === w && this._h === h) return;
    this._w = w; this._h = h;
    const gl = this._gl;
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    twgl.resizeFramebufferInfo(gl, this._sceneFbo, [this._fmt], w,  h);
    twgl.resizeFramebufferInfo(gl, this._pingFbo,  [this._fmt], hw, hh);
    twgl.resizeFramebufferInfo(gl, this._pongFbo,  [this._fmt], hw, hh);
  }

  /** Bind the scene FBO. Draw background + shapes into it. */
  bindSceneFbo() {
    if (!this._enabled) return;
    const gl = this._gl;
    twgl.bindFramebufferInfo(gl, this._sceneFbo);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Run bloom passes and composite to canvas.
   * @param {object} params  { threshold, intensity, radius, exposure }
   */
  composite(params) {
    if (!this._enabled) return;
    const gl = this._gl;
    const { threshold = 0.7, intensity = 1.0, radius = 1.0, exposure = 1.0 } = params;

    const sceneTexture = this._sceneFbo.attachments[0];
    const w = this._w, h = this._h;
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);

    gl.disable(gl.BLEND);

    // 1. Bright-pass → ping (half-res)
    twgl.bindFramebufferInfo(gl, this._pingFbo);
    gl.viewport(0, 0, hw, hh);
    gl.useProgram(this._brightProg.program);
    twgl.setUniforms(this._brightProg, { u_scene: sceneTexture, u_threshold: threshold });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2. Kawase blur passes: ping→pong, pong→ping, ping→pong (3 passes)
    const offsets = [0, 1, 2].map(i => i * radius);
    let src = this._pingFbo, dst = this._pongFbo;
    for (const off of offsets) {
      twgl.bindFramebufferInfo(gl, dst);
      gl.viewport(0, 0, hw, hh);
      gl.useProgram(this._blurProg.program);
      twgl.setUniforms(this._blurProg, {
        u_tex:    src.attachments[0],
        u_texel:  [1 / hw, 1 / hh],
        u_offset: off,
      });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      [src, dst] = [dst, src];
    }
    // src now holds final blur result

    // 3. Composite to canvas
    twgl.bindFramebufferInfo(gl, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this._compositeProg.program);
    twgl.setUniforms(this._compositeProg, {
      u_scene:          sceneTexture,
      u_bloom:          src.attachments[0],
      u_bloomIntensity: intensity,
      u_exposure:       exposure,
    });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Re-enable blend for next frame's scene render
    gl.enable(gl.BLEND);
  }
}
