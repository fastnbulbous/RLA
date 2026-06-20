// composer.js — Procedural music composition generation engine

import { SCALE_FORMULAS, CHORD_FORMULAS, NOTE_VALUES, noteToMidi, midiToName, getCumulativeSteps } from './music-theory.js';

// Integer sequences that can drive the melody — each value maps onto a scale degree, so the
// tune literally "plays" the sequence (e.g. the digits of Pi). Short ones cycle.
export const SEQUENCES = {
  pi: [3,1,4,1,5,9,2,6,5,3,5,8,9,7,9,3,2,3,8,4,6,2,6,4,3,3,8,3,2,7,9,5,0,2,8,8,4,1,9,7,1,6,9,3,9,9,3,7,5,1,0,5,8,2,0,9,7,4,9,4,4,5,9,2,3,0,7,8,1,6,4,0,6,2,8,6,2,0,8,9,9,8,6,2,8,0,3,4,8,2,5,3,4,2,1,1,7,0,6,7],
  e:  [2,7,1,8,2,8,1,8,2,8,4,5,9,0,4,5,2,3,5,3,6,0,2,8,7,4,7,1,3,5,2,6,6,2,4,9,7,7,5,7,2,4,7,0,9,3,6,9,9,9,5,9,5,7,4,9,6,6,9,6,7,6,2,7,7,2,4,0,7,6,6,3,0,3,5,3,5,4,7,5,9,4,5,7,1,3,8,2,1,7,8,5,2,5,1,6,6,4,2,7],
  primes: [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113],
  fibonacci: [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987],
  triangular: [1,3,6,10,15,21,28,36,45,55,66,78,91,105,120,136]
};

