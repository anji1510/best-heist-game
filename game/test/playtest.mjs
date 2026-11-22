// Headless deterministic playtest for MIDNIGHT VAULT.
//
// No browser, no render, no human: the simulation runs in Node with a
// stubbed audio object, and a scripted bot walks the three rooms with
// position-based waypoints. Four checks:
//
//   1. WIN — the bot plays all three rooms (keycard, vault crack, gold,
//      getaway van) and reaches SCREEN_WIN.
//   2. CAUGHT — walking into a guard's cone and standing there gets the
//      thief caught, so the danger is real.
//   3. GETAWAY TIMEOUT — opening the vault and standing still lets the
//      45 s police clock run out, so the getaway is a real deadline.
//   4. DETERMINISM — the whole win run, replayed, produces a byte-identical
//      fingerprint (screen, score, time, positions), so the sim is
//      seed-only and the entry is reproducible.
//
// Run: node game/test/playtest.mjs   (exit 0 = all four pass)
import { createWorld, startGame, stepWorld, crackAttempt, throwPebble } from '../src/world.js';

const DT = 1 / 60;
const AUDIO = { enabled: false }; // stub: every sound call no-ops on it
const T = 32; // one tile, px
const px = (tx, ty) => ({ x: tx * T + T / 2, y: ty * T + T / 2 });

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
  throw new Error(msg);
}

const TRACE = !!process.env.PLAYTEST_TRACE;

function step(world, input = {}) {
  stepWorld(world, DT, input, AUDIO);
  if (TRACE) {
    traceN += 1;
    if (traceN % 60 === 0) {
      const g = world.guards.map((gg, i) => `g${i + 1}:${gg.state}@(${Math.round(gg.x)},${Math.round(gg.y)})s${gg.suspicion.toFixed(2)}`).join(' ');
      console.log(`  [${world.levelIndex + 1}] t=${world.time.toFixed(0)} player(${Math.round(world.player.x)},${Math.round(world.player.y)}) alarm=${world.alarm} ${g}`);
    }
  }
}
let traceN = 0;

// Step through a level transition (SCREEN_LEVEL lasts 1.4 s) if one is running.
function settle(world, maxSec = 3) {
  let n = 0;
  while (world.screen === 'level' && n < maxSec * 60) { step(world); n += 1; }
  return world.screen;
}

// Walk toward (tx, ty) until within `within` px, or the step budget runs
// out, or the screen leaves play. Sneak halves the speed and the exposure
// fill, so the bot sneaks whenever it is near a patrol.
function go(world, tx, ty, { within = 16, sneak = false, maxSec = 60, until } = {}) {
  // Reaching the exit advances the level — that IS the arrival, even
  // though the target tile now sits in the next room.
  const level0 = world.levelIndex;
  let n = 0;
  while (n < maxSec * 60) {
    if (world.screen === 'level') { settle(world); continue; }
    if (world.levelIndex > level0) return { arrived: true, steps: n, screen: world.screen };
    // Reaching the van in the last room wins the game — the screen flips
    // to 'win' instead of advancing a level, and that is the arrival.
    if (world.screen === 'win') return { arrived: true, steps: n, screen: world.screen };
    if (world.screen !== 'play') return { arrived: false, steps: n, screen: world.screen };
    if (until && until()) return { arrived: true, steps: n, screen: world.screen };
    const p = world.player;
    const dx = tx - p.x;
    const dy = ty - p.y;
    if (Math.hypot(dx, dy) <= within) return { arrived: true, steps: n, screen: world.screen };
    // No deadzone: the bot must press toward the target on any nonzero
    // delta, or it wedges against a round wall — 2 px short of the
    // direction it needs — and never slides around it. The arrival check
    // (within N px) stops it before any jitter matters.
    step(world, {
      up: dy < 0, down: dy > 0, left: dx < 0, right: dx > 0, sneak,
    });
    n += 1;
  }
  const p = world.player;
  return { arrived: Math.hypot(tx - p.x, ty - p.y) <= within, steps: n, screen: world.screen };
}

