// The first flight. One kite crosses the middle again and again, with no clock, until the
// player cuts it or skips. Nothing here is scored or stored.

import { pack } from './ghost.ts';
import { skyForDay } from './sky.ts';
import { cosA, sinA } from './trig.ts';
import { TICKS_PER_SECOND } from './types.ts';
import type { Sample, Sky } from './types.ts';

const LESSON_SECONDS = 24;
/** About 0.55 rad/s, in angle units, so the path does not depend on Math.sin. */
const SWEEP = 90;

/** A practice sky: no kampung pilots, one kite whose string keeps crossing the middle. */
export function lessonSky(): Sky {
  const samples: Sample[] = [];
  for (let tick = 0; tick <= LESSON_SECONDS * TICKS_PER_SECOND; tick += 3) {
    const t = tick / TICKS_PER_SECOND;
    const angle = Math.round(t * SWEEP);
    // Sweeps across the player's string (x = 180) and back.
    const x = Math.round(180 + sinA(angle) * 80);
    samples.push({ x, y: 300, a: cosA(angle) >= 0 ? 256 : 768, f: 1 });
  }
  const base = skyForDay(1);
  return {
    ...base,
    windX: 4,
    windY: 0,
    gustAmp: 0,
    rivals: [],
    untimed: true,
    ghosts: [
      {
        id: 'lesson',
        name: 'Si Latih',
        colors: ['#F2C230', '#1B4F9C'],
        anchorX: 300,
        kind: 'ghost',
        score: 0,
        track: pack(samples),
      },
    ],
  };
}
