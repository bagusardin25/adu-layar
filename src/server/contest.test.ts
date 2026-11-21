import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ContestView } from '../shared/contest.ts';
import { entryText } from '../shared/contest.ts';
import { dayStartMs } from '../shared/days.ts';
import { describeKite } from '../shared/kite.ts';
import type { KiteDesign, Profile } from '../shared/kite.ts';
import type { Sky } from '../shared/sim/types.ts';
import { createApp } from './app.ts';
import type { AppDeps } from './app.ts';
import { createMemoryStore } from './core/memoryStore.ts';

const KAWUNG: KiteDesign = {
  shape: 'aduan',
  motif: 'kawung',
  main: 'merah',
  trim: 'putih',
  tail: 'pita',
  line: 'biasa',
};
const STARS: KiteDesign = {
  shape: 'wajik',
  motif: 'bintang',
  main: 'biru',
  trim: 'kuning',
  tail: 'pita',
  line: 'biasa',
};

type Posted = { id: string; parent: string; text: string; as: string };

/**
 * The app inside a day's Reddit post. `votes` stands in for the comments' scores on Reddit:
 * a number, `null` for a deleted comment, or missing when Reddit cannot be asked.
 */
function setup(extra: Partial<AppDeps> = {}) {
  const clock = { day: 5, ms: 0 };
  const who = {
    current: { id: 't2_ani', name: 'ani' } as {
      id: string;
      name: string;
    } | null,
  };
  const comments: Posted[] = [];
  const votes: Record<string, number | null> = {};
  const asked = { count: 0 };
  const app = createApp({
    store: createMemoryStore(),
    now: () => dayStartMs(clock.day) + 3600 * 1000 + clock.ms,
    player: () => who.current,
    postDay: () => clock.day,
    subredditName: () => 'AduLayangan',
    createPost: async (day) => ({ id: `t3_post${day}` }),
    postId: () => `t3_post${clock.day}`,
    comment: async ({ id, text, as }) => {
      const posted = { id: `t1_c${comments.length + 1}`, parent: id, text, as };
      comments.push(posted);
      return { id: posted.id };
    },
    commentScores: async (ids) => {
      asked.count += 1;
      const out: Record<string, number | null> = {};
      for (const id of ids) if (id in votes) out[id] = votes[id];
      return out;
    },
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
  /** Signs in as someone with a saved kite. */
  const as = async (id: string, name: string, design: KiteDesign) => {
    who.current = { id, name };
    const profile: Profile = { design, name: { title: 'bang', nick: 'petir' } };
    await send('/api/profile', profile);
  };
  return { clock, who, comments, votes, asked, send, get, as };
}

test('a kite is described in words, without asking for votes', () => {
  assert.equal(
    describeKite(KAWUNG),
    'Fighter · Kawung · Red and White · Ribbon tail'
  );
  assert.equal(
    entryText(5, STARS),
    'My kite for Raja Langit on Day 6: Diamond · Star · Blue and Yellow · Ribbon tail'
  );
  assert.doesNotMatch(entryText(5, STARS), /vote/i);
});

test('entering posts the saved kite as the player, under the app’s contest comment', async () => {
  const { as, send, comments } = setup();
  await as('t2_ani', 'ani', KAWUNG);
  const entered = await send<ContestView>('/api/contest/enter', {});
  assert.equal(entered.status, 200);
  assert.equal(comments.length, 2);
  assert.equal(comments[0].as, 'APP');
  assert.equal(comments[0].parent, 't3_post5');
  assert.match(comments[0].text, /Kite contest, Day 5/);
  assert.equal(comments[1].as, 'USER');
  assert.equal(comments[1].parent, comments[0].id);
  assert.equal(comments[1].text, entryText(5, KAWUNG));

  assert.equal(entered.data.entered, true);
  assert.equal(entered.data.canEnter, false);
  assert.equal(entered.data.entries.length, 1);
  assert.deepEqual(entered.data.entries[0].design, KAWUNG);
  assert.equal(entered.data.entries[0].mine, true);
  assert.equal(
    entered.data.entries[0].link,
    'https://www.reddit.com/r/AduLayangan/comments/post5/comment/c2/'
  );

  await as('t2_budi', 'budi', STARS);
  await send('/api/contest/enter', {});
  assert.equal(comments.length, 3, 'the contest comment is made once a day');
  assert.equal(comments[2].parent, comments[0].id);
});

test('one kite per player per day', async () => {
  const { as, send, comments } = setup();
  await as('t2_ani', 'ani', KAWUNG);
  await send('/api/contest/enter', {});
  const again = await send<{ error: string }>('/api/contest/enter', {});
  assert.equal(again.status, 409);
  assert.equal(comments.length, 2);
});

test('entering needs a login and Reddit, and works from any day’s post', async () => {
  const { send, who, clock } = setup();
  who.current = null;
  assert.equal((await send('/api/contest/enter', {})).status, 401);

  const offReddit = setup({ comment: undefined });
  assert.equal((await offReddit.send('/api/contest/enter', {})).status, 400);

  // Yesterday's post, opened today: the kite still goes to today's contest, in today's post.
  const old = setup({ postDay: () => 4, postId: () => 't3_post4' });
  assert.equal((await old.send('/api/contest/enter', {})).status, 200);
  assert.equal(old.comments[0].parent, 't3_post5');
  assert.equal(old.comments[1].parent, old.comments[0].id);
  assert.equal(clock.day, 5);
});

test('a comment that fails to post leaves the player free to try again', async () => {
  let fail = true;
  const posted: string[] = [];
  const t = setup({
    comment: async ({ as }) => {
      if (as === 'USER' && fail) {
        fail = false;
        throw new Error('Reddit did not take the comment.');
      }
      posted.push(as);
      return { id: `t1_x${posted.length}` };
    },
  });
  await t.as('t2_ani', 'ani', KAWUNG);
  assert.equal((await t.send('/api/contest/enter', {})).status, 500);
  assert.equal((await t.send('/api/contest/enter', {})).status, 200);
  assert.deepEqual(posted, ['APP', 'USER']);
});

test('the gallery ranks kites by upvotes and drops deleted ones', async () => {
  const t = setup();
  await t.as('t2_ani', 'ani', KAWUNG);
  await t.send('/api/contest/enter', {});
  t.clock.ms += 1000;
  await t.as('t2_budi', 'budi', STARS);
  await t.send('/api/contest/enter', {});
  await t.as('t2_cici', 'cici', KAWUNG);
  await t.send('/api/contest/enter', {});
  // Comments: c1 contest, c2 ani, c3 budi, c4 cici.
  t.votes.t1_c2 = 3;
  t.votes.t1_c3 = 9;
  t.votes.t1_c4 = null;
  t.clock.ms += 61_000;

  const view = await t.get<ContestView>('/api/contest');
  assert.deepEqual(
    view.entries.map((e) => [e.by, e.votes]),
    [
      ['budi', 9],
      ['ani', 3],
    ]
  );
  // Cici deleted her comment: her entry is gone, so she could enter again.
  assert.equal(view.entered, false);
  assert.equal(view.canEnter, true);
});

test('upvotes are read from Reddit at most once a minute', async () => {
  const t = setup();
  await t.as('t2_ani', 'ani', KAWUNG);
  await t.send('/api/contest/enter', {});
  t.votes.t1_c2 = 2;
  const before = t.asked.count;
  await t.get('/api/contest');
  await t.get('/api/contest');
  assert.equal(
    t.asked.count,
    before,
    'fresh from the entry, nothing to ask yet'
  );
  t.clock.ms += 61_000;
  await t.get('/api/contest');
  assert.equal(t.asked.count, before + 1);
});

test('the next day, Raja Langit flies the kite with the most upvotes, and it stays chosen', async () => {
  const t = setup();
  await t.as('t2_ani', 'ani', KAWUNG);
  await t.send('/api/contest/enter', {});
  t.clock.ms += 1000;
  await t.as('t2_budi', 'budi', STARS);
  await t.send('/api/contest/enter', {});
  t.votes.t1_c2 = 4;
  t.votes.t1_c3 = 7;

  t.clock.day = 6;
  t.clock.ms = 0;
  const fight = await t.get<{ sky: Sky }>('/api/fight');
  const king = fight.sky.ghosts?.find((g) => g.kind === 'king');
  assert.deepEqual(king?.chosen, { design: STARS, by: 'budi', votes: 7 });

  // Votes that come in after the day is over change nothing.
  t.votes.t1_c2 = 50;
  t.clock.ms += 120_000;
  const later = await t.get<ContestView>('/api/contest');
  assert.equal(later.flying?.by, 'budi');
  assert.equal(later.entries.length, 0, 'day 6 starts with no kites');
});

test('on a tie, the kite entered first is chosen', async () => {
  const t = setup();
  await t.as('t2_ani', 'ani', KAWUNG);
  await t.send('/api/contest/enter', {});
  t.clock.ms += 1000;
  await t.as('t2_budi', 'budi', STARS);
  await t.send('/api/contest/enter', {});
  t.votes.t1_c2 = 5;
  t.votes.t1_c3 = 5;
  t.clock.day = 6;
  const view = await t.get<ContestView>('/api/contest');
  assert.equal(view.flying?.by, 'ani');
});

test('nothing is chosen while Reddit cannot be asked, or on a day without kites', async () => {
  const t = setup();
  await t.as('t2_ani', 'ani', KAWUNG);
  await t.send('/api/contest/enter', {});
  // No score for c2: Reddit could not be asked.
  t.clock.day = 6;
  const unsure = await t.get<ContestView>('/api/contest');
  assert.equal(unsure.flying, null);

  t.votes.t1_c2 = 1;
  const settled = await t.get<ContestView>('/api/contest');
  assert.equal(settled.flying?.by, 'ani');

  const quiet = setup();
  quiet.clock.day = 6;
  const fight = await quiet.get<{ sky: Sky }>('/api/fight');
  assert.equal(
    fight.sky.ghosts?.find((g) => g.kind === 'king')?.chosen,
    undefined
  );
});

test('the daily post settles yesterday’s contest before it goes up', async () => {
  const t = setup();
  await t.as('t2_ani', 'ani', KAWUNG);
  await t.send('/api/contest/enter', {});
  t.votes.t1_c2 = 2;
  t.clock.day = 6;
  const posted = await t.send<{ created: boolean }>(
    '/internal/cron/daily-post',
    {}
  );
  assert.equal(posted.data.created, true);
  t.votes.t1_c2 = null;
  const view = await t.get<ContestView>('/api/contest');
  assert.equal(view.flying?.by, 'ani');
});

test('a kite entered between reads has its upvotes read right away', async () => {
  const t = setup();
  await t.as('t2_ani', 'ani', KAWUNG);
  await t.send('/api/contest/enter', {});
  t.votes.t1_c2 = 5;
  t.votes.t1_c3 = 3;
  await t.as('t2_budi', 'budi', STARS);
  const view = (await t.send<ContestView>('/api/contest/enter', {})).data;
  assert.deepEqual(
    view.entries.map((e) => [e.by, e.votes]),
    [
      ['budi', 3],
      ['ani', 0],
    ],
    'ani keeps the count from the last full read until the next one'
  );
  t.clock.ms += 61_000;
  const later = await t.get<ContestView>('/api/contest');
  assert.deepEqual(
    later.entries.map((e) => [e.by, e.votes]),
    [
      ['ani', 5],
      ['budi', 3],
    ]
  );
});
