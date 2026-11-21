import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayStartMs } from '../shared/days.ts';
import { createApp } from './app.ts';
import { createMemoryStore } from './core/memoryStore.ts';
import { postLink } from './core/posts.ts';

type Posted = { id: string; parent: string; as: string };

/** The game open inside the post of `postDay`, on `day`. */
function setup(day: number, postDay: number | undefined) {
  const clock = { day, postDay };
  const comments: Posted[] = [];
  const app = createApp({
    store: createMemoryStore(),
    now: () => dayStartMs(clock.day) + 3600 * 1000,
    player: () => ({ id: 't2_ani', name: 'ani' }),
    postDay: () => clock.postDay,
    subredditName: () => 'AduLayangan',
    createPost: async (d) => ({ id: `t3_post${d}` }),
    postId: () => (clock.postDay ? `t3_post${clock.postDay}` : undefined),
    comment: async ({ id, as }) => {
      const posted = { id: `t1_c${comments.length + 1}`, parent: id, as };
      comments.push(posted);
      return { id: posted.id };
    },
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
  return { clock, comments, send, get };
}

test('a post link is the post on Reddit', () => {
  assert.equal(
    postLink('AduLayangan', 't3_abc12'),
    'https://www.reddit.com/r/AduLayangan/comments/abc12/'
  );
});

test('opened in an older day’s post, the game links to today’s post', async () => {
  const t = setup(5, 5);
  await t.send('/internal/cron/daily-post', {});
  const inToday = await t.get<{ viewing: number; todayPost: string | null }>(
    '/api/fight'
  );
  assert.equal(inToday.viewing, 5);
  assert.equal(inToday.todayPost, null);

  t.clock.day = 7;
  await t.send('/internal/cron/daily-post', {});
  t.clock.postDay = 5;
  const inOld = await t.get<{ viewing: number; todayPost: string | null }>(
    '/api/fight'
  );
  assert.equal(inOld.viewing, 5);
  assert.equal(
    inOld.todayPost,
    'https://www.reddit.com/r/AduLayangan/comments/post7/'
  );

  t.clock.postDay = undefined;
  const nowhere = await t.get<{ viewing: number | null }>('/api/fight');
  assert.equal(nowhere.viewing, null);
});

test('a flight shared from an older post goes under today’s post', async () => {
  const t = setup(7, 4);
  await t.send('/internal/cron/daily-post', {});
  await t.send('/api/round', { day: 7, taps: [] });
  const shared = await t.send<{ posted: boolean }>('/api/share', {
    confirm: true,
  });
  assert.equal(shared.data.posted, true);
  assert.equal(t.comments[0].as, 'APP');
  assert.equal(t.comments[0].parent, 't3_post7');
  assert.equal(t.comments[1].parent, t.comments[0].id);
});

test('a flight flown before midnight is shared under that day’s post', async () => {
  const t = setup(5, 5);
  await t.send('/internal/cron/daily-post', {});
  await t.send('/api/round', { day: 5, taps: [] });
  t.clock.day = 6;
  t.clock.postDay = 6;
  await t.send('/internal/cron/daily-post', {});
  await t.send('/api/share', { confirm: true });
  assert.equal(t.comments[0].parent, 't3_post5');
});

test('a kite entered from an older post joins today’s contest, in today’s post', async () => {
  const t = setup(9, 3);
  const entered = await t.send<{ entered: boolean; canEnter: boolean }>(
    '/api/contest/enter',
    {}
  );
  assert.equal(entered.status, 200);
  assert.equal(entered.data.entered, true);
  assert.equal(t.comments[0].parent, 't3_post9');
  assert.equal(t.comments[1].as, 'USER');
});
