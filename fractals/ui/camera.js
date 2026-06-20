// Pan / zoom / global-rotate via pointer events + wheel + pinch.
// Updates state.pan, state.zoom, state.globalRotation and marks uniforms dirty.

import { markUniforms } from '../state/appState.js';

// attachCamera: Accepts a callback `onChange` to trigger demand-driven rendering
// when mouse/pointer drag, wheel scroll, or touch pinch events modify uniforms.
export function attachCamera(canvas, state, onChange) {
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let lastPinchDist = null;

  function clampZoom(z) {
    return Math.max(0.001, Math.min(z, 100));
  }

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.909;
    state.zoom = clampZoom(state.zoom * factor);
    markUniforms(state);
    if (onChange) onChange();
  }, { passive: false });

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return; // handled by touch events
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    state.pan[0] += dx * state.zoom;
    state.pan[1] -= dy * state.zoom; // canvas Y-down, world Y-up
    markUniforms(state);
    if (onChange) onChange();
  });

  canvas.addEventListener('pointerup', () => { isDragging = false; });
  canvas.addEventListener('pointercancel', () => { isDragging = false; });

  // Pinch-to-zoom via touch
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      lastPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && lastPinchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = lastPinchDist / dist;
      state.zoom = clampZoom(state.zoom * factor);
      lastPinchDist = dist;
      markUniforms(state);
      if (onChange) onChange();
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => { lastPinchDist = null; });

  // Reset zoom and pan on double click
  canvas.addEventListener('dblclick', () => {
    state.pan = [0, 0];
    state.zoom = 1.0;
    markUniforms(state);
    if (onChange) onChange();
  });
}
