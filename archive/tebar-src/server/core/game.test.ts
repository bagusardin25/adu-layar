import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayStartMs, weekOf } from '../../shared/days.ts';
import { dailyPuzzle } from '../../shared/generator.ts';
import { playableHoles, startRun, pick } from '../../shared/puzzle.ts';
import {
  ensureDailyPost,
  getBoard,
  getStandings,
  KEEP_SECONDS,
  Refused,
  submitRun,
} from './game.ts';
import type { Game, Player } from './game.ts';
import { createMemoryStore } from './memoryStore.ts';

const ani: Player = { id: 't2_ani', name: 'ani' };
const budi: Player = { id: 't2_budi', name: 'budi' };
const citra: Player = { id: 't2_citra', name: 'citra' };

function setup() {
  const store = createMemoryStore();
  /** A moment in the middle of a day. */
  const at = (day: number): Game => ({
    store,
    nowMs: dayStartMs(day) + 12 * 3600 * 1000,
  });
  return { store, at };
}

/** A legal line that is not the best one: always the lowest playable hole. */
function plainLine(day: number): number[] {
  let run = startRun(dailyPuzzle(day));
  while (!run.over) run = pick(run, playableHoles(run.board)[0]).run;
  return run.line;
}

test('a new player sees the board with no result, no streak and no best line', async () => {
  const { at } = setup();
  const board = await getBoard(at(5), ani, 5);
  const daily = dailyPuzzle(5);
  assert.equal(board.day, 5);
  assert.equal(board.today, 5);
  assert.deepEqual(board.cells, daily.cells);
  assert.equal(board.picks, daily.picks);
  assert.equal(board.perfect, daily.perfect);
  assert.deepEqual(board.player, { name: 'ani', streak: 0 });
  assert.equal(board.result, null);
  assert.deepEqual(board.stats, { players: 0, perfect: 0, histogram: {} });
  assert.equal(
    board.bestLine,
    null,
    'the best line stays on the server while the day is open'
  );
});

test('a post without a day, or with a day in the future, shows today', async () => {
  const { at } = setup();
  assert.equal((await getBoard(at(5), ani, undefined)).day, 5);
  assert.equal((await getBoard(at(5), ani, 9)).day, 5);
  assert.equal((await getBoard(at(5), ani, 0)).day, 5);
});

test('the first run counts, is scored by the server, and shows up on the board', async () => {
  const { at } = setup();
  const daily = dailyPuzzle(5);
  const line = plainLine(5);

  const answer = await submitRun(at(5), ani, { day: 5, line });
  assert.equal(answer.counted, true);
  assert.equal(answer.reason, null);
  assert.deepEqual(answer.result.line, line);
  assert.ok(answer.result.score >= 0 && answer.result.score <= daily.perfect);
  assert.equal(answer.streak, 1);
  assert.equal(answer.stats.players, 1);
  assert.deepEqual(answer.stats.histogram, {
    [String(answer.result.score)]: 1,
  });

  const board = await getBoard(at(5), ani, 5);
  assert.deepEqual(board.result, answer.result);
  assert.equal(board.player.streak, 1);
});

test('a second run never replaces the first', async () => {
  const { at } = setup();
  const daily = dailyPuzzle(5);
  const first = await submitRun(at(5), ani, { day: 5, line: plainLine(5) });
  const second = await submitRun(at(5), ani, { day: 5, line: daily.bestLine });

  assert.equal(second.counted, false);
  assert.equal(second.reason, 'already');
  assert.deepEqual(
    second.result,
    first.result,
    'the answer carries the run that counts'
  );
  assert.equal(second.stats.players, 1);
  assert.equal(
    second.stats.perfect,
    first.result.score === daily.perfect ? 1 : 0
  );
});

test('made-up, unfinished and malformed runs are refused', async () => {
  const { at } = setup();
  const daily = dailyPuzzle(5);
  const refuses = async (
    body: { day: unknown; line: unknown },
    status: number
  ) => {
    await assert.rejects(
      () => submitRun(at(5), ani, body),
      (e) => e instanceof Refused && e.status === status
    );
  };
  await refuses({ day: 5, line: daily.bestLine.slice(0, 1) }, 400); // stops early
  await refuses({ day: 5, line: [9, 9, 9, 9] }, 400); // holes that do not exist
  await refuses({ day: 5, line: 'best' }, 400);
  await refuses({ day: 5, line: [] }, 400);
  await refuses({ day: 5, line: [0.5] }, 400);
  await refuses({ day: 6, line: plainLine(6) }, 409); // tomorrow's board
  await refuses({ day: 0, line: [0] }, 409);
  await refuses({ day: '5', line: plainLine(5) }, 409);
  assert.equal(
    (await getBoard(at(5), ani, 5)).stats.players,
    0,
    'nothing was recorded'
  );
});

