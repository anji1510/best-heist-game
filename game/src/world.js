// MIDNIGHT VAULT — the world: one step ties the thief, the guards, the
// cones and the alarm together. Detection is a meter, not a switch:
// suspicion rises while a guard sees you and decays when you break line of
// sight, so a near miss is a scare you can recover from — and a full alert
// is a chase you can still outrun. The heist has two beats the stealth game
// never had: the vault crack (a dial minigame at the vault door) and the
// getaway (a 45-second clock to the van once the vault is open).
import { CAMERA, CRACK, GETAWAY, GUARD, LASER, SEARCHLIGHT, SHAKE } from './config.js';
import { LEVELS } from './levels.js';
import { createGuard, stepGuard } from './guards.js';
import { createCamera, stepCamera, cameraExposure } from './cameras.js';
import { createLaserGrid, stepLaser, laserExposure } from './lasers.js';
import { createSearchlight, stepSearchlight, searchlightExposure } from './searchlight.js';
import { createDuct, inDuct } from './duct.js';
import { createCrack, startCrack, stepCrack, tryLock } from './crack.js';
import { createPlayer, stepPlayer, triggerPop } from './player.js';
import { inRect, inShadowAt, sampleThief, senseNoise, senseSight } from './sense.js';
import { createParticles, spawnBurst, spawnDust, spawnGlint, spawnAlarmSparks, spawnMote, spawnPrint, spawnRing, spawnVaultOpen, stepParticles } from './particles.js';
import { alarmSting, burstChime, cameraBeep, crackClick, crackClunk, guardStep, keycardBlip, losePhrase, pickupBlip, playerStep, proximityPulse, vaultOpenSound, winPhrase } from './audio.js';
import { approach } from './motion.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL = 'level'; // brief card between rooms

export function createWorld(seed) {
  const world = {
    seed,
    rng: createRandom(seed + 99), // the crack dial's own roll — never the particle roll
    levelIndex: 0,
    level: LEVELS[0],
    player: null,
    guards: [],
    cameras: [], // wall cameras (The Vault) — sweep, spot, and trip the alarm
    camSpotted: false, // true while any camera beam holds the thief right now
    lasers: [], // laser tripwires (The Gallery) — blink on a clock, trip the alarm
    laserSpotted: false, // true while the thief touches a live beam right now
    searchlights: [], // skylight searchlight (The Lobby) — wide, slow, warm white
    slSpotted: false, // true while the searchlight beam holds the thief now
    ducts: [], // service duct (The Vault) — a channel along the north wall, slow but unseen
    inDuct: false, // true while the thief is crawling inside the duct
    crack: createCrack(), // the vault dial — only live in The Vault
    vaultOpen: false, // true once the third tumbler locks
    getaway: 0, // seconds left to reach the van, once the vault is open
    getawayRunning: false,
    caughtReason: '', // 'caught' | 'police' — the lose card names the ending
    loot: [],
    keycard: null,
    keycardTaken: false,
    lootTaken: 0,
    lootTotal: 0,
    score: 0,
    time: 0,
    timeFrozen: null, // staged shots freeze the clock at a readable value
    alarm: false,
    alarmT: 0,
    alarmFlash: 0,
    suspicion: 0, // the highest suspicion of any guard — the HUD eye reads this
    suspicionFlash: 0, // 1 right after a near miss crosses the suspect line
    pebbles: 3,
    shake: 0, // screen-shake trauma, 0..1 — decays, never snaps back
    camX: 640, // the camera drift: eases toward the thief, never snaps
    camY: 360,
    camFollow: true, // C toggles the drift off for a fixed full-floor view
    screen: SCREEN_TITLE,
    screenT: 0,
    transition: 0, // room-change fade, 0..1
    particles: createParticles(seed),
    events: [],
    pendingNoises: [], // noise events this step — heard by the guards, then cleared
    won: false,
    glintT: 0,
    moteT: 0,
  };
  loadLevel(world, 0);
  return world;
}

