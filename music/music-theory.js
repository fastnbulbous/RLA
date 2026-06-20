// music-theory.js — Shared ES module for music theory data and calculations

// ── CONSTANTS ────────────────────────────────────────────────────────────────
export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

export const RELATIVE_MINORS = {
  'C': 'A', 'G': 'E', 'D': 'B', 'A': 'F#', 'E': 'C#', 'B': 'G#',
  'F#': 'D#', 'C#': 'A#', 'F': 'D', 'Bb': 'G', 'Eb': 'C', 'Ab': 'F', 'Db': 'Bb', 'Gb': 'Eb'
};

// Map keys to their sharp/flat signatures
// positive numbers = sharps, negative = flats
export const KEY_SIGNATURE_ACCIDENTALS = {
  // Majors
  'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
  'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7,
  // Minors
  'Am': 0, 'Em': 1, 'Bm': 2, 'F#m': 3, 'C#m': 4, 'G#m': 5, 'D#m': 6, 'A#m': 7,
  'Dm': -1, 'Gm': -2, 'Cm': -3, 'Fm': -4, 'Bbm': -5, 'Ebm': -6, 'Abm': -7
};

export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
export const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export const INTERVAL_NAMES = {
  0: 'Unison',
  1: 'Minor 2nd',
  2: 'Major 2nd',
  3: 'Minor 3rd',
  4: 'Major 3rd',
  5: 'Perfect 4th',
  6: 'Tritone',
  7: 'Perfect 5th',
  8: 'Minor 6th',
  9: 'Major 6th',
  10: 'Minor 7th',
  11: 'Major 7th',
  12: 'Octave'
};

// Interval semitones lists
export const SCALE_FORMULAS = {
  major:            [2, 2, 1, 2, 2, 2, 1],
  natural_minor:    [2, 1, 2, 2, 1, 2, 2],
  minor:            [2, 1, 2, 2, 1, 2, 2],
  harmonic_minor:   [2, 1, 2, 2, 1, 3, 1],
  pentatonic_major: [2, 2, 3, 2, 3],
  pentatonic_minor: [3, 2, 2, 3, 2],
  chromatic:        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  dorian:           [2, 1, 2, 2, 2, 1, 2],
  mixolydian:       [2, 2, 1, 2, 2, 1, 2],
  lydian:           [2, 2, 2, 1, 2, 2, 1],
  whole_tone:       [2, 2, 2, 2, 2, 2]
};

export function getCumulativeSteps(intervals) {
  const steps = [0];
  let acc = 0;
  for (let i = 0; i < intervals.length - 1; i++) {
    acc += intervals[i];
    steps.push(acc);
  }
  return steps;
}

export const CHORD_FORMULAS = {
  'maj':  { name: 'Major Triad', intervals: [0, 4, 7] },
  'min':  { name: 'Minor Triad', intervals: [0, 3, 7] },
  'dim':  { name: 'Diminished Triad', intervals: [0, 3, 6] },
  'aug':  { name: 'Augmented Triad', intervals: [0, 4, 8] },
  'dom7': { name: 'Dominant 7th', intervals: [0, 4, 7, 10] },
  'maj7': { name: 'Major 7th', intervals: [0, 4, 7, 11] },
  'min7': { name: 'Minor 7th', intervals: [0, 3, 7, 10] }
};

// Note duration names mapped to beat lengths
export const NOTE_VALUES = {
  'w':  4,   // whole note (semibreve)
  'h':  2,   // half note (minim)
  'q':  1,   // quarter note (crotchet)
  'e':  0.5, // eighth note (quaver)
  's':  0.25,// sixteenth note (semiquaver)
};

