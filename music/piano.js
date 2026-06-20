// piano.js — On-screen piano keyboard rendering and interaction module

import { NOTE_NAMES_SHARP, midiToName, noteToMidi } from './music-theory.js';

export class PianoKeyboard {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = Object.assign({
      startMidi: 60, // Default C4 (Middle C)
      endMidi: 72,   // Default C5 (1 octave + 1 note)
      keyWidth: 32,
      keyHeight: 120,
      interactive: true,
      onKeyPress: null, // callback(midi)
      onKeyRelease: null // callback(midi)
    }, options);

    this.activeMidis = new Set();
    this.lhMidis = new Set(); // Left-hand notes (colored blue)
    this.rhMidis = new Set(); // Right-hand notes (colored pink)
    
    this.render();
    if (this.options.interactive) {
      this.setupMouseEvents();
      this.setupKeyboardMapping();
    }
  }

  // Get list of MIDI numbers representing white and black keys in our range
  getKeysList() {
    const list = [];
    for (let m = this.options.startMidi; m <= this.options.endMidi; m++) {
      const isBlack = [1, 3, 6, 8, 10].includes(m % 12);
      list.push({ midi: m, isBlack });
    }
    return list;
  }

  render() {
    if (!this.container) return;

    const keys = this.getKeysList();
    const whites = keys.filter(k => !k.isBlack);
    const blacks = keys.filter(k => k.isBlack);

    const totalWhites = whites.length;
    const wWidth = this.options.keyWidth;
    const wHeight = this.options.keyHeight;
    const bWidth = Math.round(wWidth * 0.65);
    const bHeight = Math.round(wHeight * 0.6);

    const svgWidth = totalWhites * wWidth;
    const svgHeight = wHeight;

    let html = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="piano-keyboard-svg" style="width:100%; height:auto; overflow:visible;" xmlns="http://www.w3.org/2000/svg">`;
    
    // Draw white keys first
    let whiteIndex = 0;
    const whitePositions = {}; // midi -> x coordinate
    
    whites.forEach(k => {
      const x = whiteIndex * wWidth;
      whitePositions[k.midi] = x;
      const noteName = midiToName(k.midi);
      
      html += `<rect class="piano-key white-key" 
                     data-midi="${k.midi}" 
                     x="${x + 0.5}" y="0.5" 
                     width="${wWidth - 1}" height="${wHeight - 1}" 
                     rx="3" ry="3"
                     fill="var(--card, #ffffff)" 
                     stroke="var(--border, #ccc)" 
                     stroke-width="1"
                     style="cursor:pointer; transition: fill 0.1s; fill-rule:evenodd;">
                 <title>${noteName}</title>
               </rect>`;
      whiteIndex++;
    });

    // Draw black keys on top
    blacks.forEach(k => {
      // Find white key immediately below this black key
      const lowerWhiteMidi = k.midi - 1;
      const xWhite = whitePositions[lowerWhiteMidi];
      if (xWhite === undefined) return;

      // Position black key centering over the gap
      const x = xWhite + wWidth - (bWidth / 2);
      const noteName = midiToName(k.midi);

      html += `<rect class="piano-key black-key" 
                     data-midi="${k.midi}" 
                     x="${x}" y="0" 
                     width="${bWidth}" height="${bHeight}" 
                     rx="2" ry="2"
                     fill="#1e1e24" 
                     stroke="#0f0f12" 
                     stroke-width="1"
                     style="cursor:pointer; transition: fill 0.1s; overflow:visible; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45));">
                 <title>${noteName}</title>
               </rect>`;
    });

    html += '</svg>';
    this.container.innerHTML = html;
  }

  setupMouseEvents() {
    const handlePress = (e) => {
      const rect = e.target.closest('rect.piano-key');
      if (!rect) return;
      const midi = parseInt(rect.getAttribute('data-midi'), 10);
      this.pressKey(midi, 'mouse');
    };

    const handleRelease = (e) => {
      const rect = e.target.closest('rect.piano-key');
      if (!rect) return;
      const midi = parseInt(rect.getAttribute('data-midi'), 10);
      this.releaseKey(midi);
    };

    this.container.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.isPointerDown = true;
      handlePress(e);
    });

    this.container.addEventListener('pointerover', (e) => {
      if (this.isPointerDown) {
        handlePress(e);
      }
    });

    this.container.addEventListener('pointerout', (e) => {
      if (this.isPointerDown) {
        handleRelease(e);
      }
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
      this.activeMidis.forEach(midi => this.releaseKey(midi));
    });
  }

  // Setup QWERTY key mapping to allow playing with computer keyboard
  setupKeyboardMapping() {
    // White keys: A S D F G H J K L ; '
    // Black keys: W E T Y U O P
    const keyMap = {
      'a': 60, // C4
      'w': 61, // C#4
      's': 62, // D4
      'e': 63, // D#4
      'd': 64, // E4
      'f': 65, // F4
      't': 66, // F#4
      'g': 67, // G4
      'y': 68, // G#4
      'h': 69, // A4
      'u': 70, // A#4
      'j': 71, // B4
      'k': 72, // C5
      'o': 73, // C#5
      'l': 74, // D5
      'p': 75, // D#5
      ';': 76, // E5
      "'": 77  // F5
    };

    // Store handlers so they can be removed; guard against stale keyboards whose DOM was
    // replaced (otherwise every keyboard ever created keeps firing on each keypress).
    this._onKeyDown = (e) => {
      if (!this.container || !this.container.isConnected) { this._teardownKeyMap(); return; }
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      const midi = keyMap[e.key.toLowerCase()];
      if (midi !== undefined && !this.activeMidis.has(midi)) {
        this.pressKey(midi, 'keyboard');
      }
    };
    this._onKeyUp = (e) => {
      if (!this.container || !this.container.isConnected) { this._teardownKeyMap(); return; }
      const midi = keyMap[e.key.toLowerCase()];
      if (midi !== undefined) {
        this.releaseKey(midi);
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  // Detach the global keyboard listeners (called automatically once the keyboard's
  // container leaves the DOM, and available for manual cleanup).
  _teardownKeyMap() {
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
    this._onKeyDown = this._onKeyUp = null;
  }

  pressKey(midi, source = 'api') {
    if (midi < this.options.startMidi || midi > this.options.endMidi) return;
    this.activeMidis.add(midi);
    
    // Update SVG key class / fill
    const rect = this.container.querySelector(`rect[data-midi="${midi}"]`);
    if (rect) {
      if (this.lhMidis.has(midi)) {
        rect.style.fill = 'rgba(56,189,248,0.85)'; // LH color (blue)
      } else if (this.rhMidis.has(midi)) {
        rect.style.fill = 'rgba(251,113,133,0.85)'; // RH color (pink)
      } else {
        rect.style.fill = 'var(--accent, #9333ea)'; // default active color
      }
      if (rect.classList.contains('black-key')) {
        rect.style.transform = 'translateY(1px)';
      } else {
        rect.style.transform = 'translateY(2px)';
      }
    }

    if (this.options.onKeyPress) {
      this.options.onKeyPress(midi, source);
    }
  }

  releaseKey(midi) {
    if (!this.activeMidis.has(midi)) return;
    this.activeMidis.delete(midi);

    const rect = this.container.querySelector(`rect[data-midi="${midi}"]`);
    if (rect) {
      rect.style.transform = '';
      if (rect.classList.contains('black-key')) {
        rect.style.fill = '#1e1e24';
      } else {
        // Restore default white key fill
        rect.style.fill = '';
      }
    }

    if (this.options.onKeyRelease) {
      this.options.onKeyRelease(midi);
    }
  }

  // Highlight specific keys without triggering synth (useful for questions)
  highlightKeys(midiArray, styleClass = 'question-highlight', color = 'var(--accent)') {
    // Clear previous highlights
    this.clearHighlights();
    
    midiArray.forEach(midi => {
      const rect = this.container.querySelector(`rect[data-midi="${midi}"]`);
      if (rect) {
        rect.setAttribute('data-original-fill', rect.style.fill || (rect.classList.contains('black-key') ? '#1e1e24' : '#ffffff'));
        rect.style.fill = color;
        rect.classList.add(styleClass);
      }
    });
  }

  // Highlight a set of notes, each with its own colour (used by the live playback tracker
  // to show left-hand vs right-hand notes in the hand colour language).
  highlightChord(notes) {
    this.clearHighlights();
    notes.forEach(({ midi, color }) => {
      const rect = this.container.querySelector(`rect[data-midi="${midi}"]`);
      if (rect) {
        rect.setAttribute('data-original-fill', rect.style.fill || (rect.classList.contains('black-key') ? '#1e1e24' : '#ffffff'));
        rect.style.fill = color;
        rect.classList.add('question-highlight');
      }
    });
  }

  clearHighlights() {
    this.container.querySelectorAll('rect.piano-key').forEach(rect => {
      const orig = rect.getAttribute('data-original-fill');
      if (orig) {
        rect.style.fill = orig === '#ffffff' ? '' : orig;
        rect.removeAttribute('data-original-fill');
      }
      rect.classList.remove('question-highlight', 'correct-highlight', 'incorrect-highlight');
    });
  }
}