export function loadLevel(world, index) {
  world.levelIndex = index;
  world.level = LEVELS[index];
  world.player = createPlayer(world.level.player);
  world.guards = world.level.guards.map((d, i) => createGuard(d, i));
  world.cameras = (world.level.cameras ?? []).map((d, i) => createCamera(d, i));
  world.camSpotted = false;
  world.lasers = (world.level.lasers ?? []).map((d, i) => createLaserGrid(d, i));
  world.laserSpotted = false;
  world.searchlights = (world.level.searchlights ?? []).map((d, i) => createSearchlight(d, i));
  world.slSpotted = false;
  world.ducts = (world.level.ducts ?? []).map((d, i) => createDuct(d, i));
  world.inDuct = false;
  world.crack = createCrack();
  world.vaultOpen = false;
  world.getaway = 0;
  world.getawayRunning = false;
  world.caughtReason = '';
  world.shake = 0;
  world.loot = world.level.loot.map((p) => ({ x: p.x, y: p.y, taken: false }));
  world.keycard = { x: world.level.keycard.x, y: world.level.keycard.y, taken: false };
  world.keycardTaken = false;
  world.lootTaken = 0;
  world.lootTotal = world.loot.length;
  world.alarm = false;
  world.alarmT = 0;
  world.suspicion = 0;
  world.pebbles = 3;
  world.particles = createParticles(world.seed + index * 7919);
}

export function startGame(world) {
  world.score = 0;
  world.time = 0;
  loadLevel(world, 0);
  world.screen = SCREEN_PLAY;
  world.screenT = 0;
}

export function nextLevel(world) {
  const bonus = 250 + Math.max(0, 300 - Math.floor(world.time));
  world.score += bonus;
  if (world.levelIndex + 1 >= LEVELS.length) {
    world.screen = SCREEN_WIN;
    world.screenT = 0;
    world.won = true;
    return;
  }
  world.screen = SCREEN_LEVEL;
  world.screenT = 0;
  world.transition = 0;
  loadLevel(world, world.levelIndex + 1);
}

// Throw a pebble: it lands as a noise event on a tile. Guards that hear it
// walk over to investigate — walls muffle it, so a pebble thrown in the
// next room may be ignored. Nobody picks a guard for them any more; the
// hearing decides, tile by tile.
export function throwPebble(world, x, y, audio) {
  if (world.pebbles <= 0 || world.screen !== SCREEN_PLAY) return false;
  world.pebbles -= 1;
  world.player.pebble = { x, y, t: 0 };
  world.pendingNoises.push({ x, y, loud: 1, radius: 520 });
  return true;
}

// SPACE at the vault: lock a tumbler. Called from the input action.
export function crackAttempt(world, audio) {
  if (world.screen !== SCREEN_PLAY || !world.crack.active) return;
  const result = tryLock(world.crack, world.rng);
  if (result === 'lock') {
    crackClick(audio);
    world.score += 50;
    world.events.push('crack-lock');
  } else if (result === 'miss') {
    crackClunk(audio);
    world.shake = Math.max(world.shake, SHAKE.crack);
    // A loud miss: the nearest guard's suspicion jumps — the room hears it.
    let best = null;
    let bestD = Infinity;
    for (const g of world.guards) {
      const d = Math.hypot(g.x - world.player.x, g.y - world.player.y);
      if (d < bestD) { bestD = d; best = g; }
    }
    if (best) {
      best.suspicion = Math.min(1, best.suspicion + CRACK.missSuspicion);
      best.lastKnown = { x: world.player.x, y: world.player.y };
      if (best.suspicion >= GUARD.alertAt && best.state !== 'alert') raiseAlarm(world, best, audio);
      else if (best.suspicion >= GUARD.suspectAt && best.state === 'patrol') {
        best.state = 'suspicious';
        best.stateT = 0;
        world.suspicionFlash = 1;
      }
    }
    world.events.push('crack-miss');
  } else if (result === 'open') {
    crackClick(audio);
    vaultOpenSound(audio);
    openVault(world);
    world.events.push('vault-open');
  }
}

