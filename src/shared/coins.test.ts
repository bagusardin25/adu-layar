import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COINS, coinsFor, total } from './coins.ts';
import { createMatch } from './sim/match.ts';
import { skyForDay } from './sim/sky.ts';
import type { Match } from './sim/types.ts';

const ended = (cuts: number, reason: Match['reason']): Match => ({
  ...createMatch(skyForDay(1)),
  cuts,
  reason,
  over: true,
});

test('coins follow the round: cuts, lasting, clearing', () => {
  assert.deepEqual(
    coinsFor(ended(0, 'cut'), { firstOfDay: false, streak: 0 }),
    []
  );
  assert.deepEqual(
    coinsFor(ended(2, 'time'), { firstOfDay: false, streak: 0 }),
    [
      { label: 'Cut 2 kites', coins: 2 * COINS.perCut },
      { label: 'Lasted the round', coins: COINS.lasted },
    ]
  );
  const cleared = coinsFor(ended(3, 'cleared'), {
    firstOfDay: false,
    streak: 0,
  });
  assert.equal(total(cleared), 3 * COINS.perCut + COINS.cleared);
});

test('the first flight of the day pays a bonus, and a streak adds to it up to a cap', () => {
  const day1 = coinsFor(ended(0, 'cut'), { firstOfDay: true, streak: 1 });
  assert.deepEqual(day1, [
    { label: 'First flight today', coins: COINS.firstOfDay },
  ]);
  const day3 = coinsFor(ended(0, 'cut'), { firstOfDay: true, streak: 3 });
  assert.equal(total(day3), COINS.firstOfDay + 2 * COINS.perStreakDay);
  const day40 = coinsFor(ended(0, 'cut'), { firstOfDay: true, streak: 40 });
  assert.equal(total(day40), COINS.firstOfDay + COINS.streakMax);
});
