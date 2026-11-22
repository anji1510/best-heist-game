// MIDNIGHT VAULT renderer — plan-view logic, oblique 3D look. The floor stays
// a readable plan, but every solid is extruded: a top face, a darker front
// face and a side face, plus a cast shadow thrown to the south-east. Vision
// cones are drawn as volumes of light lying on the floor, brighter near the
// guard and fading with distance, so depth reads at a glance — even at 300 px.
// Painter's order: floor, light pools, routes, duct, loot, vault, exit, cones,
// then every solid and body sorted by its feet (y), then particles, then the HUD.
import { CAMERA, COLORS, FLOOR, GUARD, LASER, SEARCHLIGHT, SHAKE, TILE, VIEW } from './config.js';
import { clamp, easeOutCubic } from './motion.js';
import { SCREEN_CAUGHT, SCREEN_LEVEL, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './world.js';
import { drawHud } from './hud.js';
import { popScale, settleScale } from './player.js';

const WALL_H = 30;
const CRATE_H = 26;
const PILLAR_H = 38;
const DESK_H = 20;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function shadow(ctx, x, y, w, h, dx, dy, alpha = 0.3) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(x + dx, y + dy, w, h);
}

// Perspective depth (guanmo layering + motion-design parallax): props near
// the frame bottom (close to the viewer) render ~1.1x, props near the top
// (far) ~0.9x, each scaled around its own feet so the floor plan stays true.
// Overlap + scale gradient = depth without any projection change.
function depthScale(y) {
  return 0.9 + 0.2 * clamp(y / 720, 0, 1);
}

function depthWrap(ctx, fx, fy, draw) {
  const s = depthScale(fy);
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(s, s);
  ctx.translate(-fx, -fy);
  draw();
  ctx.restore();
}

// Extrude a rectangle upward: top face, front face (south), right face (east).
// The front face is the darkest, the top the lightest — the volume reads.
function extrude(ctx, r, h, top, front, side) {
  shadow(ctx, r.x, r.y, r.w, r.h, 14, 20, 0.38); // deeper, longer cast shadow
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(r.x + r.w, r.y);
  ctx.lineTo(r.x + r.w + 7, r.y - 7);
  ctx.lineTo(r.x + r.w + 7, r.y + r.h - h - 7);
  ctx.lineTo(r.x + r.w, r.y + r.h - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = front;
  ctx.fillRect(r.x, r.y + r.h - h, r.w, h);
  ctx.fillStyle = top;
  ctx.fillRect(r.x, r.y - h, r.w, r.h);
  // A thin lit edge on the top's south rim — the lamp light catching the rim.
  ctx.fillStyle = 'rgba(255, 230, 170, 0.45)';
  ctx.fillRect(r.x, r.y - h, r.w, 3);
}

function drawFloor(ctx, world, t) {
  const level = world.level;
  ctx.fillStyle = COLORS.floorA;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Big 64 px marble tiles with grout lines: texture you can read, not noise.
  for (let ty = 0; ty < 22; ty += 1) {
    for (let tx = 0; tx < 40; tx += 1) {
      const x = tx * TILE;
      const y = FLOOR.y + ty * TILE;
      ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x, y, TILE, TILE);
    }
  }
  ctx.strokeStyle = COLORS.grout;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 40; i += 1) {
    ctx.beginPath(); ctx.moveTo(i * TILE, FLOOR.y); ctx.lineTo(i * TILE, FLOOR.y + 704); ctx.stroke();
  }
  for (let i = 0; i <= 22; i += 1) {
    ctx.beginPath(); ctx.moveTo(0, FLOOR.y + i * TILE); ctx.lineTo(1280, FLOOR.y + i * TILE); ctx.stroke();
  }
  // Carpets: broad colour fields with a border — the room's identity at a glance.
  // A dark band on the far edge and a light one on the near edge fake the
  // perspective: the runner lies on the floor and runs away from you.
  for (const c of level.carpets) {
    ctx.fillStyle = c.color === 'red' ? COLORS.carpet : COLORS.carpetBlue;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
    ctx.fillRect(c.x, c.y, c.w, 7);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(c.x, c.y + c.h - 7, c.w, 7);
    ctx.strokeStyle = COLORS.carpetEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
    ctx.strokeStyle = 'rgba(232, 228, 216, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 9, c.y + 9, c.w - 18, c.h - 18);
  }
  // Atmospheric depth: the far floor hazes lighter, the near floor sits
  // darker — the room reads as a space, not a flat plan.
  const haze = ctx.createLinearGradient(0, FLOOR.y, 0, FLOOR.y + 704);
  haze.addColorStop(0, 'rgba(190, 200, 225, 0.07)');
  haze.addColorStop(1, 'rgba(0, 0, 0, 0.10)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, FLOOR.y, 1280, 704);
  // Shadow zones: deep dark floor with a dotted edge — safety you can see.
  for (const s of level.shadows) {
    ctx.fillStyle = COLORS.shadowZone;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = 'rgba(120, 140, 190, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
    ctx.setLineDash([]);
  }
  // Room labels, painted on the floor — large, few, never clutter. A dark
  // halo under a 0.38 alpha face at 46 px with tracking, so the room's name
  // reads without shouting.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';
  ctx.font = 'bold 46px Georgia, serif';
  for (const l of level.labels) {
    ctx.fillStyle = 'rgba(8, 10, 18, 0.55)';
    ctx.fillText(l.text, l.x * TILE + 16, l.y * TILE + 19);
    ctx.fillStyle = 'rgba(232, 228, 216, 0.38)';
    ctx.fillText(l.text, l.x * TILE + 16, l.y * TILE + 16);
  }
  ctx.letterSpacing = '0px';
}

