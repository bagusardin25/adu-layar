import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayStartMs } from '../shared/days.ts';
import { createApp } from './app.ts';
import { createMemoryStore } from './core/memoryStore.ts';
import { ensureDailyPost, KEEP_SECONDS } from './core/posts.ts';
import { defaultProfile } from '../shared/kite.ts';
import type { Profile } from '../shared/kite.ts';

function setup(options: { failPost?: boolean; loggedOut?: boolean } = {}) {
  const store = createMemoryStore();
  const made: number[] = [];
  const app = createApp({
    store,
    now: () => dayStartMs(5) + 3600 * 1000,
    player: () => (options.loggedOut ? null : { id: 't2_ani', name: 'ani' }),
    postDay: () => undefined,
    subredditName: () => 'layangan_dev',
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
  const get = (path: string) => app.request(path);
  return { store, made, post, get };
}

type MenuAnswer = { navigateTo?: string; showToast?: string };

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
  const first = (await (
    await post('/internal/menu/post-create')
  ).json()) as MenuAnswer;
  assert.equal(
    first.navigateTo,
    'https://reddit.com/r/layangan_dev/comments/t3_post5'
  );
  assert.equal(first.showToast, undefined);
  const second = (await (
    await post('/internal/menu/post-create')
  ).json()) as MenuAnswer;
  assert.equal(second.navigateTo, first.navigateTo);
  assert.match(second.showToast ?? '', /already posted/);
  assert.deepEqual(made, [5]);
});

test('a failed post is reported to Reddit and can be tried again', async () => {
  const failing = setup({ failPost: true });
  assert.equal(
    (
      await failing.post('/internal/triggers/on-app-install', {
        type: 'AppInstall',
      })
    ).status,
    400
  );
  assert.equal((await failing.post('/internal/menu/post-create')).status, 400);
  assert.deepEqual(
    await failing.store.hGetAll('posts'),
    {},
    'no claim is left behind'
  );
});

test('ensureDailyPost creates once however many ask, and retries after a failure', async () => {
  const store = createMemoryStore();
  let made = 0;
  const create = async (day: number) => ({ id: `t3_post${day}_${++made}` });
  const results = await Promise.all(
    [1, 2, 3].map(() => ensureDailyPost(store, 5, create))
  );
  assert.equal(made, 1);
  assert.equal(results.filter((r) => r.created).length, 1);
  await assert.rejects(() =>
    ensureDailyPost(store, 6, async () => {
      throw new Error('down');
    })
  );
  assert.deepEqual(await ensureDailyPost(store, 6, create), {
    id: 't3_post6_2',
    created: true,
  });
});

type ProfileAnswer = { profile: Profile; saved: boolean; error?: string };

const mine: Profile = {
  design: {
    shape: 'pari',
    motif: 'kawung',
    main: 'biru',
    trim: 'kuning',
    tail: 'pita',
    line: 'biasa',
  },
  name: { title: 'kang', nick: 'petir' },
};

test('a new player gets the kite and name their account starts with', async () => {
  const { get } = setup();
  const answer = (await (await get('/api/profile')).json()) as ProfileAnswer;
  assert.equal(answer.saved, false);
  assert.deepEqual(answer.profile, defaultProfile('t2_ani'));
});

test('a saved kite comes back, and is kept 30 days from the save', async () => {
  const { get, post, store } = setup();
  const res = await post('/api/profile', mine);
  assert.equal(res.status, 200);
  assert.deepEqual(((await res.json()) as ProfileAnswer).profile, mine);
  const answer = (await (await get('/api/profile')).json()) as ProfileAnswer;
  assert.deepEqual(answer, { profile: mine, saved: true });
  assert.equal(store.expiries.get('profile:t2_ani'), KEEP_SECONDS);
});

test('a kite made of unknown choices, or with extra fields, is refused or cleaned', async () => {
  const { get, post, store } = setup();
  for (const bad of [
    { ...mine, name: { title: 'kang', nick: 'Anything I like' } },
    { ...mine, design: { ...mine.design, main: '#123456' } },
    { design: mine.design },
    'not a kite',
  ]) {
    const res = await post('/api/profile', bad);
    assert.equal(res.status, 400);
  }
  assert.equal(await store.get('profile:t2_ani'), undefined);

  await post('/api/profile', {
    ...mine,
    extra: '<script>',
    design: { ...mine.design, note: 'hi' },
  });
  const answer = (await (await get('/api/profile')).json()) as ProfileAnswer;
  assert.deepEqual(answer.profile, mine, 'only known fields are kept');
});

test('a logged-out visitor can look but not save', async () => {
  const { get, post, store } = setup({ loggedOut: true });
  const answer = (await (await get('/api/profile')).json()) as ProfileAnswer;
  assert.equal(answer.saved, false);
  const res = await post('/api/profile', mine);
  assert.equal(res.status, 401);
  assert.deepEqual(store.keys(), []);
});
