// The shape of a kite string.
//
// A string is never a ruler-straight line: it hangs under its own weight and the wind pushes a
// belly into it. A pulled string is nearly straight; a slack one hangs deep. The simulation
// tests these curves against each other to find where two strings touch, and the drawing code
// draws the very same curve, so a spark always sits on the strings you see.

import { crossing, length } from './geometry.ts';
import { STRING_LENGTH } from './types.ts';
import type { Kite, Sky } from './types.ts';
import { windAt } from './wind.ts';

/** Straight pieces the curve is cut into for the touch test. */
export const STRING_SEGMENTS = 6;
/** How far the middle of a full-length string is pushed down: when taut, and when slack. */
const SAG_TAUT = 6;
const SAG_SLACK = 46;
/** How far the wind pushes the middle of a full-length string sideways, per unit of wind. */
const BELLY = 0.55;

/** The curve is a quadratic Bezier from the hand to the kite; this is its control point. */
export type Bend = { cx: number; cy: number };

export function bendOf(
  ax: number,
  ay: number,
  x: number,
  y: number,
  slack: number,
  windX: number
): Bend {
  // A short string has less weight to hang and less length for the wind to push.
  const reach = length(x - ax, y - ay) / STRING_LENGTH;
  return {
    cx: (ax + x) / 2 + windX * BELLY * (0.3 + 0.7 * slack) * reach,
    cy: (ay + y) / 2 + (SAG_TAUT + (SAG_SLACK - SAG_TAUT) * slack) * reach,
  };
}

/**
 * The bend of a kite's string at a tick. `x` and `y` default to the kite's position; the
 * drawing code passes the position it is about to draw the kite at instead.
 */
export function stringBend(
  k: Kite,
  sky: Sky,
  tick: number,
  x: number = k.x,
  y: number = k.y
): Bend {
  const wind = windAt(sky, tick, (k.ay + y) / 2);
  return bendOf(k.ax, k.ay, x, y, k.slack, wind.x);
}

/** Points along the string, hand first, as x0, y0, x1, y1, ... */
export function tracePoints(
  ax: number,
  ay: number,
  x: number,
  y: number,
  bend: Bend
): number[] {
  const out: number[] = [];
  for (let i = 0; i <= STRING_SEGMENTS; i++) {
    const t = i / STRING_SEGMENTS;
    const m = 1 - t;
    out.push(
      m * m * ax + 2 * m * t * bend.cx + t * t * x,
      m * m * ay + 2 * m * t * bend.cy + t * t * y
    );
  }
  return out;
}

/** Where two strings touch: the point, and how far along each string it is (0 hand, 1 kite). */
export type Touch = { x: number; y: number; sa: number; sb: number };

export function touch(a: number[], b: number[]): Touch | null {
  for (let i = 0; i < STRING_SEGMENTS; i++) {
    for (let j = 0; j < STRING_SEGMENTS; j++) {
      const at = crossing(
        a[i * 2],
        a[i * 2 + 1],
        a[i * 2 + 2],
        a[i * 2 + 3],
        b[j * 2],
        b[j * 2 + 1],
        b[j * 2 + 2],
        b[j * 2 + 3]
      );
      if (at)
        return {
          x: at.x,
          y: at.y,
          sa: (i + at.t) / STRING_SEGMENTS,
          sb: (j + at.u) / STRING_SEGMENTS,
        };
    }
  }
  return null;
}
