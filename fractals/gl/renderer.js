import * as twgl from '../../twgl.module.js';

/**
 * Manages the instanced shape program + persistent VBOs.
 * Reuses WebGLBuffers to eliminate memory churn and garbage collection pauses.
 */
export class ShapeRenderer {
  constructor(gl, shapeProgram) {
    this._gl = gl;
    this._prog = shapeProgram;
    this._instanceCount = 0;

    // DESIGN DECISION (WHY):
    // - Persistent Buffer & VAO Reuse:
    //   Instead of creating new WebGLBuffers and VAOs every frame (which generates high CPU overhead
    //   and Garbage Collection pauses), we allocate persistent WebGLBuffer objects exactly ONCE
    //   in the constructor and bind them to the Vertex Array Object (VAO) permanently.
    //   Subsequent uploads only copy data to these existing buffers, yielding 0% CPU allocation overhead.
    const arrays = {
      a_centre:        { numComponents: 2, divisor: 1, buffer: gl.createBuffer() },
      a_radius:        { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_rotation:      { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_colour:        { numComponents: 3, divisor: 1, buffer: gl.createBuffer() },
      a_alpha:         { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_strokePx:      { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_fillMix:       { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_sides:         { numComponents: 1, divisor: 1, buffer: gl.createBuffer(), type: gl.UNSIGNED_INT },
      a_dotRadius:     { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_outlineColour: { numComponents: 3, divisor: 1, buffer: gl.createBuffer() },
      a_depth:         { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_emboss:        { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_pattern:       { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_seed:          { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
    };

    this._glBuffers = {};
    for (const [name, info] of Object.entries(arrays)) {
      this._glBuffers[name] = info.buffer;
    }

    this._bufferInfo = {
      numElements: 4,
      attribs: arrays
    };
    this._vao = twgl.createVertexArrayInfo(gl, this._prog, this._bufferInfo);
  }

  /**
   * Reinitialise GPU resources after a WebGL context restore.
   * Recreates all WebGLBuffers, the VAO, and swaps in a freshly compiled program.
   */
  reinit(shapeProgram) {
    const gl = this._gl;
    this._prog = shapeProgram;

    // Recreate persistent buffers (old ones are invalidated by context loss)
    const arrays = {
      a_centre:        { numComponents: 2, divisor: 1, buffer: gl.createBuffer() },
      a_radius:        { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_rotation:      { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_colour:        { numComponents: 3, divisor: 1, buffer: gl.createBuffer() },
      a_alpha:         { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_strokePx:      { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_fillMix:       { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_sides:         { numComponents: 1, divisor: 1, buffer: gl.createBuffer(), type: gl.UNSIGNED_INT },
      a_dotRadius:     { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_outlineColour: { numComponents: 3, divisor: 1, buffer: gl.createBuffer() },
      a_depth:         { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_emboss:        { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_pattern:       { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
      a_seed:          { numComponents: 1, divisor: 1, buffer: gl.createBuffer() },
    };

    this._glBuffers = {};
    for (const [name, info] of Object.entries(arrays)) {
      this._glBuffers[name] = info.buffer;
    }

    this._bufferInfo = { numElements: 4, attribs: arrays };
    this._vao = twgl.createVertexArrayInfo(gl, this._prog, this._bufferInfo);
  }

  uploadInstances(buffers, instanceCount) {
    const gl = this._gl;
    this._instanceCount = instanceCount;
    if (instanceCount === 0) return;

    const bufferKeys = {
      a_centre:        buffers.centre,
      a_radius:        buffers.radius,
      a_rotation:      buffers.rotation,
      a_colour:        buffers.colour,
      a_alpha:         buffers.alpha,
      a_strokePx:      buffers.strokePx,
      a_fillMix:       buffers.fillMix,
      a_sides:         buffers.sides,
      a_dotRadius:     buffers.dotRadius,
      a_outlineColour: buffers.outlineColour,
      a_depth:         buffers.depth,
      a_emboss:        buffers.emboss,
      a_pattern:       buffers.pattern,
      a_seed:          buffers.seed,
    };

    // Upload data to existing GPU-allocated buffers
    for (const [name, buf] of Object.entries(this._glBuffers)) {
      const data = bufferKeys[name];
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }
  }

  draw(uniforms) {
    if (this._instanceCount === 0 || !this._vao) return;
    const gl = this._gl;

    gl.useProgram(this._prog.program);
    twgl.setBuffersAndAttributes(gl, this._prog, this._vao);
    twgl.setUniforms(this._prog, uniforms);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this._instanceCount);
  }
}
