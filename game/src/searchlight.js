// Skylight searchlight: a tower-mounted spotlight sweeping a wide, slow beam
// across the lobby floor. It never walks, so the counterplay is pure timing
// — cross while the beam is away, hide in the shadows while it passes. The
// beam is warm white, wide and long, with a bright core line: a machine's
// light, not a person's cone (guard gold), not a camera's thin magenta beam,
// not a laser's straight line — four watchers, four shapes, so the eye never
// has to ask which light is sweeping at it, even at 300 px. A searchlight
// fills the same suspicion meter as a guard or a camera and trips the same
// alarm, but its beam is blocked by walls and desks like a camera's — cover
// still works, you just have to mind the sweep.
import { SEARCHLIGHT } from './config.js';
import { sampleThief, senseBeam } from './sense.js';

export function createSearchlight(def, index) {
  return {
    index,
    x: def.x,
    y: def.y,
    base: def.base,
    sweep: def.sweep,
    period: def.period,
    sweepT: def.phase ?? 0,
    angle: def.base,
    suspicion: 0,
    spotted: false,
    beeped: false,
    lastSeen: null,
  };
}

// The sweep is a sine, so the beam slows at each end — it dwells, then
// turns, like a real searchlight head. No snap, ever.
export function stepSearchlight(sl, dt) {
  sl.sweepT += dt;
  sl.angle = sl.base + Math.sin((sl.sweepT / sl.period) * Math.PI * 2) * sl.sweep;
}

// Set the sweep clock by hand (staged screenshots): the beam lands exactly
// where the shot needs it, and the same clock always gives the same beam.
export function poseSearchlight(sl, sweepT) {
  sl.sweepT = sweepT;
  stepSearchlight(sl, 0);
}

// Is the thief inside this searchlight's beam? 0 when unseen, else 0..1 —
// 1 is point blank. Walls and desks block it, the duct hides the thief.
export function searchlightExposure(sl, player, level) {
  return senseBeam(sl, sampleThief(player), level, SEARCHLIGHT.halfAngle, SEARCHLIGHT.range).exposure;
}
