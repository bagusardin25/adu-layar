import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COINS } from '../shared/coins.ts';
import { dayStartMs } from '../shared/days.ts';
import type { Profile } from '../shared/kite.ts';
import { decide } from '../shared/sim/ai.ts';
import { createMatch, replay, step } from '../shared/sim/match.ts';
import type { Taps } from '../shared/sim/match.ts';
import { skyForDay } from '../shared/sim/sky.ts';
import { PLAYER_ID } from '../shared/sim/types.ts';
import { createApp } from './app.ts';
import { createMemoryStore } from './core/memoryStore.ts';
import { KEEP_SECONDS } from './core/posts.ts';

type WalletAnswer = {
  guest?: boolean;
  coins: number;
  owned: string[];
  streak: number;
  spoolsLeft: number;
};
type RoundAnswer = {
  score: number;
  counted: boolean;
  coins: { lines: { label: string; coins: number }[]; earned: number };
  wallet: WalletAnswer | null;
  error?: string;
};

function setup(options: { loggedOut?: boolean } = {}) {
  const store = createMemoryStore();
  const clock = { day: 5 };
  const app = createApp({
    store,
    now: () => dayStartMs(clock.day) + 3600 * 1000,
    player: () => (options.loggedOut ? null : { id: 't2_ani', name: 'ani' }),
    postDay: () => undefined,
    subredditName: () => 'layangan_dev',
    createPost: async (day) => ({ id: `t3_post${day}` }),
  });
  const send = async <T>(path: string, body: unknown) => {
    const res = await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: (await res.json()) as T };
  };
  const wallet = async () =>
    (await (await app.request('/api/wallet')).json()) as WalletAnswer;
  return { store, clock, send, wallet };
}

/** Flies a round the way a rival would, and records its taps like the client does. */
function fly(day: number): Taps {
  const match = createMatch(skyForDay(day));
  const taps: Taps = [];
  let pull = false;
  while (!match.over) {
    const me = match.kites[PLAYER_ID];
    const want =
      match.contacts.some((c) => c.a === PLAYER_ID || c.b === PLAYER_ID) ||
      decide({ ...me, style: 'gesit', aim: 0.9 }, match);
    if (want !== pull) {
      taps.push(match.tick);
      pull = want;
    }
    step(match, pull);
  }
  return taps;
}

/** A day whose round, flown as above, cuts at least one kite. */
function dayWithCuts(from: number): number {
  for (let d = from; d < from + 40; d++)
    if (replay(skyForDay(d), fly(d)).cuts > 0) return d;
  throw new Error('no day with a cut');
}

test('a new player starts with the starter coins, kept 30 days', async () => {
  const { wallet, store } = setup();
  const w = await wallet();
  assert.equal(w.guest, false);
  assert.equal(w.coins, COINS.starter);
  assert.deepEqual(w.owned, []);
  assert.equal(w.spoolsLeft, 3);
  assert.equal(store.expiries.get('wallet:t2_ani'), KEEP_SECONDS);
  assert.equal((await wallet()).coins, COINS.starter, 'given only once');
});

test('the server scores a round from its taps and pays its coins', async () => {
  const { send, clock } = setup();
  clock.day = dayWithCuts(5);
  const taps = fly(clock.day);
  const expected = replay(skyForDay(clock.day), taps);

  const { status, data } = await send<RoundAnswer>('/api/round', {
    day: clock.day,
    taps,
  });
  assert.equal(status, 200);
  assert.equal(data.score, expected.score, 'same score as the client saw');
  assert.equal(data.counted, true);
  const labels = data.coins.lines.map((l) => l.label);
  assert.ok(labels.includes('First flight today'));
  assert.ok(labels.some((l) => l.startsWith('Cut')));
  assert.equal(
    data.coins.earned,
    data.coins.lines.reduce((s, l) => s + l.coins, 0)
  );
  assert.equal(data.wallet?.coins, COINS.starter + data.coins.earned);
  assert.equal(data.wallet?.spoolsLeft, 2);
});

