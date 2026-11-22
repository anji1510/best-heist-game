// The thief: Rook. Movement accelerates and decelerates (exponential
// approach — no snapping), sneaking is slower and quieter, and a pickup pops
// with a squash-and-stretch overshoot (easeOutBack) instead of appearing flat.
import { DUCT, PLAYER } from './config.js';
import { clamp, easeOutBack } from './motion.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    facing: -Math.PI / 2,
    sneaking: false,
    moving: false,
    stepT: 0,
    stepped: false,
    stepSide: 1, // footprints alternate left / right
    pop: 0, // pickup squash-and-stretch clock, 0 = idle
    popT: 0,
    stopT: 0, // settle clock after a hard stop — the body dips, then recovers
    prevSpeed: 0, // speed last step, so a sudden stop reads as a stop
    pebbles: 3,
    pebble: null, // {x, y, t} — the thrown distraction, still ringing
    inShadow: false,
    hidden: false,
    inDuct: false, // crawling inside the service duct — unseen, half speed
    cracking: false, // standing at the vault dial — the crack minigame runs
  };
}

function blocked(x, y, level) {
  const blockers = [...level.walls, ...level.crates, ...level.desks];
  for (const r of blockers) {
    if (x > r.x - 10 && x < r.x + r.w + 10 && y > r.y - 10 && y < r.y + r.h + 10) {
      // Circle-vs-rect: clamp to the rect and test the distance.
      const cx = clamp(x, r.x, r.x + r.w);
      const cy = clamp(y, r.y, r.y + r.h);
      if (Math.hypot(x - cx, y - cy) < PLAYER.radius) return true;
    }
  }
  // Pillars are round and solid too.
  for (const p of level.pillars) {
    if (Math.hypot(x - p.x, y - p.y) < PLAYER.radius + 13) return true;
  }
  // The vault door is a round steel wall — you crack it from the floor, not
  // by walking through it. The dial is reachable from 55 px out, and the
  // crack zone starts at 72 px, so the door never locks you out of the crack.
  if (level.vault) {
    const v = level.vault;
    if (Math.hypot(x - v.x, y - v.y) < v.r + PLAYER.radius) return true;
  }
  // Plants are soft: you can brush past them, they only slow you a touch.
  return false;
}

export function stepPlayer(p, dt, input, level) {
  p.stepped = false;
  let ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let iy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(ix, iy);
  if (len > 0) { ix /= len; iy /= len; }
  p.sneaking = !!input.sneak;
  // Inside the duct you crawl — half walk speed, whether or not you sneak.
  // The crawl is the price of being unseen.
  const speed = p.inDuct
    ? PLAYER.walkSpeed * DUCT.crawl
    : p.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  // Cracking the vault roots you to the spot — hands on the dial, feet still.
  const k = 1 - Math.exp(-PLAYER.accel * dt); // eased: velocity chases the target
  p.vx += (p.cracking ? -p.vx : ix * speed - p.vx) * k;
  p.vy += (p.cracking ? -p.vy : iy * speed - p.vy) * k;
  p.moving = Math.hypot(p.vx, p.vy) > 12;
  if (p.moving) p.facing = Math.atan2(p.vy, p.vx);

  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  if (!blocked(nx, p.y, level)) p.x = nx;
  else p.vx = 0;
  if (!blocked(p.x, ny, level)) p.y = ny;
  else p.vy = 0;
  // Stay inside the floor.
  p.x = clamp(p.x, 16 + PLAYER.radius, 1280 - 16 - PLAYER.radius);
  p.y = clamp(p.y, 16 + 16 + PLAYER.radius, 720 - 16 - PLAYER.radius);

  // A hard stop is a beat: run in fast, plant the feet, dip and settle —
  // squash-and-stretch on the stop, not just on the pickup.
  const curSpeed = Math.hypot(p.vx, p.vy);
  if (curSpeed < 12 && p.prevSpeed > 110) p.stopT = 0.22;
  p.prevSpeed = curSpeed;
  if (p.stopT > 0) p.stopT = Math.max(0, p.stopT - dt);

  if (p.moving) {
    p.stepT += dt;
    const interval = p.sneaking ? 0.52 : 0.36;
    if (p.stepT >= interval) {
      p.stepT -= interval;
      p.stepped = true;
      p.stepSide = -p.stepSide;
    }
  }
  if (p.pop > 0) {
    p.popT += dt / 0.38;
    if (p.popT >= 1) { p.pop = 0; p.popT = 0; }
  }
  if (p.pebble) {
    p.pebble.t += dt;
    if (p.pebble.t > 3.5) p.pebble = null;
  }
}

// The squash-and-stretch scale for the pickup pop (1 = normal size).
export function popScale(p) {
  if (!p.pop) return 1;
  return 1 + (easeOutBack(p.popT) - 1) * 0.35 + Math.sin(p.popT * Math.PI) * 0.12;
}

// The settle dip after a hard stop (1 = normal): the body squashes as the
// feet plant, then springs back — one sine, over in a fifth of a second.
export function settleScale(p) {
  if (!p.stopT) return 1;
  return 1 - Math.sin((1 - p.stopT / 0.22) * Math.PI) * 0.1;
}

export function triggerPop(p) {
  p.pop = 1;
  p.popT = 0;
}
