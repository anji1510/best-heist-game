// MIDNIGHT VAULT sensing — the honest-AI boundary.
//
// This is the only module in the game that is allowed to look at the thief.
// Everything a watcher knows comes out of two pure functions here, and each
// one collapses the thief down to a few numbers before any guard, camera or
// searchlight ever sees them:
//
//   senseSight(watcher, sample, level) -> { seen, exposure, zone }
//   senseNoise(watcher, noises, level) -> { heard, tile, strong }
//
// A guard never reads player.x or player.y. It reads a frozen sample, and
// what it remembers is a tile — the last place the thief WAS seen, not
// where the thief is now. That is what makes the hunt fair: the guard can
// be wrong, it can lose you, and you can watch it be wrong.
//
// Sight is graded, never binary. Two wedges share one facing: a forward
// wedge of about 60 degrees at full range, and a peripheral wedge of about
// 120 degrees at half range that fills the meter at a little over half
// speed. A thief at the edge of the wide wedge, far away, in shadow, still
// and crouched is barely a rumour; a thief dead centre, close, lit and
// running is a shout. The meter the world keeps is the forgiveness window
// between those two.
//
// Sound travels as a tile event, not as a position. A pebble or a clunk
// names a tile; walls muffle it to a third of its strength, so noise from
// the next room is a whisper the guards may ignore. The one exception is
// the vault alarm: it is loud and unambiguous, and it names the vault
// itself — a fixed tile on the map — never the thief.
import { GUARD } from './config.js';

// The composite cone. Forward wedge: narrow, full reach, full fill.
// Peripheral wedge: wide, half reach, a little over half fill — the guard
// notices movement at the edge of its vision, but it is slow to believe it.
export const SENSE = {
  fwdHalf: 0.52,
  periHalf: 1.05,
  periRange: 0.5,
  periFill: 0.55,
  wallHear: 0.3,
};

// Freeze the thief into the only shape a watcher may see. Nothing here
// moves, nothing here is live: it is a snapshot, taken once per step.
export function sampleThief(p) {
  return {
    x: p.x,
    y: p.y,
    sneaking: !!p.sneaking,
    moving: !!p.moving,
    inShadow: !!p.inShadow,
    inDuct: !!p.inDuct,
  };
}

// Angle helpers. All angles in radians, all differences wrapped to [-PI, PI].
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function wedgeHas(px, py, cx, cy, facing, half, range) {
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  if (d > range) return { inside: false, dist: d, edge: 0 };
  const off = Math.abs(wrapAngle(Math.atan2(dy, dx) - facing));
  if (off > half) return { inside: false, dist: d, edge: 0 };
  return { inside: true, dist: d, edge: 1 - off / half };
}

// Does segment (x1,y1)-(x2,y2) cross rectangle r? Slab test on each axis.
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let lo = 0;
  let hi = 1;
  for (const [p, d, a, b] of [[x1, dx, r.x, r.x + r.w], [y1, dy, r.y, r.y + r.h]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < a || p > b) return false;
    } else {
      let t0 = (a - p) / d;
      let t1 = (b - p) / d;
      if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
      lo = Math.max(lo, t0);
      hi = Math.min(hi, t1);
      if (lo > hi) return false;
    }
  }
  return true;
}

// Walls, crates and desks block sight; pillars and plants do not — they are
// cover you crouch behind, not walls. Shadow zones never block sight, they
// hide you. The vault door counts as a wall, read as a square.
function sightBlockers(level) {
  const out = [...level.walls, ...level.crates, ...level.desks];
  if (level.vault) {
    const v = level.vault;
    out.push({ x: v.x - v.r, y: v.y - v.r, w: v.r * 2, h: v.r * 2 });
  }
  return out;
}

export function sightlineClear(x1, y1, x2, y2, level) {
  for (const r of sightBlockers(level)) {
    if (segmentHitsRect(x1, y1, x2, y2, r)) return false;
  }
  return true;
}

export function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function inShadowAt(x, y, level) {
  return level.shadows.some((s) => inRect(x, y, s));
}

// The guard's own sight: composite cones, graded exposure, line of sight.
// `w` is any watcher with x, y, facing and (for guards) a state. Returns
// exposure 0 when unseen, else 0..1, plus which wedge caught the thief.
export function senseSight(w, sample, level) {
  const none = { seen: false, exposure: 0, zone: null, dist: 0 };
  if (sample.inDuct) return none;
  const fwdHalf = w.state === 'alert'
    ? GUARD.alertHalfAngle
    : w.state === 'suspicious' ? GUARD.suspectHalfAngle : SENSE.fwdHalf;
  const range = GUARD.viewRange;
  const fwd = wedgeHas(sample.x, sample.y, w.x, w.y, w.facing, fwdHalf, range);
  let zone = null;
  let reach = 0;
  let edge = 0;
  let dist = 0;
  if (fwd.inside) {
    zone = 'forward';
    reach = 1;
    edge = fwd.edge;
    dist = fwd.dist;
  } else {
    const peri = wedgeHas(sample.x, sample.y, w.x, w.y, w.facing, SENSE.periHalf, range * SENSE.periRange);
    if (!peri.inside) return none;
    zone = 'peripheral';
    reach = SENSE.periFill;
    edge = peri.edge;
    dist = peri.dist;
  }
  if (!sightlineClear(w.x, w.y, sample.x, sample.y, level)) return none;
  // Graded exposure: close counts, centred counts, and the zone itself
  // counts — a peripheral glimpse is worth about half a forward stare.
  const closeness = 1 - dist / range;
  const exposure = Math.min(1, (0.25 + 0.75 * (0.55 * closeness + 0.45 * edge)) * reach);
  return { seen: true, exposure, zone, dist };
}

// A beam watcher (camera, searchlight): one thin wedge, no peripheral ring.
// Same sightline rule as a guard, same 0..1 exposure shape.
export function senseBeam(w, sample, level, half, range) {
  const none = { seen: false, exposure: 0, zone: null, dist: 0 };
  if (sample.inDuct) return none;
  const hit = wedgeHas(sample.x, sample.y, w.x, w.y, w.angle, half, range);
  if (!hit.inside) return none;
  if (!sightlineClear(w.x, w.y, sample.x, sample.y, level)) return none;
  const closeness = 1 - hit.dist / range;
  return { seen: true, exposure: 0.3 + 0.7 * closeness, zone: 'forward', dist: hit.dist };
}

// Noise, heard as a tile. Each event names {x, y, loud, radius, strong}.
// A wall between the guard and the noise muffles it to a third of its
// strength — a pebble in the next room is a rumour, not a summons. A strong
// event (the vault alarm) is always heard, and it names the vault tile.
export function senseNoise(w, noises, level) {
  let best = null;
  let strongTile = null;
  for (const n of noises) {
    if (n.strong) { strongTile = { x: n.x, y: n.y }; continue; }
    const d = Math.hypot(n.x - w.x, n.y - w.y);
    let reach = Math.min(n.radius, 520);
    if (!sightlineClear(w.x, w.y, n.x, n.y, level)) reach *= SENSE.wallHear;
    if (d > reach) continue;
    const strength = Math.max(0, 1 - d / reach);
    if (strength <= 0.02) continue;
    if (!best || strength > best.strength) best = { strength, tile: { x: n.x, y: n.y } };
  }
  if (strongTile) return { heard: true, tile: strongTile, strong: true };
  if (!best) return { heard: false, tile: null, strong: false };
  return { heard: true, tile: best.tile, strong: false };
}
