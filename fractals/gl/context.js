import * as twgl from '../../twgl.module.js';
import { VERT_SRC, FRAG_SRC, BG_VERT_SRC, BG_FRAG_SRC } from './shaders.js';

// Max DPR to avoid thrashing on 4K displays
const MAX_DPR = 2;

/**
 * Initialise a WebGL2 context on the given canvas element.
 * Returns { gl, programs, resize, setBlendMode }.
 */
export function createGLContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,   // we do our own AA via SDF
    premultipliedAlpha: false,
    alpha: false,
  });
  if (!gl) throw new Error('WebGL2 not supported in this browser.');

  // Compile shape program
  const shapeProgram = twgl.createProgramInfo(gl, [VERT_SRC, FRAG_SRC]);
  const bgProgram    = twgl.createProgramInfo(gl, [BG_VERT_SRC, BG_FRAG_SRC]);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w   = canvas.clientWidth;
    const h   = canvas.clientHeight;
    const pw  = Math.round(w * dpr);
    const ph  = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width  = pw;
      canvas.height = ph;
    }
    gl.viewport(0, 0, pw, ph);
    return { w, h, pw, ph, dpr };
  }

  function setBlendMode(mode) {
    gl.enable(gl.BLEND);
    switch (mode) {
      case 'additive':
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);
        break;
      case 'multiply':
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case 'screen':
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
        break;
      case 'normal':
      default:
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        break;
    }
  }

  return { gl, shapeProgram, bgProgram, resize, setBlendMode };
}
