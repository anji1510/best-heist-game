// Laser tripwires: a grid of straight beams across a corridor, on a clock.
// Unlike the cameras, lasers do not sweep — they blink on and off, so the
// counterplay is timing the dark: cross while the beams are down. A beam is
// a line, not a cone, so it reads apart from every other watcher at a glance.
// The cycle is warn → on → off: the emitters blink for half a second before
// the beams fire, so the grid never catches the thief without warning.
// A live beam fills the same suspicion meter as a guard or a camera and
// trips the same alarm — the HUD chip says when one has you.
import { LASER } from './config.js';

// Distance from point (px, py) to segment (x1, y1)-(x2, y2).
export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function createLaserGrid(def, index) {
  return {
    index,
    beams: def.beams.map((b) => ({ ...b })),
    period: def.period ?? 3.2, // seconds for one full warn → on → off cycle
    warn: def.warn ?? 0.5, // seconds of blinking warning before the beams fire
    onTime: def.onTime ?? 1.4, // seconds the beams stay live each cycle
    clock: def.phase ?? 0, // the cycle clock — staged shots set this by hand
    state: 'off', // 'warn' | 'on' | 'off'
    suspicion: 0, // 0..1 — fills like a guard's, trips the same alarm
    spotted: false, // true while the thief touches a live beam right now
    beeped: false, // the spot beep fires once per sighting
    lastSeen: null,
  };
}

// Where in the cycle is this clock? The grid is fair because the dark
// (period − warn − onTime) is always longer than the live window.
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

// Is the thief touching a live beam? Returns 0 when safe, else 0..1
// (1 = dead on the line). The beams are light — walls never block them,
// only the clock does.
export function laserExposure(grid, player) {
  if (grid.state !== 'on') return 0;
  let best = Infinity;
  for (const b of grid.beams) {
    const d = distToSegment(player.x, player.y, b.x1, b.y1, b.x2, b.y2);
    if (d < best) best = d;
  }
  if (best > LASER.hitDist) return 0;
  return 0.5 + 0.5 * (1 - best / LASER.hitDist);
}
