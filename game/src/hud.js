// HUD: the detection eye, the objectives, the level, the loot and the timer.
// Elements pop in staggered (one after another, 70 ms apart, easeOutBack) when
// a room starts, so the screen assembles instead of appearing flat. In a
// staged screenshot the pop-in is already finished. The heist adds two
// panels the stealth game never had: the vault-crack dial (a big gold ring
// with a green window and a needle, centre screen while cracking) and the
// getaway countdown (big amber digits once the vault is open).
import { COLORS, CRACK, MOTION, VIEW } from './config.js';
import { clamp, easeOutBack, easeOutCubic, staggerDelay } from './motion.js';
import { SCREEN_CAUGHT, SCREEN_LEVEL, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './world.js';

function popIn(t, delay) {
  const x = (t - delay) / MOTION.standard;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return easeOutBack(x);
}

function bar(ctx, x, y, w, h, back, fill, frac) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function eyeColor(s) {
  if (s >= 1) return '#ff4a3c';
  if (s >= 0.45) return '#ffb43c';
  return '#37e08a';
}

// The detection eye: closed and green when unseen, opening and reddening as
// suspicion rises, wide and red on full alert.
function drawEye(ctx, cx, cy, r, suspicion, t) {
  const open = 0.25 + 0.75 * suspicion;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(10,12,20,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = eyeColor(suspicion);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
  ctx.stroke();
  // The eye outline, pinched by how closed it is.
  ctx.fillStyle = '#e8e4d8';
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.quadraticCurveTo(0, -r * open * 1.15, r, 0);
  ctx.quadraticCurveTo(0, r * open * 1.15, -r, 0);
  ctx.fill();
  // The iris: grows and reddens with suspicion.
  const irisR = r * (0.3 + 0.45 * suspicion);
  ctx.fillStyle = eyeColor(suspicion);
  ctx.beginPath();
  ctx.arc(0, 0, irisR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0c14';
  ctx.beginPath();
  ctx.arc(0, 0, irisR * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS.hudBack;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(232,228,216,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

// The vault-crack dial: a big gold ring, centre screen. The green window is
// the target zone, the needle sweeps back and forth, and three pips show the
// tumblers locked so far. The prompt says what to do — SPACE — in plain words.
function drawCrackDial(ctx, world, t) {
  const crack = world.crack;
  if (!crack.active) return;
  const cx = VIEW.width / 2;
  const cy = 330;
  const R = 92;
  ctx.save();
  // Dim the room behind the dial so the minigame owns the frame.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // The ring: brushed steel outside, gold inside, with a rim light.
  ctx.fillStyle = 'rgba(10, 12, 20, 0.88)';
  ctx.beginPath();
  ctx.arc(cx, cy, R + 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.vaultGold;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = COLORS.vaultDark;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 230, 170, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  // Tick marks around the dial, one every 15 degrees.
  ctx.strokeStyle = 'rgba(232, 228, 216, 0.4)';
  ctx.lineWidth = 2;
  for (let a = -1.2; a <= 1.2; a += Math.PI / 12) {
    const x1 = cx + Math.sin(a) * (R - 10);
    const y1 = cy - Math.cos(a) * (R - 10);
    const x2 = cx + Math.sin(a) * (R - 2);
    const y2 = cy - Math.cos(a) * (R - 2);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // The green window: the target zone, wide and bright.
  const a0 = crack.target - CRACK.zoneHalf;
  const a1 = crack.target + CRACK.zoneHalf;
  ctx.strokeStyle = COLORS.vaultGreen;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 20, -Math.PI / 2 + a0, -Math.PI / 2 + a1);
  ctx.stroke();
  // The needle: gold, with a bright tip — it sweeps, it never snaps.
  const na = crack.needle;
  const nx = cx + Math.sin(na) * (R - 8);
  const ny = cy - Math.cos(na) * (R - 8);
  ctx.strokeStyle = COLORS.vaultGold;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.stroke();
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(nx, ny, 5, 0, Math.PI * 2);
  ctx.fill();
  // Hub + tumbler pips.
  ctx.fillStyle = COLORS.vaultSteel;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 230, 170, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < CRACK.tumblers; i += 1) {
    const px = cx - 28 + i * 28;
    const py = cy + R - 2;
    ctx.fillStyle = i < crack.locked ? COLORS.vaultGreen : 'rgba(232,228,216,0.25)';
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,228,216,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // The flash: green on a lock, red on a miss — the dial answers the press.
  if (crack.flash > 0) {
    ctx.fillStyle = crack.flashGood
      ? `rgba(55, 224, 138, ${0.25 * crack.flash})`
      : `rgba(255, 74, 60, ${0.3 * crack.flash})`;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
  }
  // The prompt: what to do, in plain words, big enough to read at 300 px.
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CRACK THE VAULT', cx, cy - R - 52);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '16px Georgia, serif';
  ctx.fillText('SPACE when the needle is in the green', cx, cy + R + 52);
  ctx.restore();
}

export function drawHud(ctx, world, screen, t) {
  const level = world.level;
  const intro = screen === SCREEN_PLAY ? world.screenT : 10;
  const time = world.timeFrozen ?? world.time;

  // Top bar: room + objective | detection eye | loot + timer.
  const a0 = popIn(intro, staggerDelay(0, 0.07));
  const a1 = popIn(intro, staggerDelay(1, 0.07));
  const a2 = popIn(intro, staggerDelay(2, 0.07));
  const a3 = popIn(intro, staggerDelay(3, 0.07));

  ctx.save();
  ctx.globalAlpha = a0;
  panel(ctx, 12, 10, 430, 44, 1);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`MIDNIGHT VAULT — ${level.name}`, 24, 26);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '13px Georgia, serif';
  const threat = level.searchlights ? 'searchlights' : level.lasers ? 'lasers' : level.cameras ? 'cameras' : null;
  const hasDuct = !!level.ducts;
  const hasVault = !!level.vault;
  let obj;
  if (hasVault) {
    obj = world.vaultOpen
      ? 'VAULT OPEN — run for the van, the police are coming'
      : world.keycardTaken
        ? 'Reach the vault dial — SPACE on the green, three tumblers'
        : 'Find the keycard — cameras sweep, or crawl the duct';
  } else if (hasDuct) {
    obj = world.keycardTaken ? 'Reach the stair door — floor is fast, duct is safe' : 'Find the keycard — cameras sweep, or crawl the duct';
  } else if (threat === 'searchlights') {
    obj = world.keycardTaken ? 'Reach the stair door — mind the searchlight' : 'Find the keycard — time the searchlight sweep';
  } else if (threat === 'lasers') {
    obj = world.keycardTaken ? 'Reach the stair door — mind the laser grid' : 'Find the keycard — time the laser grid';
  } else if (threat === 'cameras') {
    obj = world.keycardTaken ? 'Reach the stair door — the cameras sweep' : 'Find the keycard — the cameras sweep';
  } else {
    obj = world.keycardTaken ? 'Reach the stair door' : 'Find the keycard, then reach the stair door';
  }
  ctx.fillText(obj, 24, 44);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = a1;
  panel(ctx, 456, 10, 368, 44, 1);
  drawEye(ctx, 482, 32, 15, world.suspicion, t);
  const label = world.alarm ? 'ALARM' : world.suspicion >= 0.45 ? 'SUSPICIOUS' : world.suspicion > 0.05 ? 'SEEN?' : 'UNSEEN';
  ctx.fillStyle = eyeColor(world.suspicion);
  ctx.font = 'bold 16px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, 506, 27);
  bar(ctx, 506, 40, 180, 7, 'rgba(255,255,255,0.14)', eyeColor(world.suspicion), world.suspicion);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '12px Georgia, serif';
  ctx.fillText('detection', 700, 32);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = a2;
  panel(ctx, 838, 10, 200, 44, 1);
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 16px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(`◆ LOOT ${world.lootTaken}/${world.lootTotal}`, 852, 27);
  ctx.fillStyle = world.keycardTaken ? '#4ec9f2' : COLORS.hudDim;
  ctx.font = '13px Georgia, serif';
  ctx.fillText(world.keycardTaken ? '⬢ KEYCARD ✓' : '⬢ KEYCARD —', 852, 44);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = a3;
  panel(ctx, 1052, 10, 216, 44, 1);
  // The getaway countdown replaces the clock once the vault is open — big
  // amber digits, red under ten seconds. It is the whole endgame, so it
  // takes the timer's place instead of hiding in a corner.
  if (world.getawayRunning || world.vaultOpen) {
    const low = world.getaway <= 10;
    ctx.fillStyle = low ? '#ff4a3c' : '#ffb43c';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`◷ GETAWAY ${fmtTime(world.getaway)}`, 1066, 27);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '13px Georgia, serif';
    ctx.fillText('reach the van — police incoming', 1066, 44);
  } else {
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 16px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`◷ ${fmtTime(time)}`, 1066, 27);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '13px Georgia, serif';
    ctx.fillText(`SCORE ${world.score}   ● ${world.pebbles} pebbles`, 1066, 44);
  }
  ctx.restore();

  // Camera chip: a small red flag under the eye panel while a camera beam
  // holds the thief — the warning names the watcher, not just the meter.
  if (world.camSpotted && !world.alarm) {
    ctx.save();
    ctx.fillStyle = 'rgba(160, 20, 60, 0.92)';
    ctx.fillRect(456, 60, 212, 22);
    ctx.fillStyle = '#ffd9e0';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('◉ CAMERA HAS YOU — MOVE', 466, 75);
    ctx.restore();
  }

  // Laser chip: the same flag, one line down, while a live beam holds the
  // thief. A room has cameras or lasers, never both, so the flags never stack.
  if (world.laserSpotted && !world.alarm) {
    ctx.save();
    ctx.fillStyle = 'rgba(160, 20, 60, 0.92)';
    ctx.fillRect(456, 86, 212, 22);
    ctx.fillStyle = '#ffd9e0';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('◈ LASER HAS YOU — MOVE', 466, 101);
    ctx.restore();
  }

  // Searchlight chip: the same flag, in the camera slot, while the wide
  // beam holds the thief. A room has one watcher kind, never two, so the
  // flags never stack — the chip always names the watcher that has you.
  if (world.slSpotted && !world.alarm) {
    ctx.save();
    ctx.fillStyle = 'rgba(160, 20, 60, 0.92)';
    ctx.fillRect(456, 60, 232, 22);
    ctx.fillStyle = '#ffd9e0';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('✦ SEARCHLIGHT HAS YOU — MOVE', 466, 75);
    ctx.restore();
  }

  // IN DUCT chip: a small steel-blue flag while the thief crawls the duct
  // — the one moment the eye panel reads UNSEEN on purpose. It sits in the
  // watcher-chip slot, but a camera can never spot the thief in the duct,
  // so the two flags never stack.
  if (world.inDuct && !world.alarm) {
    ctx.save();
    ctx.fillStyle = 'rgba(42, 54, 84, 0.94)';
    ctx.fillRect(456, 60, 168, 22);
    ctx.fillStyle = '#d7e0f2';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('◈ IN DUCT — UNSEEN', 466, 75);
    ctx.restore();
  }

  // CRACKING chip: a gold flag while Rook works the dial — hands on the
  // vault, feet still. It names the minigame, so the stillness reads as a
  // choice, not a freeze.
  if (world.crack.active && !world.alarm) {
    ctx.save();
    ctx.fillStyle = 'rgba(122, 92, 30, 0.94)';
    ctx.fillRect(456, 60, 208, 22);
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('◉ CRACKING — SPACE ON GREEN', 466, 75);
    ctx.restore();
  }

  // Near-miss flash: the screen edge reddens for a beat when a guard turns suspicious.
  if (world.suspicionFlash > 0) {
    ctx.strokeStyle = `rgba(255, 180, 60, ${0.55 * world.suspicionFlash})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, VIEW.width - 10, VIEW.height - 10);
  }
  // Alarm banner: full-width, high contrast, impossible to miss. It slides
  // down from the top bar in 0.38 s (ease-out) instead of appearing flat.
  if (world.alarm) {
    const blink = 0.75 + 0.25 * Math.sin(t * 9);
    const slide = easeOutCubic(clamp(world.alarmT / 0.38, 0, 1));
    ctx.save();
    ctx.translate(0, (1 - slide) * -34);
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#a01f16';
    ctx.fillRect(0, 62, VIEW.width, 34);
    ctx.fillStyle = '#ffd9d4';
    ctx.font = 'bold 19px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠  ALARM — THE WATCH IS COMING FOR YOU  ⚠', VIEW.width / 2, 80);
    ctx.restore();
  }
  if (world.alarmFlash > 0 && !world.alarm) {
    ctx.fillStyle = `rgba(255, 74, 60, ${0.14 * world.alarmFlash})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  // The crack dial overlays the room while Rook works it.
  drawCrackDial(ctx, world, t);

  // Screens over the world.
  if (screen === SCREEN_TITLE) drawTitle(ctx, world, t);
  if (screen === SCREEN_PAUSED) drawCenter(ctx, 'PAUSED', 'WASD / arrows to move · Shift to sneak · Click to throw a pebble · P to resume', t);
  if (screen === SCREEN_LEVEL) drawLevelCard(ctx, world, t);
  if (screen === SCREEN_CAUGHT) {
    const police = world.caughtReason === 'police';
    drawCenter(
      ctx,
      police ? 'THE POLICE ARRIVED' : 'CAUGHT',
      police
        ? 'The getaway clock hit zero with Rook still in the street. Press R to try again — crack faster, run faster.'
        : `The watch found Rook in ${level.name}. Press R to try again — patience beats speed.`,
      t,
    );
  }
  if (screen === SCREEN_WIN) {
    drawCenter(ctx, 'CLEAN GETAWAY', `All three rooms, ${world.lootTaken} loot, score ${world.score} in ${fmtTime(time)}. Rook was never really there.`, t);
  }
}

function drawCenter(ctx, title, sub, t, fade = 1) {
  ctx.save();
  ctx.globalAlpha = clamp(fade, 0, 1);
  ctx.fillStyle = 'rgba(8, 10, 18, 0.66)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, VIEW.width / 2, VIEW.height / 2 - 22);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '18px Georgia, serif';
  ctx.fillText(sub, VIEW.width / 2, VIEW.height / 2 + 26);
  ctx.restore();
}

function drawTitle(ctx, world, t) {
  // The title screen has no world clock — world.time only runs during play —
  // so the title keeps its own: the fade-in rises over 0.6 s of title time,
  // and the prompt blinks on the same clock.
  titleClock += 1 / 60;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 10, 18, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const rise = easeOutCubic(clamp(titleClock / 0.6, 0, 1));
  ctx.globalAlpha = rise;
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MIDNIGHT VAULT', VIEW.width / 2, 250);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '20px Georgia, serif';
  ctx.fillText('One night. Three rooms. One vault. Get in, crack it, get out.', VIEW.width / 2, 308);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '16px Georgia, serif';
  ctx.fillText('WASD / arrows — move      Shift — sneak      SPACE — crack the vault      Click — throw a pebble      P — pause', VIEW.width / 2, 352);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 18px Georgia, serif';
  const blink = 0.6 + 0.4 * Math.sin(titleClock * 3);
  ctx.globalAlpha = rise * blink;
  ctx.fillText('— press ENTER to begin —', VIEW.width / 2, 408);
  ctx.restore();
}

// Title-screen clock (see drawTitle): advances once per painted title frame.
let titleClock = 0;

function drawLevelCard(ctx, world, t) {
  // The room card names the new threat when the room has one. The Vault has
  // three lines (cameras + duct + crack), so each line steps down 26 px —
  // the lines never stack on each other.
  drawCenter(ctx, world.level.name, world.level.sub, t, world.transition);
  let lineY = VIEW.height / 2 + 62;
  const threatLine = (color, text) => {
    ctx.save();
    ctx.globalAlpha = world.transition;
    ctx.fillStyle = color;
    ctx.font = 'bold 16px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, lineY);
    ctx.restore();
    lineY += 26;
  };
  if (world.level.cameras) threatLine('#ff5ac8', '◉ 2 SECURITY CAMERAS SWEEP THE VAULT — TIME THE MAGENTA BEAMS');
  if (world.level.lasers) threatLine('#ff5ac8', '◈ 3 LASER TRIPWIRES GUARD THE GALLERY — TIME THE DARK');
  if (world.level.searchlights) threatLine('#ffe9b0', '✦ 1 SKYLIGHT SEARCHLIGHT SWEEPS THE LOBBY — TIME THE BEAM');
  if (world.level.ducts) threatLine('#b9c2d8', '◈ SERVICE DUCT — SLOW BUT UNSEEN');
  if (world.level.vault) threatLine('#f2c14e', '◉ CRACK THE VAULT — SPACE ON THE GREEN, THREE TUMBLERS, THEN RUN');
}