test('a logged-out visitor is scored but nothing is stored', async () => {
  const { store, at } = setup();
  const answer = await submitRun(at(5), null, { day: 5, line: plainLine(5) });
  assert.equal(answer.counted, false);
  assert.equal(answer.reason, 'anonymous');
  assert.equal(answer.stats.players, 0);
  assert.deepEqual(store.keys(), []);
  assert.deepEqual((await getBoard(at(5), null, 5)).player, {
    name: null,
    streak: 0,
  });
});

test('yesterday’s post can still be played, but the run does not count and the best line is shown', async () => {
  const { at } = setup();
  const late = await submitRun(at(6), ani, { day: 5, line: plainLine(5) });
  assert.equal(late.counted, false);
  assert.equal(late.reason, 'late');
  assert.equal(late.stats.players, 0);

  const board = await getBoard(at(6), ani, 5);
  assert.equal(board.day, 5);
  assert.equal(board.today, 6);
  assert.deepEqual(board.bestLine, dailyPuzzle(5).bestLine);
});

test('streaks grow on consecutive days and start over after a gap', async () => {
  const { at } = setup();
  assert.equal(
    (await submitRun(at(5), ani, { day: 5, line: plainLine(5) })).streak,
    1
  );
  assert.equal(
    (await submitRun(at(6), ani, { day: 6, line: plainLine(6) })).streak,
    2
  );
  assert.equal(
    (await submitRun(at(7), ani, { day: 7, line: plainLine(7) })).streak,
    3
  );

  // Day 8 before playing: the streak is still alive.
  assert.equal((await getBoard(at(8), ani, 8)).player.streak, 3);
  // Day 9 without having played day 8: it is gone.
  assert.equal((await getBoard(at(9), ani, 9)).player.streak, 0);
  assert.equal(
    (await submitRun(at(9), ani, { day: 9, line: plainLine(9) })).streak,
    1
  );
});

test('standings: the perfect club in order of arrival, and the week’s stars with shared ranks', async () => {
  const { store, at } = setup();
  // Days 5 to 7 are Monday to Wednesday of one week.
  assert.equal(weekOf(5), weekOf(7));
  const best = (day: number) => dailyPuzzle(day).bestLine;

  await submitRun({ store, nowMs: dayStartMs(5) + 1000 }, budi, {
    day: 5,
    line: best(5),
  });
  await submitRun({ store, nowMs: dayStartMs(5) + 2000 }, ani, {
    day: 5,
    line: best(5),
  });
  await submitRun({ store, nowMs: dayStartMs(5) + 3000 }, citra, {
    day: 5,
    line: plainLine(5),
  });
  await submitRun(at(6), ani, { day: 6, line: best(6) });
  await submitRun(at(6), budi, { day: 6, line: best(6) });

  const monday = await getStandings(at(6), citra, 5);
  assert.deepEqual(monday.perfectClub, { count: 2, names: ['budi', 'ani'] });

  const week = (await getStandings(at(6), citra, 6)).week;
  assert.deepEqual(
    week.entries.slice(0, 2).map((e) => [e.rank, e.stars]),
    [
      [1, 6],
      [1, 6],
    ]
  );
  assert.deepEqual(
    week.entries
      .slice(0, 2)
      .map((e) => e.name)
      .sort(),
    ['ani', 'budi']
  );
  assert.equal(week.entries[2].name, 'citra');
  assert.equal(week.entries[2].rank, 3);
  assert.deepEqual(week.me, { rank: 3, stars: week.entries[2].stars });

  // A new week starts empty.
  assert.notEqual(weekOf(12), weekOf(7));
  const next = await getStandings(at(12), ani, 12);
  assert.deepEqual(next.week, { entries: [], me: null });
  assert.equal((await getStandings(at(6), null, 6)).week.me, null);
});

test('everything stored about players expires within 30 days', async () => {
  const { store, at } = setup();
  await submitRun(at(5), ani, { day: 5, line: dailyPuzzle(5).bestLine });
  await submitRun(at(5), budi, { day: 5, line: plainLine(5) });
  const stored = store.keys();
  assert.ok(
    stored.length >= 5,
    `expected run, histogram, perfect, week and profile keys, got ${stored}`
  );
  for (const key of stored) {
    assert.equal(store.expiries.get(key), KEEP_SECONDS, `${key} has no expiry`);
  }
});

test('the daily post is created once, however many ask, and can be retried after a failure', async () => {
  const { store } = setup();
  let made = 0;
  const create = async (day: number) => ({ id: `t3_post${day}_${++made}` });

  const [a, b, c] = await Promise.all([
    ensureDailyPost(store, 5, create),
    ensureDailyPost(store, 5, create),
    ensureDailyPost(store, 5, create),
  ]);
  assert.equal(made, 1);
  assert.equal([a, b, c].filter((r) => r.created).length, 1);
  assert.deepEqual(await ensureDailyPost(store, 5, create), {
    id: 't3_post5_1',
    created: false,
  });

  await assert.rejects(() =>
    ensureDailyPost(store, 6, async () => {
      throw new Error('Reddit is down');
    })
  );
  assert.deepEqual(await ensureDailyPost(store, 6, create), {
    id: 't3_post6_2',
    created: true,
  });
});
