// Tebar's solo puzzle, played on the congklak board from rules.ts.
//
// One player sits South and has a fixed number of picks. Each pick lifts every seed from one
// South hole and sows them one by one around the board. The far store is never used.
//
//   last seed on a hole that already had seeds  -> relay: lift them all and keep sowing
//   last seed in an empty hole on your side     -> capture the hole across, into your store
//   last seed anywhere else                     -> the pick is over
//
// Unlike two-player congklak, landing in your store does not grant another move, and nothing
// is swept up at the end. Every pick costs one pick, so a run is always short and can be judged.
//
// No runtime dependencies: the client animates with this file and the server scores with it.

import {
  CELLS,
  cellOf,
  nextCell,
  opposite,
  ownerOf,
  NORTH,
  SOUTH,
  storeOf,
} from './rules.ts';
import type { Board, Step } from './rules.ts';

/** Holes per side. Tebar always uses the five-hole board. */
export const SIZE = 5;
/** The player's store. */
export const STORE = storeOf(SOUTH);
const FAR_STORE = storeOf(NORTH);
/** A pick stops after this many seeds dropped. Daily boards never come close. */
export const MAX_DROPS = 400;

export type Puzzle = {
  /** Sixteen cells, laid out as in rules.ts. Both stores start empty. */
  cells: Board;
  picks: number;
};

export type PickOutcome =
  | 'store' // last seed in your store
  | 'capture' // last seed in an empty hole of yours, with seeds across
  | 'rest' // last seed in an empty hole of yours, nothing across
  | 'far' // last seed in an empty hole on the far side
  | 'limit'; // the drop limit was reached

export type PickResult = {
  board: Board;
  outcome: PickOutcome;
  /** Seeds this pick added to the store. */
  gained: number;
  /** Seeds dropped, counting every relay. */
  drops: number;
  relays: number;
  /** What happened, in order, for animation. Empty when not asked for. */
  steps: Step[];
};

export class IllegalPick extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalPick';
  }
}

/** South holes (0-based) that hold seeds. */
export function playableHoles(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < SIZE; i++) if (board[i] > 0) out.push(i);
  return out;
}

/** The next cell a seed is dropped in, skipping the far store. */
function step(cell: number): number {
  const next = nextCell(SIZE, cell);
  return next === FAR_STORE ? nextCell(SIZE, next) : next;
}

/**
 * Where the first lap of a pick ends: the cell that receives the last seed lifted from `hole`,
 * before any relay. Shown to the player as a hint while a hole is selected.
 */
export function firstLanding(board: Board, hole: number): number {
  let cell = cellOf(SOUTH, hole);
  for (let n = board[cell]; n > 0; n--) cell = step(cell);
  return cell;
}

/** Plays one pick. The input board is not modified. */
export function sow(input: Board, hole: number, withSteps = true): PickResult {
  if (!Number.isInteger(hole) || hole < 0 || hole >= SIZE)
    throw new IllegalPick(`Hole ${hole} is not on your side.`);
  const board = input.slice();
  const steps: Step[] = [];
  const before = board[STORE];

  let cell = cellOf(SOUTH, hole);
  let hand = board[cell];
  if (hand === 0) throw new IllegalPick(`Hole ${hole} is empty.`);
  board[cell] = 0;
  if (withSteps) steps.push({ kind: 'lift', cell, count: hand, relay: false });

  let drops = 0;
  let relays = 0;
  let outcome: PickOutcome;

  for (;;) {
    while (hand > 0) {
      cell = step(cell);
      board[cell] += 1;
      hand -= 1;
      drops += 1;
      if (withSteps) steps.push({ kind: 'drop', cell });
    }

    if (cell === STORE) {
      outcome = 'store';
      break;
    }
    if (board[cell] > 1) {
      if (drops >= MAX_DROPS) {
        outcome = 'limit';
        break;
      }
      hand = board[cell];
      board[cell] = 0;
      relays += 1;
      if (withSteps)
        steps.push({ kind: 'lift', cell, count: hand, relay: true });
      continue;
    }
    // The last seed fell into a hole that was empty.
    if (ownerOf(SIZE, cell) === SOUTH) {
      const across = opposite(SIZE, cell);
      const taken = board[across];
      if (taken > 0) {
        board[STORE] += taken + 1;
        board[across] = 0;
        board[cell] = 0;
        outcome = 'capture';
        if (withSteps)
          steps.push({ kind: 'capture', cell, from: across, seeds: taken + 1 });
      } else {
        outcome = 'rest';
      }
    } else {
      outcome = 'far';
    }
    break;
  }

  return {
    board,
    outcome,
    gained: board[STORE] - before,
    drops,
    relays,
    steps,
  };
}

