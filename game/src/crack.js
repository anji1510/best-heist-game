// The vault crack: a dial minigame at the vault door. The needle sweeps back
// and forth across the dial; press SPACE while it sits inside the green
// zone to lock a tumbler. Three tumblers open the vault. A miss clunks loud
// — it feeds suspicion straight into the alarm meter and the needle speeds
// up, so a sloppy crack is a loud crack. The dial is the heist's signature:
// it is the only mechanic in the game you play with timing instead of
// movement, and it reads at 300 px — a big gold ring with a green window
// and a needle you cannot miss.
import { CRACK } from './config.js';
import { clamp } from './motion.js';

export function createCrack() {
  return {
    active: false, // true while Rook stands at the vault and cracks it
    needle: 0, // current needle angle, -1.2..1.2 rad around the dial top
    dir: 1, // sweep direction, flips at the dial's ends
    speed: CRACK.sweepSpeed,
    target: 0, // centre of the green zone this tumbler, radians
    locked: 0, // tumblers locked so far, 0..3
    done: false, // true once the third tumbler locks — the vault is open
    flash: 0, // 1 right after a lock or a miss — the dial pops
    flashGood: true, // green flash on a lock, red on a miss
    missT: 0, // brief shake clock after a miss
  };
}

// Start cracking: pick a fresh target zone for the first tumbler.
export function startCrack(crack, rng) {
  crack.active = true;
  crack.locked = 0;
  crack.done = false;
  crack.needle = -1.1;
  crack.dir = 1;
  crack.speed = CRACK.sweepSpeed;
  crack.target = (rng() - 0.5) * 1.6;
  crack.flash = 0;
  crack.missT = 0;
}

export function stepCrack(crack, dt) {
  if (!crack.active || crack.done) return;
  crack.needle += crack.dir * crack.speed * dt;
  if (crack.needle > 1.2) { crack.needle = 1.2; crack.dir = -1; }
  if (crack.needle < -1.2) { crack.needle = -1.2; crack.dir = 1; }
  if (crack.flash > 0) crack.flash = Math.max(0, crack.flash - dt * 2.2);
  if (crack.missT > 0) crack.missT = Math.max(0, crack.missT - dt);
}

// Press SPACE: lock the tumbler if the needle is inside the green zone.
// Returns 'lock' | 'miss' | null (null when the dial is not running).
// `rng` picks the next zone after a lock.
export function tryLock(crack, rng) {
  if (!crack.active || crack.done) return null;
  const inside = Math.abs(crack.needle - crack.target) <= CRACK.zoneHalf;
  if (inside) {
    crack.locked += 1;
    crack.flash = 1;
    crack.flashGood = true;
    crack.speed *= CRACK.speedUp; // every tumbler is faster than the last
    if (crack.locked >= CRACK.tumblers) {
      crack.done = true;
      crack.active = false;
      return 'open';
    }
    // Next zone: far from the last one, so the needle has to travel.
    let next = (rng() - 0.5) * 1.6;
    if (Math.abs(next - crack.target) < 0.7) next = -next;
    crack.target = clamp(next, -1.0, 1.0);
    return 'lock';
  }
  crack.flash = 1;
  crack.flashGood = false;
  crack.missT = 0.5;
  return 'miss';
}
