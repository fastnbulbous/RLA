// notation.js — Sheet music rendering, audio engine, and synthesis module

import { midiToFreq, NOTE_NAMES_SHARP } from './music-theory.js';

// Polyphonic Web Audio Synthesizer for instant, lag-free interactive note trigger
class PolyphonicSynth {
  constructor() {
    this.ctx = null;
    this.activeNodes = new Map(); // midi -> { oscillators, gainNode }
    this.instrument = 0; // 0 = Piano, 24 = Guitar, 40 = Violin, 73 = Flute, 114 = Steel Drums
  }

  initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setInstrument(programId) {
    if (programId === 'sine') {
      this.instrument = -1;
    } else {
      this.instrument = parseInt(programId, 10) || 0;
    }
  }

  // Trigger a note immediately (runs forever until releaseNote is called)
  triggerNote(midi, velocity = 0.8) {
    this.initContext();
    if (this.activeNodes.has(midi)) {
      this.releaseNote(midi);
    }

    const freq = midiToFreq(midi);
    const dest = this.ctx.destination;

    // Gain node for ADSR envelope
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    
    const oscs = [];

    if (this.instrument === 24) {
      // 🎸 Guitar: Plucked string sound (rapid attack, fast decay to a low sustain level)
      gainNode.gain.linearRampToValueAtTime(velocity * 0.4, this.ctx.currentTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(velocity * 0.08, this.ctx.currentTime + 0.15);
      
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc1.connect(gainNode);
      oscs.push(osc1);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq * 2, this.ctx.currentTime);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.04, this.ctx.currentTime);
      osc2.connect(g2);
      g2.connect(gainNode);
      oscs.push(osc2);
    } else if (this.instrument === 40) {
      // 🎻 Violin: Bowed string (slow attack, rich sawtooth harmonic content with vibrato)
      gainNode.gain.linearRampToValueAtTime(velocity * 0.22, this.ctx.currentTime + 0.18);
      
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 6; // 6Hz
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      oscs.push(lfo); // started once below (don't start here, or start() throws on the 2nd call)

      osc1.connect(gainNode);
      oscs.push(osc1);
    } else if (this.instrument === 73) {
      // 🌬️ Flute: Wind sound (pure sine wave + breathy vibrato + high 3rd harmonic)
      gainNode.gain.linearRampToValueAtTime(velocity * 0.3, this.ctx.currentTime + 0.08);
      
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 1.8;
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      oscs.push(lfo); // started once below (don't start here, or start() throws on the 2nd call)

      osc1.connect(gainNode);
      oscs.push(osc1);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 3, this.ctx.currentTime);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.015, this.ctx.currentTime);
      osc2.connect(g2);
      g2.connect(gainNode);
      oscs.push(osc2);
    } else if (this.instrument === 114) {
      // 🥁 Steel Drums: Pingy, metallic (sharp attack, fast exponential decay, detuned overtone)
      gainNode.gain.linearRampToValueAtTime(velocity * 0.35, this.ctx.currentTime + 0.003);
      gainNode.gain.exponentialRampToValueAtTime(velocity * 0.005, this.ctx.currentTime + 0.4);

      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc1.connect(gainNode);
      oscs.push(osc1);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 1.503, this.ctx.currentTime);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.08, this.ctx.currentTime);
      osc2.connect(g2);
      g2.connect(gainNode);
      oscs.push(osc2);
    } else if (this.instrument === 0) {
      // 🎹 Grand Piano: Percussive attack, rapid decay, soft sustain
      gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(velocity * 0.35, this.ctx.currentTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(velocity * 0.05, this.ctx.currentTime + 0.5);

      const osc1 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc1.connect(gainNode);
      oscs.push(osc1);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, this.ctx.currentTime);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.08, this.ctx.currentTime);
      osc2.connect(g2);
      g2.connect(gainNode);
      oscs.push(osc2);
    } else {
      // 🔮 Digital Chime (sine) / Default
      gainNode.gain.linearRampToValueAtTime(velocity * 0.25, this.ctx.currentTime + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(velocity * 0.15, this.ctx.currentTime + 1.2);

      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc1.connect(gainNode);
      oscs.push(osc1);
    }
    
    gainNode.connect(dest);
    oscs.forEach(osc => {
      if (osc.type) {
        osc.start();
      }
    });

    this.activeNodes.set(midi, {
      oscillators: oscs,
      gainNode,
      startTime: this.ctx.currentTime
    });
  }

  // Release a currently playing note with a smooth decay
  releaseNote(midi) {
    if (!this.activeNodes.has(midi)) return;
    const nodeObj = this.activeNodes.get(midi);
    this.activeNodes.delete(midi);

    const { oscillators, gainNode } = nodeObj;
    this.initContext();
    
    // Smooth release to prevent hard clicks
    const releaseTime = 0.35;
    try {
      gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + releaseTime);
      
      setTimeout(() => {
        oscillators.forEach(osc => {
          try { osc.stop(); } catch(e) {}
          try { osc.disconnect(); } catch(e) {}
        });
        gainNode.disconnect();
      }, releaseTime * 1000 + 50);
    } catch(e) {
      oscillators.forEach(osc => {
        try { osc.stop(); } catch(err) {}
      });
    }
  }

  // Play a single note for a fixed duration (useful for quizzes)
  playNote(midi, durationSeconds = 0.5) {
    this.triggerNote(midi, 0.7);
    setTimeout(() => {
      this.releaseNote(midi);
    }, durationSeconds * 1000);
  }
}

