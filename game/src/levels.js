// MIDNIGHT VAULT — the three rooms of the Meridian Bank. Coordinates are in
// tiles (1 tile = 32 px); the floor is 40 x 22 tiles, drawn from above with a
// slight oblique lift so walls, crates and pillars read as solid 3D volumes,
// not flat shapes. Every room has a job: cover to hide behind, shadow to
// vanish in, lamps whose pools of light mark the dangerous ground, and a
// route that rewards patience. Rook works through the bank in one night:
// the Lobby, the Gallery, then the Vault itself.
import { TILE } from './config.js';

function r(x, y, w, h) {
  return { x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE };
}
function p(x, y) {
  return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
}

const BORDER = [
  r(0, 0, 40, 1), r(0, 21, 40, 1), r(0, 0, 1, 22), r(39, 0, 1, 22),
];

export const LEVELS = [
  {
    name: 'THE LOBBY',
    sub: 'Room 1 — learn the patrols',
    hint: 'A skylight searchlight sweeps the lobby. Time the beam, use the shadows — find the manager\u2019s keycard, then slip out the stair door.',
    walls: [
      ...BORDER,
      r(8, 4, 1, 5), // teller counter wall, west
      r(28, 12, 1, 7), // east wing wall
      r(18, 16, 9, 1), // south hall wall
    ],
    // One skylight searchlight on the north wall — a wide, slow, warm-white
    // beam sweeping the open lobby floor on a 6 s clock. It hangs a tile
    // clear of the wall face, so its line of sight is real, and its sweep
    // crosses the red runner where a cash bundle waits: crossing the light
    // pays, if you time it.
    searchlights: [
      { x: 17 * TILE + 16, y: 1 * TILE + 16, base: Math.PI / 2, sweep: 0.85, period: 6, phase: 0 },
    ],
    crates: [r(16, 8, 2, 1), r(24, 6, 1, 1), r(12, 15, 1, 1), r(20, 9, 1, 1)],
    pillars: [p(6, 6), p(6, 16), p(34, 6), p(34, 16)],
    desks: [r(14, 4, 3, 1), r(26, 17, 2, 1)],
    plants: [p(4, 4), p(36, 20), p(12, 19)],
    lamps: [p(10, 10), p(28, 10), p(20, 18)],
    shadows: [r(2, 2, 5, 3), r(34, 17, 4, 3)],
    carpets: [{ ...r(18, 2, 3, 18), color: 'red' }, { ...r(8, 10, 4, 3), color: 'blue' }],
    labels: [
      { x: 10, y: 11, text: 'LOBBY' },
    ],
    guards: [
      { path: [p(5, 5), p(13, 5), p(13, 11), p(5, 11)], pause: 1.3 },
      { path: [p(25, 15), p(33, 15), p(33, 9), p(25, 9)], pause: 1.1 },
    ],
    loot: [p(20, 10), p(5, 4), p(35, 17), p(35, 5), p(21, 6)], // a fifth bundle on the red runner, inside the searchlight's sweep — crossing the light pays
    keycard: p(26, 17),
    exit: { ...r(38, 18, 1, 2), dir: 'E' },
    player: p(3, 19),
  },
  {
    name: 'THE GALLERY',
    sub: 'Room 2 — the marble hall',
    hint: 'The gallery is wide open. Use the display cases and the blue carpet — watch the middle guard, and time the laser grid on the carpet.',
    walls: [
      ...BORDER,
      r(10, 3, 1, 5), r(10, 10, 1, 4), // west gallery wall with a door gap
      r(14, 15, 9, 1), // south gallery wall
      r(27, 5, 1, 9), // east wing wall
    ],
    crates: [r(16, 6, 1, 1), r(17, 6, 1, 1), r(30, 18, 1, 1), r(8, 18, 1, 1)],
    pillars: [p(6, 6), p(6, 16), p(20, 8), p(34, 8), p(20, 18)],
    desks: [r(16, 3, 2, 1), r(24, 3, 2, 1), r(16, 19, 2, 1), r(32, 12, 1, 2)],
    plants: [p(3, 10), p(37, 4), p(22, 11)],
    lamps: [p(8, 8), p(20, 6), p(32, 16), p(14, 18)],
    shadows: [r(2, 14, 4, 5), r(30, 2, 7, 3)],
    carpets: [{ ...r(2, 9, 36, 2), color: 'blue' }],
    labels: [
      { x: 20, y: 11, text: 'GALLERY' },
      { x: 33, y: 5, text: 'EAST WING' },
    ],
    guards: [
      { path: [p(4, 4), p(10, 4), p(10, 8), p(4, 8)], pause: 1.2 },
      { path: [p(16, 16), p(24, 16), p(24, 8), p(16, 8)], pause: 1.0 },
      { path: [p(28, 4), p(36, 4), p(36, 18), p(28, 18)], pause: 0.8 },
    ],
    // Three laser tripwires across the blue carpet — vertical beams at tile
    // x 28, 30 and 32, spanning the carpet band (tiles y 9–11). They blink
    // on a 3.2 s clock — 0.5 s warning, 1.4 s live, 1.3 s dark — so the
    // direct route east is fast but timed, and the long way around is safe
    // but slow. The bundle at (37, 10) sits behind the grid: crossing it pays.
    lasers: [
      {
        beams: [
          { x1: 28 * TILE + 16, y1: 9 * TILE + 4, x2: 28 * TILE + 16, y2: 11 * TILE - 4 },
          { x1: 30 * TILE + 16, y1: 9 * TILE + 4, x2: 30 * TILE + 16, y2: 11 * TILE - 4 },
          { x1: 32 * TILE + 16, y1: 9 * TILE + 4, x2: 32 * TILE + 16, y2: 11 * TILE - 4 },
        ],
        period: 3.2,
        warn: 0.5,
        onTime: 1.4,
        phase: 0,
      },
    ],
    loot: [p(13, 3), p(35, 3), p(5, 17), p(30, 19), p(37, 10)], // a fifth bundle east of the grid — the reward for crossing it
    keycard: p(27, 10),
    exit: { ...r(38, 2, 1, 2), dir: 'E' },
    player: p(2, 20),
  },
  {
    name: 'THE VAULT',
    sub: 'Room 3 — the last door',
    hint: 'Four guards, two cameras, and the vault itself. Crack the dial with the keycard — three tumblers, SPACE on the green — then grab the gold and run for the van before the police arrive.',
    walls: [
      ...BORDER,
      r(9, 4, 1, 6), // west vault wall
      r(21, 13, 1, 7), // south vault wall
      r(21, 11, 9, 1), // vault hall wall
      r(29, 7, 7, 1), // north vault wall
      // The service duct: a channel at tile y 2, enclosed by real walls —
      // its north wall, its south wall with two grate gaps, and caps at both
      // ends. The only way in or out is through a grate at tile x 3–4
      // (entry, west) or x 33–36 (exit, east); the collision code enforces
      // it, so no special-case movement is needed anywhere else. The east
      // gap is four tiles wide on purpose: the vault door stands just south
      // of it, and a two-tile gap would wedge the thief in the pocket
      // between the wall's east end and the door — no way south, no way
      // west, only back north into the duct.
      r(3, 1, 34, 1), // duct north wall
      r(5, 3, 28, 1), // duct south wall (gaps at x 3–4 and x 33–36)
      r(2, 2, 1, 1), // duct west cap
      r(37, 2, 1, 1), // duct east cap
    ],
    crates: [r(14, 14, 1, 1), r(15, 14, 1, 1), r(30, 4, 1, 1), r(8, 6, 1, 1)],
    pillars: [p(6, 10), p(16, 18), p(26, 6), p(34, 14)],
    desks: [r(22, 4, 2, 1), r(24, 4, 2, 1), r(34, 18, 2, 1)],
    plants: [p(4, 4), p(36, 10)],
    lamps: [p(10, 14), p(22, 10), p(32, 8)],
    shadows: [r(2, 2, 3, 4), r(34, 14, 4, 5), r(12, 16, 4, 3)],
    carpets: [{ ...r(33, 3, 3, 16), color: 'red' }],
    labels: [
      { x: 25, y: 17, text: 'THE VAULT' },
      { x: 6, y: 12, text: 'WEST WING' },
    ],
    guards: [
      { path: [p(4, 8), p(8, 8), p(8, 16), p(4, 16)], pause: 1.1 },
      { path: [p(14, 4), p(18, 4), p(18, 10), p(14, 10)], pause: 1.0 },
      { path: [p(24, 14), p(30, 14), p(30, 18), p(24, 18)], pause: 0.9 },
      { path: [p(34, 6)], pause: 2.6, scan: true }, // the watcher: stands, scans, turns away
    ],
    // Two wall cameras guard the vault hall. CAM-1 hangs just under the
    // north vault wall and sweeps the hall south; CAM-2 sits on the east
    // wall by the vault door and sweeps the door approach west. Both sit a
    // tile clear of the wall face, so their line of sight is real.
    cameras: [
      { x: 30 * TILE + 16, y: 7 * TILE + 8, base: Math.PI / 2, sweep: 0.62, period: 5.2, phase: 0 },
      { x: 38 * TILE + 16, y: 6 * TILE + 16, base: Math.PI * 0.92, sweep: 0.55, period: 6.4, phase: 1.3 },
    ],
    // The service duct along the north wall — a channel at tile y 2 from
    // x 3 to x 36, entry grate at (4, 2), exit grate at (35, 2). Inside the
    // duct the thief is unseen but crawls at half speed and cannot pick up
    // loot. The duct runs the whole width of the hall, so it bypasses both
    // cameras; the last dash from the far grate to the vault door is still
    // under CAM-2's sweep, so the route is a trade-off, not a free win.
    ducts: [
      { x: 3 * TILE, y: 2 * TILE, w: 34 * TILE, h: TILE, entry: p(4, 2), exit: p(35, 2), crawl: 0.5 },
    ],
    // The vault itself: a big round steel door on the east wall, centre at
    // tile (36.5, 4.5). Rook stands at the dial with the keycard and cracks
    // three tumblers; the gold inside is the score that matters.
    vault: { x: 36 * TILE + 16, y: 4 * TILE + 16, r: 44 },
    loot: [p(11, 18), p(19, 6), p(27, 4), p(33, 16), p(36, 19), p(33, 4)], // a sixth bundle just outside the far grate, on the floor route to the door — the reward for using the duct
    keycard: p(12, 18),
    exit: { ...r(38, 3, 1, 2), dir: 'E', van: true }, // the getaway van waits here
    player: p(2, 19),
  },
];
