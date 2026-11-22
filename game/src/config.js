// MIDNIGHT VAULT — shared constants. One source of truth for sizes, speeds,
// colours and the motion palette (Premium archetype: 350-600ms, ease-out, no
// overshoot on the camera; playful ease-out-back only on small pops).
export const VIEW = { width: 1280, height: 720 };
export const TILE = 32;
export const COLS = 40;
export const ROWS = 22;
export const FLOOR = { x: 0, y: 16, width: 1280, height: 704 };
export const STEP = 1 / 60;

// Motion palette (motion-design-skill: one signature easing, three durations).
export const MOTION = {
  quick: 0.18, // HUD ticks, dial needle, eye blink
  standard: 0.38, // guard turns, pop-ins, alarm flash
  slow: 0.6, // room transitions, camera ease
};

export const PLAYER = {
  radius: 11,
  walkSpeed: 178,
  sneakSpeed: 96,
  accel: 14, // exponential approach — movement eases in and out, never snaps
  crouchDetect: 0.55, // how much harder a sneaking thief is to spot
  shadowDetect: 0.25, // how much harder a thief in a shadow zone is to spot
};

export const GUARD = {
  radius: 12,
  patrolSpeed: 62,
  chaseSpeed: 128,
  searchSpeed: 88,
  viewRange: 225,
  viewHalfAngle: 0.56, // ~32 degrees each side while patrolling
  suspectHalfAngle: 0.36, // narrows on suspicion — the cone reacts as you expect
  alertHalfAngle: 0.78,
  suspectAt: 0.45, // suspicion that makes a guard stop and look ("?")
  alertAt: 1.0, // suspicion that raises the alarm ("!")
  risePerSec: 1.15, // base detection fill rate at point blank, standing, lit
  fallPerSec: 0.32, // suspicion decays when line of sight breaks — you recover
  alertHoldSec: 5.0, // alarm lasts this long without a fresh sighting
  searchSec: 4.0,
  catchRange: 26,
  stepInterval: 0.42, // seconds between footstep sounds while patrolling
};

// Security cameras (The Vault): wall-mounted, they never move — they sweep.
// A camera cone is narrower and shorter than a guard's, and it fills
// suspicion a touch slower, so the fair counterplay is timing the sweep.
// A camera that fills its meter trips the same alarm as a guard.
export const CAMERA = {
  range: 200,
  halfAngle: 0.38, // ~22 degrees each side — a thin, readable beam
  risePerSec: 0.9,
  fallPerSec: 0.4,
};

// Service duct (The Vault): a recessed channel along the north wall, grate
// hatches at both ends. Inside: unseen, half speed, no pickups. The floor
// route is faster but watched; the duct is slow but safe.
export const DUCT = {
  crawl: 0.5, // speed inside the duct, as a fraction of walk speed
};

// Laser tripwires (The Gallery): straight beams across the marble hall, on a
// clock — warn, on, off. Same magenta family as the cameras, but lines, not
// cones, so the two watchers never read as one another. A beam fills
// suspicion at the camera rate and trips the same alarm.
export const LASER = {
  risePerSec: 0.9,
  fallPerSec: 0.4,
  hitDist: 12, // px from a live beam's line — touching it is being seen
};

// Skylight searchlight (The Lobby): tower-mounted on the roof, it never
// moves — it sweeps. A wide, slow beam over the open lobby floor, on a 6 s
// clock, so the fair counterplay is timing the sweep and using the shadows.
// Same meter, same alarm, same fill rate as a camera — only the shape is new.
export const SEARCHLIGHT = {
  range: 380, // long — the beam crosses half the lobby floor
  halfAngle: 0.5, // ~29 degrees each side — wide, a flood of light, not a needle
  risePerSec: 0.9,
  fallPerSec: 0.4,
};

// The vault crack (The Vault): a dial minigame at the vault door. The needle
// sweeps back and forth; press SPACE while it sits inside the green zone to
// lock a tumbler. Three tumblers open the vault. A miss clunks loud — it
// feeds suspicion straight into the alarm meter and the needle speeds up,
// so a sloppy crack is a loud crack.
export const CRACK = {
  tumblers: 3,
  zoneHalf: 0.22, // radians either side of the target — the green window
  sweepSpeed: 2.6, // radians per second at the start
  speedUp: 1.35, // multiplier after every locked tumbler — it gets harder
  missSuspicion: 0.3, // suspicion fed to the alarm meter on a miss
};

