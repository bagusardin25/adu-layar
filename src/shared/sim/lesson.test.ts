import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lessonSky } from './lesson.ts';
import { createMatch, step } from './match.ts';
import { ROUND_TICKS } from './types.ts';

test('the practice sky has no clock', () => {
  const sky = lessonSky();
  assert.equal(sky.untimed, true);
  assert.equal(sky.rivals.length, 0);
  assert.equal(sky.ghosts?.length, 1);
  assert.equal(sky.ghosts?.[0]?.name, 'Si Latih');

  const match = createMatch(sky);
  for (let i = 0; i < ROUND_TICKS && !match.over; i++) step(match, true);
  assert.notEqual(match.reason, 'time');
  if (!match.over) assert.equal(match.tick, ROUND_TICKS);
});