// General MIDI 128 Instruments groups
export const GM_INSTRUMENTS = [
  { id: 0,   name: 'Acoustic Grand Piano' },
  { id: 4,   name: 'Electric Piano 1' },
  { id: 11,  name: 'Music Box' },
  { id: 13,  name: 'Xylophone' },
  { id: 19,  name: 'Church Organ' },
  { id: 21,  name: 'Accordion' },
  { id: 24,  name: 'Nylon Acoustic Guitar' },
  { id: 25,  name: 'Steel Acoustic Guitar' },
  { id: 32,  name: 'Acoustic Bass' },
  { id: 40,  name: 'Violin' },
  { id: 42,  name: 'Cello' },
  { id: 46,  name: 'Orchestral Harp' },
  { id: 56,  name: 'Trumpet' },
  { id: 60,  name: 'French Horn' },
  { id: 65,  name: 'Alto Sax' },
  { id: 68,  name: 'Oboe' },
  { id: 71,  name: 'Clarinet' },
  { id: 73,  name: 'Flute' },
  { id: 80,  name: 'Lead 1 (square)' },
  { id: 81,  name: 'Lead 2 (sawtooth)' },
  { id: 89,  name: 'Pad 2 (warm)' },
  { id: 114, name: 'Steel Drums' }
];

// Generate the full list of 128 GM instruments dynamically if needed
export const FULL_GM_LIST = Array.from({ length: 128 }, (_, i) => {
  const custom = GM_INSTRUMENTS.find(x => x.id === i);
  if (custom) return custom;
  return { id: i, name: `Instrument ${i + 1}` };
});

// Standard General MIDI program names (program 0-127) — every instrument a GM SoundFont provides
export const GM_PROGRAM_NAMES = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
  'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavi',
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
  'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
  'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
  'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
  'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
  'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
  'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
];

// ── CONVERSION HELPERS ───────────────────────────────────────────────────────

/**
 * Converts a MIDI number to frequency (Hz)
 */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Converts a frequency (Hz) to a MIDI number
 */
export function freqToMidi(freq) {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

/**
 * Converts a MIDI number to a note name (e.g. 60 -> "C4")
 */
export function midiToName(midi, useFlat = false) {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const name = useFlat ? NOTE_NAMES_FLAT[noteIndex] : NOTE_NAMES_SHARP[noteIndex];
  return name + octave;
}

/**
 * Converts a note name with octave (e.g. "C#4", "Db5", "C4") to MIDI number
 */
export function noteToMidi(noteStr) {
  const match = noteStr.match(/^([A-G])(bb|b|##|#|)?(-?\d+)$/);
  if (!match) return 60; // fallback to Middle C

  const letter = match[1];
  const accidental = match[2] || '';
  const octave = parseInt(match[3], 10);

  // Base values for C-B in octave 0
  const baseMap = { 'C': 12, 'D': 14, 'E': 16, 'F': 17, 'G': 19, 'A': 21, 'B': 23 };
  let midi = baseMap[letter] + (octave * 12);

  if (accidental === '#') midi += 1;
  else if (accidental === '##') midi += 2;
  else if (accidental === 'b') midi -= 1;
  else if (accidental === 'bb') midi -= 2;

  return midi;
}

/**
 * Gets the MIDI numbers for a scale
 */
export function getScaleMidis(rootMidi, type) {
  const formula = SCALE_FORMULAS[type] || SCALE_FORMULAS.major;
  const midis = [rootMidi];
  let current = rootMidi;
  for (let i = 0; i < formula.length - 1; i++) {
    current += formula[i];
    midis.push(current);
  }
  return midis;
}

/**
 * Gets the MIDI numbers for a chord
 */
export function getChordMidis(rootMidi, type) {
  const formula = CHORD_FORMULAS[type] || CHORD_FORMULAS.maj;
  return formula.intervals.map(semitones => rootMidi + semitones);
}

/**
 * Returns helper info for drawing notes on a staff
 * Calculates staff steps relative to Treble Clef Middle Line (B4 = 0)
 * E.g., C4 is -6 steps down, G4 is -2 steps down.
 */
export function getStaffStep(midi) {
  const b4Midi = 71;
  const diffOctave = Math.floor((midi - b4Midi) / 12);
  const remainder = ((midi - b4Midi) % 12 + 12) % 12;
  const diatonicStepsFromB = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
  return diatonicStepsFromB[remainder] + (diffOctave * 7);
}
