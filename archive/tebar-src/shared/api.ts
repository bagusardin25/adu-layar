// The contract between the web view and the server. Both sides import these types.

import type { Level } from './generator.ts';

/** A finished run: the holes picked, in order, and what they scored. */
export type RunResult = {
  line: number[];
  score: number;
};

/** How everyone did on one board. */
export type BoardStats = {
  /** Players with a counted run. */
  players: number;
  /** How many of them reached the best score. */
  perfect: number;
  /** Counted runs per final score. Keys are scores. */
  histogram: Record<string, number>;
};

export type BoardResponse = {
  /** The day this post's board belongs to. */
  day: number;
  /** The current day on the server. A board only counts on its own day. */
  today: number;
  level: Level;
  cells: number[];
  picks: number;
  /** The best score any line reaches. */
  perfect: number;
  player: {
    /** Reddit username, or null when logged out. */
    name: string | null;
    /** Days in a row with a counted run, up to today. */
    streak: number;
  };
  /** This player's counted run on this board, if there is one. */
  result: RunResult | null;
  stats: BoardStats;
  /** A line that reaches the best score. Only sent once the board's day is over. */
  bestLine: number[] | null;
};

export type RunRequest = {
  day: number;
  line: number[];
};

/** Why a run was scored but not recorded. */
export type NotCounted =
  | 'anonymous' // not logged in
  | 'late' // the board's day is over
  | 'already'; // this player already has a counted run on this board

export type RunResponse = {
  /** True when this run became the player's counted run. */
  counted: boolean;
  reason: NotCounted | null;
  /** The player's counted run when there is one, otherwise the run just sent. */
  result: RunResult;
  streak: number;
  stats: BoardStats;
};

export type StandingsResponse = {
  day: number;
  /** Everyone who reached the best score today, earliest first. */
  perfectClub: {
    count: number;
    names: string[];
  };
  /** This week's stars, Monday to Sunday. */
  week: {
    entries: { rank: number; name: string; stars: number }[];
    me: { rank: number; stars: number } | null;
  };
};

export type ErrorResponse = {
  error: string;
};