function openVault(world) {
  world.vaultOpen = true;
  world.player.cracking = false;
  world.score += 250;
  const v = world.level.vault;
  spawnVaultOpen(world.particles, v.x, v.y);
  // The gold inside the vault: three bars by the door, grabbable now.
  // All three sit on open floor, clear of the duct wall and the vault wall.
  const gold = [
    { x: v.x - 64, y: v.y + 16 },
    { x: v.x - 48, y: v.y + 56 },
    { x: v.x - 88, y: v.y - 8 },
  ];
  for (const g of gold) world.loot.push({ x: g.x, y: g.y, taken: false, vault: true });
  world.lootTotal = world.loot.length;
  // The getaway clock starts the moment the door swings: 45 seconds to the van.
  world.getaway = GETAWAY.seconds;
  world.getawayRunning = true;
}

export function stepWorld(world, dt, input, audio) {
  world.events = [];
  if (world.screen === SCREEN_LEVEL) {
    world.screenT += dt;
    world.transition = Math.min(1, world.screenT / 0.6);
    if (world.screenT > 1.4) {
      world.screen = SCREEN_PLAY;
      world.screenT = 0;
    }
    return;
  }
  if (world.screen !== SCREEN_PLAY) return;

  world.time += dt;
  world.screenT += dt;
  if (world.suspicionFlash > 0) world.suspicionFlash = Math.max(0, world.suspicionFlash - dt * 1.6);
  if (world.alarmFlash > 0) world.alarmFlash = Math.max(0, world.alarmFlash - dt * 1.2);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - SHAKE.decayPerSec * dt);

  // The getaway clock: once the vault is open, every second counts down to
  // the police arriving. At zero the crew is caught in the street.
  if (world.getawayRunning) {
    world.getaway -= dt;
    if (world.getaway <= 0) {
      world.getaway = 0;
      world.getawayRunning = false;
      world.screen = SCREEN_CAUGHT;
      world.screenT = 0;
      world.caughtReason = 'police';
      losePhrase(audio);
      world.events.push('police');
      return;
    }
  }

  // The thief. The duct state is read from the position BEFORE the thief
  // moves, so the crawl speed applies from the first step inside the duct —
  // and lifts the moment they step out through a grate.
  const p0 = world.player;
  p0.inDuct = world.ducts.some((v) => inDuct(v, p0.x, p0.y));
  world.inDuct = p0.inDuct;
  // The vault: with the keycard, standing at the dial starts the crack —
  // the thief roots to the spot and the dial takes over SPACE. Never from
  // inside the duct: the crack zone (72 px) reaches into the channel, and
  // a thief who crawls into it would root to the spot mid-duct, stuck in
  // the vent with the dial 70 px away through the wall. The dial is worked
  // from the floor, so the crack only starts once the thief is out.
  const vault = world.level.vault;
  if (vault && world.keycardTaken && !world.vaultOpen) {
    const near = Math.hypot(p0.x - vault.x, p0.y - vault.y) < vault.r + 28;
    if (near && !p0.inDuct && !world.crack.active) {
      startCrack(world.crack, world.rng);
      world.player.cracking = true;
    } else if (!near && world.crack.active) {
      world.crack.active = false;
      world.player.cracking = false;
    }
  }
  stepPlayer(world.player, dt, input, world.level);
  stepCrack(world.crack, dt);
  const p = world.player;
  p.inShadow = inShadowAt(p.x, p.y, world.level);
  p.hidden = p.inDuct || (p.inShadow && !p.moving);
  // The camera drift eases toward the thief (critically damped — it settles,
  // never overshoots), so the frame leans into the action without ever
  // leaving the floor. Staged shots set camX/camY by hand instead.
  if (world.camFollow) {
    world.camX = approach(world.camX, p.x, 2.2, dt);
    world.camY = approach(world.camY, p.y, 2.2, dt);
  }
  if (p.stepped) {
    playerStep(audio);
    spawnDust(world.particles, p.x, p.y + 8);
    spawnPrint(world.particles, p.x, p.y + 8, p.facing, p.stepSide);
  }

  // Pickups: loot pops with squash-and-stretch AND a gold burst — the grab
  // has weight now — and a small shake kick; the keycard unlocks the exit.
  // No pickups from inside the duct — the channel is for travelling, not
  // for looting. The bar just outside the far grate is the reward instead.
  for (const l of world.loot) {
    if (!l.taken && !p.inDuct && Math.hypot(l.x - p.x, l.y - p.y) < 24) {
      l.taken = true;
      world.lootTaken += 1;
      world.score += 100;
      triggerPop(p);
      spawnBurst(world.particles, l.x, l.y);
      world.shake = Math.max(world.shake, SHAKE.loot);
      pickupBlip(audio);
      burstChime(audio);
      world.events.push('loot');
    }
  }
  // The keycard sits on the manager's desk in the Lobby — you reach across
  // the desk to grab it, so the reach is 32 px, not 26: the closest a thief
  // can stand to that desk is 26.4 px away, and at 26 the card was
  // unreachable and the whole game unwinnable. (Found by the headless
  // playtest: min approach distance 26.414 > 26.)
  if (!world.keycard.taken && !p.inDuct && Math.hypot(world.keycard.x - p.x, world.keycard.y - p.y) < 32) {
    world.keycard.taken = true;
    world.keycardTaken = true;
    world.score += 50;
    triggerPop(p);
    keycardBlip(audio);
    world.events.push('keycard');
  }

  // The exit: only open with the keycard, and only then does reaching it win.
  // In The Vault the exit IS the getaway van — and it only counts once the
  // vault is open, so the thief cannot skip the crack and run.
  const ex = world.level.exit;
  const exitOpen = world.keycardTaken && (!vault || world.vaultOpen);
  if (exitOpen && inRect(p.x, p.y, { x: ex.x - 6, y: ex.y - 6, w: ex.w + 12, h: ex.h + 12 })) {
    winPhrase(audio);
    nextLevel(world);
    return;
  }

  // The guards: see, suspect, chase — and let you go when you vanish.
  // One frozen sample of the thief per step: every guard reads the same
  // snapshot, and none of them ever sees the live player.
  const thief = sampleThief(p);
  let maxSuspicion = 0;
  let nearest = Infinity;
  for (const g of world.guards) {
    // A thief inside the duct is unseen — the duct walls hide them, and no
    // guard can spot, suspect, or catch what it cannot see.
    const sight = senseSight(g, thief, world.level);
    const exposure = sight.exposure;
    // Noise: a pebble or a clunk names a tile. A patrolling guard that
    // hears it walks over to look — walls muffle it, so a pebble in the
    // next room may be ignored entirely.
    if (world.pendingNoises.length > 0) {
      const heard = senseNoise(g, world.pendingNoises, world.level);
      if (heard.heard && !heard.strong && (g.state === 'patrol' || g.state === 'return')) {
        g.lastKnown = heard.tile;
        g.state = 'investigate';
        g.stateT = 0;
      }
    }
    const near = Math.hypot(g.x - p.x, g.y - p.y);
    if (near < nearest) nearest = near;
    if (exposure > 0) {
      let rate = GUARD.risePerSec * exposure;
      if (p.sneaking) rate *= 0.55;
      if (p.inShadow) rate *= 0.25;
      if (!p.moving) rate *= 0.8;
      const before = g.suspicion;
      g.suspicion = Math.min(1, g.suspicion + rate * dt);
      g.lastKnown = { x: p.x, y: p.y };
      if (before < GUARD.suspectAt && g.suspicion >= GUARD.suspectAt && g.state === 'patrol') {
        g.state = 'suspicious';
        g.stateT = 0;
        world.suspicionFlash = 1;
        world.shake = Math.max(world.shake, SHAKE.suspect); // the near miss jolts
        spawnRing(world.particles, g.x, g.y, 'rgba(255, 180, 60, 0.85)');
        world.events.push('suspect');
      }
      if (g.suspicion >= GUARD.alertAt && g.state !== 'alert') {
        raiseAlarm(world, g, audio);
      }
    } else if (g.state === 'patrol' || g.state === 'suspicious' || g.state === 'search') {
      // No fresh sighting: the meter drains in every non-alert state — a guard
      // sweeping the room where you vanished still calms down, so recovery
      // is real and not just a patrol-state accident.
      g.suspicion = Math.max(0, g.suspicion - GUARD.fallPerSec * dt);
      if (g.state === 'suspicious' && g.suspicion < 0.1) {
        g.state = 'return';
        g.stateT = 0;
      }
    } else if (g.state === 'alert') {
      // No fresh sighting: the alarm clock runs down, then the hunt ends.
      g.suspicion = Math.max(0, g.suspicion - (GUARD.fallPerSec * 0.5) * dt);
    }
    if (g.suspicion > maxSuspicion) maxSuspicion = g.suspicion;
    stepGuard(g, dt, world);
    if (g.stepped) {
      guardStep(audio, g, p);
      spawnPrint(world.particles, g.x, g.y + 8, g.facing, g.stepSide);
    }
    // Caught: an alert guard close enough to grab you — never inside the duct.
    if (g.state === 'alert' && !p.inDuct && Math.hypot(g.x - p.x, g.y - p.y) < GUARD.catchRange) {
      world.screen = SCREEN_CAUGHT;
      world.screenT = 0;
      world.caughtReason = 'caught';
      losePhrase(audio);
      world.events.push('caught');
      return;
    }
  }

  // The cameras: they sweep, they spot, and they fill the same meter. A camera
  // beam is thinner than a guard's cone but it never gets tired — the fair
  // counterplay is timing the sweep, and the HUD chip says when one has you.
  world.camSpotted = false;
  for (const cam of world.cameras) {
    stepCamera(cam, dt);
    // The duct hides the thief from the cameras too — the whole point of the
    // route is slipping past the beams unseen.
    const exposure = p.inDuct ? 0 : cameraExposure(cam, p, world.level);
    cam.spotted = exposure > 0;
    if (cam.spotted) {
      world.camSpotted = true;
      let rate = CAMERA.risePerSec * exposure;
      if (p.sneaking) rate *= 0.55;
      if (p.inShadow) rate *= 0.25;
      if (!p.moving) rate *= 0.8;
      cam.suspicion = Math.min(1, cam.suspicion + rate * dt);
      cam.lastSeen = { x: p.x, y: p.y };
      if (exposure > 0.5 && !cam.beeped) {
        cam.beeped = true;
        cameraBeep(audio, cam, p);
      }
      if (cam.suspicion >= 1 && !world.alarm) {
        raiseAlarm(world, null, audio); // a camera trips the alarm
      }
    } else {
      cam.suspicion = Math.max(0, cam.suspicion - CAMERA.fallPerSec * dt);
      cam.beeped = false;
    }
    if (cam.suspicion > maxSuspicion) maxSuspicion = cam.suspicion;
  }

  // The lasers: they blink on a clock — cross while the beams are down.
  // A live beam fills the same meter and trips the same alarm; the HUD chip
  // names the watcher, just like the cameras'. The dark is always longer
  // than the live window, so the grid is a timing test, never a trap.
  world.laserSpotted = false;
  for (const grid of world.lasers) {
    stepLaser(grid, dt);
    const exposure = laserExposure(grid, p);
    grid.spotted = exposure > 0;
    if (grid.spotted) {
      world.laserSpotted = true;
      let rate = LASER.risePerSec * exposure;
      if (p.sneaking) rate *= 0.55;
      if (p.inShadow) rate *= 0.25;
      if (!p.moving) rate *= 0.8;
      grid.suspicion = Math.min(1, grid.suspicion + rate * dt);
      grid.lastSeen = { x: p.x, y: p.y };
      if (exposure > 0.5 && !grid.beeped) {
        grid.beeped = true;
        const b = grid.beams[0];
        cameraBeep(audio, { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 }, p);
      }
      if (grid.suspicion >= 1 && !world.alarm) {
        raiseAlarm(world, null, audio); // a laser trips the alarm
      }
    } else {
      grid.suspicion = Math.max(0, grid.suspicion - LASER.fallPerSec * dt);
      grid.beeped = false;
    }
    if (grid.suspicion > maxSuspicion) maxSuspicion = grid.suspicion;
  }

  // The searchlight: a wide, slow sweep over the open floor — cross while
  // the beam is away. It fills the same meter and trips the same alarm;
  // the HUD chip names the watcher, just like the cameras' and lasers'.
  // Walls and desks block it, so the cover you already know still works.
  world.slSpotted = false;
  for (const sl of world.searchlights) {
    stepSearchlight(sl, dt);
    const exposure = searchlightExposure(sl, p, world.level);
    sl.spotted = exposure > 0;
    if (sl.spotted) {
      world.slSpotted = true;
      let rate = SEARCHLIGHT.risePerSec * exposure;
      if (p.sneaking) rate *= 0.55;
      if (p.inShadow) rate *= 0.25;
      if (!p.moving) rate *= 0.8;
      sl.suspicion = Math.min(1, sl.suspicion + rate * dt);
      sl.lastSeen = { x: p.x, y: p.y };
      if (exposure > 0.5 && !sl.beeped) {
        sl.beeped = true;
        cameraBeep(audio, sl, p);
      }
      if (sl.suspicion >= 1 && !world.alarm) {
        raiseAlarm(world, null, audio); // a searchlight trips the alarm
      }
    } else {
      sl.suspicion = Math.max(0, sl.suspicion - SEARCHLIGHT.fallPerSec * dt);
      sl.beeped = false;
    }
    if (sl.suspicion > maxSuspicion) maxSuspicion = sl.suspicion;
  }
  world.suspicion = maxSuspicion;

  // The alarm: while it holds, every guard converges — staggered, one by one.
  if (world.alarm) {
    world.alarmT += dt;
    if (world.alarmT > GUARD.alertHoldSec) {
      world.alarm = false;
      for (const g of world.guards) {
        if (g.state === 'alert') { g.state = 'search'; g.stateT = 0; }
      }
    }
  }
  proximityPulse(audio, dt, nearest);

  // Ambient life: loot glints and exit motes, on a slow seeded clock.
  world.glintT += dt;
  if (world.glintT > 1.1) {
    world.glintT = 0;
    const left = world.loot.filter((l) => !l.taken);
    if (left.length) {
      const l = left[Math.floor(world.particles.rng() * left.length)];
      spawnGlint(world.particles, l.x, l.y - 6);
    }
  }
  world.moteT += dt;
  if (world.moteT > 0.5) {
    world.moteT = 0;
    spawnMote(world.particles, ex.x + ex.w / 2, ex.y + ex.h / 2);
  }
  // Noise heard this step is spent — a pebble echoes once, not forever.
  world.pendingNoises = [];
  stepParticles(world.particles, dt);
}

