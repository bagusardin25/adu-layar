import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dayLabel,
  dayNumber,
  dayStartMs,
  DAY_MS,
  FIRST_DAY_MS,
  msUntilNextDay,
  weekdayOf,
} from './days.ts';
import {
  bandFor,
  dailyPuzzle,
  fitsBand,
  MAX_PER_HOLE,
  MAX_PICK_DROPS,
} from './generator.ts';
import { playLine, solve, STORE } from './puzzle.ts';

test('days start at 00:00 UTC and day 1 is 12 November 2026', () => {
  assert.equal(dayNumber(FIRST_DAY_MS), 1);
  assert.equal(dayNumber(FIRST_DAY_MS + DAY_MS - 1), 1);
  assert.equal(dayNumber(FIRST_DAY_MS + DAY_MS), 2);
  assert.equal(dayNumber(FIRST_DAY_MS - 1), 0);
  assert.equal(dayStartMs(2), FIRST_DAY_MS + DAY_MS);
  assert.equal(weekdayOf(1), 4, '12 November 2026 is a Thursday');
  assert.equal(dayLabel(1), 'Thu 12 Nov');
  assert.equal(dayLabel(21), 'Wed 2 Dec');
  assert.equal(msUntilNextDay(FIRST_DAY_MS + 1000), DAY_MS - 1000);
});

test('the same day always gives the same board, and days differ', () => {
  const a = dailyPuzzle(7);
  const b = dailyPuzzle(7);
  assert.deepEqual(a, b);
  const seen = new Set<string>();
  for (let day = 1; day <= 60; day++)
    seen.add(dailyPuzzle(day).cells.join(','));
  assert.equal(seen.size, 60);
});

test('every board for the first 120 days fits its difficulty band', () => {
  for (let day = 1; day <= 120; day++) {
    assert.ok(fitsBand(day), `day ${day} missed its band`);
  }
});

test('boards are small, start with empty stores, and carry a real perfect line', () => {
  for (let day = 1; day <= 120; day++) {
    const d = dailyPuzzle(day);
    assert.equal(d.cells.length, 16);
    assert.equal(d.cells[STORE], 0);
    assert.equal(d.cells[15], 0);
    assert.deepEqual(d.cells.slice(5, 7), [0, 0]);
    assert.deepEqual(d.cells.slice(13, 15), [0, 0]);
    for (const n of d.cells) assert.ok(n >= 0 && n <= MAX_PER_HOLE);
    assert.equal(d.picks, bandFor(day).picks);
    const s = solve(d);
    assert.equal(d.perfect, s.perfect);
    assert.equal(playLine(d, d.bestLine).score, d.perfect);
    assert.ok(
      s.maxDrops <= MAX_PICK_DROPS,
      `day ${day} has a pick of ${s.maxDrops} drops`
    );
  }
});

test('the week climbs: Monday is easy with 4 picks, Saturday expert with 6', () => {
  // Day 5 is Monday 16 November 2026.
  assert.equal(weekdayOf(5), 1);
  assert.deepEqual([dailyPuzzle(5).level, dailyPuzzle(5).picks], ['easy', 4]);
  assert.deepEqual([dailyPuzzle(6).level, dailyPuzzle(6).picks], ['medium', 5]);
  assert.deepEqual([dailyPuzzle(9).level, dailyPuzzle(9).picks], ['hard', 5]);
  assert.deepEqual(
    [dailyPuzzle(10).level, dailyPuzzle(10).picks],
    ['expert', 6]
  );
});
