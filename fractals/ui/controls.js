// Bottom bar: number input + log-scale scrub slider + +/- buttons.
import { markRebuild, markUniforms } from '../state/appState.js';

const MIN_N = 1;
const MAX_N = 100_000_000;
const SLIDER_STEPS = 1000;

// Map slider position (0–1000) to number (1–100M) logarithmically
function sliderToNumber(pos) {
  const t = pos / SLIDER_STEPS;
  return Math.round(Math.pow(MAX_N, t));
}

// Map number to slider position
function numberToSlider(n) {
  if (n <= 1) return 0;
  return Math.round(Math.log(n) / Math.log(MAX_N) * SLIDER_STEPS);
}

export function attachControls(state, onRebuild, triggerRender) {
  const numberInput  = document.getElementById('number-input');
  const numberSlider = document.getElementById('number-slider');
  const numberDec    = document.getElementById('number-dec');
  const numberInc    = document.getElementById('number-inc');

  if (!numberInput) return { applyNumber: () => {} };

  function applyNumber(n, isManual = true) {
    n = Math.max(MIN_N, Math.min(MAX_N, Math.floor(n)));
    if (n === state.number) return;
    state.number = n;
    numberInput.value  = n;
    numberSlider.value = numberToSlider(n);
    if (isManual) {
      state.autoPlayEnabled = false;
    }
    markRebuild(state);
    onRebuild();
    if (triggerRender) triggerRender();
  }

  function resetCamera() {
    state.pan = [0, 0];
    state.zoom = 1.0;
    markUniforms(state);
  }

  numberInput.addEventListener('change', () => {
    resetCamera();
    applyNumber(Number(numberInput.value), true);
  });
  numberInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      resetCamera();
      applyNumber(Number(numberInput.value), true);
    }
  });

  // Throttle slider input events via requestAnimationFrame to avoid VBO allocation and GPU upload churn.
  // This makes scrubbing the log-scale slider silk-smooth and prevents thread blocking.
  let slideThrottle = null;
  numberSlider.addEventListener('input', () => {
    if (slideThrottle) cancelAnimationFrame(slideThrottle);
    slideThrottle = requestAnimationFrame(() => {
      applyNumber(sliderToNumber(Number(numberSlider.value)), true);
      slideThrottle = null;
    });
  });

  numberDec.addEventListener('click', () => applyNumber(state.number - 1, true));
  numberInc.addEventListener('click', () => applyNumber(state.number + 1, true));

  // Hold to repeat on +/-
  let holdTimer = null;
  let holdInterval = null;
  function startHold(delta) {
    applyNumber(state.number + delta, true);
    holdTimer = setTimeout(() => {
      holdInterval = setInterval(() => applyNumber(state.number + delta, true), 80);
    }, 400);
  }
  function stopHold() {
    clearTimeout(holdTimer);
    clearInterval(holdInterval);
  }
  numberDec.addEventListener('mousedown', () => startHold(-1));
  numberInc.addEventListener('mousedown', () => startHold(1));
  numberDec.addEventListener('mouseup', stopHold);
  numberInc.addEventListener('mouseup', stopHold);
  numberDec.addEventListener('mouseleave', stopHold);
  numberInc.addEventListener('mouseleave', stopHold);

  // Sync initial values
  numberInput.value  = state.number;
  numberSlider.value = numberToSlider(state.number);

  return {
    applyNumber: (n, isManual = true) => applyNumber(n, isManual)
  };
}