// Wait until a condition holds (a guard is at the far end of its patrol,
// a laser grid is dark), stepping the sim meanwhile. The bot never walks
// into a patrol blind — it waits for the opening, like a player would.
function waitUntil(world, fn, maxSec = 40) {
  let n = 0;
  while (n < maxSec * 60) {
    if (fn()) return true;
    if (world.screen !== 'play') return false;
    step(world);
    n += 1;
  }
  return fn();
}

function at(world, tx, ty, opts = {}) {
  // A waypoint can also end on a condition, not just proximity: the Lobby
  // keycard sits on a desk, so the bot stops at the desk's edge and the
  // pickup — not the tile — is the arrival.
  const until = opts.until;
  const r = go(world, tx * T + T / 2, ty * T + T / 2, opts);
  if (!r.arrived && !(until && until())) fail(`bot never reached (${tx}, ${ty}) — screen ${r.screen}, player at (${Math.round(world.player.x)}, ${Math.round(world.player.y)})`);
  return r;
}

// Stand at the vault dial and lock all three tumblers: press SPACE the
// moment the needle sits inside the green window.
function crack(world, maxSec = 90) {
  let n = 0;
  while (!world.vaultOpen && world.screen === 'play' && n < maxSec * 60) {
    step(world);
    const c = world.crack;
    if (c.active && Math.abs(c.needle - c.target) <= 0.12) crackAttempt(world, AUDIO);
    n += 1;
  }
  if (!world.vaultOpen) fail(`vault never opened after ${n} steps (crack active: ${world.crack.active}, locked: ${world.crack.locked})`);
  return n;
}

// The win path, room by room. Waypoints hug the safe edges: the south
// wall in the Lobby, the west lane past the middle guard in the Gallery,
// and the service duct in the Vault — the routes the rooms were built
// around, not a straight line through every patrol. driveToVault runs the
// shared legs (lobby + gallery + vault up to the open vault); the win run
// adds the gold and the van, and the getaway check idles at the dial.
function driveLobby(world) {
  // Room 1 — the Lobby: south lane to the keycard, south lane to the stair door.
  at(world, 20, 19);
  at(world, 28, 19);
  at(world, 26, 17, { until: () => world.keycardTaken }); // keycard, on the desk
  if (!world.keycardTaken) fail('lobby keycard not picked up');
  at(world, 30, 19);
  at(world, 38.5, 19); // exit
  if (world.levelIndex !== 1) fail(`expected level 2 after lobby exit, got ${world.levelIndex + 1}`);
}

function driveGallery(world) {
  // Room 2 — the Gallery: east along the south wall, north up the west side
  // of the laser grid, then WAIT: the keycard sits 16 px from the east
  // guard's west patrol line, so the bot only goes for it while that guard
  // is at the far south-east corner. Then NORTH around the east wing wall
  // — it runs y160-448 with no door gap, so the straight line east is a
  // dead end — and east through the north-east shadow zone to the stair door.
  settle(world);
  at(world, 26, 20);
  at(world, 26, 12);
  const g3 = () => world.guards[2];
  if (!waitUntil(world, () => g3().x > 1000 && g3().y > 500)) fail('east guard never reached the south-east corner');
  at(world, 27, 10, { until: () => world.keycardTaken }); // keycard, west face of the east wall
  if (!world.keycardTaken) fail('gallery keycard not picked up');
  at(world, 26, 4); // north along the wall's west face
  if (!waitUntil(world, () => g3().y > 450)) fail('east guard never went south');
  at(world, 33, 3); // east through the north-east shadow zone
  at(world, 37, 3);
  at(world, 38.5, 2.5); // exit
  if (world.levelIndex !== 2) fail(`expected level 3 after gallery exit, got ${world.levelIndex + 1}`);
}

