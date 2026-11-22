// Laser tripwires: a grid of straight beams across a corridor, on a clock.
// Unlike the cameras, lasers do not sweep — they blink on and off, so the
// counterplay is timing the dark: cross while the beams are down. A beam is
// a line, not a cone, so it reads apart from every other watcher at a
// glance. The cycle is warn → on → off: the emitters blink for half a
// second before the beams fire, so the grid never catches the thief without
// warning. A live beam fills the same suspicion meter as a guard or a
// camera and trips the same alarm — the HUD chip says when one has you.
// The dark is always longer than the live window, so the grid is a timing
// test, never a trap.
import { LASER } from './config.js';

// Distance from point (px, py) to segment (x1, y1)-(x2, y2): clamp the
// projection to the segment, then measure to the closest point on it.
export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const raw = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  const t = Math.max(0, Math.min(1, raw));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function createLaserGrid(def, index) {
  return {
    index,
    beams: def.beams.map((b) => ({ ...b })),
    period: def.period ?? 3.2,
    warn: def.warn ?? 0.5,
    onTime: def.onTime ?? 1.4,
    clock: def.phase ?? 0,
    state: 'off',
    suspicion: 0,
    spotted: false,
    beeped: false,
    lastSeen: null,
  };
}

// Where in the cycle is this clock? Warn, then live, then dark — and the
// dark is always the longest part, by construction.
export function laserState(grid) {
  const ph = grid.clock % grid.period;
  if (ph < grid.warn) return 'warn';
  if (ph < grid.warn + grid.onTime) return 'on';
  return 'off';
}

export function stepLaser(grid, dt) {
  grid.clock += dt;
  grid.state = laserState(grid);
}

// Set the clock by hand (staged screenshots): the grid lands exactly where
// the shot needs it, and the same clock always gives the same beams.
export function poseLaser(grid, clock) {
  grid.clock = clock;
  grid.state = laserState(grid);
}

// Is the thief touching a live beam? 0 when safe, else 0..1 — 1 is dead on
// the line. The beams are light: walls never block them, only the clock
// does, so the fair counterplay is the dark window.
export function laserExposure(grid, player) {
  if (grid.state !== 'on') return 0;
  let closest = Infinity;
  for (const b of grid.beams) {
    const d = distToSegment(player.x, player.y, b.x1, b.y1, b.x2, b.y2);
    if (d < closest) closest = d;
  }
  if (closest > LASER.hitDist) return 0;
  return 0.5 + 0.5 * (1 - closest / LASER.hitDist);
}
