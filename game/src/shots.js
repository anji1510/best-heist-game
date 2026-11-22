// The four screenshot scenes. Each one stages a real world state — the same
// world the player plays, frozen at a chosen moment — and paints it twice, so
// the frame is deterministic: the same seed always gives the same pixels.
// The cover is a story beat: Rook slips behind a crate while a guard's cone
// sweeps right past him, the stair door glowing in the distance. The crack
// shot is the heist's signature: Rook at the vault dial with the needle
// mid-sweep, the cameras doing their job behind him. The exit shot is the
// endgame: the vault open, gold in hand, the van waiting with its lights on
// and the getaway clock running. Every stage sets the camera drift (camX/camY)
// by hand, so the frame is identical on every render.
import { SCREEN_PLAY } from './world.js';
import { loadLevel } from './world.js';
import { poseCamera } from './cameras.js';
import { poseLaser } from './lasers.js';
import { poseSearchlight } from './searchlight.js';

function place(world, px, py, facing) {
  world.player.x = px;
  world.player.y = py;
  world.player.facing = facing;
  world.player.vx = 0;
  world.player.vy = 0;
}

function guardAt(world, i, x, y, facing, state, suspicion, lastKnown) {
  const g = world.guards[i];
  g.x = x;
  g.y = y;
  g.facing = facing;
  g.coneAngle = facing; // the cone follows the staged facing, not the creation one
  g.state = state;
  g.suspicion = suspicion;
  g.lastKnown = lastKnown ?? null;
  g.stateT = 0.8;
  return g;
}

// 1-cover: the Lobby, Rook crouched behind the crate cluster as the patrol
// guard's cone sweeps the runner a step in front of him; the stair door
// glows at the far right, the keycard already taken — and the skylight
// searchlight sweeps its wide warm-white beam down the red runner just east
// of him, the room's own watcher visible in the frame that sells the game.
export function stageCover(world) {
  loadLevel(world, 0);
  world.screen = SCREEN_PLAY;
  world.screenT = 10; // HUD pop-in finished
  world.time = 134;
  world.timeFrozen = 134;
  world.lootTaken = 1;
  world.loot[0].taken = true;
  world.keycardTaken = true;
  world.keycard.taken = true;
  world.score = 150;
  world.pebbles = 2;
  place(world, 18 * 32 + 16, 10 * 32 + 10, -Math.PI / 2);
  world.player.sneaking = true;
  world.player.inShadow = false;
  world.camX = 592;
  world.camY = 330;
  // Pose the searchlight by hand: sweepT -0.37 lands the beam at ~1.25 rad,
  // running south-east down the red runner a step east of Rook — close
  // enough to read, far enough that he is unseen.
  poseSearchlight(world.searchlights[0], -0.37);
  // The patrol guard stands clear of the wall, cone sweeping south-east
  // straight over the crates Rook is crouched behind — and he has just
  // noticed something: MARA is suspicious, "?" over her head, bark up,
  // meter at 32%. The cover frame shows the whole detection language at
  // once: a named guard, a number, a question, and a thief unseen — the
  // near miss, frozen a beat before it resolves.
  guardAt(world, 0, 12 * 32 + 16, 7 * 32 + 16, 0.35, 'suspicious', 0.32);
  world.guards[0].bark = "Who's there?";
  world.guards[0].barkT = 2.5;
  guardAt(world, 1, 33 * 32 + 16, 13 * 32 + 16, Math.PI, 'patrol', 0);
  world.suspicion = 0.32;
  return { screen: SCREEN_PLAY };
}

// 2-patrol: the Gallery, the long marble hall — three cones sweeping, routes
// dotted, Rook behind a pillar watching the middle guard turn — and the laser
// grid live across the blue carpet at the right, three magenta lines the
// player has to time. The frame is nudged east so the grid sits in clear view.
export function stagePatrol(world) {
  loadLevel(world, 1);
  world.screen = SCREEN_PLAY;
  world.screenT = 10;
  world.time = 96;
  world.timeFrozen = 96;
  world.lootTaken = 2;
  world.loot[0].taken = true;
  world.loot[2].taken = true;
  world.score = 200;
  place(world, 22 * 32 + 8, 9 * 32 + 16, Math.PI);
  world.player.sneaking = true;
  world.camX = 760;
  world.camY = 304;
  // Pose the laser grid by hand: clock 1.0 sits inside the live window
  // (warn 0.5 + on 1.4 → on until 1.9), so all three beams burn bright.
  poseLaser(world.lasers[0], 1.0);
  guardAt(world, 0, 8 * 32 + 16, 5 * 32 + 16, Math.PI / 2, 'patrol', 0);
  guardAt(world, 1, 20 * 32 + 16, 12 * 32 + 16, -Math.PI / 2, 'patrol', 0.12);
  guardAt(world, 2, 32 * 32 + 16, 10 * 32 + 16, Math.PI, 'patrol', 0);
  world.suspicion = 0.12;
  return { screen: SCREEN_PLAY };
}

