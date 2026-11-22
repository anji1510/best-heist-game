// MIDNIGHT VAULT guard brain — patrol, glance, investigate, search, chase,
// return. One guard, one mind: it walks a route it can learn, it gets
// suspicious in stages instead of snapping, and what it remembers is a tile
// — the last place the thief was seen — never the thief's live position.
// A guard can be wrong. It can lose you. That is the whole game.
//
// States, one behaviour and one tell each:
//   patrol      walk the route, pause and scan at each waypoint, cone calm.
//   suspicious  stop, stare at the last-known tile for 1.6 s ("?").
//   investigate walk to the last-known tile and look around it.
//   search      sweep the spot where you vanished for 4 s, then give up.
//   alert       converge on the last-known tile, staggered — the chase.
//   return      walk to the nearest waypoint, then resume the route.
// world.js owns the suspicion meter; this brain only moves and decides.
import { GUARD } from './config.js';
import { easeInOutCubic, turnToward } from './motion.js';
import { spawnRing } from './particles.js';

// How long a guard stares before it decides, and how long it sweeps a spot
// it has searched before it gives up and walks home.
const GLANCE_HOLD = 1.6;
const ANTICIP_BEAT = 0.35;
const TURN_RATE = 5.5;
const CONE_LAG = 4.2;

function legSeconds(a, b, speed) {
  return Math.max(0.4, Math.hypot(b.x - a.x, b.y - a.y) / speed);
}

export function createGuard(def, index) {
  const first = def.path[0];
  const second = def.path.length > 1 ? def.path[1] : null;
  const startFacing = second
    ? Math.atan2(second.y - first.y, second.x - first.x)
    : -Math.PI / 2;
  return {
    index,
    x: first.x,
    y: first.y,
    facing: startFacing,
    path: def.path,
    pause: def.pause ?? 1,
    scan: !!def.scan,
    leg: second ? 1 : 0,
    legT: 0,
    legDur: second ? legSeconds(first, second, GUARD.patrolSpeed) : 1,
    pausing: 0,
    scanPhase: index * 1.7,
    state: 'patrol',
    suspicion: 0,
    coneAngle: startFacing,
    anticip: 0,
    stepSide: 1,
    lastKnown: null,
    stateT: 0,
    stepT: 0,
    stepped: false,
    alertDelay: 0,
    bob: index * 0.9,
  };
}

// One guard, one step. The cone chases the body's facing and overshoots a
// touch, so a turn reads as a sweep, never a snap.
export function stepGuard(g, dt, world) {
  g.stepped = false;
  g.stateT += dt;
  g.bob += dt * (g.state === 'alert' ? 11 : 7);
  g.coneAngle = turnToward(g.coneAngle, g.facing, dt * CONE_LAG);
  switch (g.state) {
    case 'patrol': return walkRoute(g, dt, world);
    case 'suspicious': return glance(g, dt);
    case 'investigate': return investigate(g, dt, world);
    case 'alert': return chase(g, dt, world);
    case 'search': return sweepSpot(g, dt);
    default: return walkHome(g, dt);
  }
}

// Walk toward a point at a speed, turning the body as you go. Returns true
// on arrival. Footsteps tick on a fixed interval, alternating feet.
function walkTo(g, dt, tx, ty, speed) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  g.facing = turnToward(g.facing, Math.atan2(dy, dx), dt * TURN_RATE);
  const step = Math.min(d, speed * dt);
  g.x += (dx / d) * step;
  g.y += (dy / d) * step;
  g.stepT += dt;
  if (g.stepT >= GUARD.stepInterval) {
    g.stepT -= GUARD.stepInterval;
    g.stepped = true;
    g.stepSide = -g.stepSide;
  }
  return d - step < 1;
}

