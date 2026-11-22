// Security cameras: wall-mounted watchers that sweep a thin beam. They never
// walk, so the counterplay is pure timing — cross while the beam is away.
// A camera fills the same suspicion meter as a guard and trips the same alarm,
// but its cone is cold magenta, never guard gold, so the two watchers read
// apart at a glance — even at 300 px.
import { CAMERA } from './config.js';
import { hasLineOfSight, inCone } from './vision.js';

export function createCamera(def, index) {
  return {
    index,
    x: def.x,
    y: def.y,
    base: def.base, // centre of the sweep, radians
    sweep: def.sweep, // amplitude either side of base, radians
    period: def.period, // seconds for one full sweep
    sweepT: def.phase ?? 0, // sweep clock — staged shots set this by hand
    angle: def.base, // current beam angle, from the sweep clock
    suspicion: 0, // 0..1 — fills like a guard's, trips the same alarm
    spotted: false, // true while the thief is inside the beam right now
    beeped: false, // the spot beep fires once per sighting
    lastSeen: null,
  };
}

// The sweep is a sine, so the beam slows at each end — it dwells, then turns,
// like a real camera head. No snap, ever.
export function stepCamera(cam, dt) {
  cam.sweepT += dt;
  const s = Math.sin((cam.sweepT / cam.period) * Math.PI * 2);
  cam.angle = cam.base + s * cam.sweep;
}

// Set the sweep clock by hand (staged screenshots): the beam lands exactly
// where the shot needs it, and the same clock always gives the same beam.
export function poseCamera(cam, sweepT) {
  cam.sweepT = sweepT;
  stepCamera(cam, 0);
}

// Is the thief inside this camera's beam, with a clear line of sight?
// Returns 0 when unseen, else a 0..1 "how exposed" value (1 = point blank).
export function cameraExposure(cam, player, level) {
  if (!inCone(player.x, player.y, cam.x, cam.y, cam.angle, CAMERA.halfAngle, CAMERA.range)) return 0;
  if (!hasLineOfSight(cam.x, cam.y, player.x, player.y, level)) return 0;
  const dist = Math.hypot(player.x - cam.x, player.y - cam.y);
  const closeness = 1 - dist / CAMERA.range;
  return 0.3 + 0.7 * closeness;
}