function drawLampPools(ctx, world, t) {
  // Warm pools of light on the floor: danger ground, glowing softly.
  // On alarm the lamps flicker hard — the light itself tells the story.
  for (const l of world.level.lamps) {
    const flicker = world.alarm
      ? 0.72 + 0.28 * Math.sin(t * 13 + l.x * 0.11)
      : 0.92 + 0.08 * Math.sin(t * 2.1 + l.x * 0.05);
    const r = 150 * flicker;
    const g = ctx.createRadialGradient(l.x, l.y, 8, l.x, l.y, r);
    g.addColorStop(0, 'rgba(255, 214, 130, 0.20)');
    g.addColorStop(0.6, 'rgba(255, 190, 100, 0.08)');
    g.addColorStop(1, 'rgba(255, 190, 100, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoutes(ctx, world) {
  // Patrol routes, dotted with arrowheads: the route you can learn.
  ctx.strokeStyle = 'rgba(232, 228, 216, 0.30)';
  ctx.fillStyle = 'rgba(232, 228, 216, 0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 9]);
  for (const g of world.guards) {
    if (g.path.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(g.path[0].x, g.path[0].y);
    for (let i = 1; i <= g.path.length; i += 1) {
      const p = g.path[i % g.path.length];
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    for (let i = 0; i < g.path.length; i += 1) {
      const a = g.path[i];
      const b = g.path[(i + 1) % g.path.length];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-4, -5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.setLineDash([]);
}

// A vision cone as a volume of light: a floor wedge, brighter near the guard,
// plus a second, higher wedge offset up-left at low alpha, so the beam has
// height instead of lying flat like paint. The colour is interpolated by
// suspicion — the cone warms from pale gold to amber to red as the guard grows
// sure, never snapping between states. The cone angle lags the body turn
// (follow-through), so a turn reads as a sweep.
function coneFill(suspicion) {
  const a = [255, 214, 130, 0.30];
  const b = [255, 170, 60, 0.42];
  const c = [255, 70, 60, 0.48];
  const mix = (u, v, t) => u.map((x, i) => x + (v[i] - x) * t);
  const col = suspicion < 0.45 ? mix(a, b, suspicion / 0.45) : mix(b, c, (suspicion - 0.45) / 0.55);
  return `rgba(${Math.round(col[0])}, ${Math.round(col[1])}, ${Math.round(col[2])}, ${col[3]})`;
}

function drawCone(ctx, g) {
  const half = g.state === 'alert'
    ? GUARD.alertHalfAngle
    : g.state === 'suspicious' ? 0.36 : GUARD.viewHalfAngle;
  const range = GUARD.viewRange;
  const angle = g.coneAngle ?? g.facing;
  const color = coneFill(g.suspicion);
  const lift = g.state === 'alert' ? 7 : 5;
  for (let layer = 0; layer < 2; layer += 1) {
    const ox = -lift * layer * 0.7;
    const oy = -lift * layer;
    const alpha = layer === 0 ? 1 : 0.45;
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(g.x + ox, g.y + oy, 10, g.x + ox, g.y + oy, range);
    grad.addColorStop(0, color);
    grad.addColorStop(0.75, color);
    grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(g.x + ox, g.y + oy);
    ctx.arc(g.x + ox, g.y + oy, range, angle - half, angle + half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Bright rim on the cone's edges — the beam's sides catch the dark.
  ctx.strokeStyle = g.suspicion >= 0.45 ? 'rgba(255, 120, 70, 0.5)' : 'rgba(255, 220, 140, 0.35)';
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(angle + s * half) * range, g.y + Math.sin(angle + s * half) * range);
    ctx.stroke();
  }
}

// A camera beam: same volume-of-light language as a guard cone, but cold
// magenta and thinner — the sweep reads as a machine's, not a person's.
// The beam warms toward red as the camera's suspicion fills, and a bright
// scan line runs down its centre so the sweep's direction is unmistakable.
function camConeFill(suspicion) {
  const a = [255, 90, 200, 0.30];
  const b = [255, 60, 110, 0.48];
  const col = a.map((x, i) => x + (b[i] - x) * suspicion);
  return `rgba(${Math.round(col[0])}, ${Math.round(col[1])}, ${Math.round(col[2])}, ${col[3]})`;
}

function drawCamCone(ctx, cam) {
  const range = CAMERA.range;
  const half = CAMERA.halfAngle;
  const color = camConeFill(cam.suspicion);
  const grad = ctx.createRadialGradient(cam.x, cam.y, 8, cam.x, cam.y, range);
  grad.addColorStop(0, color);
  grad.addColorStop(0.75, color);
  grad.addColorStop(1, 'rgba(255, 90, 200, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.arc(cam.x, cam.y, range, cam.angle - half, cam.angle + half);
  ctx.closePath();
  ctx.fill();
  // The scan line: bright, down the middle of the beam.
  ctx.strokeStyle = cam.suspicion >= 0.5 ? 'rgba(255, 120, 160, 0.75)' : 'rgba(255, 160, 220, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.lineTo(cam.x + Math.cos(cam.angle) * range, cam.y + Math.sin(cam.angle) * range);
  ctx.stroke();
  // Rims, fainter than a guard cone's — the beam is thin by design.
  ctx.strokeStyle = 'rgba(255, 120, 210, 0.35)';
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cam.x, cam.y);
    ctx.lineTo(cam.x + Math.cos(cam.angle + s * half) * range, cam.y + Math.sin(cam.angle + s * half) * range);
    ctx.stroke();
  }
}

// A laser grid: straight magenta lines across a corridor, on a clock.
// The beams are lines, never cones — the shape is what tells them apart
// from the cameras at a glance. Off: only a faint dotted guide line, so the
// thief can see where the beams will be. Warn: the beams flicker in, and
// the emitter dots blink red. On: a bright core with a soft glow, warming
// toward red as the grid's suspicion fills.
function drawLaserBeams(ctx, grid, t) {
  const hot = grid.suspicion; // 0..1 — the beam warms as the grid grows sure
  const core = `rgba(${Math.round(255)}, ${Math.round(138 - 78 * hot)}, ${Math.round(216 - 106 * hot)}, 1)`;
  for (const b of grid.beams) {
    if (grid.state === 'off') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 90, 200, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 7]);
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    const flicker = grid.state === 'warn' ? 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 14)) : 1;
    ctx.save();
    ctx.globalAlpha = flicker;
    ctx.strokeStyle = COLORS.laserGlow;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.strokeStyle = core;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    ctx.restore();
  }
}

// The emitter and receiver posts: small wall boxes at each beam's ends, with
// a tally dot that is dim when the grid is dark, blinking red while it warns,
// and solid magenta while the beams are live — the machine is visible, so
// the beams are never a surprise.
function drawLaserPosts(ctx, grid, t) {
  for (const b of grid.beams) {
    for (const [ex, ey] of [[b.x1, b.y1], [b.x2, b.y2]]) {
      const ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
      shadow(ctx, ex - 7, ey - 4, 14, 8, 3, 4, 0.35);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = COLORS.laserPost;
      ctx.fillRect(-7, -4, 14, 8);
      ctx.fillStyle = '#241a28';
      ctx.fillRect(4, -3, 4, 6);
      ctx.restore();
      const blink = 0.5 + 0.5 * Math.sin(t * 8 + ex * 0.05);
      const dot = grid.state === 'on'
        ? 'rgba(255, 90, 200, 0.95)'
        : grid.state === 'warn'
          ? `rgba(255, 60, 80, ${0.45 + 0.55 * blink})`
          : 'rgba(255, 90, 200, 0.3)';
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(ex, ey - 7, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The camera itself: a small wall-mounted box with a lens that follows the
// beam, a red tally dot that blinks while it sweeps, and a CAM tag —
// the machine is visible, so its beam is never a surprise.
function drawCamera(ctx, cam, t) {
  shadow(ctx, cam.x - 11, cam.y - 6, 22, 12, 5, 7, 0.35);
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.rotate(cam.angle);
  ctx.fillStyle = COLORS.camBody;
  ctx.fillRect(-11, -7, 22, 14);
  ctx.fillStyle = '#241a28';
  ctx.beginPath();
  ctx.arc(11, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.camLens;
  ctx.beginPath();
  ctx.arc(11, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const blink = 0.5 + 0.5 * Math.sin(t * 4 + cam.index * 2.1);
  ctx.fillStyle = `rgba(255, 60, 80, ${0.45 + 0.55 * blink})`;
  ctx.beginPath();
  ctx.arc(cam.x - 8, cam.y - 11, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 10px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(232, 228, 216, 0.75)';
  ctx.fillText(`CAM-${cam.index + 1}`, cam.x, cam.y + 16);
  if (cam.suspicion > 0.05) {
    ctx.strokeStyle = cam.suspicion >= 1 ? 'rgba(255, 60, 90, 0.9)' : 'rgba(255, 90, 200, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 11, -Math.PI / 2, -Math.PI / 2 + cam.suspicion * Math.PI * 2);
    ctx.stroke();
  }
}

// A searchlight beam: the same volume-of-light language as a guard cone, but
// warm white, wide and long — a flood sweeping the floor, not a needle. The
// beam warms toward amber as the searchlight's suspicion fills, and a bright
// core line runs down its centre so the sweep's direction is unmistakable.
function drawSearchlightCone(ctx, sl) {
  const range = SEARCHLIGHT.range;
  const half = SEARCHLIGHT.halfAngle;
  const hot = sl.suspicion; // 0..1 — the beam warms as the light grows sure
  const color = `rgba(${Math.round(255)}, ${Math.round(248 - 30 * hot)}, ${Math.round(225 - 90 * hot)}, ${0.36 + 0.14 * hot})`;
  const grad = ctx.createRadialGradient(sl.x, sl.y, 8, sl.x, sl.y, range);
  grad.addColorStop(0, color);
  grad.addColorStop(0.7, color);
  grad.addColorStop(1, 'rgba(255, 248, 225, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(sl.x, sl.y);
  ctx.arc(sl.x, sl.y, range, sl.angle - half, sl.angle + half);
  ctx.closePath();
  ctx.fill();
  // The core line: bright white, down the middle of the beam.
  ctx.strokeStyle = sl.suspicion >= 0.5 ? 'rgba(255, 240, 200, 0.9)' : COLORS.slCore;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sl.x, sl.y);
  ctx.lineTo(sl.x + Math.cos(sl.angle) * range, sl.y + Math.sin(sl.angle) * range);
  ctx.stroke();
  // Rims, soft — the beam is wide by design, its edges are light, not lines.
  ctx.strokeStyle = 'rgba(255, 250, 230, 0.3)';
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sl.x, sl.y);
    ctx.lineTo(sl.x + Math.cos(sl.angle + s * half) * range, sl.y + Math.sin(sl.angle + s * half) * range);
    ctx.stroke();
  }
  // Warm pool where the beam lands: the far end glows on the floor, so the
  // flood has a destination instead of fading into nothing.
  const px = sl.x + Math.cos(sl.angle) * range * 0.92;
  const py = sl.y + Math.sin(sl.angle) * range * 0.92;
  const pool = ctx.createRadialGradient(px, py, 4, px, py, 95);
  pool.addColorStop(0, `rgba(255, 244, 210, ${0.16 + 0.08 * hot})`);
  pool.addColorStop(1, 'rgba(255, 244, 210, 0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(px, py, 95, 0, Math.PI * 2);
  ctx.fill();
}

// The searchlight itself: a small rooftop tower on the north wall, a mast
// with a lamp head that turns with the beam, and a warm tally dot — the
// machine is visible, so its beam is never a surprise.
function drawSearchlight(ctx, sl, t) {
  shadow(ctx, sl.x - 9, sl.y - 5, 18, 10, 4, 6, 0.35);
  ctx.save();
  ctx.translate(sl.x, sl.y);
  ctx.fillStyle = COLORS.slBody;
  ctx.fillRect(-9, -5, 18, 10); // the tower base, bolted to the wall
  ctx.rotate(sl.angle);
  ctx.fillStyle = '#2c2820';
  ctx.fillRect(2, -4, 14, 8); // the lamp head, turning with the beam
  ctx.fillStyle = COLORS.slLens;
  ctx.beginPath();
  ctx.arc(16, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const blink = 0.5 + 0.5 * Math.sin(t * 3 + sl.index * 2.1);
  ctx.fillStyle = `rgba(255, 220, 140, ${0.5 + 0.5 * blink})`;
  ctx.beginPath();
  ctx.arc(sl.x - 7, sl.y - 9, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 10px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // A dark halo behind the tag — the label sits on a bright beam, and
  // without it the white sweep eats the letters.
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.strokeText('SEARCHLIGHT', sl.x, sl.y + 17);
  ctx.fillStyle = 'rgba(232, 228, 216, 0.75)';
  ctx.fillText('SEARCHLIGHT', sl.x, sl.y + 17);
  if (sl.suspicion > 0.05) {
    ctx.strokeStyle = sl.suspicion >= 1 ? 'rgba(255, 60, 90, 0.9)' : 'rgba(255, 220, 140, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sl.x, sl.y, 13, -Math.PI / 2, -Math.PI / 2 + sl.suspicion * Math.PI * 2);
    ctx.stroke();
  }
}

function drawLoot(ctx, world, t) {
  for (const l of world.loot) {
    if (l.taken) continue;
    if (l.vault) {
      // Vault gold: a gold bar on a dark plinth — a small 3D ingot with a glint.
      shadow(ctx, l.x - 9, l.y - 5, 18, 10, 4, 5, 0.35);
      ctx.fillStyle = '#7a5c1e';
      ctx.fillRect(l.x - 9, l.y - 4, 18, 8);
      ctx.fillStyle = COLORS.lootGold;
      ctx.beginPath();
      ctx.moveTo(l.x - 8, l.y - 4);
      ctx.lineTo(l.x - 5, l.y - 9);
      ctx.lineTo(l.x + 5, l.y - 9);
      ctx.lineTo(l.x + 8, l.y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(l.x - 4, l.y - 8, 3, 2);
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + l.x);
      ctx.fillStyle = `rgba(255, 240, 180, ${0.25 + 0.45 * tw})`;
      ctx.beginPath();
      ctx.arc(l.x, l.y - 12, 3 + tw * 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // A cash bundle: green paper banded in gold, with a glint — money you can see.
    shadow(ctx, l.x - 10, l.y - 6, 20, 12, 4, 5, 0.35);
    ctx.fillStyle = '#1e4a30';
    ctx.fillRect(l.x - 10, l.y - 6, 20, 12);
    ctx.fillStyle = '#2e6b44';
    ctx.fillRect(l.x - 10, l.y - 9, 20, 6);
    ctx.fillStyle = COLORS.lootGold;
    ctx.fillRect(l.x - 3, l.y - 9, 6, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(l.x - 7, l.y - 8, 3, 2);
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + l.x);
    ctx.fillStyle = `rgba(255, 240, 180, ${0.25 + 0.45 * tw})`;
    ctx.beginPath();
    ctx.arc(l.x, l.y - 13, 3 + tw * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!world.keycard.taken) {
    const k = world.keycard;
    shadow(ctx, k.x - 11, k.y - 7, 22, 14, 4, 5, 0.35);
    ctx.fillStyle = '#12303f';
    ctx.fillRect(k.x - 11, k.y - 7, 22, 14);
    ctx.fillStyle = COLORS.keycard;
    ctx.fillRect(k.x - 11, k.y - 12, 22, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(k.x - 7, k.y - 11, 7, 3);
  }
}

// The vault door: a big round steel door set into the east wall, with a gold
// dial ring, spokes and a hub. Closed it is the room's centrepiece; open it
// swings aside and gold light spills out of the dark inside. The dial's
// needle follows the crack state, so the door shows the minigame even from
// across the room.
function drawVault(ctx, world, t) {
  const v = world.level.vault;
  if (!v) return;
  const open = world.vaultOpen;
  const crack = world.crack;
  shadow(ctx, v.x - v.r, v.y - v.r, v.r * 2, v.r * 2, 10, 12, 0.4);
  // The dark mouth behind the door, once it opens.
  ctx.fillStyle = '#0a0c14';
  ctx.beginPath();
  ctx.arc(v.x, v.y, v.r - 6, 0, Math.PI * 2);
  ctx.fill();
  if (open) {
    // Gold light spilling out of the open vault.
    const g = ctx.createRadialGradient(v.x, v.y, 4, v.x, v.y, v.r + 70);
    g.addColorStop(0, 'rgba(242, 193, 78, 0.5)');
    g.addColorStop(1, 'rgba(242, 193, 78, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(v.x, v.y, v.r + 70, 0, Math.PI * 2);
    ctx.fill();
  }
  // The door itself: steel disc, gold ring, spokes. When open it swings
  // west, drawn offset so the mouth shows.
  const dx = open ? -v.r * 0.9 : 0;
  ctx.save();
  ctx.translate(v.x + dx, v.y);
  ctx.fillStyle = COLORS.vaultSteel;
  ctx.beginPath();
  ctx.arc(0, 0, v.r - 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 230, 170, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, v.r - 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = COLORS.vaultDark;
  ctx.lineWidth = 5;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
    ctx.lineTo(Math.cos(a) * (v.r - 12), Math.sin(a) * (v.r - 12));
    ctx.stroke();
  }
  // The dial ring: gold, with the crack needle when Rook is working it.
  ctx.strokeStyle = COLORS.vaultGold;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.stroke();
  if (crack.active) {
    const na = crack.needle;
    ctx.strokeStyle = '#fff6d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(na) * 20, -Math.cos(na) * 20);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.vaultDark;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The label sits LEFT of the door, right-aligned — a door at the canvas
  // edge must never clip its own name. It sits at mid-height on the red
  // carpet: above it the duct wall would eat it, below it the north vault
  // wall would. Mid-height is open floor.
  ctx.fillStyle = open ? COLORS.vaultGold : 'rgba(242, 193, 78, 0.75)';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('VAULT', v.x - v.r - 12, v.y + 6);
  ctx.font = 'bold 12px Georgia, serif';
  ctx.fillStyle = open ? 'rgba(55, 224, 138, 0.9)' : 'rgba(232, 228, 216, 0.55)';
  ctx.fillText(open ? '— OPEN' : world.crack.active ? '· CRACKING…' : '· LOCKED', v.x - v.r - 12, v.y + 24);
}

function drawExit(ctx, world, t) {
  const ex = world.level.exit;
  const cx = ex.x + ex.w / 2;
  const cy = ex.y + ex.h / 2;
  const open = world.keycardTaken && (!world.level.vault || world.vaultOpen);
  if (ex.van) {
    // The getaway van: dark green, parked at the east door with its lights
    // on, nose east. It only reads as the way out once the vault is open —
    // before that its lights are off and the door is just a door.
    const pulse = open ? 0.75 + 0.25 * Math.sin(t * 2.4) : 0.35;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 130);
    g.addColorStop(0, `rgba(255, 233, 176, ${0.35 * pulse})`);
    g.addColorStop(1, 'rgba(255, 233, 176, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 130, 0, Math.PI * 2);
    ctx.fill();
    shadow(ctx, cx - 34, cy - 26, 68, 52, 8, 10, 0.4);
    ctx.fillStyle = open ? COLORS.vanBody : '#22332a';
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy - 26);
    ctx.lineTo(cx + 10, cy - 26);
    ctx.lineTo(cx + 34, cy - 8);
    ctx.lineTo(cx + 34, cy + 26);
    ctx.lineTo(cx - 34, cy + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = open ? COLORS.vanTop : '#2c4036';
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy - 26);
    ctx.lineTo(cx + 10, cy - 26);
    ctx.lineTo(cx + 34, cy - 8);
    ctx.lineTo(cx - 34, cy - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = open ? COLORS.vanLight : 'rgba(255, 233, 176, 0.25)';
    ctx.beginPath();
    ctx.arc(cx + 30, cy - 2, 4, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#141824';
    ctx.beginPath();
    ctx.arc(cx - 18, cy + 26, 9, 0, Math.PI * 2);
    ctx.arc(cx + 18, cy + 26, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = open ? COLORS.exitGlow : 'rgba(55, 224, 138, 0.6)';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    // A door near the top of the frame gets its label BELOW it: the HUD bar
    // would eat a label drawn above a high door.
    const below = cy < 220;
    ctx.fillText('VAN', ex.x - 12, below ? cy + 44 : cy - 34);
    ctx.font = 'bold 12px Georgia, serif';
    ctx.fillStyle = open ? 'rgba(55, 224, 138, 0.9)' : 'rgba(232, 228, 216, 0.55)';
    ctx.fillText(open ? '— GO GO GO' : '· WAITING', ex.x - 12, below ? cy + 62 : cy - 16);
    return;
  }
  // Green light spilling out of the stair door, pulsing gently when it is open.
  const pulse = open ? 0.75 + 0.25 * Math.sin(t * 2.4) : 0.35;
  const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 120);
  g.addColorStop(0, `rgba(55, 224, 138, ${0.4 * pulse})`);
  g.addColorStop(1, 'rgba(55, 224, 138, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.fill();
  extrude(ctx, ex, 30, open ? '#2f7a52' : '#274a38', '#16261d', '#1e3328');
  // The label sits LEFT of the door, right-aligned — a door at the canvas
  // edge must never clip its own name. A door near the top of the frame gets
  // its label BELOW it: the HUD bar would eat a label drawn above a high door.
  const below = cy < 220;
  ctx.fillStyle = open ? COLORS.exitGlow : 'rgba(55, 224, 138, 0.6)';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', ex.x - 12, below ? cy + 44 : cy - 34);
  ctx.font = 'bold 12px Georgia, serif';
  ctx.fillStyle = open ? 'rgba(55, 224, 138, 0.9)' : 'rgba(232, 228, 216, 0.55)';
  ctx.fillText(open ? '— OPEN' : '· LOCKED', ex.x - 12, below ? cy + 62 : cy - 16);
}

function drawCrate(ctx, c) {
  extrude(ctx, c, CRATE_H, COLORS.crateTop, COLORS.crateFront, COLORS.crateSide);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x + 4, c.y - CRATE_H + 4);
  ctx.lineTo(c.x + c.w - 4, c.y - CRATE_H + c.h - 4);
  ctx.moveTo(c.x + c.w - 4, c.y - CRATE_H + 4);
  ctx.lineTo(c.x + 4, c.y - CRATE_H + c.h - 4);
  ctx.stroke();
}

function drawPillar(ctx, p) {
  shadow(ctx, p.x - 12, p.y - 6, 24, 12, 8, 10, 0.35);
  ctx.fillStyle = COLORS.pillarBody;
  ctx.fillRect(p.x - 11, p.y - PILLAR_H, 22, PILLAR_H + 4);
  ctx.fillStyle = COLORS.pillarTop;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - PILLAR_H, 13, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(p.x - 4, p.y - PILLAR_H - 2, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDesk(ctx, d) {
  extrude(ctx, d, DESK_H, COLORS.deskTop, COLORS.deskFront, '#2c3550');
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(d.x + 4, d.y - DESK_H + 3, d.w - 8, 3);
}

function drawPlant(ctx, p, t) {
  shadow(ctx, p.x - 10, p.y - 4, 20, 10, 5, 6, 0.35);
  ctx.fillStyle = COLORS.plantPot;
  ctx.beginPath();
  ctx.moveTo(p.x - 10, p.y - 2);
  ctx.lineTo(p.x + 10, p.y - 2);
  ctx.lineTo(p.x + 7, p.y + 8);
  ctx.lineTo(p.x - 7, p.y + 8);
  ctx.closePath();
  ctx.fill();
  const sway = Math.sin(t * 1.3 + p.x * 0.1) * 2;
  for (const [dx, dy, r, col] of [[-7, -16, 9, COLORS.leaf], [6, -18, 10, COLORS.leafDark], [0, -24, 9, COLORS.leaf]]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x + dx + sway, p.y + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuard(ctx, g, t) {
  const bob = Math.sin(g.bob) * 1.5;
  const x = g.x;
  const y = g.y + bob * 0.3;
  // The anticipation telegraph: while the guard is deciding its next leg, a
  // faint dotted line shows where it is about to walk — the turn is readable
  // before the feet move.
  if (g.anticip > 0 && g.path.length > 1) {
    const next = g.path[(g.leg + 1) % g.path.length];
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 228, 216, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    ctx.restore();
  }
  shadow(ctx, x - 12, y - 6, 24, 12, 7, 9, 0.35);
  // Body: a tall figure in a lighter uniform — coat, shoulders, cap — with a
  // red trim and a pale outline that keeps the guard visible against the floor.
  ctx.fillStyle = '#414a66';
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 12, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 228, 216, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = COLORS.guardTrim;
  ctx.fillRect(x - 12, y - 16, 24, 4);
  // Head + cap, turned toward the facing.
  const hx = x + Math.cos(g.facing) * 4;
  const hy = y - 22 + Math.sin(g.facing) * 2;
  ctx.fillStyle = '#c9a37e';
  ctx.beginPath();
  ctx.arc(hx, hy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d2333';
  ctx.beginPath();
  ctx.arc(hx, hy - 2, 7, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(hx - 7, hy - 4, 14, 3);
  // Facing tick: a short nose line so the direction reads at 300 px.
  ctx.strokeStyle = 'rgba(232,228,216,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.cos(g.facing) * 10, hy + Math.sin(g.facing) * 10);
  ctx.stroke();
  // "?" while suspicious, "!" while alert — big, high contrast.
  if (g.state === 'suspicious' || g.state === 'alert') {
    const mark = g.state === 'alert' ? '!' : '?';
    const col = g.state === 'alert' ? COLORS.alarm : '#ffb43c';
    const pop = 1 + 0.12 * Math.sin(t * 6);
    ctx.font = `bold ${Math.round(26 * pop)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(mark, x, y - 44);
    ctx.fillStyle = col;
    ctx.fillText(mark, x, y - 44);
  }
  // Suspicion arc over the guard's head: the meter, where you look.
  if (g.suspicion > 0.05 && g.state !== 'alert') {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y - 34, 11, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = g.suspicion >= GUARD.suspectAt ? '#ffb43c' : '#e8e4d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - 34, 11, -Math.PI / 2, -Math.PI / 2 + g.suspicion * Math.PI * 2);
    ctx.stroke();
  }
}

// The service duct: a recessed channel, darker than the floor, with slats
// along its length and a metal grate hatch at each end — a hole in the floor,
// not another beam. The grates are the only way in or out, so they are drawn
// as real hatches (frame + crossbars + a DUCT tag), big enough to read at
// 300 px. The duct is floor-level, so it paints before the loot and cones.
function drawDuct(ctx, duct) {
  const r = duct.rect;
  ctx.fillStyle = COLORS.ductChannel;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = COLORS.ductInner;
  ctx.fillRect(r.x, r.y + 4, r.w, r.h - 8);
  // Depth: the duct reads as sunk into the floor — a dark inner shadow along
  // its north rim, a faint lit rim along its south edge, so the channel looks
  // recessed, not painted.
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  g.addColorStop(0.35, 'rgba(0, 0, 0, 0)');
  g.addColorStop(0.85, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0.13)');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Slats: the duct reads as a channel, not a painted stripe.
  ctx.strokeStyle = COLORS.ductSlat;
  ctx.lineWidth = 2;
  for (let x = r.x + 16; x < r.x + r.w; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, r.y + 5);
    ctx.lineTo(x, r.y + r.h - 5);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(232, 228, 216, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  for (const [gx, gy, tag] of [[duct.entry.x, duct.entry.y, 'DUCT'], [duct.exit.x, duct.exit.y, 'DUCT']]) {
    // Grate thickness: a darker front face under the hatch, so the grate
    // reads as a slab set into the duct, not a flat decal.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(gx - 15, gy - 13 + 6, 30, 26);
    shadow(ctx, gx - 15, gy - 13, 30, 26, 3, 4, 0.4);
    ctx.fillStyle = COLORS.ductGrateDark;
    ctx.fillRect(gx - 15, gy - 13, 30, 26);
    ctx.fillStyle = COLORS.ductGrate;
    ctx.fillRect(gx - 13, gy - 11, 26, 22);
    ctx.fillStyle = COLORS.ductGrateDark;
    for (let i = -1; i <= 1; i += 1) ctx.fillRect(gx - 13, gy + i * 7 - 1, 26, 2);
    ctx.fillRect(gx - 1, gy - 11, 2, 22);
    ctx.font = 'bold 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ductTag;
    ctx.fillText(tag, gx, gy + 21);
  }
}

function drawPlayer(ctx, p, t) {
  const scale = popScale(p) * settleScale(p) * (p.inDuct ? 0.8 : 1); // crouched small in the duct
  const x = p.x;
  const y = p.y;
  shadow(ctx, x - 11, y - 5, 22, 11, 6, 8, p.inDuct ? 0.6 : 0.35); // darker shadow in the duct — deeper in the dark
  const bob = p.moving ? Math.sin(t * (p.sneaking ? 8 : 12)) * 1.2 : 0;
  ctx.save();
  ctx.translate(x, y + bob * 0.3);
  if (p.inDuct) ctx.globalAlpha = 0.8; // dimmed in the duct — crouched in the dark
  ctx.scale(scale, 2 - scale); // squash-and-stretch: wide when flat, tall when thin
  // Rook: a burgundy cloak with gold trim and a dark hood — bright against
  // the marble, and no guard wears this colour, so the thief is unmistakable.
  ctx.fillStyle = '#7a2e35';
  ctx.beginPath();
  ctx.ellipse(0, -11, 11, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.vaultGold;
  ctx.fillRect(-11, -15, 22, 3);
  ctx.fillStyle = '#1d1420';
  ctx.beginPath();
  ctx.arc(Math.cos(p.facing) * 3, -21 + Math.sin(p.facing) * 2, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e4d8';
  ctx.beginPath();
  ctx.arc(Math.cos(p.facing) * 3, -21 + Math.sin(p.facing) * 2, 6.5, Math.PI, 0);
  ctx.fill();
  ctx.restore();
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(232,228,216,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - 11, 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (p.hidden) {
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(160,180,220,0.95)';
    ctx.fillText('HIDDEN', x, y - 36);
  }
}

function drawParticles(ctx, world) {
  for (const p of world.particles.list) {
    const a = 1 - p.t / p.life;
    if (p.kind === 'dust') {
      ctx.fillStyle = `rgba(200, 190, 170, ${0.35 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + p.t), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'glint') {
      ctx.fillStyle = `rgba(255, 240, 180, ${0.9 * a})`;
      ctx.fillRect(p.x - 1.5, p.y - 4, 3, 8);
      ctx.fillRect(p.x - 4, p.y - 1.5, 8, 3);
    } else if (p.kind === 'spark') {
      ctx.fillStyle = `rgba(255, 90, 60, ${0.9 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'gold') {
      // The loot burst: gold sparks with a bright core — the grab sparkles.
      ctx.fillStyle = `rgba(242, 193, 78, ${0.95 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 246, 200, ${0.9 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.size * a + 0.5) * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'print') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = `rgba(12, 14, 22, ${0.4 * a})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'ring') {
      const rr = p.size + (1 - a) * 46;
      ctx.strokeStyle = p.color ?? 'rgba(255, 180, 60, 0.8)';
      ctx.globalAlpha = a;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 12, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = `rgba(120, 255, 170, ${0.5 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The thrown pebble: a small ring that fades — the noise, made visible.
  if (world.player.pebble) {
    const pb = world.player.pebble;
    const a = 1 - pb.t / 3.5;
    ctx.strokeStyle = `rgba(255, 220, 130, ${0.7 * a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pb.x, pb.y, 6 + (1 - a) * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawWorld(ctx, world, screen, t) {
  const level = world.level;
  // The camera: a gentle 1.025x drift that eases toward the thief (the
  // world's own follow-through), plus trauma shake that decays, never snaps.
  // Staged shots set camX/camY by hand, so the frame is deterministic.
  // The HUD is painted after the restore, unscaled and unshaken.
  ctx.save();
  if (world.camFollow !== false) {
    const zx = 640 + (640 - world.camX) * 0.035;
    const zy = 360 + (360 - world.camY) * 0.035;
    ctx.translate(zx, zy);
    ctx.scale(1.025, 1.025);
    ctx.translate(-640, -360);
  }
  if (world.shake > 0) {
    const s = world.shake * world.shake * SHAKE.maxPx;
    ctx.translate(Math.sin(t * 47.3) * s, Math.cos(t * 39.7) * s);
  }
  drawFloor(ctx, world, t);
  drawLampPools(ctx, world, t);
  drawRoutes(ctx, world);
  for (const v of world.ducts) drawDuct(ctx, v); // the duct is floor-level, under the loot and cones
  drawLoot(ctx, world, t);
  drawVault(ctx, world, t);
  drawExit(ctx, world, t);
  for (const g of world.guards) drawCone(ctx, g);
  for (const cam of world.cameras) drawCamCone(ctx, cam);
  for (const grid of world.lasers) drawLaserBeams(ctx, grid, t);
  for (const sl of world.searchlights) drawSearchlightCone(ctx, sl);
  // Solids and bodies, sorted by their feet so nearer things overlap farther ones.
  // Freestanding props and bodies render through depthWrap (perspective scale
  // by feet y); wall-mounted machines and walls stay unscaled so the room's
  // grid never drifts.
  const solids = [];
  for (const c of level.crates) solids.push({ y: c.y + c.h, draw: () => depthWrap(ctx, c.x + c.w / 2, c.y + c.h, () => drawCrate(ctx, c)) });
  for (const p of level.pillars) solids.push({ y: p.y, draw: () => depthWrap(ctx, p.x, p.y, () => drawPillar(ctx, p)) });
  for (const d of level.desks) solids.push({ y: d.y + d.h, draw: () => depthWrap(ctx, d.x + d.w / 2, d.y + d.h, () => drawDesk(ctx, d)) });
  for (const p of level.plants) solids.push({ y: p.y + 8, draw: () => depthWrap(ctx, p.x, p.y + 8, () => drawPlant(ctx, p, t)) });
  for (const g of world.guards) solids.push({ y: g.y, draw: () => depthWrap(ctx, g.x, g.y, () => drawGuard(ctx, g, t)) });
  for (const cam of world.cameras) solids.push({ y: cam.y, draw: () => drawCamera(ctx, cam, t) });
  for (const grid of world.lasers) solids.push({ y: grid.beams[0].y2, draw: () => drawLaserPosts(ctx, grid, t) });
  for (const sl of world.searchlights) solids.push({ y: sl.y, draw: () => drawSearchlight(ctx, sl, t) });
  solids.push({ y: world.player.y, draw: () => depthWrap(ctx, world.player.x, world.player.y, () => drawPlayer(ctx, world.player, t)) });
  // Walls join the same sort, keyed by their base — a guard south of a wall
  // stands in front of it and must be drawn over its front face.
  for (const w of level.walls) solids.push({ y: w.y + w.h, draw: () => extrude(ctx, w, WALL_H, COLORS.wallTop, COLORS.wallFront, COLORS.wallSide) });
  solids.sort((a, b) => a.y - b.y);
  for (const s of solids) s.draw();
  drawParticles(ctx, world);
  // A soft vignette: the room is dark at the edges, lit where the lamps are.
  const v = ctx.createRadialGradient(640, 360, 300, 640, 360, 760);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.restore();
  drawHud(ctx, world, screen, t);
}
