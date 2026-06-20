// Prime factorisation with memoised cache.
// Returns an ordered array of prime factors (ascending), e.g. 12 → [2,2,3].

const _cache = new Map();

export function factorise(n) {
  n = Math.floor(n);
  if (n < 2) return [];
  if (_cache.has(n)) return _cache.get(n);

  const factors = [];
  let rem = n;
  for (let p = 2; p * p <= rem; p++) {
    while (rem % p === 0) {
      factors.push(p);
      rem = rem / p;
    }
  }
  if (rem > 1) factors.push(rem);

  _cache.set(n, factors);
  return factors;
}

// ── Prime index (2→0, 3→1, 5→2, 7→3, …) for stable palette assignment ──

const _primeIndex = new Map();
let _nextPrimeIndex = 0;
let _sieveTop = 2;

function _extendSieve(upTo) {
  for (let p = _sieveTop; p <= upTo; p++) {
    if (_isPrime(p)) {
      if (!_primeIndex.has(p)) {
        _primeIndex.set(p, _nextPrimeIndex++);
      }
    }
  }
  _sieveTop = upTo + 1;
}

function _isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

export function primeIndex(p) {
  if (!_primeIndex.has(p)) _extendSieve(p);
  return _primeIndex.get(p) ?? 0;
}

// ── Composite grouping ────────────────────────────────────────────
// Takes a prime factors array and greedily groups consecutive identical
// primes whose product is ≤ 11 AND is in the allowed set.
// allowedComposites: object keyed by composite value, e.g. {4:true, 8:true, 9:true}
// e.g. [2,2,2,3] with {4,8} → [8,3];  with {4} only → [4,2,3]
//
// DESIGN DECISION (WHY):
// - Largest-first greedy grouping (10, 9, 8, 6, 4) is chosen to maximize structural stability.
//   By prioritizing larger composites at outer layers, we reduce early branching chaotic density
//   and generate highly balanced, symmetric regular polygons first.
// - Sorting the remaining single prime pool ascending at the end preserves the small-to-large
//   nesting architecture for standard prime factors, keeping layers visually consistent.
export function groupToComposite(primes, allowedComposites = {4:true,8:true,9:true}) {
  const COMPOSITE_PRIMES = [
    { value: 10, factors: [2, 5] },
    { value: 9,  factors: [3, 3] },
    { value: 8,  factors: [2, 2, 2] },
    { value: 6,  factors: [2, 3] },
    { value: 4,  factors: [2, 2] }
  ];

  const pool = [...primes];
  const result = [];

  for (const comp of COMPOSITE_PRIMES) {
    if (!allowedComposites[comp.value]) continue;

    while (true) {
      const tempPool = [...pool];
      let matches = true;
      for (const f of comp.factors) {
        const idx = tempPool.indexOf(f);
        if (idx !== -1) {
          tempPool.splice(idx, 1);
        } else {
          matches = false;
          break;
        }
      }
      if (matches) {
        pool.length = 0;
        pool.push(...tempPool);
        result.push(comp.value);
      } else {
        break;
      }
    }
  }

  pool.sort((a, b) => a - b);
  result.push(...pool);

  return result;
}
