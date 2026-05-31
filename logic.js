/* logic.js — Rainbow Learning Academy pure logic (no DOM)
   Load with <script src="logic.js"></script> before page scripts.
   Also works in Node: if (typeof module!=='undefined') module.exports={...} at end. */

// ── NUMBER ENGINE ─────────────────────────────────────────────────────────────

const SIEVE = (function() {
  const c = new Array(131).fill(true); c[0] = c[1] = false;
  for (let i = 2; i <= 130; i++) if (c[i]) for (let j = i*i; j <= 130; j += i) c[j] = false;
  return c;
})();

function isPrime(n)      { return n >= 2 && SIEVE[n]; }
function isUnit(n)       { return n === 1; }
function divisors(n) {
  const d = [];
  for (let i = 1; i <= Math.sqrt(n); i++) if (n % i === 0) { d.push(i); if (i !== n/i) d.push(n/i); }
  return d.sort((a,b) => a-b);
}
function aliquotSum(n) { return divisors(n).filter(d => d < n).reduce((s,d) => s+d, 0); }
function numberClass(n) {
  if (n <= 1) return 'deficient';
  const a = aliquotSum(n);
  return a === n ? 'perfect' : a > n ? 'abundant' : 'deficient';
}
function factorize(n) {
  const f = []; let x = n;
  for (let p = 2; p * p <= x; p++) while (x % p === 0) { f.push(p); x = Math.floor(x/p); }
  if (x > 1) f.push(x);
  return f;
}
function factorString(n) {
  if (n === 1) return '1';
  return factorize(n).join(' × ');
}
function factorPairs(n) {
  const d = divisors(n);
  const pairs = [];
  for (let i = 0; i < d.length; i++) {
    if (d[i] * d[d.length-1-i] === n && d[i] <= d[d.length-1-i]) pairs.push([d[i], d[d.length-1-i]]);
  }
  return pairs;
}

function isTriangular(n) { const k = Math.round((-1 + Math.sqrt(1 + 8*n)) / 2); return k*(k+1)/2 === n; }
function isSquare(n)     { const k = Math.round(Math.sqrt(n)); return k*k === n; }
function isCube(n)       { const k = Math.round(Math.cbrt(n)); return k*k*k === n; }
function isOblong(n)     { const k = Math.floor(Math.sqrt(n)); return k*(k+1) === n; }

const FIB_SET = (function(){
  const s = new Set(); let a=1,b=1;
  while (a <= 120) { s.add(a); [a,b] = [b, a+b]; }
  return s;
})();
const HC_SET   = new Set([1,2,4,6,12,24,36,48,60,120]);
const TETRA_SET = new Set([1,4,10,20,35,56,84,120]);

function popcount(n) { let c=0,x=n; while(x){ c+=x&1; x>>=1; } return c; }
function isEvilNum(n) { return popcount(n) % 2 === 0; }

function twinPrimePair(n) {
  if (!isPrime(n)) return null;
  if (isPrime(n+2)) return [n, n+2];
  if (n >= 2 && isPrime(n-2)) return [n-2, n];
  return null;
}

function isPow2(n) { return n >= 1 && (n & (n-1)) === 0; }
function isMersenne(n) { return n >= 1 && ((n+1) & n) === 0; }
function isPalindrome10(n) { const s = String(n); return s === s.split('').reverse().join(''); }
function isPalindromeBin(n) { const s = n.toString(2); return s === s.split('').reverse().join(''); }

function collatz(n) {
  const path = [n]; let cur = n, steps = 0, max = n;
  while (cur !== 1 && steps < 1000) {
    cur = cur % 2 === 0 ? cur / 2 : 3 * cur + 1;
    path.push(cur); if (cur > max) max = cur; steps++;
  }
  return { path, steps, max };
}

function happy(n) {
  const seen = new Set(); let cur = n;
  const path = [n];
  while (cur !== 1 && !seen.has(cur)) {
    seen.add(cur);
    cur = String(cur).split('').reduce((s,d) => s + d*d, 0);
    path.push(cur);
  }
  return { isHappy: cur === 1, path };
}

function digitalRoot(n) { return n === 0 ? 0 : 1 + (n-1) % 9; }

