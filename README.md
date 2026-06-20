# Rainbow Learning Academy 🌈🐾

Welcome to **Rainbow Learning Academy**, a static, highly interactive, tactile, and dog-themed maths playground built to help primary school children master mathematical reasoning in a gamified, offline-first environment. 

👉 **Play it Live on GitHub Pages:** [https://fastnbulbous.github.io/RLA/](https://fastnbulbous.github.io/RLA/)

---

## 🌟 Overview & Learning Philosophy

Rainbow Learning Academy transitions children from raw digital symbols into visual representations and conversational understandings. Guided by **Rainbow Doggy**, **Kind Dog**, and a lovable cast of canine companions, abstract mathematical concepts are turned into interactive puzzles.

The application leverages a central **Stars & Streak economy** that encourages exploration and independent problem-solving:
*   ⭐ **Cumulative Stars**: Cumulative rewards that never reset, celebrating effort and progress.
*   🔥 **Streak Counter**: Grows on correct answers solved independently (without utilizing hints), incentivising focused, self-reliant mastery.
*   🐶 **Canine Companions**: High-fidelity characters (like Hairy Maclary and Schnitzel von Krumm) narrate word problems and provide tailored encouraging feedback.

---

## 🧭 The Six Learning Zones

The academy is divided into six highly focused, interactive learning modules:

| Learning Zone | File | Purpose | Key Pedagogy |
| :--- | :--- | :--- | :--- |
| **Number Explorers** 🔢 | [`numbers.html`](file:///g:/code/RLA/numbers.html) | Master numbers 1–120, properties, binary, and sequence logic across 6 tabs (Gallery, Quiz, Build-a-Number, Roman Decoder, Sequences, Guide). Also includes a WebGL fractal modal. | 8 tracked number properties (Prime, Perfect, Square, Cube, Triangular, Power of 2, Fibonacci, Highly Composite) with color-coding, step-by-step working, 8-bit binary "paw-lights", sequence difference ladders, a comprehensive reference guide, and WebGL-based fractal visualization. Includes Roman numeral translation and practice mode. |
| **Calculation Crew** ✖️ | [`calculation.html`](file:///g:/code/RLA/calculation.html) | Discover and memorize times tables from 1 to 20. | Multi-sensory skip-counting, visual array tapping, Time Trials, and mixed challenge modes. |
| **Fraction Friends** 🍕 | [`fractions.html`](file:///g:/code/RLA/fractions.html) | Deepen fractional intuition (halves up to sixteenths). | Visual part-whole comparisons (strips, seesaws, number lines) with no abstract arithmetic. |
| **Time Travellers** ⏰ | [`time.html`](file:///g:/code/RLA/time.html) | Master reading the clock face, elapsed time, and scheduling. | Digital-to-Descriptive flow, grab-handle tactile hands, and "hour neighborhood" boundary rules. |
| **Angle & Shape Detective** 📐 | [`geometry.html`](file:///g:/code/RLA/geometry.html) | Estimate angles, learn 3D shape properties, and discover line symmetry. | Tactile angle-sweep estimation, 3D shape edge/vertex/face counting, and symmetry-line quizzes. |
| **Melody Makers** 🎵 | [`music.html`](file:///g:/code/RLA/music.html) | Study music theory, compose melodies, play virtual piano, and analyze staff notation. | Theory Academy w/ 11 lessons & hints, auto-composition (Markov-chains, Euclidean drums, swing, voice-leading), Piano Studio with synth instruments and Web MIDI, and a visual Toolkit. |

*For complete in-depth documentation on each mode, math generators, and pedagogical rationales, see the **[SPEC.md](file:///g:/code/RLA/SPEC.md)**.*

---

## 🛠️ Architecture & Core Technologies

Rainbow Learning Academy is engineered to be lightweight, bulletproof, and offline-compatible:

*   **100% Static & Local-First:** Built entirely with standard vanilla HTML5, CSS (utilising modern OKLCH color palettes), and ES6 JavaScript. It runs natively in any modern browser.
*   **Minimal Dependencies:** Standard pages are dependency-free. The Music zone includes a lightweight, pre-packaged, offline-compatible copy of `abcjs` (for sheet music rendering) and `sf2-player.js` (FluidSynth WASM wrapper) to render and play compositions locally.
*   **Shared Layer Architecture:** A unified logic and styling layer connects the pages:
    - [`shared.js`](file:///g:/code/RLA/shared.js): Manages state persistence, the star/streak economy, virtual keypad factories, character assets, and global audio controllers.
    - [`logic.js`](file:///g:/code/RLA/logic.js): A headless, pure-logic mathematical engine that generates number records, computes factor pairs, validates sequences, and operates the unit test suite.
    - [`shared.css`](file:///g:/code/RLA/shared.css): Contains the core design system tokens, OKLCH variables, responsive grids, and components.
*   **Audio Synthesis & SoundFonts:**
    - **Web Audio API Synth**: Procedurally synthesizes sound effects (level-ups, clicks, and chord changes) instantly without network latency.
    - **General MIDI SoundFont (SF2)**: Melody Makers loads a high-quality local `GeneralUser-GS.sf2` soundfont for realistic acoustic piano, nylon guitar, violin, flute, steel drums, and drum kit playback.
    - **Guide Voice Loops**: Plays randomized bark sound clips and guiding spoken vocal cues (`ava.mp3` decks) in Safari-compatible structures to support younger learners.
*   **Visual WebGL Fractal Engine:**
    - Uses the `fractals/` module tree (factorise, autoLayout, and GL rendering) and `twgl.module.js` to draw mathematical factor fractals dynamically in a WebGL canvas overlay.
*   **Local Persistence**: Automatically saves stars, streaks, best times, and table records using `localStorage`.

---

## 🚀 How to Run Locally

### 1. Clone the Repository
```bash
git clone https://github.com/fastnbulbous/RLA.git
cd RLA
```

### 2. Play Instantly
*   **Standard Pages**: Simply double-click **[`index.html`](file:///g:/code/RLA/index.html)** in any web browser! You can navigate between all academy areas using the portal cards and return to the main dashboard anytime.
*   **Module-Based Features (Music / Fractals)**: Due to standard browser security (CORS) rules regarding local ES modules, files using modular JavaScript (like the Music playground or Fractals WebGL viewer) require a local HTTP server.
    - To start the server, double-click **`start.bat`** (or run `node serve.js` in your terminal).
    - Open **`http://localhost:8080`** in your browser.

### 3. Running Unit Tests
Open **`http://localhost:8080/tests.html`** (or [`tests.html`](file:///g:/code/RLA/tests.html) directly) in a browser to run the comprehensive unit test suite and verify calculations, factorizations, and sequence rule generations.

---

## 🐾 Reference Documentation

For technical implementation specifications, code line mappings, and deep pedagogical rationales for all learning activities, please read the **[Specification Document (SPEC.md)](file:///g:/code/RLA/SPEC.md)**.
