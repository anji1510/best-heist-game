// Skylight searchlight: a tower-mounted spotlight sweeping a wide, slow beam
// across the lobby floor. It never walks, so the counterplay is pure timing
// — cross while the beam is away, hide in the shadows while it passes. The
// beam is warm white, wide and long, with a bright core line: a machine's
// light, not a person's cone (guard gold), not a camera's thin magenta beam,
// not a laser's straight line — four watchers, four shapes, so the eye never
// has to ask which light is sweeping at it, even at 300 px.
// A searchlight fills the same suspicion meter as a guard or a camera and
// trips the same alarm, but its beam is blocked by walls and desks like a
// camera's — cover still works, you just have to mind the sweep.
import { SEARCHLIGHT } from './config.js';
import { hasLineOfSight, inCone } from './vision.js';

export function createSearchlight(def, index) {
  return {
    index,
    x: def.x,
    y: def.y,
    base: def.base, // centre of the sweep, radians (south, down the floor)
    sweep: def.sweep, // amplitude either side of base, radians
    period: def.period, // seconds for one full sweep — slow, so it is learnable
    sweepT: def.phase ?? 0, // sweep clock — staged shots set this by hand
    angle: def.base, // current beam angle, from the sweep clock
    suspicion: 0, // 0..1 — fills like a guard's, trips the same alarm
    spotted: false, // true while the thief is inside the beam right now
    beeped: false, // the spot beep fires once per sighting
    lastSeen: null,
  };
}

// The sweep is a sine, so the beam slows at each end — it dwells, then turns,
// like a real searchlight head. No snap, ever.
export function stepSearchlight(sl, dt) {
  sl.sweepT += dt;
  const s = Math.sin((sl.sweepT / sl.period) * Math.PI * 2);
  sl.angle = sl.base + s * sl.sweep;
}

// Set the sweep clock by hand (staged screenshots): the beam lands exactly
// where the shot needs it, and the same clock always gives the same beam.
export function poseSearchlight(sl, sweepT) {
  sl.sweepT = sweepT;
  stepSearchlight(sl, 0);
}

// Is the thief inside this searchlight's beam, with a clear line of sight?
// Returns 0 when unseen, else a 0..1 "how exposed" value (1 = point blank).
export function searchlightExposure(sl, player, level) {
  if (!inCone(player.x, player.y, sl.x, sl.y, sl.angle, SEARCHLIGHT.halfAngle, SEARCHLIGHT.range)) return 0;
  if (!hasLineOfSight(sl.x, sl.y, player.x, player.y, level)) return 0;
  const dist = Math.hypot(player.x - sl.x, player.y - sl.y);
  const closeness = 1 - dist / SEARCHLIGHT.range;
  return 0.3 + 0.7 * closeness;
}
