import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pack, sampleAt } from './ghost.ts';
import { createMatch, healthOf, step } from './match.ts';
import { skyForDay } from './sky.ts';
import { PLAYER_ID, POINTS } from './types.ts';
import type { Sample, Sky } from './types.ts';

function kingSky(): Sky {
  const samples: Sample[] = [];
  for (let i = 0; i < 40; i++) samples.push({ x: 240, y: 300 - i, a: 0, f: 1 });
  return {
    ...skyForDay(2),
    rivals: [],
    ghosts: [
      {
        id: 'boss',
        name: 'High',
        colors: ['#F2C230', '#1B4F9C'],
        anchorX: 242,
        kind: 'king',
        score: 500,
        track: pack(samples),
      },
    ],
  };
}

test('a recorded kite follows its track and a king cut is worth 300', () => {
  const match = createMatch(kingSky());
  const king = match.kites.find((k) => k.kind === 'king');
  assert.ok(king);
  assert.equal(king.worth, POINTS.king);
  assert.equal(king.name, 'Raja · High');

  step(match, false);
  assert.equal(king.x, 240);
  assert.equal(king.y, 300);

  step(match, false);
  step(match, false);
  step(match, false);
  const seen = sampleAt(king.track ?? [], 3);
  assert.equal(king.x, seen?.x);
  assert.equal(king.y, seen?.y);

  king.damage = healthOf(king);
  king.hitBy = PLAYER_ID;
  step(match, false);
  const cut = match.events.find(
    (e) => e.type === 'cut' && e.victim === king.id && e.by === PLAYER_ID
  );
  assert.ok(cut && cut.type === 'cut');
  assert.equal(cut.points, POINTS.king);
  const end = match.events.find((e) => e.type === 'end');
  assert.ok(end && end.type === 'end' && end.reason === 'cleared');
  assert.equal(match.score, POINTS.king + end.points);
});
