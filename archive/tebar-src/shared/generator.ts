// The daily board. It is worked out from the day number alone, so the client, the server and
// every player arrive at the same board without anything being stored.
//
// Candidates are drawn from a seeded random source and solved; the first one that fits the
// day's difficulty band is the board. The week climbs from an easy Monday to a hard Saturday.

import { CELLS } from './rules.ts';
import type { Board } from './rules.ts';
import { weekdayOf } from './days.ts';
import { SIZE, solve } from './puzzle.ts';
import type { Puzzle, Solution } from './puzzle.ts';

export type Level = 'easy' | 'medium' | 'hard' | 'expert';

export type Daily = Puzzle & {
  day: number;
  level: Level;
  perfect: number;
  /** A line that reaches the perfect score. Kept on the server until the day is over. */
  bestLine: number[];
};

type Band = {
  level: Level;
  picks: number;
  /** How close the careful one-step reader may get to perfect, as a share of it. */
  readerMin: number;
  readerMax: number;
  /** Upper limit on the share of lines that are perfect. */
  perfectShareMax: number;
};

/** Indexed by UTC weekday, Sunday first. Sunday is medium until a community board takes its place. */
const BANDS: readonly Band[] = [
  {
    level: 'medium',
    picks: 5,
    readerMin: 0.7,
    readerMax: 0.95,
    perfectShareMax: 0.02,
  },
  {
    level: 'easy',
    picks: 4,
    readerMin: 0.85,
    readerMax: 1,
    perfectShareMax: 0.08,
  },
  {
    level: 'medium',
    picks: 5,
    readerMin: 0.7,
    readerMax: 0.95,
    perfectShareMax: 0.02,
  },
  {
    level: 'medium',
    picks: 5,
    readerMin: 0.7,
    readerMax: 0.95,
    perfectShareMax: 0.02,
  },
  {
    level: 'medium',
    picks: 5,
    readerMin: 0.7,
    readerMax: 0.95,
    perfectShareMax: 0.02,
  },
  {
    level: 'hard',
    picks: 5,
    readerMin: 0.5,
    readerMax: 0.8,
    perfectShareMax: 0.01,
  },
  {
    level: 'expert',
    picks: 6,
    readerMin: 0.5,
    readerMax: 0.8,
    perfectShareMax: 0.006,
  },
];

export const bandFor = (day: number): Band => BANDS[weekdayOf(day)];

/** Seeds per hole at the start: small numbers, so a sowing can be counted in the head. */
export const MAX_PER_HOLE = 4;
const MIN_SEEDS = 16;
const MAX_SEEDS = 26;
/** No pick on a daily board may run longer than this many drops: it keeps the animation short. */
export const MAX_PICK_DROPS = 40;
const ATTEMPTS = 600;

/** mulberry32: a small, well-spread 32-bit generator. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function candidate(next: () => number): Board | undefined {
  const cells = new Array<number>(CELLS).fill(0);
  let seeds = 0;
  let southHoles = 0;
  for (const base of [0, 8]) {
    for (let i = 0; i < SIZE; i++) {
      const n = Math.floor(next() * (MAX_PER_HOLE + 1));
      cells[base + i] = n;
      seeds += n;
      if (base === 0 && n > 0) southHoles += 1;
    }
  }
  if (seeds < MIN_SEEDS || seeds > MAX_SEEDS || southHoles < 4)
    return undefined;
  return cells;
}

/** How far a solved candidate is from the band: 0 means it fits. */
function distance(band: Band, s: Solution): number {
  const reader = s.reader / s.perfect;
  const share = s.perfectLines / s.lines;
  let d = 0;
  if (s.perfect < 10) d += 10 - s.perfect;
  if (s.perfect < 0.6 * s.seeds) d += 5;
  if (s.maxDrops > MAX_PICK_DROPS) d += 10;
  if (s.lines < 40) d += 5;
  if (s.mean > 0.75 * s.perfect) d += 3;
  if (reader < band.readerMin) d += (band.readerMin - reader) * 10;
  if (reader > band.readerMax) d += (reader - band.readerMax) * 10;
  if (share > band.perfectShareMax) d += (share - band.perfectShareMax) * 100;
  return d;
}

const cache = new Map<number, Daily>();

/** The board for a day. Always the same answer for the same day. */
export function dailyPuzzle(day: number): Daily {
  const hit = cache.get(day);
  if (hit) return hit;

  const band = bandFor(day);
  const next = random(Math.imul(day, 0x9e3779b1) ^ 0x7eba2026);
  let best: { cells: Board; solution: Solution; d: number } | undefined;

  for (let i = 0; i < ATTEMPTS; i++) {
    const cells = candidate(next);
    if (!cells) continue;
    const solution = solve({ cells, picks: band.picks });
    const d = distance(band, solution);
    if (!best || d < best.d) best = { cells, solution, d };
    if (d === 0) break;
  }
  if (!best) throw new Error(`No board could be made for day ${day}.`);

  const daily: Daily = {
    day,
    level: band.level,
    cells: best.cells,
    picks: band.picks,
    perfect: best.solution.perfect,
    bestLine: best.solution.bestLine,
  };
  cache.set(day, daily);
  return daily;
}

/** True when the day's board met its band exactly, rather than being the nearest miss. */
export function fitsBand(day: number): boolean {
  const daily = dailyPuzzle(day);
  return distance(bandFor(day), solve(daily)) === 0;
}
