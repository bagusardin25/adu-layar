// Flights recorded ahead of any real player, so the first day already has a Raja Langit
// and neighbours on the other roofs. Real flights from yesterday replace them.
// Built once: a few full rounds, then kept.

import { decide } from './ai.ts';
import { pack, place } from './ghost.ts';
import { createMatch, playTaps, step } from './match.ts';
import type { Taps } from './match.ts';
import { skyForDay } from './sky.ts';
import { PLAYER_ID } from './types.ts';
import type { GhostSpec, Sky } from './types.ts';

const CAST = [
  {
    id: 'seed-petir',
    name: 'Bang Petir',
    colors: ['#F2C230', '#1B4F9C'] as const,
    anchor: 242,
  },
  {
    id: 'seed-cilok',
    name: 'Neng Cilok',
    colors: ['#E86A9A', '#1F2333'] as const,
    anchor: 64,
  },
  {
    id: 'seed-elang',
    name: 'Mas Elang',
    colors: ['#2F8F5B', '#F4E9D0'] as const,
    anchor: 306,
  },
  {
    id: 'seed-bakwan',
    name: 'Cak Bakwan',
    colors: ['#F07A1A', '#1F2A44'] as const,
    anchor: 118,
  },
];

/** Taps a hunter would make. The same sky always gives the same taps. */
export function huntTaps(sky: Sky): Taps {
  const match = createMatch(sky);
  const taps: Taps = [];
  let pull = false;
  while (!match.over) {
    const me = match.kites[PLAYER_ID];
    const want =
      match.contacts.some((c) => c.a === PLAYER_ID || c.b === PLAYER_ID) ||
      decide({ ...me, style: 'gesit', aim: 0.9 }, match);
    if (want !== pull) {
      taps.push(match.tick);
      pull = want;
    }
    step(match, pull);
  }
  return taps;
}

let cached: GhostSpec[] | null = null;

/** Four kampung flyers, the highest score among them wearing the king's place. */
export function seedGhosts(): GhostSpec[] {
  if (cached) return cached;
  const flown = CAST.map((flyer, i) => {
    // Skies with no recordings, so a seed is not a recording of another seed.
    const sky = skyForDay(11 + i);
    const taps = huntTaps(sky);
    const { match, samples } = playTaps(sky, taps);
    return place(
      {
        id: flyer.id,
        name: flyer.name,
        colors: flyer.colors,
        score: match.score,
        track: pack(samples),
      },
      flyer.anchor,
      'ghost'
    );
  });
  const best = flown.reduce((a, b) => (a.score >= b.score ? a : b));
  cached = flown.map((g) =>
    g.id === best.id ? { ...g, kind: 'king' as const } : g
  );
  return cached;
}
