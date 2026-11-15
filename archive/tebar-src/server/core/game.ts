// What the server knows and decides: which board a post shows, what a run scores, whose run
// counts, streaks and standings. It talks to storage only through `Store`, so the same code
// runs on Reddit, in tests and in the local preview.
//
// Everything stored about a player expires within 30 days of their last run.

import type {
  BoardResponse,
  BoardStats,
  NotCounted,
  RunResponse,
  RunResult,
  StandingsResponse,
} from '../../shared/api.ts';
import { dayNumber, weekOf } from '../../shared/days.ts';
import { dailyPuzzle } from '../../shared/generator.ts';
import { IllegalPick, playLine, starsFor } from '../../shared/puzzle.ts';
import type { Store } from './store.ts';

/** A logged-in player, or null for someone browsing logged out. */
export type Player = { id: string; name: string } | null;

export type Game = { store: Store; nowMs: number };

/** Thirty days, in seconds. */
export const KEEP_SECONDS = 30 * 24 * 60 * 60;
const LIST_SIZE = 20;
const MAX_LINE = 12;

const keys = {
  runs: (day: number) => `runs:${day}`,
  histogram: (day: number) => `hist:${day}`,
  perfect: (day: number) => `perfect:${day}`,
  week: (week: number) => `week:${week}`,
  profile: (id: string) => `u:${id}`,
};

/** A request the server refuses, with the HTTP status to answer with. */
export class Refused extends Error {
  readonly status: 400 | 409;
  constructor(status: 400 | 409, message: string) {
    super(message);
    this.name = 'Refused';
    this.status = status;
  }
}

// ───────────────────────────── Profiles and streaks ─────────────────────────────

type Profile = {
  name: string;
  /** Days in a row with a counted run, ending on `last`. */
  streak: number;
  /** The last day with a counted run. */
  last: number;
};

function parseProfile(raw: string | null | undefined): Profile | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { name, streak, last } = v as Record<string, unknown>;
    if (
      typeof name !== 'string' ||
      typeof streak !== 'number' ||
      typeof last !== 'number'
    )
      return null;
    return { name, streak, last };
  } catch {
    return null;
  }
}

/** A streak is alive if its last day is today or yesterday. */
const liveStreak = (profile: Profile | null, today: number): number =>
  profile && profile.last >= today - 1 ? profile.streak : 0;

// ───────────────────────────── Runs and stats ─────────────────────────────

function parseRun(raw: string | undefined): RunResult | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { line, score } = v as Record<string, unknown>;
    if (!Array.isArray(line) || typeof score !== 'number') return null;
    return { line: line.map(Number), score };
  } catch {
    return null;
  }
}

async function readStats(
  store: Store,
  day: number,
  perfect: number
): Promise<BoardStats> {
  const raw = await store.hGetAll(keys.histogram(day));
  const histogram: Record<string, number> = {};
  let players = 0;
  for (const [score, count] of Object.entries(raw)) {
    histogram[score] = Number(count);
    players += histogram[score];
  }
  return { players, perfect: histogram[String(perfect)] ?? 0, histogram };
}

function parseLine(line: unknown): number[] {
  if (!Array.isArray(line) || line.length === 0 || line.length > MAX_LINE) {
    throw new Refused(400, 'A run is a list of holes.');
  }
  for (const hole of line) {
    if (!Number.isInteger(hole))
      throw new Refused(400, 'A run is a list of holes.');
  }
  return line as number[];
}

// ───────────────────────────── The three questions ─────────────────────────────

/** The board a post shows, and where this player stands on it. `postDay` is the post's own day. */
export async function getBoard(
  game: Game,
  player: Player,
  postDay: number | undefined
): Promise<BoardResponse> {
  const today = dayNumber(game.nowMs);
  // A post cannot be from the future; one without a day shows today's board.
  const day =
    postDay !== undefined &&
    Number.isInteger(postDay) &&
    postDay >= 1 &&
    postDay <= today
      ? postDay
      : today;
  const daily = dailyPuzzle(day);

  const [stats, run, profile] = await Promise.all([
    readStats(game.store, day, daily.perfect),
    player ? game.store.hGet(keys.runs(day), player.id) : undefined,
    player ? game.store.get(keys.profile(player.id)) : undefined,
  ]);

  return {
    day,
    today,
    level: daily.level,
    cells: daily.cells,
    picks: daily.picks,
    perfect: daily.perfect,
    player: {
      name: player?.name ?? null,
      streak: liveStreak(parseProfile(profile), today),
    },
    result: parseRun(run),
    stats,
    bestLine: day < today ? daily.bestLine : null,
  };
}

/**
 * Scores a run. It becomes the player's counted run only if they are logged in, the board is
 * today's, and they have none yet. The score is always worked out here, never taken from the client.
 */
