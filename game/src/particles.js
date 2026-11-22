// Particles: the secondary layer. Footstep dust, loot glints, alarm sparks
// and exit motes — small, cheap, and always seeded, so a staged shot is
// identical every render. Ambient life only; never the thing the eye must follow.
import { createRandom, jitter } from './random.js';

export function createParticles(seed) {
  return { list: [], rng: createRandom(seed) };
}

export function spawnDust(ps, x, y) {
  for (let i = 0; i < 3; i += 1) {
    ps.list.push({
      kind: 'dust', x: x + (ps.rng() - 0.5) * 10, y: y + (ps.rng() - 0.5) * 6,
      vx: (ps.rng() - 0.5) * 14, vy: -6 - ps.rng() * 10,
      t: 0, life: 0.55 + ps.rng() * 0.3, size: 2.5 + ps.rng() * 2,
    });
  }
}

export function spawnGlint(ps, x, y) {
  ps.list.push({
    kind: 'glint', x, y, vx: 0, vy: -14, t: 0, life: 0.7, size: 3,
  });
}

export function spawnAlarmSparks(ps, x, y) {
  for (let i = 0; i < 10; i += 1) {
    const a = ps.rng() * Math.PI * 2;
    const sp = 40 + ps.rng() * 70;
    ps.list.push({
      kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
      t: 0, life: 0.45 + ps.rng() * 0.35, size: 2 + ps.rng() * 2,
    });
  }
}

// The loot burst: a pickup is a moment, not a disappearance — fourteen gold
// sparks fly out with an ease-out spread and fall back, so the grab has weight.
// Seeded like everything else, so a staged shot never flickers.
export function spawnBurst(ps, x, y) {
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2 + jitter(ps.rng, 0.3);
    const sp = 55 + ps.rng() * 85;
    ps.list.push({
      kind: 'gold', x, y: y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 34,
      t: 0, life: 0.5 + ps.rng() * 0.35, size: 2 + ps.rng() * 2.5,
    });
  }
  ps.list.push({
    kind: 'ring', x, y, vx: 0, vy: 0, t: 0, life: 0.5, size: 8, color: 'rgba(242, 193, 78, 0.9)',
  });
}

export function spawnMote(ps, x, y) {
  ps.list.push({
    kind: 'mote', x: x + (ps.rng() - 0.5) * 30, y: y + (ps.rng() - 0.5) * 20,
    vx: (ps.rng() - 0.5) * 6, vy: -8 - ps.rng() * 8,
    t: 0, life: 1.4 + ps.rng(), size: 1.5 + ps.rng() * 1.5,
  });
}

// A footprint: a fading print where a foot landed — the trail tells the story
// of where someone walked. Left and right feet alternate by the step count.
export function spawnPrint(ps, x, y, angle, side) {
  const px = x + Math.cos(angle + Math.PI / 2) * side * 5;
  const py = y + Math.sin(angle + Math.PI / 2) * side * 5;
  ps.list.push({
    kind: 'print', x: px, y: py, vx: 0, vy: 0, angle,
    t: 0, life: 2.4, size: 4,
  });
}

// A state-change ring: expands and fades when a guard turns suspicious or
// the alarm goes up — the transition itself is visible, never a snap.
export function spawnRing(ps, x, y, color) {
  ps.list.push({
    kind: 'ring', x, y, vx: 0, vy: 0, t: 0, life: 0.7, size: 10, color,
  });
}

// The vault opening: a gold rush — twenty sparks burst from the door and a
// wide ring rolls out, so the crack landing reads as a moment, not a number.
export function spawnVaultOpen(ps, x, y) {
  for (let i = 0; i < 20; i += 1) {
    const a = (i / 20) * Math.PI * 2 + jitter(ps.rng, 0.25);
    const sp = 70 + ps.rng() * 110;
    ps.list.push({
      kind: 'gold', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
      t: 0, life: 0.7 + ps.rng() * 0.4, size: 2.5 + ps.rng() * 2.5,
    });
  }
  ps.list.push({
    kind: 'ring', x, y, vx: 0, vy: 0, t: 0, life: 0.9, size: 14, color: 'rgba(242, 193, 78, 0.95)',
  });
}

export function stepParticles(ps, dt) {
  for (const p of ps.list) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'spark' || p.kind === 'gold') p.vy += 130 * dt;
  }
  ps.list = ps.list.filter((p) => p.t < p.life);
}
