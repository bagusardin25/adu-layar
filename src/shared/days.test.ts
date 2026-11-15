import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dayLabel,
  dayNumber,
  dayStartMs,
  DAY_MS,
  FIRST_DAY_MS,
  msUntilNextDay,
  weekOf,
  weekdayOf,
} from './days.ts';

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

test('weeks run Monday to Sunday', () => {
  // Day 5 is Monday 16 November, day 11 Sunday 22 November.
  assert.equal(weekOf(5), weekOf(11));
  assert.notEqual(weekOf(4), weekOf(5));
  assert.notEqual(weekOf(11), weekOf(12));
});
