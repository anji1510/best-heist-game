// MIDNIGHT VAULT boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// ?seed=N fixes the world. ?shot=cover|patrol|crack|exit (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, crackAttempt, startGame, stepWorld, throwPebble, SCREEN_CAUGHT, SCREEN_LEVEL, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './world.js';
import { ACTION_CAM, ACTION_CONFIRM, ACTION_CRACK, ACTION_PAUSE, ACTION_RETRY, createInput } from './input.js';
import { createAudio, ensureAudio } from './audio.js';
import { createRenderer, drawWorld } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
createRandom(seed); // the seed also drives particles, so shots stay identical

function announce(text) {
  status.textContent = text;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    drawWorld(renderer.ctx, world, scene.screen, 2.0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  const input = createInput(
    canvas,
    (x, y) => {
      ensureAudio(audio);
      if (screen === SCREEN_PLAY) throwPebble(world, x, y, audio);
    },
    (action) => {
      ensureAudio(audio);
      if (action === ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_CAUGHT)) {
        startGame(world);
        screen = SCREEN_PLAY;
        announce('The job is on. Find the keycard, crack the vault, reach the van.');
      } else if (action === ACTION_PAUSE && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
        screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      } else if (action === ACTION_RETRY && screen === SCREEN_CAUGHT) {
        startGame(world);
        screen = SCREEN_PLAY;
      } else if (action === ACTION_CRACK && screen === SCREEN_PLAY) {
        crackAttempt(world, audio);
      } else if (action === ACTION_CAM) {
        // C toggles the camera drift: on, the frame leans into the action;
        // off, the whole floor sits still. Announced, never silent.
        world.camFollow = !world.camFollow;
        if (!world.camFollow) { world.camX = 640; world.camY = 360; }
        announce(world.camFollow ? 'Camera follow on.' : 'Camera follow off.');
      }
    },
  );
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += dt;
    while (accumulator >= STEP) {
      stepWorld(world, STEP, input, audio);
      accumulator -= STEP;
      screen = world.screen;
    }
    drawWorld(renderer.ctx, world, screen, world.time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