function toRoman(n) {
  const vals = [[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let r = '';
  for (const [v, s] of vals) { while (n >= v) { r += s; n -= v; } }
  return r;
}

function toTally(n) { return { groups: Math.floor(n/5), remainder: n % 5 }; }

function buildNumberRecord(n) {
  const divs = divisors(n);
  const aq   = aliquotSum(n);
  const cl   = numberClass(n);
  const facs = factorize(n);
  const twin = twinPrimePair(n);
  const colt = collatz(n);
  const hap  = happy(n);
  const tally = toTally(n);
  return {
    n,
    isPrime: isPrime(n), isUnit: isUnit(n),
    isComposite: !isUnit(n) && !isPrime(n),
    isEven: n % 2 === 0, isOdd: n % 2 !== 0,
    divisors: divs, aliquotSum: aq, numClass: cl,
    numDivisors: divs.length,
    primeFactors: facs, factorString: factorString(n),
    factorPairs: factorPairs(n),
    isTriangular: isTriangular(n), isSquare: isSquare(n),
    isCube: isCube(n), isOblong: isOblong(n),
    isTetrahedral: TETRA_SET.has(n),
    isFibonacci: FIB_SET.has(n),
    isTwinPrime: twin !== null, twinPartner: twin ? (twin[0] === n ? twin[1] : twin[0]) : null,
    isHighlyComposite: HC_SET.has(n),
    isPow2: isPow2(n), isMersenne: isMersenne(n),
    isPalin10: isPalindrome10(n), isPalinBin: isPalindromeBin(n),
    popcount: popcount(n), isEvil: isEvilNum(n),
    collatz: colt, happy: hap,
    digitalRoot: digitalRoot(n),
    binary: n.toString(2), base4: n.toString(4),
    base16: n.toString(16).toUpperCase(),
    roman: n <= 3999 ? toRoman(n) : '',
    tally,
  };
}

const MAX_NUMBER = 120;

// Pre-compute records 1–120
const NUM_CACHE = {};
for (let i = 1; i <= MAX_NUMBER; i++) NUM_CACHE[i] = buildNumberRecord(i);

// ── MATH TINTS ────────────────────────────────────────────────────────────────

const MATH_TINTS = [
  { key: 'perfect',          color: '#facc15', label: 'Perfect' },
  { key: 'prime',            color: '#fb7185', label: 'Prime' },
  { key: 'square',           color: '#38bdf8', label: 'Square' },
  { key: 'cube',             color: '#a78bfa', label: 'Cube' },
  { key: 'triangular',       color: '#34d399', label: 'Triangular' },
  { key: 'pow2',             color: '#f472b6', label: 'Power of 2' },
  { key: 'fibonacci',        color: '#fbbf24', label: 'Fibonacci' },
  { key: 'highly-composite', color: '#60a5fa', label: 'Highly Composite' },
  { key: 'composite',        color: '#475569', label: 'Composite' },
];

function getMathTint(rec) {
  if (rec.numClass === 'perfect') return MATH_TINTS[0];
  if (rec.isPrime) return MATH_TINTS[1];
  if (rec.isSquare) return MATH_TINTS[2];
  if (rec.isCube)   return MATH_TINTS[3];
  if (rec.isTriangular) return MATH_TINTS[4];
  if (rec.isPow2)   return MATH_TINTS[5];
  if (rec.isFibonacci) return MATH_TINTS[6];
  if (rec.isHighlyComposite) return MATH_TINTS[7];
  return MATH_TINTS[8];
}

// ── SEQUENCE GENERATORS ───────────────────────────────────────────────────────

function _rnd(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

const SEQ_GENERATORS = [
  // Count-up small (diff 0+)
  {
    minDiff: 0, family: 'count',
    gen() {
      const step = [2,3,5,10][_rnd(0,3)];
      const start = _rnd(0, 20) * step + _rnd(1, step-1||1);
      const terms = Array.from({length:5}, (_,i) => start + i*step);
      return { terms, next: terms[4]+step, rule: `+${step} each time`, family: 'count' };
    }
  },
  // Count-down crossing zero (diff 1+)
  {
    minDiff: 1, family: 'countdown',
    gen() {
      const step = [2,3,5][_rnd(0,2)];
      const start = _rnd(6, 18);
      const terms = Array.from({length:5}, (_,i) => start - i*step);
      return { terms, next: terms[4]-step, rule: `−${step} each time`, family: 'countdown' };
    }
  },
  // Multiples (diff 0+)
  {
    minDiff: 0, family: 'multiples',
    gen() {
      const t = _rnd(2, 10);
      const start = _rnd(1, 6);
      const terms = Array.from({length:5}, (_,i) => t*(start+i));
      return { terms, next: t*(start+5), rule: `×${t} table`, family: 'multiples' };
    }
  },
  // Skip from offset (diff 2+)
  {
    minDiff: 2, family: 'skip',
    gen() {
      const step = [5,7,11,13][_rnd(0,3)];
      const start = _rnd(3, 30);
      const terms = Array.from({length:5}, (_,i) => start + i*step);
      return { terms, next: terms[4]+step, rule: `+${step} from ${start}`, family: 'skip' };
    }
  },
  // Linear scale + offset (diff 2+)
  {
    minDiff: 2, family: 'linear',
    gen() {
      const a = _rnd(2, 7);
      const b = _rnd(1, 15);
      const terms = Array.from({length:5}, (_,i) => a*(i+1)+b);
      return { terms, next: a*6+b, rule: `${a}n + ${b}`, family: 'linear' };
    }
  },
  // Evens/odds (diff 0+)
  {
    minDiff: 0, family: 'evens',
    gen() {
      const isEven = Math.random() < 0.5;
      const start = isEven ? _rnd(1,20)*2 : _rnd(0,19)*2+1;
      const terms = Array.from({length:5}, (_,i) => start + i*2);
      return { terms, next: terms[4]+2, rule: isEven ? 'even numbers' : 'odd numbers', family: 'count' };
    }
  },
  // Squares (diff 2+)
  {
    minDiff: 2, family: 'squares',
    gen() {
      const start = _rnd(1, 7);
      const terms = Array.from({length:5}, (_,i) => (start+i)*(start+i));
      return { terms, next: (start+5)*(start+5), rule: 'square numbers', family: 'squares' };
    }
  },
  // Triangular (diff 2+)
  {
    minDiff: 2, family: 'triangular',
    gen() {
      const start = _rnd(1, 6);
      const T = n => n*(n+1)/2;
      const terms = Array.from({length:5}, (_,i) => T(start+i));
      return { terms, next: T(start+5), rule: 'triangular numbers', family: 'triangular' };
    }
  },
  // Fibonacci-style (diff 3+)
  {
    minDiff: 3, family: 'fibonacci',
    gen() {
      const a = _rnd(1,5), b = _rnd(a,8);
      const terms = [a, b];
      for (let i=2; i<5; i++) terms.push(terms[i-1]+terms[i-2]);
      return { terms, next: terms[4]+terms[3], rule: 'each term = sum of two before', family: 'fibonacci' };
    }
  },
  // Powers of 2 (diff 3+)
  {
    minDiff: 3, family: 'pow2',
    gen() {
      const start = _rnd(0,4);
      const terms = Array.from({length:5}, (_,i) => Math.pow(2, start+i));
      return { terms, next: Math.pow(2, start+5), rule: 'powers of 2', family: 'pow2' };
    }
  },
  // Primes (diff 3+)
  {
    minDiff: 3, family: 'primes',
    gen() {
      const primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67];
      const start = _rnd(0, primes.length - 6);
      const terms = primes.slice(start, start+5);
      return { terms, next: primes[start+5], rule: 'prime numbers', family: 'primes' };
    }
  },
];

// ── DIFFERENCE LADDER ─────────────────────────────────────────────────────────

// Returns { d1: number[], d2: number[]|null }
// d2 is null when all first differences are equal (no second level needed)
function diffLadder(terms) {
  const d1 = [];
  for (let i = 1; i < terms.length; i++) d1.push(terms[i] - terms[i-1]);
  const allSame = d1.every(v => v === d1[0]);
  if (allSame) return { d1, d2: null };
  const d2 = [];
  for (let i = 1; i < d1.length; i++) d2.push(d1[i] - d1[i-1]);
  return { d1, d2 };
}

// ── PEDAGOGICAL REGISTRIES (Workstream B1 & C1) ────────────────────────────────

function _seqCard(title, definition, example) {
  return `
    <div class="sub-card teaching-card" style="border-left: 4px solid var(--accent); padding: 12px 14px; margin-top: 8px; text-align: left;">
      <h4 style="margin: 0 0 6px 0; font-family: 'Outfit', sans-serif; font-size: 0.95rem; color: var(--text1);">${title}</h4>
      <div style="font-size: 0.85rem; color: var(--text2); line-height: 1.45; margin-bottom: 8px;">${definition}</div>
      <div style="font-size: 0.82rem; background: var(--surface-inset); padding: 8px 10px; border-radius: 8px; font-family: monospace; color: var(--text1); white-space: pre-wrap; word-break: break-all;">${example}</div>
    </div>
  `;
}

const SEQ_EXPLAIN = {
  count(terms, next, rule) {
    const diff = terms[1] - terms[0];
    return _seqCard(
      'Count Up Sequence 📈',
      'We add the same number to each term to get the next term. This is called an arithmetic sequence!',
      `Difference: +${diff} each time.\n${terms.join(' → ')} → [?]\nCalculation:\n${terms[4]} + ${diff} = ${next}`
    );
  },
  countdown(terms, next, rule) {
    const diff = terms[0] - terms[1];
    return _seqCard(
      'Count Down Sequence 📉',
      'We subtract the same number from each term to get the next term. Watch out for numbers crossing zero!',
      `Difference: −${diff} each time.\n${terms.join(' → ')} → [?]\nCalculation:\n${terms[4]} - ${diff} = ${next}`
    );
  },
  multiples(terms, next, rule) {
    const diff = terms[1] - terms[0];
    return _seqCard(
      'Multiples Table ✖️',
      `These numbers are the multiplication table of ${diff}! Each step adds the table base.`,
      `Sequence: ${terms.join(', ')}\nWorked out:\n` +
      terms.map((v, i) => `${diff} × ${v/diff} = ${v}`).join('\n') +
      `\nNext multiple:\n${diff} × ${next/diff} = ${next}`
    );
  },
  skip(terms, next, rule) {
    const diff = terms[1] - terms[0];
    return _seqCard(
      'Skip Counting with Offset 🏃',
      `We start at a non-standard number (${terms[0]}) and skip count by a large step size of +${diff} each time!`,
      `Sequence: ${terms.join(' → ')} → [?]\nCalculation:\n${terms[4]} + ${diff} = ${next}`
    );
  },
  linear(terms, next, rule) {
    const diff = terms[1] - terms[0];
    const b = terms[0] - diff;
    const ruleStr = `${diff}n ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}`;
    return _seqCard(
      'Linear Rule Sequence 📏',
      `A sequence defined by multiplying the position number (n) by a multiplier and adding/subtracting a constant. Formula: ${ruleStr}`,
      terms.map((v, i) => `Position n=${i+1}: ${diff}×${i+1} ${b>=0?'+ '+b:'- '+Math.abs(b)} = ${v}`).join('\n') +
      `\nNext (Position n=6):\n${diff}×6 ${b>=0?'+ '+b:'- '+Math.abs(b)} = ${next}`
    );
  },
  evens(terms, next, rule) {
    const isEven = terms[0] % 2 === 0;
    const type = isEven ? 'Even numbers' : 'Odd numbers';
    return _seqCard(
      'Evens & Odds Pattern 👥',
      `Consecutive even numbers (ending in 0, 2, 4, 6, 8) or odd numbers (ending in 1, 3, 5, 7, 9) skipping by 2!`,
      `Pattern: Consecutive ${type}\nSequence: ${terms.join(' → ')} → [?]\nCalculation:\n${terms[4]} + 2 = ${next}`
    );
  },
  squares(terms, next, rule) {
    const roots = terms.map(v => Math.round(Math.sqrt(v)));
    const nextRoot = roots[roots.length - 1] + 1;
    return _seqCard(
      'Square Numbers Grid 🟦',
      'A square number is made by multiplying a number by itself! e.g. 2 × 2 = 4, 3 × 3 = 9.',
      roots.map((r, i) => `Term ${i+1}: ${r} × ${r} = ${terms[i]}`).join('\n') +
      `\nNext term:\n${nextRoot} × ${nextRoot} = ${next}`
    );
  },
  triangular(terms, next, rule) {
    const roots = terms.map(v => Math.round((-1 + Math.sqrt(1 + 8*v)) / 2));
    const nextRoot = roots[roots.length - 1] + 1;
    return _seqCard(
      'Triangular Numbers Stack 🔺',
      'Numbers that can make a neat triangle shape! The difference grows by 1 more each step: +2, +3, +4, +5...',
      roots.map((r, i) => `Term ${i+1} (Row ${r}): 1 + 2 + ... + ${r} = ${terms[i]}`).join('\n') +
      `\nNext term (Row ${nextRoot}):\n${terms[4]} + ${nextRoot} = ${next}`
    );
  },
  fibonacci(terms, next, rule) {
    return _seqCard(
      'Fibonacci Sequence 🌀',
      "Nature's beautiful pattern! Each new number is found by adding up the two numbers right before it.",
      `Let's add consecutive terms:\n` +
      `${terms[0]} + ${terms[1]} = ${terms[2]}\n` +
      `${terms[1]} + ${terms[2]} = ${terms[3]}\n` +
      `${terms[2]} + ${terms[3]} = ${terms[4]}\n` +
      `Next term:\n${terms[3]} + ${terms[4]} = ${next}`
    );
  },
  pow2(terms, next, rule) {
    return _seqCard(
      'Powers of 2 (Doubling) ⚡',
      'Each number is exactly double (2 times) the previous number! Extremely fast growth!',
      terms.slice(0, 4).map((v, i) => `${v} × 2 = ${terms[i+1]}`).join('\n') +
      `\nNext term:\n${terms[4]} × 2 = ${next}`
    );
  },
  primes(terms, next, rule) {
    return _seqCard(
      'Prime Numbers Row 🔴',
      'Primes are special numbers that only have exactly two divisors: 1 and themselves! They cannot be split into smaller rectangles.',
      `Primes in sequence: ${terms.join(', ')}\n` +
      `These are consecutive prime numbers in order.\n` +
      `The very next prime number after ${terms[4]} is ${next}!`
    );
  }
};

const SEQ_HINT = {
  count: 'We are counting UP by the same step size each time! Find the step and add it to the last number.',
  countdown: 'We are counting DOWN by the same step size each time! Subtract the step from the last number.',
  multiples: 'These are consecutive numbers in a multiplication times-table! Look at the multiplication factor.',
  skip: 'We are skip counting by a big step size starting from an offset number! Just add the step to the last number.',
  linear: 'There is a multiplier and an offset at play! Try: position number × factor + offset.',
  evens: 'Look at the last digit of the numbers! These are consecutive even or odd numbers, skipping by 2.',
  squares: 'Try multiplying numbers by themselves! e.g. 1×1, 2×2, 3×3, 4×4...',
  triangular: 'These numbers make a bowling-pin triangle! The gap between numbers increases by 1 each time.',
  fibonacci: 'Try adding two consecutive numbers together! Does it equal the next number?',
  pow2: 'Try doubling! Each number is exactly twice the size of the number before it.',
  primes: 'These are special numbers that cannot be divided evenly except by 1 and themselves!'
};

const PROP_INFO = {
  isUnit: {
    title: 'The Unit 👑',
    definition: 'The number 1 is unique! It is neither prime nor composite, so we call it the Unit.',
    explain(n, rec) {
      return `1 has exactly 1 divisor (just itself).<br>Primes need exactly 2 divisors, composites need 3+, so 1 is special — we call it <strong>the Unit</strong>.`;
    }
  },
  isPrime: {
    title: '🔴 Prime Number',
    definition: 'A prime number is a building block of math! It only has exactly 2 divisors: 1 and itself.',
    explain(n, rec) {
      const tested = [];
      for (let i = 2; i <= Math.floor(Math.sqrt(n)); i++) tested.push(i);
      const testStr = tested.length
        ? `We test: ${tested.map(t => `${n} ÷ ${t} = ${(n/t).toFixed(1)}${n%t===0?' ✓':' ✗ (remainder '+n%t+')'}`).join(', ')}.<br>`
        : '';
      return `${testStr}${n} has only 2 divisors: <strong>1</strong> and <strong>${n}</strong>. No other number divides it evenly, so it is prime!`;
    }
  },
  isComposite: {
    title: 'Composite Number 🧱',
    definition: 'A composite number is made by multiplying other numbers together! It has 3 or more divisors.',
    explain(n, rec) {
      const pairs = rec.factorPairs;
      const pairStr = pairs.map(p => `${p[0]} × ${p[1]}`).join(', ');
      return `${n} has <strong>${rec.numDivisors} divisors</strong>: ${rec.divisors.join(', ')}.<br>Factor pairs: ${pairStr}.<br>Prime breakdown: ${rec.factorString} = ${n}.`;
    }
  },
  isEven: {
    title: 'Even Number 👥',
    definition: 'Even numbers can be split into two perfectly equal groups with no leftovers!',
    explain(n, rec) {
      return `${n} ÷ 2 = <strong>${n/2}</strong> (no remainder!).<br>We can make 2 equal groups of ${n/2}: [${n/2}] + [${n/2}] = ${n}. ✓`;
    }
  },
  isOdd: {
    title: 'Odd Number 🧍',
    definition: 'Odd numbers always have one leftover when you try to split them into pairs!',
    explain(n, rec) {
      const half = Math.floor(n/2);
      return `${n} ÷ 2 = ${half} remainder <strong>1</strong>.<br>If we try pairs: [${half}] + [${half}] = ${half*2}, but we still have 1 left over!`;
    }
  },
  perfect: {
    title: '✨ Perfect Number',
    definition: 'A perfect number is super rare! Its proper divisors (divisors smaller than the number) add up to exactly the number itself!',
    explain(n, rec) {
      const proper = rec.divisors.filter(d => d < n);
      const chain = proper.join(' + ');
      const running = [];
      let sum = 0;
      proper.forEach(d => { sum += d; running.push(sum); });
      const steps = proper.map((d,i) => `${i===0?'':'+ '}${d} = ${running[i]}`).join(', ');
      return `Proper divisors of ${n}: <strong>${proper.join(', ')}</strong>.<br>Adding up: ${steps}.<br>${chain} = <strong>${rec.aliquotSum}</strong> which equals ${n} exactly! ✨ Perfect!`;
    }
  },
  abundant: {
    title: 'Abundant Number 🍊',
    definition: 'An abundant number\'s proper divisors add up to MORE than the number itself. It has plenty of division friends!',
    explain(n, rec) {
      const proper = rec.divisors.filter(d => d < n);
      const chain = proper.join(' + ');
      return `Proper divisors of ${n}: <strong>${proper.join(', ')}</strong>.<br>Adding up: ${chain} = <strong>${rec.aliquotSum}</strong>.<br>${rec.aliquotSum} > ${n}, so ${n} is abundant (overflowing with divisors)! 🍊`;
    }
  },
  deficient: {
    title: 'Deficient Number 💧',
    definition: 'A deficient number\'s proper divisors add up to LESS than the number itself.',
    explain(n, rec) {
      const proper = rec.divisors.filter(d => d < n);
      const chain = proper.join(' + ');
      return `Proper divisors of ${n}: <strong>${proper.join(', ')}</strong>.<br>Adding up: ${chain} = <strong>${rec.aliquotSum}</strong>.<br>${rec.aliquotSum} < ${n}, so ${n} is deficient (not quite enough). 💧`;
    }
  },
  isSquare: {
    title: '🟦 Square Number',
    definition: 'Square numbers can make a perfect grid square! They are created by multiplying a number by itself.',
    explain(n, rec) {
      const root = Math.round(Math.sqrt(n));
      const prev = root - 1;
      return `${root} × ${root} = <strong>${n}</strong> — a perfect square!<br>The square before this: ${prev} × ${prev} = ${prev*prev}.<br>The next square: ${root+1} × ${root+1} = ${(root+1)*(root+1)}.`;
    }
  },
  isCube: {
    title: '🟣 Cube Number',
    definition: 'Cube numbers can build a perfect 3D block! They are made by multiplying a number by itself three times.',
    explain(n, rec) {
      const root = Math.round(Math.cbrt(n));
      return `${root} × ${root} × ${root} = <strong>${n}</strong> — a perfect cube!<br>Step by step: ${root} × ${root} = ${root*root}, then ${root*root} × ${root} = ${n}.`;
    }
  },
  isTriangular: {
    title: '🔺 Triangular Number',
    definition: 'Triangular numbers can be stacked to form a perfect triangle, like bowling pins!',
    explain(n, rec) {
      const k = Math.round((-1 + Math.sqrt(1 + 8*n)) / 2);
      const terms = Array.from({length: k}, (_, i) => i + 1);
      const chain = terms.join(' + ');
      // Show running total
      const running = [];
      let sum = 0;
      terms.forEach(t => { sum += t; running.push(sum); });
      const steps = terms.map((t, i) => i === 0 ? `${t}` : `${running[i-1]} + ${t} = ${running[i]}`).join(', ');
      return `Stack ${k} rows: ${chain} = <strong>${n}</strong>.<br>Working out: ${steps}.<br>Formula check: ${k} × ${k+1} ÷ 2 = ${k*(k+1)} ÷ 2 = ${n}. ✓`;
    }
  },
  isFibonacci: {
    title: '🌀 Fibonacci Pattern',
    definition: 'Fibonacci numbers are nature\'s pattern! Each term is the sum of the two numbers before it in the series.',
    explain(n, rec) {
      // Build the Fibonacci chain up to n
      const chain = [1, 1];
      while (chain[chain.length - 1] < n) {
        chain.push(chain[chain.length - 1] + chain[chain.length - 2]);
      }
      const steps = chain.slice(2).map((v, i) => `${chain[i]} + ${chain[i+1]} = ${v}`);
      return `Fibonacci sequence: <strong>${chain.join(', ')}</strong>.<br>How it builds: ${steps.join(', ')}.<br>${n} fits in nature's spiral — sunflower seeds, pinecones, and seashells! 🌻`;
    }
  },
  isHighlyComposite: {
    title: '🏆 Highly Composite',
    definition: 'Highly composite numbers are the ultimate champions of division! They have more divisors than any number smaller than them.',
    explain(n, rec) {
      // Find the previous HC number for comparison
      const hcList = [1,2,4,6,12,24,36,48,60,120];
      const idx = hcList.indexOf(n);
      const prev = idx > 0 ? hcList[idx - 1] : null;
      const prevRec = prev ? NUM_CACHE[prev] : null;
      const comparison = prevRec
        ? `The previous record was ${prev} with ${prevRec.numDivisors} divisors.`
        : '';
      return `${n} has <strong>${rec.numDivisors} divisors</strong>: ${rec.divisors.join(', ')}.<br>${comparison}<br>${n} beats every smaller number's divisor count — a new record! 🏆`;
    }
  },
  isTwinPrime: {
    title: 'Twin Prime 🤝',
    definition: 'Twin primes are prime numbers that are very close neighbours—just 2 apart from another prime!',
    explain(n, rec) {
      const a = Math.min(n, rec.twinPartner);
      const b = Math.max(n, rec.twinPartner);
      return `Both <strong>${a}</strong> and <strong>${b}</strong> are prime, and they are only ${b} − ${a} = 2 apart!<br>Twin prime pair: (${a}, ${b}). They're practically neighbours! 🤝`;
    }
  },
  isPow2: {
    title: '⚡ Power of 2',
    definition: 'Powers of 2 grow by doubling! They represent computer storage steps (2, 4, 8, 16...).',
    explain(n, rec) {
      const exp = Math.round(Math.log2(n));
      // Build the doubling chain
      const chain = [];
      for (let i = 0; i <= exp; i++) chain.push(Math.pow(2, i));
      const doubles = chain.slice(0, -1).map((v, i) => `${v} × 2 = ${chain[i+1]}`).join(', ');
      return `2 to the power of ${exp} = <strong>${n}</strong>.<br>Doubling chain: ${doubles}.<br>In binary: ${rec.binary} (just one "1" followed by zeroes!). 💾`;
    }
  },
  isMersenne: {
    title: 'Mersenne Number 🪁',
    definition: 'A Mersenne number is exactly 1 less than a power of 2! e.g. 3, 7, 31.',
    explain(n, rec) {
      const exp = Math.round(Math.log2(n + 1));
      return `2 to the power of ${exp} = ${n + 1}.<br>${n + 1} − 1 = <strong>${n}</strong>.<br>In binary: ${rec.binary} (all 1s — every bit is switched on!). 🪁`;
    }
  },
  isPalin10: {
    title: 'Mirror Palindrome 🪞',
    definition: 'A palindrome reads the same forwards and backwards, like a mirror!',
    explain(n, rec) {
      const s = String(n);
      const rev = s.split('').reverse().join('');
      return `Forward: <strong>${s}</strong> → Backward: <strong>${rev}</strong>.<br>They match! ${n} is a perfect mirror number. 🪞`;
    }
  },
  isPalinBin: {
    title: 'Binary Palindrome 💾',
    definition: 'A binary palindrome reads the same forwards and backwards when written in computer binary code (0s and 1s)!',
    explain(n, rec) {
      const rev = rec.binary.split('').reverse().join('');
      return `${n} in binary: <strong>${rec.binary}</strong>.<br>Reversed: <strong>${rev}</strong>.<br>They match — a perfect binary mirror! 💾`;
    }
  },
  isEvil: {
    title: 'Evil Number 😈',
    definition: 'Evil numbers have an EVEN number of \'1\'s in their binary code! There is nothing bad about them; it is just a fun math name!',
    explain(n, rec) {
      const bits = rec.binary.split('');
      const highlighted = bits.map(b => b === '1' ? `<strong style="color:#fb7185;">${b}</strong>` : b).join('');
      return `${n} in binary: ${highlighted}.<br>Count the 1s: <strong>${rec.popcount}</strong> ones. ${rec.popcount} is even, so ${n} is "evil"! 😈`;
    }
  },
  isOdious: {
    title: 'Odious Number 😇',
    definition: 'Odious numbers have an ODD number of \'1\'s in their binary code! It is just a fun wordplay in mathematics.',
    explain(n, rec) {
      const bits = rec.binary.split('');
      const highlighted = bits.map(b => b === '1' ? `<strong style="color:#34d399;">${b}</strong>` : b).join('');
      return `${n} in binary: ${highlighted}.<br>Count the 1s: <strong>${rec.popcount}</strong> ones. ${rec.popcount} is odd, so ${n} is "odious"! 😇`;
    }
  }
};

function explainProps(rec, currentDiff) {
  const list = [];
  const n = rec.n;

  if (rec.isUnit) list.push({ key: 'isUnit', ...PROP_INFO.isUnit });
  if (rec.isPrime) list.push({ key: 'isPrime', ...PROP_INFO.isPrime });
  if (rec.isComposite) list.push({ key: 'isComposite', ...PROP_INFO.isComposite });
  if (rec.isEven) list.push({ key: 'isEven', ...PROP_INFO.isEven });
  else list.push({ key: 'isOdd', ...PROP_INFO.isOdd });
  
  if (rec.numClass === 'perfect') list.push({ key: 'perfect', ...PROP_INFO.perfect });
  if (rec.numClass === 'abundant') list.push({ key: 'abundant', ...PROP_INFO.abundant });
  if (rec.numClass === 'deficient') list.push({ key: 'deficient', ...PROP_INFO.deficient });
  
  if (rec.isSquare) list.push({ key: 'isSquare', ...PROP_INFO.isSquare });
  if (rec.isCube) list.push({ key: 'isCube', ...PROP_INFO.isCube });
  if (rec.isTriangular) list.push({ key: 'isTriangular', ...PROP_INFO.isTriangular });

  if (currentDiff >= 1) {
    if (rec.isFibonacci) list.push({ key: 'isFibonacci', ...PROP_INFO.isFibonacci });
    if (rec.isHighlyComposite) list.push({ key: 'isHighlyComposite', ...PROP_INFO.isHighlyComposite });
    if (rec.isTwinPrime) list.push({ key: 'isTwinPrime', ...PROP_INFO.isTwinPrime });
    if (rec.isPow2) list.push({ key: 'isPow2', ...PROP_INFO.isPow2 });
    if (rec.isMersenne) list.push({ key: 'isMersenne', ...PROP_INFO.isMersenne });
  }

  if (currentDiff >= 2) {
    if (rec.isPalin10) list.push({ key: 'isPalin10', ...PROP_INFO.isPalin10 });
    if (rec.isPalinBin) list.push({ key: 'isPalinBin', ...PROP_INFO.isPalinBin });
    if (rec.isEvil) list.push({ key: 'isEvil', ...PROP_INFO.isEvil });
    else list.push({ key: 'isOdious', ...PROP_INFO.isOdious });
  }

  return list.map(p => {
    const just = p.explain(n, rec);
    return `
      <div class="sub-card teaching-card prop-card" style="border-left: 4px solid var(--area-num); padding: 12px 14px; margin-top: 8px; text-align: left;">
        <h4 style="margin: 0 0 6px 0; font-family: 'Outfit', sans-serif; font-size: 0.95rem; color: var(--text1);">${p.title}</h4>
        <div style="font-size: 0.85rem; color: var(--text2); line-height: 1.45; margin-bottom: 8px;">${p.definition}</div>
        <div style="font-size: 0.82rem; background: var(--surface-inset); padding: 8px 10px; border-radius: 8px; font-family: 'Outfit', sans-serif; font-weight: 600; color: var(--text1);">${just}</div>
      </div>
    `;
  }).join('');
}

function seqExplain(seq) {
  if (SEQ_EXPLAIN[seq.family]) {
    return SEQ_EXPLAIN[seq.family](seq.terms, seq.next, seq.rule);
  }
  return _seqCard(
    'Sequence Pattern 🧩',
    `We can find the pattern in this sequence by looking at the rules: ${seq.rule}`,
    `Sequence: ${seq.terms.join(' → ')} → [?]\nNext term: ${seq.next}`
  );
}

// ── NODE COMPAT ───────────────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = {
    isPrime, divisors, aliquotSum, numberClass, factorize, factorString, factorPairs,
    isTriangular, isSquare, isCube, isOblong,
    isPow2, isMersenne, isPalindrome10, isPalindromeBin,
    popcount, isEvilNum, twinPrimePair, collatz, happy, digitalRoot,
    toRoman, toTally, buildNumberRecord,
    MAX_NUMBER, NUM_CACHE, MATH_TINTS, getMathTint,
    SEQ_GENERATORS, diffLadder,
    _seqCard, SEQ_EXPLAIN, SEQ_HINT, PROP_INFO, explainProps, seqExplain
  };
}
