// Guards: patrol routes you can learn, and a suspicion meter that gives you
// a chance to recover. Movement eases in and out of every leg
// (easeInOutCubic), the facing turns smoothly (turnToward), and a guard on
// pause scans the room with a slow sine sweep — never a snap, never a teleport.
import { GUARD } from './config.js';
import { easeInOutCubic, turnToward } from './motion.js';
import { spawnRing } from './particles.js';

export function createGuard(def, index) {
  const first = def.path[0];
  return {
    index,
    x: first.x,
    y: first.y,
    facing: def.path.length > 1
      ? Math.atan2(def.path[1].y - first.y, def.path[1].x - first.x)
      : -Math.PI / 2,
    path: def.path,
    pause: def.pause ?? 1,
    scan: !!def.scan,
    leg: def.path.length > 1 ? 1 : 0, // index of the waypoint we are heading for
    legT: 0, // 0..1 along the current leg, eased
    legDur: def.path.length > 1 ? legDuration(def.path[0], def.path[1], GUARD.patrolSpeed) : 1,
    pausing: 0, // seconds left of the pause at a waypoint
    scanPhase: index * 1.7,
    state: 'patrol', // patrol | suspicious | alert | search | return
    suspicion: 0,
    coneAngle: def.path.length > 1
      ? Math.atan2(def.path[1].y - first.y, def.path[1].x - first.x)
      : -Math.PI / 2, // the cone lags behind the body turn — follow-through
    anticip: 0, // anticipation beat before a patrol leg starts
    stepSide: 1, // footprints alternate left / right
    lastKnown: null,
    stateT: 0,
    stepT: 0,
    stepped: false, // set for one step when a footstep lands (sound + dust)
    alertDelay: 0, // staggered converge: guards join the alarm one after another
    bob: index * 0.9, // walk-bob phase, so guards do not march in lockstep
  };
}

function legDuration(from, to, speed) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(0.4, dist / speed);
}

// One guard, one step.
export function stepGuard(g, dt, world) {
  g.stepped = false;
  g.stateT += dt;
  g.bob += dt * (g.state === 'alert' ? 11 : 7);
  // Follow-through: the cone chases the body's facing and overshoots a touch,
  // so a turn reads as a sweep, not a snap.
  g.coneAngle = turnToward(g.coneAngle, g.facing, dt * 4.2);

  if (g.state === 'patrol') return stepPatrol(g, dt, world);
  if (g.state === 'suspicious') return stepSuspicious(g, dt, world);
  if (g.state === 'alert') return stepAlert(g, dt, world);
  if (g.state === 'search') return stepSearch(g, dt, world);
  return stepReturn(g, dt, world);
}

function moveAlong(g, dt, target, speed) {
  const dx = target.x - g.x;
  const dy = target.y - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const want = Math.atan2(dy, dx);
  g.facing = turnToward(g.facing, want, dt * 5.5);
  const step = Math.min(dist, speed * dt);
  g.x += (dx / dist) * step;
  g.y += (dy / dist) * step;
  footstep(g, dt);
  return dist - step < 1;
}

function footstep(g, dt) {
  g.stepT += dt;
  if (g.stepT >= GUARD.stepInterval) {
    g.stepT -= GUARD.stepInterval;
    g.stepped = true;
    g.stepSide = -g.stepSide;
  }
}