// 3-crack: the Vault, the heist's signature — Rook at the vault dial, the big
// gold ring centre screen with the needle mid-sweep and one tumbler already
// locked, the keycard in hand. Behind him the two cameras sweep the hall:
// CAM-1's beam runs south-east across the vault hall, CAM-2's runs west
// across the door approach. Neither beam touches him — he is unseen, and
// the frame proves the timing game AND the minigame in one shot.
export function stageCrack(world) {
  loadLevel(world, 2);
  world.screen = SCREEN_PLAY;
  world.screenT = 10;
  world.time = 212;
  world.timeFrozen = 212;
  world.lootTaken = 3;
  world.loot[0].taken = true;
  world.loot[1].taken = true;
  world.loot[2].taken = true;
  world.keycardTaken = true;
  world.keycard.taken = true;
  world.score = 350;
  world.pebbles = 1;
  place(world, 36 * 32 - 40, 4 * 32 + 16, 0);
  world.player.cracking = true;
  world.crack.active = true;
  world.crack.needle = 0.3;
  world.crack.target = 0.25;
  world.crack.locked = 1;
  world.crack.speed = 2.6 * 1.35;
  world.camX = 1080;
  world.camY = 220;
  // Pose the cameras by hand: CAM-1's beam runs south-east across the vault
  // hall (angle 1.14 rad); CAM-2's runs west across the door approach
  // (angle 3.22 rad), a step behind Rook.
  poseCamera(world.cameras[0], -0.64);
  poseCamera(world.cameras[1], 0.655);
  guardAt(world, 0, 6 * 32 + 16, 12 * 32 + 16, -Math.PI / 2, 'patrol', 0);
  guardAt(world, 1, 16 * 32 + 16, 7 * 32 + 16, Math.PI, 'patrol', 0.05);
  guardAt(world, 2, 27 * 32 + 16, 16 * 32 + 16, Math.PI / 2, 'patrol', 0);
  guardAt(world, 3, 34 * 32 + 16, 6 * 32 + 16, -Math.PI / 2 - 0.7, 'patrol', 0);
  world.suspicion = 0.05;
  return { screen: SCREEN_PLAY };
}

// 4-exit: the Vault again, the endgame — the vault door swung open with gold
// light spilling out, the vault gold grabbed, Rook at the van with its
// lights on and the getaway clock running (0:32). The watcher has turned
// away at last; CAM-2 sweeps the door approach just behind him. The frame
// sells the whole heist: crack, grab, run.
export function stageExit(world) {
  loadLevel(world, 2);
  world.screen = SCREEN_PLAY;
  world.screenT = 10;
  world.time = 287;
  world.timeFrozen = 287;
  world.keycardTaken = true;
  world.keycard.taken = true;
  world.vaultOpen = true;
  world.getaway = 32;
  world.getawayRunning = true;
  world.lootTaken = 6;
  world.loot.forEach((l, i) => { if (i < 6) l.taken = true; });
  // The three vault gold bars, grabbed on the way out.
  world.loot.push(
    { x: 1104, y: 160, taken: true, vault: true },
    { x: 1120, y: 200, taken: true, vault: true },
    { x: 1080, y: 136, taken: true, vault: true },
  );
  world.lootTotal = world.loot.length;
  world.lootTaken = 9; // six floor bundles plus the three vault gold bars
  world.score = 850;
  world.pebbles = 1;
  place(world, 37 * 32 + 8, 4 * 32 + 8, 0);
  world.camX = 1168;
  world.camY = 136;
  // Pose the cameras by hand: CAM-1 sweeps the hall south-east, CAM-2 sweeps
  // the door approach west, a step behind Rook. Neither beam touches him.
  poseCamera(world.cameras[0], -0.64);
  poseCamera(world.cameras[1], 0.655);
  guardAt(world, 0, 6 * 32 + 16, 12 * 32 + 16, -Math.PI / 2, 'patrol', 0);
  guardAt(world, 1, 16 * 32 + 16, 7 * 32 + 16, Math.PI, 'patrol', 0.05);
  guardAt(world, 2, 27 * 32 + 16, 16 * 32 + 16, Math.PI / 2, 'patrol', 0);
  guardAt(world, 3, 34 * 32 + 16, 6 * 32 + 16, -Math.PI / 2 - 0.7, 'patrol', 0);
  world.suspicion = 0.05;
  return { screen: SCREEN_PLAY };
}

export function stageShot(name, world) {
  if (name === 'patrol') return stagePatrol(world);
  if (name === 'crack') return stageCrack(world);
  if (name === 'exit') return stageExit(world);
  return stageCover(world);
}
