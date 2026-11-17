import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pack } from '../shared/sim/ghost.ts';
import { skyForFight } from './core/fight.ts';
import { createMemoryStore } from './core/memoryStore.ts';
import { playRound } from './core/wallet.ts';

test("yesterday's best flight is today's Raja Langit", async () => {
  const store = createMemoryStore();
  const track = pack([{ x: 180, y: 280, a: 0, f: 1 }]);
  await store.zAdd('board:4', { member: 'low', score: 40 });
  await store.zAdd('board:4', { member: 'high', score: 900 });
  await store.set(
    'rec:4:low',
    JSON.stringify({
      id: 'low',
      name: 'Low',
      score: 40,
      colors: ['#111111', '#222222'],
      track,
    })
  );
  await store.set(
    'rec:4:high',
    JSON.stringify({
      id: 'high',
      name: 'High',
      score: 900,
      colors: ['#333333', '#444444'],
      track,
    })
  );

  const today = await skyForFight(store, 5);
  const king = today.sky.ghosts?.find((g) => g.kind === 'king');
  assert.equal(king?.id, 'high');
  assert.equal(king?.name, 'High');
  assert.equal(today.king?.seed, false);
  const before = today.sky.ghosts?.map((g) => `${g.kind}:${g.id}`).join();

  await playRound(store, 't2_now', 'Now', 5, [0]);
  const after = await skyForFight(store, 5);
  assert.equal(
    after.sky.ghosts?.map((g) => `${g.kind}:${g.id}`).join(),
    before,
    'a flight today waits until tomorrow'
  );
  assert.equal(after.fliers, 1);
});