function stepPatrol(g, dt, world) {
  if (g.path.length < 2) {
    // The watcher: stands and scans. Pause, sweep, pause — the patient route.
    g.pausing += dt;
    const cycle = g.pausing % (g.pause * 2 + 3.2);
    if (cycle < g.pause) {
      g.facing = turnToward(g.facing, -Math.PI / 2 + 0.7, dt * 1.4);
    } else if (cycle < g.pause + 3.2) {
      const s = Math.sin(((cycle - g.pause) / 3.2) * Math.PI * 2);
      g.facing = -Math.PI / 2 + s * 0.75;
    } else {
      g.facing = turnToward(g.facing, -Math.PI / 2 - 0.7, dt * 1.4);
    }
    return null;
  }
  // Anticipation: face the next leg for a beat before moving — the guard
  // telegraphs the turn, so the patrol reads as a decision, not a slide.
  // The beat is 0.35 s: long enough for the eye to catch the head turn and
  // the dotted preview line the renderer draws.
  if (g.anticip > 0) {
    const next = g.path[(g.leg + 1) % g.path.length];
    g.facing = turnToward(g.facing, Math.atan2(next.y - g.y, next.x - g.x), dt * 6);
    g.anticip += dt;
    if (g.anticip >= 0.35) {
      g.anticip = 0;
      g.leg = (g.leg + 1) % g.path.length;
      g.legT = 0;
      g.legDur = legDuration(g.path[g.leg === 0 ? g.path.length - 1 : g.leg - 1], g.path[g.leg], GUARD.patrolSpeed);
    }
    return null;
  }
  if (g.pausing > 0) {
    g.pausing -= dt;
    // Scan while paused: slow sine sweep, so the cone feels alive, not frozen.
    const base = Math.atan2(
      g.path[(g.leg + 1) % g.path.length].y - g.y,
      g.path[(g.leg + 1) % g.path.length].x - g.x,
    );
    g.scanPhase += dt;
    g.facing = base + Math.sin(g.scanPhase * 1.1) * 0.55;
    if (g.pausing <= 0) {
      // The turn is about to happen: a faint ring marks the decision point,
      // so the anticipation beat is visible, not just felt.
      g.anticip = 0.0001; // start the anticipation beat
      spawnRing(world.particles, g.x, g.y, 'rgba(232, 228, 216, 0.45)');
    }
    return null;
  }
  const from = g.path[(g.leg + g.path.length - 1) % g.path.length];
  const to = g.path[g.leg];
  g.legT += dt / g.legDur;
  const e = easeInOutCubic(g.legT); // slow out of the waypoint, slow into it
  g.x = from.x + (to.x - from.x) * e;
  g.y = from.y + (to.y - from.y) * e;
  g.facing = turnToward(g.facing, Math.atan2(to.y - from.y, to.x - from.x), dt * 5.5);
  footstep(g, dt);
  if (g.legT >= 1) {
    g.x = to.x;
    g.y = to.y;
    g.pausing = g.pause;
    g.scanPhase = 0;
  }
  return null;
}

function stepSuspicious(g, dt, world) {
  // Stopped, staring at where you were seen. If you stay hidden, doubt wins.
  if (g.lastKnown) {
    g.facing = turnToward(g.facing, Math.atan2(g.lastKnown.y - g.y, g.lastKnown.x - g.x), dt * 3.2);
  }
  if (g.stateT > 1.6) {
    g.state = g.suspicion > 0.12 ? 'search' : 'return';
    g.stateT = 0;
  }
  return null;
}

function stepAlert(g, dt, world) {
  // Converge on the last known position — staggered, so the alarm rolls in.
  if (g.alertDelay > 0) {
    g.alertDelay -= dt;
    return null;
  }
  const target = g.lastKnown ?? { x: world.player.x, y: world.player.y };
  const arrived = moveAlong(g, dt, target, GUARD.chaseSpeed);
  if (arrived) {
    g.state = 'search';
    g.stateT = 0;
  }
  return null;
}

function stepSearch(g, dt, world) {
  // Sweep the spot where you vanished, then give up and go back.
  g.scanPhase += dt;
  g.facing += Math.sin(g.scanPhase * 1.4) * dt * 1.8;
  if (g.stateT > GUARD.searchSec) {
    g.state = 'return';
    g.stateT = 0;
  }
  return null;
}

function stepReturn(g, dt, world) {
  // Walk back to the nearest patrol waypoint, then resume the route.
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < g.path.length; i += 1) {
    const d = Math.hypot(g.path[i].x - g.x, g.path[i].y - g.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  const arrived = moveAlong(g, dt, g.path[best], GUARD.searchSpeed);
  if (arrived) {
    g.leg = best;
    g.state = 'patrol';
    g.stateT = 0;
    g.suspicion = 0;
    g.pausing = 0.4;
  }
  return null;
}
