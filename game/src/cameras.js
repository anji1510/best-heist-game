// Security cameras: wall-mounted watchers sweeping one thin beam. They never
// walk, so the counterplay is pure timing — cross while the beam is away.
// A camera fills the same suspicion meter as a guard and trips the same
// alarm, but its beam is cold magenta, never guard gold, so the two watchers
// read apart at a glance — even at 300 px. The beam is one wedge, no
// peripheral ring: a machine stares, it does not glance sideways.
import { CAMERA } from './config.js';
import { sampleThief, senseBeam } from './sense.js';

export function createCamera(def, index) {
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
// turns, like a real camera head. No snap, ever.
export function stepCamera(cam, dt) {
  cam.sweepT += dt;
  cam.angle = cam.base + Math.sin((cam.sweepT / cam.period) * Math.PI * 2) * cam.sweep;
}

// Set the sweep clock by hand (staged screenshots): the beam lands exactly
// where the shot needs it, and the same clock always gives the same beam.
export function poseCamera(cam, sweepT) {
  cam.sweepT = sweepT;
  stepCamera(cam, 0);
}

// Is the thief inside this camera's beam? 0 when unseen, else 0..1 —
// 1 is point blank. Walls block the beam, the duct hides the thief.
export function cameraExposure(cam, player, level) {
  return senseBeam(cam, sampleThief(player), level, CAMERA.halfAngle, CAMERA.range).exposure;
}
