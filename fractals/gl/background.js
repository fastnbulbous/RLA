import * as twgl from '../../twgl.module.js';
import { BG_VERT_SRC, BG_FRAG_SRC } from './shaders.js';

/**
 * Procedural background renderer.
 * Draws a full-screen gradient + subtle animated noise quad.
 * Theme colours are driven by the palette's THEME_BACKGROUNDS.
 */
export class BackgroundRenderer {
  constructor(gl) {
    this._gl = gl;
    this._prog = twgl.createProgramInfo(gl, [BG_VERT_SRC, BG_FRAG_SRC]);
    // Empty VAO — vertex shader uses gl_VertexID to index into a hardcoded QUAD array
    this._vao = gl.createVertexArray();
    this._startTime = performance.now();
  }

  /** Reinitialise GPU resources after a WebGL context restore. */
  reinit() {
    const gl = this._gl;
    this._prog = twgl.createProgramInfo(gl, [BG_VERT_SRC, BG_FRAG_SRC]);
    this._vao  = gl.createVertexArray();
  }

  draw(topColour, bottomColour, noiseAmt = 0.015) {
    const gl = this._gl;
    const t = (performance.now() - this._startTime) / 1000;

    gl.disable(gl.BLEND);
    gl.useProgram(this._prog.program);
    gl.bindVertexArray(this._vao);
    twgl.setUniforms(this._prog, {
      u_colourTop: topColour,
      u_colourBot: bottomColour,
      u_time:      t,
      u_noiseAmt:  noiseAmt,
    });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
  }
}