// Global instances
export const polySynth = new PolyphonicSynth();

// Optional local SoundFont (.sf2) engine — when loaded & ready it is the preferred sound
// source; otherwise everything below transparently falls back to the oscillator polySynth.
function _sf2() {
  return (typeof window !== 'undefined' && window.SF2 && window.SF2.isReady && window.SF2.isReady()) ? window.SF2 : null;
}

// Sustained interactive note on/off (used by the piano keyboards)
export function noteOn(midi, velocity = 0.8) {
  const s = _sf2();
  if (s) s.noteOn(midi, Math.round(velocity * 110) + 10);
  else polySynth.triggerNote(midi, velocity);
}
export function noteOff(midi) {
  const s = _sf2();
  if (s) s.noteOff(midi);
  else polySynth.releaseNote(midi);
}

// Wrapper for global play utilities used by quizzes (fixed-duration one-shots)
export function playNote(midi, duration = 0.5) {
  const s = _sf2();
  if (s) { s.noteOn(midi, 96); setTimeout(() => s.noteOff(midi), duration * 1000); }
  else polySynth.playNote(midi, duration);
}

export function playNotes(midiArray, duration = 0.6) {
  midiArray.forEach(midi => playNote(midi, duration));
}

export function playSequence(midiArray, duration = 0.4, interval = 0.5) {
  midiArray.forEach((midi, index) => {
    setTimeout(() => playNote(midi, duration), index * interval * 1000);
  });
}

// Mount play helpers onto window so quizzes can trigger audio easily
window.playNote = playNote;
window.playNotes = playNotes;
window.playSequence = playSequence;
window.musicNoteOn = noteOn;
window.musicNoteOff = noteOff;

// ── SoundFont full-composition playback (scheduled note events) ──
let _sf2Timers = [];

