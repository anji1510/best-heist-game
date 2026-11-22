// Seeded random (mulberry32): the same seed always gives the same world, so a
// staged screenshot renders byte-identical every time.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
// A centred jitter in [-amount, +amount] — one call instead of (rng() - 0.5)
// sprinkled through the spawners, so a burst's spread reads as one gesture.
export function jitter(rng, amount) {
  return (rng() - 0.5) * 2 * amount;
}