export async function submitRun(
  game: Game,
  player: Player,
  body: { day: unknown; line: unknown }
): Promise<RunResponse> {
  const { store } = game;
  const today = dayNumber(game.nowMs);
  const day = body.day;
  if (
    typeof day !== 'number' ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > today
  ) {
    throw new Refused(409, 'That board is not open.');
  }
  const daily = dailyPuzzle(day);

  let run: RunResult;
  try {
    const played = playLine(daily, parseLine(body.line));
    run = { line: played.line, score: played.score };
  } catch (error) {
    if (error instanceof IllegalPick) throw new Refused(400, error.message);
    throw error;
  }

  const answer = async (
    counted: boolean,
    reason: NotCounted | null,
    result: RunResult,
    streak: number
  ): Promise<RunResponse> => ({
    counted,
    reason,
    result,
    streak,
    stats: await readStats(store, day, daily.perfect),
  });

  if (!player) return answer(false, 'anonymous', run, 0);

  const profile = parseProfile(await store.get(keys.profile(player.id)));
  if (day < today)
    return answer(false, 'late', run, liveStreak(profile, today));

  const first = await store.hSetNX(
    keys.runs(day),
    player.id,
    JSON.stringify(run)
  );
  if (first === 0) {
    const kept = parseRun(await store.hGet(keys.runs(day), player.id)) ?? run;
    return answer(false, 'already', kept, liveStreak(profile, today));
  }

  const streak = profile && profile.last === day - 1 ? profile.streak + 1 : 1;
  const next: Profile = { name: player.name, streak, last: day };
  const week = weekOf(day);
  const stars = starsFor(run.score, daily.perfect);

  await Promise.all([
    store.expire(keys.runs(day), KEEP_SECONDS),
    store
      .hIncrBy(keys.histogram(day), String(run.score), 1)
      .then(() => store.expire(keys.histogram(day), KEEP_SECONDS)),
    store
      .set(keys.profile(player.id), JSON.stringify(next))
      .then(() => store.expire(keys.profile(player.id), KEEP_SECONDS)),
    store
      .zIncrBy(keys.week(week), player.id, stars)
      .then(() => store.expire(keys.week(week), KEEP_SECONDS)),
    run.score >= daily.perfect
      ? store
          .zAdd(keys.perfect(day), { member: player.id, score: game.nowMs })
          .then(() => store.expire(keys.perfect(day), KEEP_SECONDS))
      : undefined,
  ]);

  return answer(true, null, run, streak);
}

/** Who reached the best score on a day, and the week's stars. */
export async function getStandings(
  game: Game,
  player: Player,
  dayAsked: unknown
): Promise<StandingsResponse> {
  const { store } = game;
  const today = dayNumber(game.nowMs);
  const day =
    typeof dayAsked === 'number' &&
    Number.isInteger(dayAsked) &&
    dayAsked >= 1 &&
    dayAsked <= today
      ? dayAsked
      : today;
  const weekKey = keys.week(weekOf(day));

  const [club, count, top, mine] = await Promise.all([
    store.zRange(keys.perfect(day), 0, LIST_SIZE - 1, { by: 'rank' }),
    store.zCard(keys.perfect(day)),
    store.zRange(weekKey, 0, LIST_SIZE - 1, { by: 'rank', reverse: true }),
    player ? store.zScore(weekKey, player.id) : undefined,
  ]);

  const ids = [...new Set([...club, ...top].map((m) => m.member))];
  const profiles =
    ids.length === 0 ? [] : await store.mGet(ids.map(keys.profile));
  const names = new Map(
    ids.map((id, i) => [id, parseProfile(profiles[i])?.name ?? 'a player'])
  );
  const nameOf = (id: string): string => names.get(id) ?? 'a player';

  // Players with the same stars share a rank.
  let rank = 0;
  let previous = Number.NaN;
  const entries = top.map((m, i) => {
    if (m.score !== previous) rank = i + 1;
    previous = m.score;
    return { rank, name: nameOf(m.member), stars: m.score };
  });

  let me: StandingsResponse['week']['me'] = null;
  if (player && mine !== undefined) {
    const listed = top.findIndex((m) => m.member === player.id);
    if (listed >= 0) {
      me = { rank: entries[listed].rank, stars: mine };
    } else {
      // Outside the list: count everyone with more stars.
      const all = await store.zRange(weekKey, 0, -1, {
        by: 'rank',
        reverse: true,
      });
      me = { rank: all.filter((m) => m.score > mine).length + 1, stars: mine };
    }
  }

  return {
    day,
    perfectClub: { count, names: club.map((m) => nameOf(m.member)) },
    week: { entries, me },
  };
}

// ───────────────────────────── The daily post ─────────────────────────────

const POSTS = 'posts';
const PENDING = 'pending';

/**
 * Makes sure a day has its post, exactly once. The scheduler, an install and a moderator can all
 * ask at the same moment; only the first to claim the day creates the post.
 */
export async function ensureDailyPost(
  store: Store,
  day: number,
  create: (day: number) => Promise<{ id: string }>
): Promise<{ id: string | null; created: boolean }> {
  const claimed = await store.hSetNX(POSTS, String(day), PENDING);
  if (claimed === 0) {
    const id = await store.hGet(POSTS, String(day));
    return { id: id && id !== PENDING ? id : null, created: false };
  }
  try {
    const post = await create(day);
    await store.hSet(POSTS, { [String(day)]: post.id });
    return { id: post.id, created: true };
  } catch (error) {
    // Let a later attempt try again.
    await store.hDel(POSTS, [String(day)]);
    throw error;
  }
}