function getJitterRng(seed) {
  let hash = 5381;
  const sStr = String(seed || 'seed');
  for (let i = 0; i < sStr.length; i++) {
    hash = (hash * 33) ^ sStr.charCodeAt(i);
  }
  let state = hash >>> 0;
  return function() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function buildSchedule(comp) {
  const tempo = (comp.meta && comp.meta.tempo) || 100;
  const swing = (comp.meta && comp.meta.swing) || 0; // 0 = straight, 0.4 = light, 1.0 = heavy/triplet
  const humanize = comp.meta.humanize !== false;
  const beatSec = 60 / tempo;
  
  const jitterRng = getJitterRng(comp.meta.seed || "seed");
  const events = [];
  
  function swingBeat(beat, swingVal) {
    if (!swingVal) return beat;
    let beatInt = Math.floor(beat);
    let beatFrac = beat - beatInt;
    let swungFrac = beatFrac;
    if (beatFrac > 0 && beatFrac < 1) {
      if (beatFrac <= 0.5) {
        let targetHalf = 0.5 + swingVal / 6;
        swungFrac = (beatFrac / 0.5) * targetHalf;
      } else {
        let targetHalf = 0.5 + swingVal / 6;
        swungFrac = targetHalf + ((beatFrac - 0.5) / 0.5) * (1 - targetHalf);
      }
    }
    return beatInt + swungFrac;
  }

  comp.voices.forEach((voice, channel) => {
    const voiceHand = (voice.name === 'Left Hand') ? 'LH' : 'RH';
    let voiceChannel = voice.channel !== undefined ? voice.channel : channel;
    
    voice.notes.forEach(n => {
      if (n.rest) return;
      
      let startBeatSwung = swingBeat(n.startBeat, swing);
      let endBeatSwung = swingBeat(n.startBeat + n.durBeats, swing);
      
      let timeSec = startBeatSwung * beatSec;
      let durationSec = (endBeatSwung - startBeatSwung) * beatSec;
      
      if (humanize) {
        let jitterMs = (jitterRng() - 0.5) * 30; // ±15ms
        timeSec += jitterMs / 1000;
        if (timeSec < 0) timeSec = 0;
      }
      
      let finalVel = n.velocity !== undefined ? n.velocity : 0.8;
      if (humanize) {
        let velJitter = (jitterRng() - 0.5) * 0.1;
        finalVel += velJitter;
      }
      finalVel = Math.max(0.1, Math.min(1.0, finalVel));
      
      events.push({
        type: 'noteOn',
        timeMs: timeSec * 1000,
        midi: n.midi,
        velocity: finalVel,
        channel: voiceChannel,
        hand: n.hand || voiceHand,
        instrument: voice.instrument || 0
      });
      
      events.push({
        type: 'noteOff',
        timeMs: (timeSec + durationSec) * 1000,
        midi: n.midi,
        channel: voiceChannel,
        hand: n.hand || voiceHand
      });
    });
  });
  
  // Sort events by timeMs ascending
  events.sort((a, b) => a.timeMs - b.timeMs);
  return events;
}

// Play a whole composition object through the SF2 engine. onNote([midi,...]) fires per
// note-on (for the key-light animation); onEnd() fires when finished. Returns true if it
// started on the SF2 engine, false if SF2 isn't ready (caller should fall back to abcjs).
export function playCompositionSf2(comp, onActive = null, onEnd = null) {
  stopCompositionSf2();
  const s = _sf2();
  if (!s || !comp || !comp.voices) return false;

  // Set programs for each channel first
  comp.voices.forEach((voice, channel) => {
    let voiceChannel = voice.channel !== undefined ? voice.channel : channel;
    s.programChange(voice.instrument || 0, voiceChannel);
  });

  const active = new Map();           // key -> { midi, hand }  (all currently-sounding notes)
  let maxEndMs = 0;
  const fire = () => { if (onActive) onActive([...active.values()]); };

  const schedule = buildSchedule(comp);
  
  schedule.forEach(ev => {
    const key = ev.channel * 128 + ev.midi;
    maxEndMs = Math.max(maxEndMs, ev.timeMs);
    
    if (ev.type === 'noteOn') {
      _sf2Timers.push(setTimeout(() => {
        s.noteOn(ev.midi, Math.round(ev.velocity * 110) + 10, ev.channel);
        active.set(key, { midi: ev.midi, hand: ev.hand });
        fire();
      }, ev.timeMs));
    } else if (ev.type === 'noteOff') {
      _sf2Timers.push(setTimeout(() => {
        s.noteOff(ev.midi, ev.channel);
        active.delete(key);
        fire();
      }, ev.timeMs));
    }
  });

  _sf2Timers.push(setTimeout(() => { active.clear(); fire(); if (onEnd) onEnd(); }, maxEndMs + 250));
  return true;
}

export function stopCompositionSf2() {
  _sf2Timers.forEach(t => clearTimeout(t));
  _sf2Timers = [];
  const s = _sf2();
  if (s) s.allNotesOff();
}


// ── abcjs SCORE SYNTH PLAYER ──

let activeSynth = null;
let activeSynthControl = null;
let activeAnimation = null;
let localSoundfontsAvailable = false;
// Note: the local SoundFont (.sf2) engine in sf2.js is the primary playback path now.
// abcjs's own synth is only a fallback (used if the SF2 engine isn't ready) and streams
// its soundfont from the CDN, so we don't probe for midi-js soundfonts locally anymore.

/**
 * Renders an ABC string to a container as beautiful SVG sheet music
 */
export function renderScore(abcString, targetElement) {
  if (typeof ABCJS === 'undefined') {
    console.error("abcjs library not loaded yet!");
    return null;
  }
  
  // Render parameters
  const renderParams = {
    responsive: 'resize',
    scale: 0.9,
    paddingtop: 10,
    paddingbottom: 10,
    paddingleft: 10,
    paddingright: 10
  };

  const visualObj = ABCJS.renderAbc(targetElement, abcString, renderParams);
  return visualObj;
}

/**
 * Initializes and starts playback of an ABC composition using General MIDI Soundfonts.
 * Plays the score and triggers a custom cursor callback on each event.
 */
export function playScore(visualObj, onEventCallback = null, soundFontUrl = null) {
  if (typeof ABCJS === 'undefined' || !visualObj || visualObj.length === 0) return;

  // Stop previous synthesizers
  stopScorePlayback();

  // Determine soundfont path
  let sfUrl = soundFontUrl;
  if (!sfUrl) {
    if (localSoundfontsAvailable) {
      // Resolve absolute local directory path
      const baseLoc = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
      sfUrl = baseLoc + '/music/soundfonts/FluidR3_GM/';
    } else {
      sfUrl = "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/";
    }
  }

  // Create Synth Instance
  activeSynth = new ABCJS.synth.CreateSynth();
  
  // Create Timing Callback receiver (abcjs-compliant replacement for AnimationConfig)
  if (onEventCallback) {
    activeAnimation = new ABCJS.TimingCallbacks(visualObj[0], {
      eventCallback(event) {
        if (event) {
          // Normalize event structure: map midiPitches to event.notes for client compatibility
          if (event.midiPitches && !event.notes) {
            event.notes = event.midiPitches.map(p => ({
              pitch: typeof p === 'number' ? p : p.pitch,
              volume: p.volume || 127
            }));
          }
          onEventCallback(event);
        } else {
          onEventCallback(null); // Finished
        }
      }
    });
  }

  // Prime and trigger synthesizer
  activeSynth.init({
    visualObj: visualObj[0],
    options: {
      soundFontUrl: sfUrl
    }
  }).then(() => {
    activeSynth.prime().then(() => {
      activeSynth.start();
      
      // Start animation callbacks in sync
      if (activeAnimation) {
        activeAnimation.start();
      }
    });
  }).catch(err => {
    console.error("Error starting abcjs synth playback:", err);
  });
}

export function stopScorePlayback() {
  if (activeSynth) {
    try {
      activeSynth.stop();
    } catch(e) {}
    activeSynth = null;
  }
  if (activeAnimation) {
    try {
      activeAnimation.stop();
    } catch(e) {}
    activeAnimation = null;
  }
}
