// Motion helpers (motion-design-skill): one signature easing per job, entrance
// decelerates, exit accelerates, one primary property per moment, stagger for groups.
export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
// Critically-damped approach: `current` chases `target` with no overshoot —
// the camera drift, the follow-through, anything that must settle, not bounce.
export function approach(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
// Entrance: fast start, gentle landing (ease-out cubic).
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}
// Exit: gentle start, fast finish (ease-in cubic).
export function easeInCubic(t) {
  return Math.pow(clamp(t, 0, 1), 3);
}
// In and out: slow at both ends, for patrol legs and camera moves.
export function easeInOutCubic(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
// Small pops only (pickups, HUD badges, the crack dial): overshoot, then settle.
export function easeOutBack(t) {
  const x = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
export function easeOutQuad(t) {
  const x = clamp(t, 0, 1);
  return 1 - (1 - x) * (1 - x);
}
// Shortest signed turn from angle a to angle b, in radians.
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Turn `current` toward `target` by at most `maxStep` radians — eased facing.
export function turnToward(current, target, maxStep) {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}
// Stagger helper: element i of n starts after i * gap seconds.
export function staggerDelay(i, gap) {
  return i * gap;
}
