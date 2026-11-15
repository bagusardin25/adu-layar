// Sine and cosine that give the same answer on every device.
//
// The server replays every round to score it, so the browser (any engine) and the server (V8)
// must compute bit-identical positions. Basic arithmetic (+ - * / and Math.sqrt) is exactly
// rounded everywhere; Math.sin and Math.cos are not. Angles are therefore whole numbers of
// 1/1024 of a turn, and their sines come from a table built with arithmetic only.

/** Angle units in a full turn. Angle 0 points up the screen; angles grow clockwise. */
export const ANG = 1024;
const QUARTER = ANG / 4;
const PI = 3.141592653589793;
const STEP = (2 * PI) / ANG;

/** sin(x) for x in [0, π/2], by its Taylor series; arithmetic only. */
function sinFirstQuadrant(x: number): number {
  const x2 = x * x;
  let term = x;
  let sum = x;
  for (let n = 1; n <= 9; n++) {
    term = (-term * x2) / (2 * n * (2 * n + 1));
    sum += term;
  }
  return sum;
}

const SIN = new Float64Array(ANG);
for (let k = 0; k < ANG; k++) {
  const r = k % QUARTER;
  switch (Math.floor(k / QUARTER)) {
    case 0:
      SIN[k] = sinFirstQuadrant(r * STEP);
      break;
    case 1:
      SIN[k] = sinFirstQuadrant((QUARTER - r) * STEP);
      break;
    case 2:
      SIN[k] = -sinFirstQuadrant(r * STEP);
      break;
    default:
      SIN[k] = -sinFirstQuadrant((QUARTER - r) * STEP);
  }
}

/** Wraps any whole number into [0, ANG). */
export const wrap = (a: number): number => ((a % ANG) + ANG) % ANG;

export const sinA = (a: number): number => SIN[wrap(a)];
export const cosA = (a: number): number => SIN[wrap(a + QUARTER)];

/** Unit vector for a heading, in screen coordinates (y grows downwards). */
export const dirX = (a: number): number => sinA(a);
export const dirY = (a: number): number => -cosA(a);

/** Radians for drawing only. Never use the result inside the simulation. */
export const toRadians = (a: number): number => wrap(a) * STEP;