// The getaway (after the vault opens): the van is waiting at the east door
// and the police are on their way. Reach the van before the clock runs out
// or the crew is caught in the street. The timer is the whole endgame —
// the HUD counts it down in big amber digits.
export const GETAWAY = {
  seconds: 45,
};

export const SHAKE = {
  alarm: 1.0, // full trauma when the alarm goes up
  suspect: 0.3, // a jolt when a guard turns suspicious
  loot: 0.22, // a small kick on a pickup burst
  crack: 0.4, // a clunk when a tumbler misses
  decayPerSec: 1.3,
  maxPx: 9,
};

export const COLORS = {
  floorA: '#2e3342', // marble, dark slate-blue
  floorB: '#292e3c',
  grout: '#1d2130',
  carpet: '#5a2e35', // lobby runner, deep red
  carpetEdge: '#7a3f47',
  carpetBlue: '#2c3d5c',
  wallTop: '#565b70',
  wallFront: '#262a3a',
  wallSide: '#363b50',
  shadowZone: '#141824',
  crateTop: '#8a6a42',
  crateFront: '#5d4527',
  crateSide: '#6f5633',
  pillarTop: '#6b6f82',
  pillarBody: '#3a3e52',
  deskTop: '#3d4a68',
  deskFront: '#232a3d',
  plantPot: '#7a4a35',
  leaf: '#3f6b4a',
  leafDark: '#2c4f36',
  exitGlow: '#37e08a',
  lootGold: '#f2c14e',
  keycard: '#4ec9f2',
  player: '#e8e4d8',
  playerTrim: '#c96f3f',
  guardBody: '#2e3448',
  guardTrim: '#c93f3f',
  conePatrol: 'rgba(255, 214, 130, 0.30)',
  coneSuspect: 'rgba(255, 170, 60, 0.42)',
  coneAlert: 'rgba(255, 70, 60, 0.48)',
  // Camera cones are cold magenta, never guard gold — two watchers, two colours,
  // so the eye never has to ask which beam is sweeping at it.
  camCone: 'rgba(255, 90, 200, 0.30)',
  camConeHot: 'rgba(255, 60, 110, 0.48)',
  camBody: '#3a2a3e',
  camLens: '#ff5ac8',
  // Laser beams share the cameras' magenta but draw as thin lines with a
  // hot core — the family matches, the shape does not.
  laserCore: '#ff8ad8',
  laserGlow: 'rgba(255, 90, 200, 0.35)',
  laserPost: '#3a2a3e',
  // Searchlight beam: warm white, wide and long, with a bright core — the
  // fourth watcher, and the only one that is white. Guards are gold cones,
  // cameras are thin magenta, lasers are magenta lines; this is a flood.
  slCone: 'rgba(255, 248, 225, 0.36)',
  slConeHot: 'rgba(255, 236, 180, 0.5)',
  slCore: 'rgba(255, 252, 235, 0.85)',
  slBody: '#4a4436',
  slLens: '#fff6d8',
  // Duct: recessed steel, darker than the floor, with a pale grate — the
  // route reads as a hole in the floor, not as another beam.
  ductChannel: '#171b28',
  ductInner: '#10131f',
  ductSlat: '#2a3048',
  ductGrate: '#8a93ad',
  ductGrateDark: '#4a5168',
  ductTag: '#b9c2d8',
  // The vault: brushed steel with a gold dial ring — the room's centrepiece.
  vaultSteel: '#7d8296',
  vaultDark: '#3c4152',
  vaultGold: '#f2c14e',
  vaultGreen: '#37e08a',
  vaultRed: '#ff4a3c',
  // The getaway van: dark green, parked at the east door with its lights on.
  vanBody: '#2e5d43',
  vanTop: '#3f7a58',
  vanLight: '#ffe9b0',
  hudBack: 'rgba(10, 12, 20, 0.72)',
  hudText: '#e8e4d8',
  hudDim: '#9aa3b8',
  alarm: '#ff4a3c',
};
