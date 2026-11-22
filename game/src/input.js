// Input: keyboard (WASD / arrows, Shift to sneak, Space to lock a vault
// tumbler while cracking, P pause, R retry, Enter confirm, C toggles the
// camera follow) and mouse (click the floor to throw a pebble that pulls a
// guard over to investigate). Also the first gesture that wakes the audio.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RETRY = 'retry';
export const ACTION_CAM = 'cam';
export const ACTION_CRACK = 'crack';

export function createInput(canvas, onPebble, onAction) {
  const keys = new Set();
  const input = {
    up: false, down: false, left: false, right: false, sneak: false,
  };
  function sync() {
    input.up = keys.has('KeyW') || keys.has('ArrowUp');
    input.down = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
  }
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    sync();
    if (e.code === 'Enter') onAction(ACTION_CONFIRM);
    if (e.code === 'KeyP') onAction(ACTION_PAUSE);
    if (e.code === 'KeyR') onAction(ACTION_RETRY);
    if (e.code === 'KeyC') onAction(ACTION_CAM);
    if (e.code === 'Space') onAction(ACTION_CRACK);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    sync();
  });
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1280;
    const y = ((e.clientY - rect.top) / rect.height) * 720;
    onPebble(x, y);
  });
  return input;
}
