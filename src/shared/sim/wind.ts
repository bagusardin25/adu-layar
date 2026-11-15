// The wind over the kampung.
//
// It is one steady breeze for the day with slow gusts on top, and it is not the same at every
// height: the roofs slow the air down, so the wind is weak just above them and strongest high up.

import { clamp } from './geometry.ts';
import { sinA } from './trig.ts';
import { ROOF_Y, TOP_Y } from './types.ts';
import type { Sky } from './types.ts';

/** Share of the day's wind felt just above the roofs, and at the top of the sky. */
export const WIND_LOW = 0.5;
export const WIND_HIGH = 1.25;

/** How much of the wind there is at a height: WIND_LOW at the roofs, WIND_HIGH at the top. */
export function windShare(y: number): number {
  const up = clamp((ROOF_Y - y) / (ROOF_Y - TOP_Y), 0, 1);
  return WIND_LOW + (WIND_HIGH - WIND_LOW) * up;
}

/** The gust at a tick, between -1 and 1: a slow swing with a quicker flutter on top. */
export function gustAt(sky: Sky, tick: number): number {
  const slow = tick * sky.gustRate + sky.gustPhase;
  return 0.75 * sinA(slow) + 0.25 * sinA(slow * 3 + sky.gustPhase * 5);
}

/** The wind at a tick and a height, in sky units per second. */
export function windAt(
  sky: Sky,
  tick: number,
  y: number
): { x: number; y: number } {
  const share = windShare(y);
  return {
    x: (sky.windX + sky.gustAmp * gustAt(sky, tick)) * share,
    y: sky.windY * share,
  };
}
