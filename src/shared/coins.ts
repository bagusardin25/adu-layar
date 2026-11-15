// How coins are earned. The server works this out from a round it has replayed itself, so the
// client can show the rule but never decide the amount.

import type { Match } from './sim/types.ts';

export const COINS = {
  /** Given once, the first time a player is seen, so there is something to spend at once. */
  starter: 100,
  perCut: 10,
  lasted: 15,
  cleared: 25,
  /** For the first counted round of a day. */
  firstOfDay: 20,
  /** For each day of a streak after the first, on the first counted round, up to `streakMax`. */
  perStreakDay: 5,
  streakMax: 25,
} as const;

/** Rounds a day that earn coins and count for the day's best. Later rounds are practice. */
export const COIN_ROUNDS = 3;

export type CoinLine = { label: string; coins: number };

/** The coins a round earns, line by line. Lines worth nothing are left out. */
export function coinsFor(
  match: Match,
  extra: { firstOfDay: boolean; streak: number }
): CoinLine[] {
  const lines: CoinLine[] = [];
  if (match.cuts > 0)
    lines.push({
      label: match.cuts === 1 ? 'Cut a kite' : `Cut ${match.cuts} kites`,
      coins: match.cuts * COINS.perCut,
    });
  if (match.reason === 'time')
    lines.push({ label: 'Lasted the round', coins: COINS.lasted });
  if (match.reason === 'cleared')
    lines.push({ label: 'Cleared the sky', coins: COINS.cleared });
  if (extra.firstOfDay) {
    lines.push({ label: 'First flight today', coins: COINS.firstOfDay });
    const bonus = Math.min(
      COINS.streakMax,
      Math.max(0, extra.streak - 1) * COINS.perStreakDay
    );
    if (bonus > 0)
      lines.push({ label: `${extra.streak}-day streak`, coins: bonus });
  }
  return lines;
}

export const total = (lines: readonly CoinLine[]): number =>
  lines.reduce((sum, l) => sum + l.coins, 0);