// The route: ease along each leg, pause and scan at each waypoint, and
// telegraph the next turn with a 0.35 s anticipation beat — the guard faces
// the next leg before its feet move, and the renderer draws the dotted
// preview, so a patrol reads as a decision, not a slide.
function walkRoute(g, dt, world) {
  if (g.path.length < 2) {
    // The watcher: no route, just a post. Pause, sweep, pause — patient.
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
    return;
  }
  if (g.anticip > 0) {
    const next = g.path[(g.leg + 1) % g.path.length];
    g.facing = turnToward(g.facing, Math.atan2(next.y - g.y, next.x - g.x), dt * 6);
    g.anticip += dt;
    if (g.anticip >= ANTICIP_BEAT) {
      g.anticip = 0;
      g.leg = (g.leg + 1) % g.path.length;
      g.legT = 0;
      const from = g.path[(g.leg + g.path.length - 1) % g.path.length];
      g.legDur = legSeconds(from, g.path[g.leg], GUARD.patrolSpeed);
    }
    return;
  }
  if (g.pausing > 0) {
    g.pausing -= dt;
    const next = g.path[(g.leg + 1) % g.path.length];
    const base = Math.atan2(next.y - g.y, next.x - g.x);
    g.scanPhase += dt;
    g.facing = base + Math.sin(g.scanPhase * 1.1) * 0.55;
    if (g.pausing <= 0) {
      g.anticip = 0.0001; // the turn is about to happen: start the beat
      spawnRing(world.particles, g.x, g.y, 'rgba(232, 228, 216, 0.45)');
    }
    return;
  }
  const from = g.path[(g.leg + g.path.length - 1) % g.path.length];
  const to = g.path[g.leg];
  g.legT += dt / g.legDur;
  const e = easeInOutCubic(g.legT); // slow out of the waypoint, slow into it
  g.x = from.x + (to.x - from.x) * e;
  g.y = from.y + (to.y - from.y) * e;
  g.facing = turnToward(g.facing, Math.atan2(to.y - from.y, to.x - from.x), dt * TURN_RATE);
  g.stepT += dt;
  if (g.stepT >= GUARD.stepInterval) {
    g.stepT -= GUARD.stepInterval;
    g.stepped = true;
    g.stepSide = -g.stepSide;
  }
  if (g.legT >= 1) {
    g.x = to.x;
    g.y = to.y;
    g.pausing = g.pause;
    g.scanPhase = 0;
  }
}

// Glance: stopped, staring at the last-known tile. If the meter is still
// up after the hold, walk over and look; if doubt wins, walk home.
function glance(g, dt) {
  if (g.lastKnown) {
    g.facing = turnToward(g.facing, Math.atan2(g.lastKnown.y - g.y, g.lastKnown.x - g.x), dt * 3.2);
  }
  if (g.stateT > GLANCE_HOLD) {
    g.state = g.suspicion > 0.12 ? 'investigate' : 'return';
    g.stateT = 0;
  }
}

// Investigate: walk to the tile where the thief was last seen and look
// around it. If the trail is cold for 22 s, give up and walk home.
function investigate(g, dt, world) {
  if (!g.lastKnown) {
    g.state = 'patrol';
    g.stateT = 0;
    return;
  }
  if (g.stateT > 22) {
    g.lastKnown = null;
    g.state = 'return';
    g.stateT = 0;
    return;
  }
  if (walkTo(g, dt, g.lastKnown.x, g.lastKnown.y, GUARD.searchSpeed)) {
    g.state = 'search';
    g.stateT = 0;
  }
}

// Chase: converge on the last-known tile, staggered so the alarm rolls in
// one guard at a time instead of snapping. On arrival without a fresh
// sighting, sweep the spot.
function chase(g, dt, world) {
  if (g.alertDelay > 0) {
    g.alertDelay -= dt;
    return;
  }
  const target = g.lastKnown ?? { x: world.player.x, y: world.player.y };
  if (walkTo(g, dt, target.x, target.y, GUARD.chaseSpeed)) {
    g.state = 'search';
    g.stateT = 0;
  }
}

// Search: sweep the spot where the thief vanished, then give up.
function sweepSpot(g, dt) {
  g.scanPhase += dt;
  g.facing += Math.sin(g.scanPhase * 1.4) * dt * 1.8;
  if (g.stateT > GUARD.searchSec) {
    g.state = 'return';
    g.stateT = 0;
  }
}

// Return: walk to the nearest patrol waypoint, then resume the route.
function walkHome(g, dt) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < g.path.length; i += 1) {
    const d = Math.hypot(g.path[i].x - g.x, g.path[i].y - g.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (walkTo(g, dt, g.path[best].x, g.path[best].y, GUARD.searchSpeed)) {
    g.leg = best;
    g.state = 'patrol';
    g.stateT = 0;
    g.suspicion = 0;
    g.pausing = 0.4;
  }
}
