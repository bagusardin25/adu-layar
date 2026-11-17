import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayStartMs } from '../shared/days.ts';
import { rankKampungs, winnerOf } from '../shared/kampung.ts';
import type { KampungBoard } from '../shared/kampung.ts';
import { replay } from '../shared/sim/match.ts';
import { createApp } from './app.ts';
import type { AppDeps } from './app.ts';
import { skyForFight } from './core/fight.ts';
import { createMemoryStore } from './core/memoryStore.ts';
import { dailyTitle } from './core/posts.ts';

type KampungAnswer = {
  guest: boolean;
  name: string | null;
  kampung: string | null;
  flair: string | null;
  canFlair: boolean;
  board: KampungBoard;
  error?: string;
};

/** A day on which a round with no taps at all still scores. */
async function scoringDay(): Promise<number> {
  for (let d = 5; d < 60; d++) {
    const fight = await skyForFight(createMemoryStore(), d);
    if (replay(fight.sky, []).score > 0) return d;
  }
  throw new Error('No day where an idle round scores.');
}

function setup(day: number, extra: Partial<AppDeps> = {}) {
  const clock = { day };
  const who = { id: 't2_ani', name: 'ani' } as {
    id: string;
    name: string;
  } | null;
  const player = { current: who };
  const app = createApp({
    store: createMemoryStore(),
    now: () => dayStartMs(clock.day) + 3600 * 1000,
    player: () => player.current,
    postDay: () => undefined,
    subredditName: () => 'AduLayangan',
    createPost: async (d) => ({ id: `t3_post${d}` }),
    ...extra,
  });
  const send = async <T>(path: string, body: unknown) => {
    const res = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: (await res.json()) as T };
  };
  const get = async <T>(path: string) =>
    (await (await app.request(path)).json()) as T;
  return { clock, player, send, get };
}

test('kampungs rank by points, and a tie at the top has no winner', () => {
  const ranked = rankKampungs({ hilir: 300, pesisir: 300 });
  assert.deepEqual(
    ranked.map((k) => k.id),
    ['hilir', 'pesisir', 'hulu']
  );
  assert.equal(winnerOf(ranked), null);
  assert.equal(winnerOf(rankKampungs({ pesisir: 50 })), 'pesisir');
  assert.equal(winnerOf(rankKampungs({})), null);
});

test('joining a kampung needs a login and a kampung from the list', async () => {
  const { send, player } = setup(5);
  assert.equal(
    (await send('/api/kampung', { kampung: 'atlantis' })).status,
    400
  );
  const joined = await send<KampungAnswer>('/api/kampung', { kampung: 'hulu' });
  assert.equal(joined.status, 200);
  assert.equal(joined.data.kampung, 'hulu');
  assert.equal(joined.data.name, 'ani');
  assert.equal(joined.data.canFlair, false);

  player.current = null;
  assert.equal((await send('/api/kampung', { kampung: 'hulu' })).status, 401);
});

test('scored flights add their points to the kampung; practice flights do not', async () => {
  const day = await scoringDay();
  const { send, get } = setup(day);
  await send('/api/kampung', { kampung: 'hilir' });

  let total = 0;
  for (let i = 0; i < 3; i++) {
    const round = await send<{ score: number; kampung: string | null }>(
      '/api/round',
      { day, taps: [] }
    );
    assert.equal(round.data.kampung, 'hilir');
    total += round.data.score;
  }
  assert.ok(total > 0);
  const practice = await send<{
    kampung: string | null;
    kampungs: KampungBoard;
  }>('/api/round', { day, taps: [] });
  assert.equal(practice.data.kampung, null);

  const fight = await get<{ kampungs: KampungBoard }>('/api/fight');
  assert.deepEqual(fight.kampungs.today[0], { id: 'hilir', points: total });
  assert.deepEqual(practice.data.kampungs.today[0], {
    id: 'hilir',
    points: total,
  });
});

test('moving kampung leaves earned points behind, and yesterday’s winner is named', async () => {
  const day = await scoringDay();
  const { send, get, clock } = setup(day);
  await send('/api/kampung', { kampung: 'pesisir' });
  const first = await send<{ score: number }>('/api/round', { day, taps: [] });
  await send('/api/kampung', { kampung: 'hulu' });
  const second = await send<{ score: number }>('/api/round', { day, taps: [] });

  const board = (await get<KampungAnswer>('/api/kampung')).board;
  const points = Object.fromEntries(board.today.map((k) => [k.id, k.points]));
  assert.equal(points.pesisir, first.data.score);
  assert.equal(points.hulu, second.data.score);

  clock.day = day + 1;
  const next = await get<KampungAnswer>('/api/kampung');
  const expected = winnerOf(
    rankKampungs({ pesisir: first.data.score, hulu: second.data.score })
  );
  assert.equal(next.board.yesterday, expected);
  assert.ok(next.board.today.every((k) => k.points === 0));
});

test('a flight with no kampung adds nothing', async () => {
  const day = await scoringDay();
  const { send, get } = setup(day);
  const round = await send<{ kampung: string | null }>('/api/round', {
    day,
    taps: [],
  });
  assert.equal(round.data.kampung, null);
  const fight = await get<{ kampungs: KampungBoard }>('/api/fight');
  assert.ok(fight.kampungs.today.every((k) => k.points === 0));
});

test('flair is worn only on request, with the kampung’s name and colour', async () => {
  const flairs: { username: string; text: string; backgroundColor: string }[] =
    [];
  const { send } = setup(5, {
    setFlair: async (args) => {
      flairs.push(args);
    },
  });
  const early = await send<KampungAnswer>('/api/kampung/flair', {});
  assert.equal(early.status, 400);

  const joined = await send<KampungAnswer>('/api/kampung', { kampung: 'hulu' });
  assert.equal(joined.data.canFlair, true);
  assert.equal(joined.data.flair, null);
  assert.equal(flairs.length, 0);

  const worn = await send<KampungAnswer>('/api/kampung/flair', {});
  assert.equal(worn.status, 200);
  assert.equal(worn.data.flair, 'hulu');
  assert.deepEqual(flairs, [
    { username: 'ani', text: 'Kampung Hulu', backgroundColor: '#237A4B' },
  ]);
});

test('outside Reddit there is no flair to set', async () => {
  const { send } = setup(5);
  await send('/api/kampung', { kampung: 'hulu' });
  assert.equal((await send('/api/kampung/flair', {})).status, 400);
});

test('the score card names the kampung the points went to', async () => {
  const day = await scoringDay();
  const { send } = setup(day);
  await send('/api/kampung', { kampung: 'pesisir' });
  await send('/api/round', { day, taps: [] });
  const card = await send<{ text: string }>('/api/share', { confirm: false });
  assert.match(card.data.text, /for Kampung Pesisir/);
});

test('the day’s post title names Raja Langit and yesterday’s winning kampung', () => {
  assert.equal(
    dailyTitle(7, 'Bang Petir', 'hulu'),
    'Adu Layangan · Day 7 · Cut down Bang Petir · Kampung Hulu won yesterday'
  );
  assert.equal(
    dailyTitle(1, null, null),
    'Adu Layangan · Day 1 · Cut down the kampung'
  );
});
