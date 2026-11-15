import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  BoardResponse,
  ErrorResponse,
  RunResponse,
  StandingsResponse,
} from '../shared/api.ts';
import { dayStartMs } from '../shared/days.ts';
import { dailyPuzzle } from '../shared/generator.ts';
import { createApp } from './app.ts';
import type { Player } from './core/game.ts';
import { createMemoryStore } from './core/memoryStore.ts';

function setup(
  options: {
    player?: Player;
    day?: number;
    postDay?: number;
    failPost?: boolean;
  } = {}
) {
  const store = createMemoryStore();
  const made: number[] = [];
  const state = {
    player:
      options.player === undefined
        ? { id: 't2_ani', name: 'ani' }
        : options.player,
  };
  const app = createApp({
    store,
    now: () => dayStartMs(options.day ?? 5) + 3600 * 1000,
    player: () => state.player,
    postDay: () => options.postDay,
    subredditName: () => 'tebar_dev',
    createPost: async (day) => {
      if (options.failPost) throw new Error('Reddit is down');
      made.push(day);
      return { id: `t3_post${day}` };
    },
  });
  const post = (path: string, body?: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? '{}' : JSON.stringify(body),
    });
  return { app, store, made, state, post };
}

test('GET /api/board answers with the board for the post', async () => {
  const { app } = setup();
  const res = await app.request('/api/board');
  assert.equal(res.status, 200);
  const board = (await res.json()) as BoardResponse;
  assert.equal(board.day, 5);
  assert.deepEqual(board.cells, dailyPuzzle(5).cells);
  assert.equal(board.player.name, 'ani');
});

test('POST /api/run records a run, and standings pick it up', async () => {
  const { app, post } = setup();
  const res = await post('/api/run', { day: 5, line: dailyPuzzle(5).bestLine });
  assert.equal(res.status, 200);
  const run = (await res.json()) as RunResponse;
  assert.equal(run.counted, true);
  assert.equal(run.result.score, dailyPuzzle(5).perfect);

  const standings = (await (
    await app.request('/api/standings?day=5')
  ).json()) as StandingsResponse;
  assert.deepEqual(standings.perfectClub, { count: 1, names: ['ani'] });
  assert.deepEqual(standings.week.me, { rank: 1, stars: 3 });
});

test('bad requests get a plain error and the right status', async () => {
  const { app, post } = setup();
  const illegal = await post('/api/run', {
    day: 5,
    line: [0, 0, 0, 0, 0, 0, 0],
  });
  assert.equal(illegal.status, 400);
  assert.equal(
    typeof ((await illegal.json()) as ErrorResponse).error,
    'string'
  );

  const closed = await post('/api/run', { day: 99, line: [0] });
  assert.equal(closed.status, 409);

  const garbage = await app.request('/api/run', {
    method: 'POST',
    body: 'not json',
  });
  assert.equal(garbage.status, 400);

  // A day that is not a number falls back to today.
  const standings = await app.request('/api/standings?day=abc');
  assert.equal(standings.status, 200);
  assert.equal(((await standings.json()) as StandingsResponse).day, 5);
});

test('the scheduler, an install and an upgrade together create one post', async () => {
  const { post, made } = setup();
  const responses = await Promise.all([
    post('/internal/cron/daily-post'),
    post('/internal/triggers/on-app-install', { type: 'AppInstall' }),
    post('/internal/triggers/on-app-upgrade', { type: 'AppUpgrade' }),
  ]);
  for (const res of responses) assert.equal(res.status, 200);
  assert.deepEqual(made, [5]);
});

test('the moderator menu opens today’s post, creating it only when needed', async () => {
  const { post, made } = setup();
  const first = (await (await post('/internal/menu/post-create')).json()) as {
    navigateTo?: string;
    showToast?: string;
  };
  assert.equal(
    first.navigateTo,
    'https://reddit.com/r/tebar_dev/comments/t3_post5'
  );
  assert.equal(first.showToast, undefined);

  const second = (await (await post('/internal/menu/post-create')).json()) as {
    navigateTo?: string;
    showToast?: string;
  };
  assert.equal(second.navigateTo, first.navigateTo);
  assert.match(second.showToast ?? '', /already posted/);
  assert.deepEqual(made, [5]);
});

test('a failed post is reported to Reddit and can be tried again', async () => {
  const failing = setup({ failPost: true });
  const trigger = await failing.post('/internal/triggers/on-app-install', {
    type: 'AppInstall',
  });
  assert.equal(trigger.status, 400);
  const menu = await failing.post('/internal/menu/post-create');
  assert.equal(menu.status, 400);
  assert.deepEqual(
    await failing.store.hGetAll('posts'),
    {},
    'no claim is left behind'
  );
});
