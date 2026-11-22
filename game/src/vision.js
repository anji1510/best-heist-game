// Vision: line of sight and the cone test. Everything the watch sees is
// decided here, in plan view — the renderer only draws what this module
// already knows.
import { GUARD } from './config.js';

// Does segment (x1,y1)-(x2,y2) cross rectangle r? (Slab test.)
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  for (const [p, d, lo, hi] of [
    [x1, dx, r.x, r.x + r.w],
    [y1, dy, r.y, r.y + r.h],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
    } else {
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

// Walls, crates and desks block sight; pillars and plants do not (they are
// cover you crouch behind, not walls). Shadow zones never block sight —
// they hide you. The vault door is a wall too (read as a square for sight).
export function hasLineOfSight(x1, y1, x2, y2, level) {
  const blockers = [...level.walls, ...level.crates, ...level.desks];
  if (level.vault) {
    const v = level.vault;
    blockers.push({ x: v.x - v.r, y: v.y - v.r, w: v.r * 2, h: v.r * 2 });
  }
  for (const r of blockers) {
    if (segmentHitsRect(x1, y1, x2, y2, r)) return false;
  }
  return true;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// The shared angle-and-range test for every watcher: is (x, y) inside the
// wedge from (cx, cy), facing `facing`, half-angle `half`, range `range`?
// Guards and cameras both use it, so a beam means the same thing everywhere.
export function inCone(x, y, cx, cy, facing, half, range) {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  const ang = Math.atan2(dy, dx);
  let diff = ang - facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= half;
}

export function inShadow(x, y, level) {
  return level.shadows.some((s) => pointInRect(x, y, s));
}

// Is the thief inside this guard's cone, with a clear line of sight?
// Returns 0 when unseen, else a 0..1 "how exposed" value (1 = point blank).
export function coneExposure(guard, player, level) {
  const half = guard.state === 'alert'
    ? GUARD.alertHalfAngle
    : guard.state === 'suspicious'
      ? GUARD.suspectHalfAngle
      : GUARD.viewHalfAngle;
  if (!inCone(player.x, player.y, guard.x, guard.y, guard.facing, half, GUARD.viewRange)) return 0;
  if (!hasLineOfSight(guard.x, guard.y, player.x, player.y, level)) return 0;
  const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
  const ang = Math.atan2(player.y - guard.y, player.x - guard.x);
  let diff = ang - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const closeness = 1 - dist / GUARD.viewRange; // 1 up close, 0 at the edge
  const edge = 1 - Math.abs(diff) / half; // 1 dead centre, 0 at the cone edge
  return 0.25 + 0.75 * (0.55 * closeness + 0.45 * edge);
}

// Beams need no line of sight — the line IS the sight, only the clock can hide you.
// The searchlight reads through inCone + hasLineOfSight, exactly like a camera.