function driveToVault(world) {
  // Room 3 — the Vault: keycard, back west, north up the clear west column,
  // into the duct at the west grate, crawl the whole duct unseen, out the
  // east grate, crack the dial.
  settle(world);
  at(world, 12, 18); // keycard
  if (!world.keycardTaken) fail('vault keycard not picked up');
  at(world, 2, 18);
  at(world, 2, 4);
  at(world, 4, 2); // duct entry grate
  at(world, 35, 2, { within: 20, maxSec: 90 }); // crawl the duct east
  if (!world.player.inDuct && world.player.x < 1100) fail('bot never got into the duct');
  // Through the MIDDLE of the east grate gap (x1120-1184): hugging the
  // wall's east end wedges the thief in the corner — the circle overlaps
  // the corner and neither south nor west will move — so cross at x1152,
  // 32 px clear of the corner, then south around the vault door.
  at(world, 36, 2, { within: 12 });
  // Out the east grate and the crack starts by itself: the dial zone is
  // 72 px from the vault door, and the door is solid out to 55 px, so the
  // thief roots to the spot the moment they step out of the duct — arrival
  // at the dial IS the crack starting, not a tile.
  at(world, 35, 4, { until: () => world.crack.active });
  if (!world.crack.active) fail('crack never started at the dial');
  crack(world);
}

function winRun(seed) {
  const world = createWorld(seed);
  startGame(world);
  const log = [];
  driveLobby(world);
  log.push(`lobby done t=${world.time.toFixed(1)} score=${world.score}`);
  driveGallery(world);
  log.push(`gallery done t=${world.time.toFixed(1)} score=${world.score}`);
  driveToVault(world);
  log.push(`vault open t=${world.time.toFixed(1)} getaway=${world.getaway.toFixed(1)}`);
  // The vault gold, north bars first and the south bar last: the watcher
  // guard stands at (1104, 208) facing north, so the two north bars are in
  // its cone and the grab fills its meter — it walks north to investigate
  // the spot where it saw you. Grab the north bars first, end on the south
  // bar, and you are already moving away from it while it walks the other
  // way. Grab the south bar last and head south, and the watcher walks
  // straight into you.
  const v = world.level.vault;
  for (const g of [{ x: v.x - 88, y: v.y - 8 }, { x: v.x - 64, y: v.y + 16 }, { x: v.x - 48, y: v.y + 56 }]) {
    go(world, g.x, g.y, { within: 20, maxSec: 20 });
  }
  // To the van EAST around the north vault wall, then straight north: the
  // wall runs x928-1152 at y224-256, and the straight line south wedges the
  // thief against its north face — the circle overlaps the face, so neither
  // south nor sideways will move, and the thief stands in CAM-2's beam
  // until the camera trips the alarm. North-east past the wall's east end,
  // then north to the van — no southward detour, because every second the
  // watcher spends chasing is a second closer to the catch.
  at(world, 37, 6, { maxSec: 30 });
  at(world, 38.5, 3.5, { within: 30, maxSec: 30 }); // the van
  if (world.screen !== 'win') fail(`expected SCREEN_WIN, got ${world.screen}`);
  log.push(`WIN t=${world.time.toFixed(1)} score=${world.score} loot=${world.lootTaken}/${world.lootTotal}`);
  return { world, log };
}

function fingerprint(world) {
  const round = (n) => Math.round(n * 100) / 100;
  return JSON.stringify({
    screen: world.screen,
    score: world.score,
    time: round(world.time),
    level: world.levelIndex,
    loot: world.lootTaken,
    player: [round(world.player.x), round(world.player.y)],
    guards: world.guards.map((g) => [round(g.x), round(g.y), g.state]),
  });
}

// --- Check 1: the win path ---------------------------------------------
const first = winRun(1);
console.log('WIN RUN:');
for (const line of first.log) console.log(`  ${line}`);

