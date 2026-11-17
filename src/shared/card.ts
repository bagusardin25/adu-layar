// The line a player posts under the day's thread. The server builds it from the round it
// scored, so the comment cannot claim a score the flight did not earn.

import { kampungOf } from './kampung.ts';
import type { KampungId } from './kampung.ts';

export type Card = {
  day: number;
  score: number;
  reason: string | null;
  kingCut: boolean;
  rank: number | null;
  streak: number;
  /** Kites the player cut, in order. */
  names: string[];
  counted: boolean;
  /** The kampung the flight's points went to. */
  kampung: KampungId | null;
};

/** The comment body. Plain text, short enough to read in the thread. */
export function flightCard(card: Card): string {
  const cuts =
    card.names.length === 0 ? 'No kites cut' : `Cut: ${card.names.join(', ')}`;
  const ending =
    card.reason === 'cleared'
      ? 'Cleared the sky'
      : card.reason === 'time'
        ? 'Lasted the round'
        : card.reason === 'crashed'
          ? 'Caught on the roofs'
          : 'String cut';
  const place = card.counted
    ? card.rank
      ? `Rank ${card.rank}`
      : 'Scored flight'
    : 'Practice flight';
  const streak = card.streak > 1 ? `${card.streak}-day streak` : null;
  const team = card.kampung ? ` · for ${kampungOf(card.kampung).label}` : '';
  return [
    `Adu Layangan · Day ${card.day} · ${card.score}${team}`,
    cuts,
    card.kingCut ? 'Raja Langit: cut' : 'Raja Langit: still flying',
    [ending, place, streak].filter(Boolean).join(' · '),
  ].join('\n');
}
