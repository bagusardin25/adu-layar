// The kampung's kite contest. Players post their kite to the day's post as a comment, and the
// kite whose comment has the most upvotes when the day ends is the kite Raja Langit flies the
// next day. Upvotes are only read, never rewarded; voting happens on Reddit, not in the game.

import { describeKite } from './kite.ts';
import type { KiteDesign } from './kite.ts';

/** The winning kite, as Raja Langit flies it: the design, its maker, and its upvotes. */
export type ChosenKite = { design: KiteDesign; by: string; votes: number };

/** One kite in today's contest. */
export type ContestEntry = {
  /** The Reddit username of the kite's maker. */
  by: string;
  design: KiteDesign;
  /** The entry comment's score on Reddit. */
  votes: number;
  /** A link to the entry's comment, where it can be upvoted. */
  link: string | null;
  mine: boolean;
};

export type ContestView = {
  day: number;
  /** Today's kites, most upvotes first; on a tie, the earlier entry first. */
  entries: ContestEntry[];
  /** The kite Raja Langit flies today: yesterday's winner. */
  flying: ChosenKite | null;
  guest: boolean;
  /** The player's Reddit username, when logged in. */
  name: string | null;
  /** The player already has a kite in today's contest. */
  entered: boolean;
  /** Entering is possible here: on Reddit, inside today's post. */
  canEnter: boolean;
};

/** The entry's comment, posted as the player. Words only describe the kite; no call for votes. */
export function entryText(day: number, design: KiteDesign): string {
  return `My kite for Raja Langit on Day ${day + 1}: ${describeKite(design)}`;
}

/** Most votes first; on a tie, whoever entered first. */
export function byVotes<T extends { votes: number; at: number }>(
  entries: readonly T[]
): T[] {
  return [...entries].sort((a, b) => b.votes - a.votes || a.at - b.at);
}
