import type { KampungBoard } from '../../shared/kampung.ts';
import type { Sky } from '../../shared/sim/types.ts';

/** Today's sky as the server assembled it, including Raja Langit. */
export type FightView = {
  day: number;
  sky: Sky;
  king: { name: string; score: number; seed: boolean } | null;
  fliers: number;
  kampungs: KampungBoard;
};
