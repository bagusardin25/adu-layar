// The day's sky, worked out from the day number alone: every player gets the same wind and the
// same rivals, and the server can rebuild the sky to score a round.

import { random } from './random.ts';
import type { RivalSpec, Sky, Style } from './types.ts';

const NAMES = [
  'Ucok',
  'Mamat',
  'Bang Jali',
  'Neng Ijah',
  'Si Kribo',
  'Cak Mul',
  'Mbak Sri',
  'Pak RT',
  'Dul',
  'Ujang',
];

/** Two-tone kites: main colour, then trim. */
const COLOURS: readonly (readonly [string, string])[] = [
  ['#F2C230', '#1B4F9C'],
  ['#2F8F5B', '#F4E9D0'],
  ['#1E6FB8', '#F2C230'],
  ['#7A3EA0', '#F4E9D0'],
  ['#F07A1A', '#1F2A44'],
  ['#E8E4D8', '#2F8F5B'],
];

/** Rivals stand on these rooftops; the player stands in the middle. */
const ROOFTOPS = [42, 106, 254, 318];
export const PLAYER_ANCHOR_X = 180;

const STYLES: Record<Style, { spin: number; pullSpeed: number; aim: number }> =
  {
    // Charges at you, a little sloppy.
    nekat: { spin: 11, pullSpeed: 150, aim: 0.86 },
    // Quick to turn and fast, picks on whoever is closest.
    gesit: { spin: 13, pullSpeed: 170, aim: 0.94 },
    // Holds its patch of sky and only fights what comes close.
    kalem: { spin: 10, pullSpeed: 160, aim: 0.95 },
  };

function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function skyForDay(day: number): Sky {
  const next = random(Math.imul(day, 0x9e3779b1) ^ 0x1a7a2026);
  const names = shuffle(NAMES, next);
  const colours = shuffle(COLOURS, next);
  const roofs = shuffle(ROOFTOPS, next);
  const styles: Style[] = shuffle<Style>(['nekat', 'gesit', 'kalem'], next);

  const rivals: RivalSpec[] = styles.map((style, i) => ({
    name: names[i],
    style,
    anchorX: roofs[i],
    colors: colours[i],
    ...STYLES[style],
  }));

  return {
    day,
    windX: Math.round((next() * 2 - 1) * 30),
    windY: 0,
    gustAmp: 10 + Math.round(next() * 18),
    gustRate: 1 + Math.floor(next() * 2),
    gustPhase: Math.floor(next() * 1024),
    rivals,
  };
}

/** The player's own handling: a touch quicker than the average rival. */
export const PLAYER_HANDLING = { spin: 12, pullSpeed: 175 } as const;
export const PLAYER_COLOURS = ['#D7263D', '#FFFFFF'] as const;