// Seeded PRNG mulberry32 (matches fractal state randomizer)
export function getRNG(seedStr) {
  // Hash seed string to 32-bit integer (FNV-1a)
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  
  return function() {
    let t = state += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Word lists for auto-generating composition titles
const TITLE_ADJECTIVES_MAJOR = ['Happy', 'Cheerful', 'Sunny', 'Golden', 'Jolly', 'Bright', 'Dancing', 'Dreamy', 'Sparkling', 'Bouncing', 'Joyful', 'Playful'];
const TITLE_ADJECTIVES_MINOR = ['Pensive', 'Crimson', 'Misty', 'Shadow', 'Midnight', 'Whispering', 'Stormy', 'Wandering', 'Sleepy', 'Secret', 'Haunted', 'Melancholy'];
const TITLE_NOUNS = ['Meadow', 'Castle', 'River', 'Forest', 'Starlight', 'Garden', 'Breeze', 'Voyage', 'Fairground', 'Valley', 'Summit'];
const TITLE_STYLES_MAJOR = ['Waltz', 'Sonatina', 'Prelude', 'Scherzo', 'Gigue', 'Minuet', 'Serenade', 'March', 'Tune'];
const TITLE_STYLES_MINOR = ['Nocturne', 'Rhapsody', 'Lullaby', 'Elegy', 'Fantasy', 'Reverie', 'Chaconne', 'Lament'];

/**
 * Auto-generates a title based on the key, mode, and seed
 */
export function generateTitle(key, isMinor, rng) {
  const adjs = isMinor ? TITLE_ADJECTIVES_MINOR : TITLE_ADJECTIVES_MAJOR;
  const styles = isMinor ? TITLE_STYLES_MINOR : TITLE_STYLES_MAJOR;
  const adj = adjs[Math.floor(rng() * adjs.length)];
  const style = styles[Math.floor(rng() * styles.length)];
  const noun = TITLE_NOUNS[Math.floor(rng() * TITLE_NOUNS.length)];
  const modeStr = isMinor ? 'Minor' : 'Major';
  return `${adj} ${noun} ${style} in ${key} ${modeStr}`;
}

// Snap a MIDI pitch to the nearest pitch sharing a given pitch-class (0-11)
function nearestPitchWithPC(midi, pc) {
  for (let d = 0; d <= 11; d++) {
    if ((((midi + d) % 12) + 12) % 12 === pc) return midi + d;
    if ((((midi - d) % 12) + 12) % 12 === pc) return midi - d;
  }
  return midi;
}

// Snap a MIDI pitch to the nearest in-scale pitch for a key (root + scale-step semitones)
function snapToScalePitch(midi, rootMidi, steps) {
  const pcs = steps.map(s => ((((rootMidi + s) % 12) + 12) % 12));
  for (let d = 0; d <= 6; d++) {
    if (pcs.includes((((midi + d) % 12) + 12) % 12)) return midi + d;
    if (pcs.includes((((midi - d) % 12) + 12) % 12)) return midi - d;
  }
  return midi;
}

export function parseChord(chordName) {
  let root = chordName.match(/^[A-G][b#]?/)[0];
  let suffix = chordName.substring(root.length);
  
  let type = 'maj';
  if (suffix === 'm' || suffix === 'min' || suffix === 'm7' || suffix === 'min7') {
    type = 'min';
  } else if (suffix === '7' || suffix === 'dom7') {
    type = 'dom7';
  } else if (suffix === 'maj7') {
    type = 'maj7';
  } else if (suffix === 'dim') {
    type = 'dim';
  } else if (suffix === 'aug') {
    type = 'aug';
  }
  
  let fullType = type;
  if (suffix === 'm7' || suffix === 'min7') fullType = 'min7';
  
  return { root, type, fullType, isMinor: type === 'min' || fullType === 'min7' };
}

function applyVoiceLeading(newPitches, prevPitches) {
  if (!prevPitches || prevPitches.length !== newPitches.length) return newPitches;
  
  const sortedNew = [...newPitches].sort((a, b) => a - b);
  const sortedPrev = [...prevPitches].sort((a, b) => a - b);
  
  const voiced = sortedNew.map((pitch, idx) => {
    const target = sortedPrev[idx];
    let bestPitch = pitch;
    let minDiff = Infinity;
    for (let k = -2; k <= 2; k++) {
      const shifted = pitch + k * 12;
      const diff = Math.abs(shifted - target);
      if (diff < minDiff) {
        minDiff = diff;
        bestPitch = shifted;
      }
    }
    return bestPitch;
  });
  
  return voiced.map(p => {
    while (p < 40) p += 12;
    while (p > 72) p -= 12;
    return p;
  });
}

const MARKOV_TRANSITIONS = {
  folk: {
    0: [0.1, 0.3, 0.1, 0.4, 0.1],
    1: [0.2, 0.5, 0.1, 0.1, 0.1],
    2: [0.1, 0.4, 0.1, 0.3, 0.1],
    3: [0.1, 0.3, 0.1, 0.4, 0.1],
    4: [0.2, 0.4, 0.1, 0.2, 0.1],
    5: [0.1, 0.2, 0.1, 0.5, 0.1],
    6: [0.1, 0.1, 0.1, 0.6, 0.1]
  },
  jazz: {
    0: [0.2, 0.2, 0.1, 0.3, 0.2],
    1: [0.3, 0.2, 0.1, 0.2, 0.2],
    2: [0.2, 0.3, 0.1, 0.2, 0.2],
    3: [0.2, 0.2, 0.1, 0.3, 0.2],
    4: [0.3, 0.2, 0.1, 0.2, 0.2],
    5: [0.2, 0.2, 0.1, 0.3, 0.2],
    6: [0.4, 0.1, 0.1, 0.3, 0.1]
  }
};

function sampleMarkovStep(scaleDegree, style, temp, rng) {
  const degClass = ((scaleDegree % 7) + 7) % 7;
  const transitionStyle = (style === 'blues' || style === 'jazz') ? 'jazz' : 'folk';
  const table = MARKOV_TRANSITIONS[transitionStyle];
  const rawProbs = table[degClass] || [0.1, 0.3, 0.1, 0.4, 0.1];
  
  const tVal = temp !== undefined ? temp : 1.0;
  const scaled = rawProbs.map(p => Math.pow(p, 1 / tVal));
  const sum = scaled.reduce((a, b) => a + b, 0);
  const normalized = scaled.map(p => p / sum);
  
  const r = rng();
  let acc = 0;
  const steps = [-2, -1, 0, 1, 2];
  for (let i = 0; i < normalized.length; i++) {
    acc += normalized[i];
    if (r <= acc) return steps[i];
  }
  return 1;
}

export function getEuclideanPattern(pulses, steps) {
  if (pulses <= 0) return Array(steps).fill(0);
  if (pulses >= steps) return Array(steps).fill(1);

  const pattern = [];
  let bucket = 0;
  for (let i = 0; i < steps; i++) {
    bucket += pulses;
    if (bucket >= steps) {
      bucket -= steps;
      pattern.push(1);
    } else {
      pattern.push(0);
    }
  }

  const firstOne = pattern.indexOf(1);
  if (firstOne > 0) {
    const part1 = pattern.slice(firstOne);
    const part2 = pattern.slice(0, firstOne);
    return part1.concat(part2);
  }
  return pattern;
}

function midiToScaleDegree(midi, rootMidi, steps) {
  let diff = midi - rootMidi;
  let octave = Math.floor(diff / 12);
  let pitchClass = ((diff % 12) + 12) % 12;
  
  let stepIndex = 0;
  let minD = Infinity;
  for (let i = 0; i < steps.length; i++) {
    let d = Math.abs(steps[i] - pitchClass);
    if (d < minD) {
      minD = d;
      stepIndex = i;
    }
  }
  return octave * steps.length + stepIndex;
}

function scaleDegreeToMidi(degree, rootMidi, steps) {
  let stepIndex = ((degree % steps.length) + steps.length) % steps.length;
  let octave = Math.floor(degree / steps.length);
  return rootMidi + steps[stepIndex] + octave * 12;
}

function transformPhrase(notes, type, keyRootMidi, scaleSteps) {
  if (!notes.length) return notes;
  
  let transformed = notes.map(n => ({ ...n }));
  
  if (type === 'transpose') {
    transformed = transformed.map(n => {
      let degree = midiToScaleDegree(n.midi, keyRootMidi, scaleSteps);
      let newMidi = scaleDegreeToMidi(degree + 2, keyRootMidi, scaleSteps);
      return { ...n, midi: newMidi, name: midiToName(newMidi) };
    });
  } else if (type === 'invert') {
    const midis = notes.map(n => n.midi);
    const center = Math.round(midis.reduce((a, b) => a + b, 0) / midis.length);
    transformed = transformed.map(n => {
      let invertedMidi = center - (n.midi - center);
      invertedMidi = snapToScalePitch(invertedMidi, keyRootMidi, scaleSteps);
      return { ...n, midi: invertedMidi, name: midiToName(invertedMidi) };
    });
  } else if (type === 'retrograde') {
    const pitches = notes.map(n => n.midi).reverse();
    transformed = transformed.map((n, i) => {
      const newMidi = pitches[i];
      return { ...n, midi: newMidi, name: newMidi ? midiToName(newMidi) : n.name };
    });
  }
  
  return transformed;
}

/**
 * Generates a full composition object from a seed and configuration options
 */
export function generateComposition(seedInput, opts = {}) {
  const seed = seedInput || Math.random().toString(36).substring(2, 9);
  const rng = getRNG(seed);
  let prevLhVoicing = null;

  const diff = opts.difficulty !== undefined ? opts.difficulty : 0;
  const style = opts.style || 'default';
  
  let timeSig = opts.timeSignature || '4/4';
  let tempo = opts.tempo || 100;
  
  if (style === 'lullaby') {
    timeSig = '3/4';
    tempo = 80;
  } else if (style === 'march') {
    timeSig = '4/4';
    tempo = 120;
  } else if (style === 'waltz') {
    timeSig = '3/4';
    tempo = 110;
  } else if (style === 'blues') {
    timeSig = '4/4';
    tempo = 90;
  } else if (style === 'fibonacci') {
    timeSig = '5/4';   // odd, non-classical metre (5 is a Fibonacci number)
    tempo = 96;
  } else if (style === 'aleatoric') {
    timeSig = '7/4';   // experimental odd time
    tempo = 112;
  }

  const isMinor = opts.isMinor !== undefined ? opts.isMinor : (style === 'blues' ? false : rng() > 0.5);

  let key = opts.key;
  if (!key) {
    const keysPool = diff === 0 ? ['C', 'G', 'F'] : (diff === 1 ? ['C', 'G', 'D', 'F', 'Am', 'Em'] : ['C', 'G', 'D', 'A', 'F', 'Bb', 'Eb', 'Am', 'Em', 'Dm']);
    const chosen = keysPool[Math.floor(rng() * keysPool.length)];
    key = chosen.replace('m', '');
  }

  const keyRootMap = { 'C': 60, 'G': 67, 'F': 65, 'D': 62, 'A': 69, 'Bb': 58, 'Eb': 63 };
  const rootMidi = keyRootMap[key] || 60;

  const title = opts.title || generateTitle(key, isMinor, rng);
  let numBars = [4, 8, 12, 16][diff] || 4;
  if (style === 'blues') numBars = 12;       // authentic 12-bar blues length
  if (style === 'fibonacci') numBars = 8;    // a Fibonacci number of bars
  if (style === 'aleatoric') numBars = 7;    // odd, non-square phrase count

  // Per-bar beat counts. Fibonacci style shifts metre bar to bar (2→3→5→8…); others are uniform.
  const FIB_BARS = [2, 3, 5, 8];
  const barBeats = (style === 'fibonacci')
    ? Array.from({ length: numBars }, (_, i) => FIB_BARS[i % FIB_BARS.length])
    : Array.from({ length: numBars }, () => parseInt(timeSig.split('/')[0], 10));
  if (style === 'fibonacci') timeSig = barBeats[0] + '/4'; // header metre = first bar; rest change inline

  // Optional integer-sequence input (Pi, e, primes…) that the melody traces note by note
  const seqName = (opts.sequence && opts.sequence !== 'none') ? opts.sequence : null;
  const seqValues = seqName ? SEQUENCES[seqName] : null;
  let seqPtr = 0;

  const modeName = opts.mode || (isMinor ? 'natural_minor' : 'major');
  const scaleFormula = SCALE_FORMULAS[modeName] || SCALE_FORMULAS.major;
  const scaleSteps = getCumulativeSteps(scaleFormula);

  let chordProg = [];
  if (style === 'blues') {
    const I = key;
    const IV = key === 'C' ? 'F' : (key === 'G' ? 'C' : (key === 'F' ? 'Bb' : (key === 'D' ? 'G' : 'D')));
    const V = key === 'C' ? 'G' : (key === 'G' ? 'D' : (key === 'F' ? 'C' : (key === 'D' ? 'A' : 'E')));
    chordProg = [I, IV, I, I, IV, IV, I, I, V, IV, I, I];
  } else {
    const progressions = isMinor ? [
      ['Am', 'Dm', 'Em', 'Am'],
      ['Am', 'F', 'C', 'G'],
      ['Am', 'Dm', 'G', 'C']
    ] : [
      ['C', 'F', 'G', 'C'],
      ['C', 'Am', 'F', 'G'],
      ['C', 'G', 'Am', 'F']
    ];
    const baseProg = progressions[Math.floor(rng() * progressions.length)];
    const transposeProg = (prog) => {
      return prog.map(ch => {
        let root = ch.replace('m', '');
        let isChMinor = ch.endsWith('m');
        let interval = 0;
        if (isMinor) {
          const m = { 'Am': 0, 'Dm': 5, 'Em': 7, 'F': 8, 'C': 3, 'G': 10 };
          interval = m[ch] || 0;
        } else {
          const m = { 'C': 0, 'F': 5, 'G': 7, 'Am': 9, 'Em': 4, 'Dm': 2 };
          interval = m[ch] || 0;
        }
        const transposedRootMidi = rootMidi - (isMinor ? 3 : 0) + interval;
        const transposedName = midiToName(transposedRootMidi).replace(/\d+/, '');
        return transposedName + (isChMinor ? 'm' : '');
      });
    };
    const transposedProg = transposeProg(baseProg);
    chordProg = Array.from({ length: numBars }, (_, i) => transposedProg[i % transposedProg.length]);
  }

  const voices = [
    { name: 'Right Hand', clef: 'treble', instrument: opts.rhInstrument || 0, notes: [] },
    { name: 'Left Hand', clef: 'bass', instrument: opts.lhInstrument || 0, notes: [] }
  ];

  const enablePercussion = opts.enablePercussion || ['march', 'blues', 'jazz'].includes(style);
  if (enablePercussion) {
    voices.push({
      name: 'Percussion',
      clef: 'perc',
      percussion: true,
      channel: 9,
      instrument: 0,
      notes: []
    });
  }

  function generateMelodyBar(barIndex, chordName, startBeat, beatsPerBar, currentScaleDegree) {
    const notes = [];
    let barBeat = 0;
    const harmonyRoot = chordName.replace('m', '');
    const isChordMinor = chordName.endsWith('m');
    const chordMidis = [
      noteToMidi(harmonyRoot + '4'),
      noteToMidi(harmonyRoot + '4') + (isChordMinor ? 3 : 4),
      noteToMidi(harmonyRoot + '4') + 7
    ];

    let rhythmPool = [1, 2];
    if (style === 'lullaby') {
      rhythmPool = [1, 2, 3];
    } else if (style === 'march') {
      rhythmPool = [1, 0.5, 0.5];
    } else if (style === 'blues') {
      rhythmPool = [1, 0.5, 1.5];
    } else if (style === 'fibonacci') {
      rhythmPool = [1, 2, 3];           // Fibonacci durations (beats)
    } else if (style === 'aleatoric') {
      rhythmPool = [0.5, 1, 1.5, 2, 3]; // irregular, unpredictable
    } else if (diff === 1) {
      rhythmPool = [0.5, 1, 2];
    } else if (diff >= 2) {
      rhythmPool = [0.5, 1, 1.5, 0.5];
    }

    const shape = opts.shape || 'arch';
    let direction = 1;
    if (shape === 'ascending') direction = 1;
    else if (shape === 'descending') direction = -1;
    else if (shape === 'arch') {
      direction = barIndex < numBars / 2 ? 1 : -1;
    } else if (shape === 'wave') {
      direction = barIndex % 2 === 0 ? 1 : -1;
    }

    while (barBeat < beatsPerBar) {
      let duration = rhythmPool[Math.floor(rng() * rhythmPool.length)];
      if (barBeat + duration > beatsPerBar) {
        duration = beatsPerBar - barBeat;
      }

      if (seqValues) {
        // Map the next number of the chosen sequence onto a scale degree — the tune plays the sequence
        currentScaleDegree = seqValues[seqPtr++ % seqValues.length] % 11;
      } else if (opts.melodyEngine === 'markov') {
        const stepChange = sampleMarkovStep(currentScaleDegree, style, opts.temperature, rng);
        currentScaleDegree += stepChange;
      } else {
        let stepChange;
        if (style === 'fibonacci') {
          const fib = [1, 2, 3, 5];
          stepChange = fib[Math.floor(rng() * fib.length)];   // melodic leaps follow Fibonacci
        } else if (style === 'aleatoric') {
          stepChange = Math.floor(rng() * 5);                  // wider, less predictable motion
        } else {
          stepChange = Math.floor(rng() * 3);
        }
        currentScaleDegree += stepChange * direction;
      }
      
      if (currentScaleDegree < 0) currentScaleDegree = 2;
      if (currentScaleDegree > 11) currentScaleDegree = 9;

      const scaleStepsToUse = style === 'blues' ? [0, 3, 5, 6, 7, 10, 12, 15, 17, 18, 19, 22] : scaleSteps;
      const stepIndex = currentScaleDegree % scaleStepsToUse.length;
      const octaveOffset = Math.floor(currentScaleDegree / scaleStepsToUse.length) * 12;
      let noteMidi = rootMidi + scaleStepsToUse[stepIndex] + octaveOffset;

      if (barBeat === 0 && !seqValues) {
        const closestChordTone = chordMidis.map(m => m + Math.round((noteMidi - m) / 12) * 12)
                                           .sort((x, y) => Math.abs(x - noteMidi) - Math.abs(y - noteMidi))[0];
        noteMidi = closestChordTone;
      } else if (!seqValues && (barBeat === 2 || barBeat === 1.5) && rng() < 0.75) {
        const closestChordTone = chordMidis.map(m => m + Math.round((noteMidi - m) / 12) * 12)
                                           .sort((x, y) => Math.abs(x - noteMidi) - Math.abs(y - noteMidi))[0];
        noteMidi = closestChordTone;
      }

      const isLastBar = barIndex === numBars - 1;
      const isLastNote = barBeat + duration >= beatsPerBar;
      if (isLastBar && isLastNote) {
        noteMidi = rootMidi + (currentScaleDegree >= 7 ? 12 : 0);
      }

      // Keep every melody note within the key's scale (safety net for non-diatonic chord snaps)
      noteMidi = snapToScalePitch(noteMidi, rootMidi, scaleStepsToUse);

      // Seeded velocity dynamics (strong beats are louder, offbeats softer)
      let isDownbeat = (startBeat + barBeat) % beatsPerBar === 0;
      let isOffbeat = (startBeat + barBeat) % 1 !== 0;
      let baseVelocity = isDownbeat ? 0.95 : (isOffbeat ? 0.65 : 0.8);
      baseVelocity += (rng() - 0.5) * 0.08;
      baseVelocity = Math.max(0.4, Math.min(1.0, baseVelocity));

      notes.push({
        midi: noteMidi,
        name: midiToName(noteMidi),
        startBeat: startBeat + barBeat,
        durBeats: duration,
        velocity: baseVelocity,
        hand: 'RH'
      });

      barBeat += duration;
    }

    return { notes, endScaleDegree: currentScaleDegree };
  }

  function generateLHBar(chordName, startBeat, beatsPerBar) {
    const notes = [];
    const chordInfo = parseChord(chordName);
    const baseMidi = noteToMidi(chordInfo.root + '3');

    const defaultTriad = [
      baseMidi,
      baseMidi + (chordInfo.isMinor ? 3 : 4),
      baseMidi + 7
    ];

    const voicedTriad = applyVoiceLeading(defaultTriad, prevLhVoicing);
    prevLhVoicing = voicedTriad;

    const rootM = voicedTriad[0];
    const thirdM = voicedTriad[1];
    const fifthM = voicedTriad[2];

    const lhStyle = opts.lhStyle || (diff === 0 ? 'drone' : (diff === 1 ? 'block' : 'root-fifth'));

    if (style === 'fibonacci' || style === 'aleatoric') {
      // Full-bar block triad — clean in odd metres like 5/4 and 7/4
      notes.push(
        { midi: rootM, name: midiToName(rootM), startBeat: startBeat, durBeats: beatsPerBar, hand: 'LH' },
        { midi: thirdM, name: midiToName(thirdM), startBeat: startBeat, durBeats: beatsPerBar, hand: 'LH' },
        { midi: fifthM, name: midiToName(fifthM), startBeat: startBeat, durBeats: beatsPerBar, hand: 'LH' }
      );
      return notes;
    }

    if (style === 'lullaby') {
      notes.push(
        { midi: rootM, name: midiToName(rootM), startBeat: startBeat, durBeats: 1, hand: 'LH' },
        { midi: fifthM, name: midiToName(fifthM), startBeat: startBeat + 1, durBeats: 1, hand: 'LH' },
        { midi: thirdM, name: midiToName(thirdM), startBeat: startBeat + 2, durBeats: 1, hand: 'LH' }
      );
    } else if (style === 'waltz') {
      notes.push({ midi: rootM, name: midiToName(rootM), startBeat: startBeat, durBeats: 1, hand: 'LH' });
      notes.push(
        { midi: thirdM, name: midiToName(thirdM), startBeat: startBeat + 1, durBeats: 1, hand: 'LH' },
        { midi: fifthM, name: midiToName(fifthM), startBeat: startBeat + 1, durBeats: 1, hand: 'LH' },
        { midi: thirdM, name: midiToName(thirdM), startBeat: startBeat + 2, durBeats: 1, hand: 'LH' },
        { midi: fifthM, name: midiToName(fifthM), startBeat: startBeat + 2, durBeats: 1, hand: 'LH' }
      );
    } else if (lhStyle === 'drone') {
      notes.push({ midi: rootM, name: midiToName(rootM), startBeat: startBeat, durBeats: beatsPerBar, hand: 'LH' });
    } else if (lhStyle === 'block') {
      notes.push(
        { midi: rootM, name: midiToName(rootM), startBeat: startBeat, durBeats: beatsPerBar, hand: 'LH' },
        { midi: thirdM, name: midiToName(thirdM), startBeat: startBeat, durBeats: beatsPerBar, hand: 'LH' },
        { midi: fifthM, name: midiToName(fifthM), startBeat: startBeat, durBeats: beatsPerBar, hand: 'LH' }
      );
    } else {
      notes.push(
        { midi: rootM, name: midiToName(rootM), startBeat: startBeat, durBeats: 1, hand: 'LH' },
        { midi: thirdM, name: midiToName(thirdM), startBeat: startBeat + 1, durBeats: 1, hand: 'LH' },
        { midi: fifthM, name: midiToName(fifthM), startBeat: startBeat + 1, durBeats: 1, hand: 'LH' },
        { midi: rootM, name: midiToName(rootM), startBeat: startBeat + 2, durBeats: 1, hand: 'LH' },
        { midi: thirdM, name: midiToName(thirdM), startBeat: startBeat + 3, durBeats: 1, hand: 'LH' },
        { midi: fifthM, name: midiToName(fifthM), startBeat: startBeat + 3, durBeats: 1, hand: 'LH' }
      );
    }

    return notes;
  }

  function generatePercussionBar(barIndex, startBeat, beatsPerBar) {
    const notes = [];
    const steps = beatsPerBar * 2; // eighth note resolution
    
    // Choose Euclidean pulses based on style
    let kickPulses = 2;
    let snarePulses = 0;
    let hatPulses = 4;
    
    if (style === 'march') {
      kickPulses = 4;
      hatPulses = 4;
    } else if (style === 'blues' || style === 'jazz') {
      kickPulses = 2;
      hatPulses = 6; // Swing feel hi-hat
    } else if (style === 'fibonacci') {
      kickPulses = 3;
      hatPulses = 5;
    }
    
    const kickPattern = getEuclideanPattern(kickPulses, steps);
    const hatPattern = getEuclideanPattern(hatPulses, steps);
    const snarePattern = Array(steps).fill(0);
    
    // Classic snare backbeat on beats 2 and 4 (indices 2 and 6 in 4/4)
    if (beatsPerBar === 4) {
      snarePattern[2] = 1;
      snarePattern[6] = 1;
    } else if (beatsPerBar === 3) {
      snarePattern[2] = 1; // beat 2
    }
    
    for (let s = 0; s < steps; s++) {
      const stepBeat = startBeat + s * 0.5;
      const stepVel = 0.6 + (rng() - 0.5) * 0.1;
      
      if (kickPattern[s]) {
        notes.push({ midi: 36, name: 'Kick', startBeat: stepBeat, durBeats: 0.5, velocity: stepVel + 0.2, hand: 'Perc' });
      }
      if (snarePattern[s]) {
        notes.push({ midi: 38, name: 'Snare', startBeat: stepBeat, durBeats: 0.5, velocity: stepVel + 0.1, hand: 'Perc' });
      }
      if (hatPattern[s]) {
        notes.push({ midi: 42, name: 'Hi-Hat', startBeat: stepBeat, durBeats: 0.5, velocity: stepVel - 0.1, hand: 'Perc' });
      }
    }
    
    return notes;
  }

  // Freeform styles are through-composed (one phrase spanning the whole piece, no AABA tiling),
  // so blues follows a real 12-bar progression and the experimental styles never repeat.
  const phraseLengthBars = (style === 'blues' || style === 'fibonacci' || style === 'aleatoric' || style === 'polyrhythm' || seqValues) ? numBars : 2;
  const beatsPerBar = timeSig.endsWith('/8') ? parseInt(timeSig, 10) * 0.5 : parseInt(timeSig, 10);
  
  let scaleDegreeA = 4;
  let phraseAMelody = [];
  let phraseALH = [];
  let phraseAPerc = [];
  let sbA = 0;
  for (let b = 0; b < phraseLengthBars; b++) {
    const chord = chordProg[b % chordProg.length];
    const bp = barBeats[b] || beatsPerBar;
    const res = generateMelodyBar(b, chord, sbA, bp, scaleDegreeA);
    phraseAMelody.push(...res.notes);
    scaleDegreeA = res.endScaleDegree;
    phraseALH.push(...generateLHBar(chord, sbA, bp));
    if (enablePercussion) {
      phraseAPerc.push(...generatePercussionBar(b, sbA, bp));
    }
    sbA += bp;
  }

  let phraseBMelody = [];
  let phraseBLH = [];
  let phraseBPerc = [];
  let sbB = 0;
  if (phraseLengthBars === numBars) {
    // through-composed: no B phrase needed
  } else {
    // Derive Section B melody from Section A using motif transformation!
    const transTypes = ['transpose', 'invert', 'retrograde'];
    const transType = transTypes[Math.floor(rng() * transTypes.length)];
    phraseBMelody = transformPhrase(phraseAMelody, transType, rootMidi, scaleSteps);
    
    // Accompaniment & Percussion for Section B are generated normally matching the progression
    for (let b = 0; b < phraseLengthBars; b++) {
      const chord = chordProg[(b + phraseLengthBars) % chordProg.length];
      const bp = barBeats[b + phraseLengthBars] || beatsPerBar;
      phraseBLH.push(...generateLHBar(chord, sbB, bp));
      if (enablePercussion) {
        phraseBPerc.push(...generatePercussionBar(b + phraseLengthBars, sbB, bp));
      }
      sbB += bp;
    }
  }

  function shiftNotes(noteList, shiftBeats) {
    return noteList.map(n => ({
      ...n,
      startBeat: n.startBeat + shiftBeats
    }));
  }

  let currentBeat = 0;
  for (let bar = 0; bar < numBars; bar += phraseLengthBars) {
    let useB = false;
    if (numBars >= 8) {
      const phraseIndex = bar / phraseLengthBars;
      if (phraseIndex === 2) {
        useB = true;
      }
    }

    const melodyPhrase = useB ? phraseBMelody : phraseAMelody;
    const lhPhrase = useB ? phraseBLH : phraseALH;
    const percPhrase = useB ? phraseBPerc : phraseAPerc;

    voices[0].notes.push(...shiftNotes(melodyPhrase, currentBeat));
    voices[1].notes.push(...shiftNotes(lhPhrase, currentBeat));
    if (enablePercussion && voices[2]) {
      voices[2].notes.push(...shiftNotes(percPhrase, currentBeat));
    }

    // Determine duration of this phrase in beats
    let phraseBeats = 0;
    for (let b = 0; b < phraseLengthBars; b++) {
      phraseBeats += barBeats[bar + b] || beatsPerBar;
    }
    currentBeat += phraseBeats;
  }

  // Final cadence: ensure the melody ends on the tonic for a satisfying resolution
  const rhNotes = voices[0].notes;
  if (rhNotes.length) {
    const lastN = rhNotes[rhNotes.length - 1];
    lastN.midi = nearestPitchWithPC(lastN.midi, ((rootMidi % 12) + 12) % 12);
    lastN.name = midiToName(lastN.midi);
  }

  return {
    meta: {
      seed,
      title,
      key,
      isMinor,
      timeSig,
      tempo,
      numBars,
      barBeats,
      sequence: seqName,
      difficulty: diff,
      style,
      shape: opts.shape || 'arch',
      lhStyle: opts.lhStyle || (diff === 0 ? 'drone' : (diff === 1 ? 'block' : 'root-fifth')),
      instrument: opts.rhInstrument || 0,
      swing: opts.swing !== undefined ? opts.swing : 0,
      humanize: opts.humanize !== undefined ? opts.humanize : true,
      melodyEngine: opts.melodyEngine || 'random',
      temperature: opts.temperature !== undefined ? opts.temperature : 1.0,
      enablePercussion: !!enablePercussion,
      mode: opts.mode || (isMinor ? 'natural_minor' : 'major')
    },
    voices
  };
}

/**
 * Compiles our neutral composition object into standard ABC text notation
 */
export function toABC(comp) {
  const meta = comp.meta;
  const isMinor = meta.isMinor;
  const keyMode = meta.key + (isMinor ? 'm' : '');
  
  let abc = `X:1\nT:${meta.title}\nM:${meta.timeSig}\nL:1/4\nQ:${meta.tempo}\nK:${keyMode}\n`;

  // Draw voices
  comp.voices.forEach((voice, vIndex) => {
    if (voice.percussion) return;
    abc += `V:${vIndex + 1} clef=${voice.clef}\n%%MIDI program ${voice.instrument}\n`;
    
    // Group notes into measures
    const barBeats = meta.barBeats || Array.from({ length: meta.numBars }, () => parseInt(meta.timeSig.split('/')[0], 10));
    const totalBars = barBeats.length;
    const barStart = [];
    { let acc = 0; for (const bb of barBeats) { barStart.push(acc); acc += bb; } }
    
    let barNotes = Array.from({ length: totalBars }, () => []);
    
    // Allocate notes to their respective bars
    voice.notes.forEach(note => {
      let bi = 0;
      for (let i = 0; i < totalBars; i++) { if (note.startBeat >= barStart[i] - 1e-6) bi = i; else break; }
      barNotes[bi].push(note);
    });

    // Write notes for each bar, emitting an inline metre change when the bar length changes
    let prevMeter = barBeats[0];
    for (let b = 0; b < totalBars; b++) {
      if (barBeats[b] !== prevMeter) { abc += `[M:${barBeats[b]}/4]`; prevMeter = barBeats[b]; }
      const notesInBar = barNotes[b].sort((x, y) => x.startBeat - y.startBeat);
      
      if (notesInBar.length === 0) {
        abc += `z${barBeats[b]}`; // rest bar
      } else {
        // Group notes that play simultaneously (chords)
        let timeGroups = new Map();
        notesInBar.forEach(n => {
          const t = n.startBeat;
          if (!timeGroups.has(t)) timeGroups.set(t, []);
          timeGroups.get(t).push(n);
        });

        const sortedTimes = Array.from(timeGroups.keys()).sort((x, y) => x - y);
        
        sortedTimes.forEach(t => {
          const notesAtTime = timeGroups.get(t);
          const dur = notesAtTime[0].durBeats;
          
          // ABC length modifier (L:1/4 → length measured in quarter-note units = beats).
          // Handles dotted/compound durations too (e.g. 1.5 → 3/2, 3 → 3, 0.75 → 3/4).
          const lenStr = durToAbcLen(dur);

          if (notesAtTime.length > 1) {
            // Chord [CEG]
            abc += '[';
            notesAtTime.forEach(n => {
              abc += getAbcNoteChar(n.midi, voice.clef === 'treble');
            });
            abc += ']' + lenStr;
          } else {
            // Single note
            abc += getAbcNoteChar(notesAtTime[0].midi, voice.clef === 'treble') + lenStr;
          }
        });
      }
      abc += ' | ';
    }
    abc += '\n';
  });

  return abc;
}

// Greatest common divisor (for ABC note-length fractions)
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

// Convert a duration in beats (quarter-note units at L:1/4) to an ABC length suffix
function durToAbcLen(durBeats) {
  let s = Math.round(durBeats * 4); // express in sixteenth-note units
  if (s <= 0) s = 1;
  const g = gcd(s, 4);
  const num = s / g, den = 4 / g;
  if (den === 1) return num === 1 ? '' : String(num);
  if (num === 1) return '/' + den;
  return num + '/' + den;
}

// Convert MIDI number to ABC note pitch format
function getAbcNoteChar(midi, isTreble) {
  const b4Midi = 71;
  const remainder = ((midi - b4Midi) % 12 + 12) % 12;
  const diffOctave = Math.floor((midi - b4Midi) / 12);
  
  // Note pitch representation starting at B4
  // B4=B, C5=c, D5=d...
  const keys = ['B', 'c', 'c', 'd', 'd', 'e', 'f', 'f', 'g', 'g', 'a', 'a'];
  let char = keys[remainder];
  
  // Sharps/Flats (accidental notation in ABC is preceding: ^ for sharp, _ for flat)
  let prefix = '';
  if ([1, 3, 6, 8, 10].includes(midi % 12)) {
    prefix = '^'; // simplify to all sharps
  }

  // Adjust octave marks
  let suffix = '';
  if (isTreble) {
    if (diffOctave > 0) {
      // Octave above C5 gets apostrophes
      for (let i = 1; i < diffOctave; i++) suffix += "'";
    } else if (diffOctave < 0) {
      // Octave below B4 gets commas
      char = char.toUpperCase();
      for (let i = 0; i > diffOctave; i--) suffix += ",";
    } else {
      // Middle register
      if (char === 'B') char = 'B';
    }
  } else {
    // Bass clef shifts down two octaves (C3 instead of C5)
    char = char.toUpperCase();
    if (diffOctave >= 0) {
      for (let i = 0; i < diffOctave + 2; i++) suffix += "'";
    } else {
      for (let i = 0; i > diffOctave + 2; i--) suffix += ",";
    }
  }

  return prefix + char + suffix;
}