function raiseAlarm(world, guard, audio) {
  // `guard` is null when a camera trips the alarm — the guards still converge,
  // they just were not the one who saw you.
  if (guard) {
    guard.state = 'alert';
    guard.stateT = 0;
    guard.alertDelay = 0;
    spawnAlarmSparks(world.particles, guard.x, guard.y - 14);
    spawnRing(world.particles, guard.x, guard.y, 'rgba(255, 74, 60, 0.9)');
  } else {
    for (const cam of world.cameras) {
      if (cam.suspicion >= 1) spawnRing(world.particles, cam.x, cam.y, 'rgba(255, 90, 200, 0.9)');
    }
    for (const grid of world.lasers) {
      if (grid.suspicion >= 1) {
        const b = grid.beams[0];
        spawnRing(world.particles, (b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, 'rgba(255, 90, 200, 0.9)');
      }
    }
    for (const sl of world.searchlights) {
      if (sl.suspicion >= 1) spawnRing(world.particles, sl.x, sl.y, 'rgba(255, 248, 225, 0.9)');
    }
  }
  world.alarm = true;
  world.alarmT = 0;
  world.alarmFlash = 1;
  world.shake = SHAKE.alarm; // the alarm hits like a door slamming
  alarmSting(audio);
  world.events.push('alarm');
  // The others converge a beat later each — the alarm rolls in, it does not snap.
  world.guards.forEach((g, i) => {
    if (g !== guard && (g.state === 'patrol' || g.state === 'suspicious' || g.state === 'search')) {
      g.state = 'alert';
      g.stateT = 0;
      g.alertDelay = 0.18 * (i + 1);
      g.lastKnown = { x: world.player.x, y: world.player.y };
    }
  });
}
