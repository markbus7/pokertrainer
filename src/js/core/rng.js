/**
 * Seedable RNG (mulberry32) so drills, shuffles and simulations can be replayed.
 * A trainer that cannot reproduce a spot cannot explain it.
 */
export function makeRng(seed = (Math.random() * 4294967296) >>> 0) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.seed = seed;
  return rng;
}

/** Integer in [0, n). */
export function randInt(rng, n) {
  return Math.floor(rng() * n);
}

/** Uniform pick. */
export function pick(rng, arr) {
  return arr[randInt(rng, arr.length)];
}

/** Fisher-Yates, in place. */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/** Weighted pick: entries are [value, weight]. */
export function weighted(rng, entries) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

export const defaultRng = makeRng();
