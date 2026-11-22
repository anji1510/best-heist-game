// Sound, synthesized only (WebAudio, no files): guard footsteps that tell you
// where a guard is (volume by distance, pan by direction), a low proximity
// pulse when a guard is close, an alarm sting, pickup blips, the vault dial's
// clicks and clunks, and win/lose phrases. Created on the first user gesture;
// silent in screenshots.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    enabled: false,
    stepTimer: 0,
    pulseTimer: 0,
  };
}

export function ensureAudio(a) {
  if (a.ctx) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    a.ctx = new Ctx();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(a.ctx.destination);
    a.enabled = true;
  } catch {
    a.enabled = false;
  }
}

function blip(a, freq, dur, type, vol, when = 0) {
  if (!a.enabled || !a.ctx) return;
  const t0 = a.ctx.currentTime + when;
  const o = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(a.master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noiseTick(a, vol, pan, low) {
  if (!a.enabled || !a.ctx) return;
  const t0 = a.ctx.currentTime;
  const len = Math.floor(a.ctx.sampleRate * 0.07);
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const f = a.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = low;
  const g = a.ctx.createGain();
  g.gain.value = vol;
  const p = a.ctx.createStereoPanner();
  p.pan.value = pan;
  src.connect(f);
  f.connect(g);
  g.connect(p);
  p.connect(a.master);
  src.start(t0);
}

// A guard's footstep: a soft low thud, panned by where the guard stands
// relative to the thief, quieter the farther away. This is the cue that
// tells you where a guard is without looking.
export function guardStep(a, guard, player) {
  if (!a.enabled) return;
  const dx = guard.x - player.x;
  const dy = guard.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 300) return;
  const vol = 0.32 * (1 - dist / 300);
  const pan = Math.max(-0.9, Math.min(0.9, dx / 220));
  noiseTick(a, vol, pan, 420);
}

export function playerStep(a) {
  if (!a.enabled) return;
  noiseTick(a, 0.1, 0, 700);
}

export function proximityPulse(a, dt, nearestDist) {
  if (!a.enabled) return;
  a.pulseTimer -= dt;
  if (nearestDist < 200 && a.pulseTimer <= 0) {
    a.pulseTimer = 0.55;
    blip(a, 68, 0.22, 'sine', 0.16);
  }
}

export function alarmSting(a) {
  if (!a.enabled) return;
  blip(a, 620, 0.16, 'square', 0.12);
  blip(a, 466, 0.22, 'square', 0.12, 0.16);
}

export function pickupBlip(a) {
  if (!a.enabled) return;
  blip(a, 880, 0.1, 'sine', 0.16);
  blip(a, 1318, 0.14, 'sine', 0.14, 0.07);
}

// The loot burst chime: a quick three-note rise on top of the pickup blip —
// the grab sounds like it looks, a small fanfare, not a flat tick.
export function burstChime(a) {
  if (!a.enabled) return;
  [1046, 1318, 1568].forEach((f, i) => blip(a, f, 0.12, 'triangle', 0.1, i * 0.05));
}

// A camera spots you: two short high ticks, panned by where the camera sits —
// the warning tells you which side the beam is on before you look.
export function cameraBeep(a, cam, player) {
  if (!a.enabled) return;
  const pan = Math.max(-0.9, Math.min(0.9, (cam.x - player.x) / 220));
  const t0 = a.ctx.currentTime;
  for (const [f, when] of [[1568, 0], [1568, 0.13]]) {
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    const p = a.ctx.createStereoPanner();
    o.type = 'square';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + when);
    g.gain.linearRampToValueAtTime(0.09, t0 + when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + when + 0.08);
    p.pan.value = pan;
    o.connect(g);
    g.connect(p);
    p.connect(a.master);
    o.start(t0 + when);
    o.stop(t0 + when + 0.1);
  }
}

// A tumbler locks: a bright metallic click, two notes — the dial says yes.
export function crackClick(a) {
  if (!a.enabled) return;
  blip(a, 1568, 0.06, 'square', 0.14);
  blip(a, 2093, 0.1, 'triangle', 0.12, 0.05);
}

// A tumbler misses: a low dull clunk — the dial says no, and the room hears it.
export function crackClunk(a) {
  if (!a.enabled) return;
  blip(a, 130, 0.18, 'sawtooth', 0.2);
  blip(a, 98, 0.24, 'square', 0.14, 0.06);
}

// The vault swings open: a deep three-note fall, then a bright gold rise.
export function vaultOpenSound(a) {
  if (!a.enabled) return;
  [196, 147, 98].forEach((f, i) => blip(a, f, 0.2, 'sawtooth', 0.1, i * 0.1));
  [1046, 1318, 1568].forEach((f, i) => blip(a, f, 0.14, 'triangle', 0.12, 0.32 + i * 0.06));
}

export function keycardBlip(a) {
  if (!a.enabled) return;
  blip(a, 660, 0.1, 'triangle', 0.16);
  blip(a, 990, 0.12, 'triangle', 0.16, 0.08);
  blip(a, 1320, 0.18, 'triangle', 0.14, 0.16);
}

export function winPhrase(a) {
  if (!a.enabled) return;
  [523, 659, 784, 1046].forEach((f, i) => blip(a, f, 0.22, 'triangle', 0.15, i * 0.11));
}

export function losePhrase(a) {
  if (!a.enabled) return;
  [392, 330, 262, 196].forEach((f, i) => blip(a, f, 0.26, 'sawtooth', 0.08, i * 0.13));
}