// --- Check 2: determinism — replay the win, fingerprint must match ------
const second = winRun(1);
const fp1 = fingerprint(first.world);
const fp2 = fingerprint(second.world);
if (fp1 !== fp2) fail(`determinism: fingerprints differ\n  run1 ${fp1}\n  run2 ${fp2}`);
console.log(`DETERMINISM: identical fingerprint (${fp1.length} chars)`);

// --- Check 3: the laser grid is a timing test, not a trap ---------------
// Drive to the Gallery, slip around the south end of the east wing wall to
// the grid's south side, wait for the east guard to be north AND the grid
// to go dark, then cross north through the first beam and east through the
// other two. A timed crossing must not trip the alarm.
{
  const world = createWorld(1);
  startGame(world);
  driveLobby(world);
  settle(world);
  at(world, 26, 20);
  at(world, 26, 16);
  const g3 = () => world.guards[2];
  if (!waitUntil(world, () => g3().y < 200)) fail('laser check: east guard never went north');
  at(world, 28, 16); // south of the beams, east of the wall
  if (!waitUntil(world, () => world.lasers[0].state === 'off')) fail('laser check: grid never went dark');
  at(world, 28, 9, { maxSec: 10 }); // north through the first beam
  at(world, 33, 10, { maxSec: 10 }); // east through the other two
  if (world.alarm) fail('laser grid tripped the alarm on a timed crossing');
  if (world.lasers[0].suspicion > 0.5) fail(`laser suspicion ${world.lasers[0].suspicion.toFixed(2)} after a timed crossing`);
  console.log(`LASER: timed crossing, no alarm, grid suspicion=${world.lasers[0].suspicion.toFixed(2)}`);
}

// --- Check 4: standing in a guard's cone gets you caught ----------------
{
  const world = createWorld(1);
  startGame(world);
  const g = world.guards[0];
  // Walk to the guard's patrol centre and stand still in its path.
  go(world, g.path[0].x, g.path[0].y, { maxSec: 30 });
  let n = 0;
  while (world.screen === 'play' && n < 60 * 20) { step(world); n += 1; }
  if (world.screen !== 'caught') fail(`expected CAUGHT standing in a cone, got ${world.screen} after ${n} steps`);
  console.log(`CAUGHT: screen=caught reason=${world.caughtReason} after ${(n / 60).toFixed(1)}s in the cone`);
}

// --- Check 5: the getaway clock runs out --------------------------------
{
  const world = createWorld(1);
  startGame(world);
  // Drive the shared path to the open vault, then stand still at the dial.
  driveLobby(world);
  driveGallery(world);
  driveToVault(world);
  let n = 0;
  while (world.screen === 'play' && n < 60 * 50) { step(world); n += 1; }
  if (world.screen !== 'caught' || world.caughtReason !== 'police') {
    fail(`expected CAUGHT/police after the getaway clock, got ${world.screen}/${world.caughtReason}`);
  }
  console.log(`GETAWAY TIMEOUT: screen=caught reason=police after ${(n / 60).toFixed(1)}s idle`);
}

// --- Check 6: a pebble pulls a patrolling guard over to look -------------
{
  const world = createWorld(1);
  startGame(world);
  const g = world.guards[0];
  // Throw the pebble 100 px east of the guard's live position — same open
  // floor, clear line of sound, well inside the 520 px hearing reach — so
  // the guard hears it on the next step. (Throwing it at a far waypoint
  // fails the check when the guard is behind a wall that turn: walls
  // muffle the pebble to 156 px, and the noise only rings for one step.)
  const target = { x: g.x + 100, y: g.y };
  throwPebble(world, target.x, target.y, AUDIO);
  let n = 0;
  let heard = false;
  while (n < 60 * 8) {
    step(world);
    if (world.guards.some((gg) => gg.state === 'investigate')) { heard = true; break; }
    n += 1;
  }
  if (!heard) fail('no guard investigated the pebble within 8s');
  console.log(`PEBBLE: a guard went to investigate after ${(n / 60).toFixed(1)}s`);
}

console.log('PLAYTEST: all checks passed');