// ───────────────────────────── A run ─────────────────────────────

export type Run = {
  board: Board;
  picksLeft: number;
  /** Holes picked so far. */
  line: number[];
  score: number;
  /** True once the picks are spent or the South row is empty. */
  over: boolean;
};

const isOver = (board: Board, picksLeft: number): boolean =>
  picksLeft === 0 || playableHoles(board).length === 0;

export function startRun(puzzle: Puzzle): Run {
  const board = puzzle.cells.slice();
  return {
    board,
    picksLeft: puzzle.picks,
    line: [],
    score: board[STORE],
    over: isOver(board, puzzle.picks),
  };
}

export function pick(run: Run, hole: number): { run: Run; result: PickResult } {
  if (run.over) throw new IllegalPick('The run is over.');
  const result = sow(run.board, hole);
  const picksLeft = run.picksLeft - 1;
  return {
    result,
    run: {
      board: result.board,
      picksLeft,
      line: [...run.line, hole],
      score: result.board[STORE],
      over: isOver(result.board, picksLeft),
    },
  };
}

/**
 * Scores a whole line of picks. Throws IllegalPick when a pick is not allowed or the line
 * stops while picks and seeds remain, so a made-up line can never produce a score.
 */
export function playLine(puzzle: Puzzle, line: readonly number[]): Run {
  let run = startRun(puzzle);
  for (const hole of line) run = pick(run, hole).run;
  if (!run.over)
    throw new IllegalPick('The line stops before the run is over.');
  return run;
}

// ───────────────────────────── Solving ─────────────────────────────

export type Solution = {
  /** The best score any line reaches. */
  perfect: number;
  /** One line that reaches it: the first in hole order. */
  bestLine: number[];
  /** Number of complete lines, and how many of them are perfect. */
  lines: number;
  perfectLines: number;
  /** Lines per final score. */
  histogram: Record<number, number>;
  /** Average score over all lines: what picking at random gets. */
  mean: number;
  /** Score of a careful player who looks one pick ahead and takes the biggest gain. */
  reader: number;
  /** The longest single pick on any line, in seeds dropped. */
  maxDrops: number;
  /** Seeds on the board at the start. */
  seeds: number;
};

/** Tries every line. A five-hole board with six picks has at most 5^6 lines, a few milliseconds. */
export function solve(puzzle: Puzzle): Solution {
  let perfect = -1;
  let bestLine: number[] = [];
  let lines = 0;
  let perfectLines = 0;
  let sum = 0;
  let maxDrops = 0;
  const histogram: Record<number, number> = {};
  const line: number[] = [];

  const visit = (board: Board, picksLeft: number): void => {
    const holes = picksLeft === 0 ? [] : playableHoles(board);
    if (holes.length === 0) {
      const score = board[STORE];
      lines += 1;
      sum += score;
      histogram[score] = (histogram[score] ?? 0) + 1;
      if (score > perfect) {
        perfect = score;
        perfectLines = 1;
        bestLine = line.slice();
      } else if (score === perfect) {
        perfectLines += 1;
      }
      return;
    }
    for (const hole of holes) {
      const r = sow(board, hole, false);
      if (r.drops > maxDrops) maxDrops = r.drops;
      line.push(hole);
      visit(r.board, picksLeft - 1);
      line.pop();
    }
  };
  visit(puzzle.cells, puzzle.picks);

  // The careful one-step reader.
  let board = puzzle.cells;
  for (let left = puzzle.picks; left > 0; left--) {
    let best: Board | undefined;
    for (const hole of playableHoles(board)) {
      const next = sow(board, hole, false).board;
      if (!best || next[STORE] > best[STORE]) best = next;
    }
    if (!best) break;
    board = best;
  }

  let seeds = 0;
  for (let i = 0; i < CELLS; i++) seeds += puzzle.cells[i];

  return {
    perfect,
    bestLine,
    lines,
    perfectLines,
    histogram,
    mean: sum / lines,
    reader: board[STORE],
    maxDrops,
    seeds,
  };
}

// ───────────────────────────── Stars ─────────────────────────────

export type Stars = 0 | 1 | 2 | 3;

/** Three for a perfect score, two from 80% of it, one from 55%. */
export function starsFor(score: number, perfect: number): Stars {
  if (perfect <= 0 || score >= perfect) return 3;
  const share = score / perfect;
  if (share >= 0.8) return 2;
  if (share >= 0.55) return 1;
  return 0;
}
