// sf2.js — Local SoundFont (.sf2) playback via the dependency-free 'sf2-player' (pure Web Audio).
//
// Purely ADDITIVE with a hard fallback: if the engine fails to load or the soundfont is missing,
// isReady() stays false and every caller transparently falls back to the built-in oscillator synth
// in notation.js. Nothing breaks.
//
// sf2-player is a full 16-channel General MIDI synth, so every instrument is pulled straight from
// the loaded .sf2 (GeneralUser-GS) via program changes — no per-instrument code needed.
//
// Audio needs a user gesture (the AudioContext is created on init). Works on http/localhost/https.

import SoundFont from './sf2/sf2-player.js';

const DEFAULT_SF2 = 'GeneralUser-GS.sf2';

let player = null;
let ready = false, loading = false, failed = false;
let sf2Buf = null;                 // prefetched SoundFont bytes (so playback can start instantly)
const active = new Set();          // "channel*128+midi" currently sounding (for allNotesOff)

export function isReady() { return ready; }
export function isLoading() { return loading; }

// Warm the browser cache + hold the SoundFont bytes ahead of first use. Safe on page load.
export async function prefetchSf2(sf2Url = DEFAULT_SF2) {
  if (sf2Buf) return true;
  try {
    const resp = await fetch(sf2Url);
    if (!resp.ok) return false;
    sf2Buf = await resp.arrayBuffer();
    console.log('🎵 SoundFont prefetched & cached (' + Math.round(sf2Buf.byteLength / 1048576) + ' MB)');
    return true;
  } catch (e) { return false; }
}

// Initialize the engine and load the soundfont. Must be triggered from a user gesture.
export async function initSf2(sf2Url = DEFAULT_SF2) {
  if (ready || loading || failed) return ready;
  if (typeof window === 'undefined') return false;
  loading = true;
  try {
    player = new SoundFont();
    if (sf2Buf) await player.bootSynth(sf2Buf);          // reuse prefetched bytes (instant)
    else await player.loadSoundFontFromURL(sf2Url);       // otherwise fetch now
    // Resume the internally-created AudioContext (we're inside a user gesture here)
    try {
      const c = player.synth && player.synth.ctx;
      if (c && c.state === 'suspended') await c.resume();
    } catch (e) {}
    ready = true;
    console.log('🎹 SF2 engine ready — playing through ' + sf2Url + ' (sf2-player)');
  } catch (e) {
    console.warn('SF2 engine unavailable; using built-in synth instead:', e);
    failed = true;
    ready = false;
  } finally {
    loading = false;
  }
  return ready;
}

export function resume() {
  try {
    const c = player && player.synth && player.synth.ctx;
    if (c && c.state === 'suspended') c.resume();
  } catch (e) {}
}

// Sustained note on/off. velocity 0-127. channel lets the two hands use different instruments.
export function noteOn(midi, velocity = 100, channel = 0) {
  if (!ready) return;
  try {
    player.noteOn(midi, Math.max(1, Math.min(127, velocity | 0)), channel);
    active.add(channel * 128 + midi);
  } catch (e) {}
}
export function noteOff(midi, channel = 0) {
  if (!ready) return;
  try {
    player.noteOff(midi, 0, channel);
    active.delete(channel * 128 + midi);
  } catch (e) {}
}

// Select a General MIDI instrument program on a channel (pulled from the .sf2).
export function programChange(program, channel = 0) {
  if (!ready) return;
  try { player.channel = channel; player.program = program | 0; } catch (e) {}
}

// Panic: release every note we started.
export function allNotesOff() {
  if (!ready) return;
  for (const k of active) {
    try { player.noteOff(k % 128, 0, Math.floor(k / 128)); } catch (e) {}
  }
  active.clear();
}
