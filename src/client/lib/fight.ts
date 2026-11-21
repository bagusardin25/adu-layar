import type { KampungBoard } from '../../shared/kampung.ts';
import type { Sky } from '../../shared/sim/types.ts';

/** Today's sky as the server assembled it, including Raja Langit. */
export type FightView = {
  day: number;
  sky: Sky;
  king: { name: string; score: number; seed: boolean } | null;
  fliers: number;
  kampungs: KampungBoard;
  /** The day of the post the game is open in, when it is a day's post. */
  viewing: number | null;
  /** A link to today's post, when the game is open in an older day's post. */
  todayPost: string | null;
};