test('only the first three rounds of a day earn coins', async () => {
  const { send } = setup();
  const taps = fly(5);
  const answers: RoundAnswer[] = [];
  for (let i = 0; i < 4; i++)
    answers.push(
      (await send<RoundAnswer>('/api/round', { day: 5, taps })).data
    );
  assert.deepEqual(
    answers.map((a) => a.counted),
    [true, true, true, false]
  );
  assert.equal(answers[3].coins.earned, 0);
  assert.equal(answers[3].wallet?.coins, answers[2].wallet?.coins);
  assert.equal(answers[3].wallet?.spoolsLeft, 0);
  assert.ok(
    !answers[1].coins.lines.some((l) => l.label === 'First flight today'),
    'the daily bonus is paid once'
  );
});

test('flying on days in a row builds a streak', async () => {
  const { send, clock } = setup();
  clock.day = 7;
  await send('/api/round', { day: 7, taps: fly(7) });
  clock.day = 8;
  const { data } = await send<RoundAnswer>('/api/round', {
    day: 8,
    taps: fly(8),
  });
  assert.deepEqual(
    data.coins.lines.find((l) => l.label.endsWith('streak')),
    { label: '2-day streak', coins: COINS.perStreakDay }
  );
  assert.equal(data.wallet?.streak, 2);
  clock.day = 10;
  const later = await send<RoundAnswer>('/api/round', {
    day: 10,
    taps: fly(10),
  });
  assert.equal(later.data.wallet?.streak, 1, 'a missed day starts again');
});

test('rounds from another day, or with broken taps, are refused', async () => {
  const { send, wallet } = setup();
  assert.equal((await send('/api/round', { day: 3, taps: [0] })).status, 400);
  assert.equal(
    (await send('/api/round', { day: 5, taps: [5, 3] })).status,
    400
  );
  assert.equal((await send('/api/round', { day: 5 })).status, 400);
  assert.equal((await wallet()).spoolsLeft, 3, 'nothing was counted');
  // A round begun just before midnight still counts for that day.
  assert.equal((await send('/api/round', { day: 4, taps: [0] })).status, 200);
});

test('a logged-out visitor gets a score but no coins', async () => {
  const { send, store } = setup({ loggedOut: true });
  const { data } = await send<RoundAnswer>('/api/round', {
    day: 5,
    taps: fly(5),
  });
  assert.equal(data.counted, false);
  assert.equal(data.wallet, null);
  assert.deepEqual(store.keys(), []);
  assert.equal(
    (await send('/api/shop/buy', { item: 'tail:ganda' })).status,
    401
  );
});

test('coins buy looks, once each, never below zero', async () => {
  const { send, wallet } = setup();
  const twin = await send<{ wallet: WalletAnswer }>('/api/shop/buy', {
    item: 'tail:ganda',
  });
  assert.equal(twin.status, 200);
  assert.equal(twin.data.wallet.coins, COINS.starter - 50);
  assert.deepEqual(twin.data.wallet.owned, ['tail:ganda']);

  const again = await send<{ wallet: WalletAnswer }>('/api/shop/buy', {
    item: 'tail:ganda',
  });
  assert.equal(
    again.data.wallet.coins,
    COINS.starter - 50,
    'not charged twice'
  );

  const tooDear = await send('/api/shop/buy', { item: 'line:pelangi' });
  assert.equal(tooDear.status, 400);
  assert.equal((await wallet()).coins, COINS.starter - 50);

  assert.equal(
    (await send('/api/shop/buy', { item: 'speed:fast' })).status,
    404
  );
  assert.equal(
    (await send('/api/shop/buy', { item: 'motif:kawung' })).status,
    404,
    'free things are not sold'
  );
});

test('two buys at once cannot spend the same coins', async () => {
  const { send, wallet } = setup();
  const [a, b] = await Promise.all([
    send('/api/shop/buy', { item: 'motif:mendung' }),
    send('/api/shop/buy', { item: 'motif:sisik' }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 400]);
  const w = await wallet();
  assert.ok(w.coins >= 0);
  assert.equal(w.owned.length, 1);
});

test('a kite can only be saved with things the player owns', async () => {
  const { send } = setup();
  const kite: Profile = {
    design: {
      shape: 'aduan',
      motif: 'mendung',
      main: 'biru',
      trim: 'putih',
      tail: 'pita',
      line: 'biasa',
    },
    name: { title: 'kang', nick: 'petir' },
  };
  const before = await send<{ missing?: string[] }>('/api/profile', kite);
  assert.equal(before.status, 403);
  assert.deepEqual(before.data.missing, ['motif:mendung']);
  await send('/api/shop/buy', { item: 'motif:mendung' });
  assert.equal((await send('/api/profile', kite)).status, 200);
});
