// Which kampung each player flies for, and each kampung's points on each day.
//
// A player's kampung is kept 30 days after it last changed or earned points, like everything
// else about a player. The day's points hold no player data.

import { isKampung, rankKampungs, winnerOf } from '../../shared/kampung.ts';
import type { KampungBoard, KampungId } from '../../shared/kampung.ts';
import { KEEP_SECONDS } from './posts.ts';
import type { Store } from './store.ts';

const memberKey = (playerId: string) => `kampung:${playerId}`;
const dayKey = (day: number) => `kampungs:${day}`;

export type Member = {
  /** The kampung the player flies for, if they picked one. */
  kampung: KampungId | null;
  /** The kampung the player last wore as flair, through the game. */
  flair: KampungId | null;
};

export async function loadMember(
  store: Store,
  playerId: string
): Promise<Member> {
  const fields = await store.hGetAll(memberKey(playerId));
  return {
    kampung: isKampung(fields.id) ? fields.id : null,
    flair: isKampung(fields.flair) ? fields.flair : null,
  };
}

/** Joins a kampung, or moves to another. Points already earned stay where they were earned. */
export async function joinKampung(
  store: Store,
  playerId: string,
  kampung: KampungId
): Promise<Member> {
  await store.hSet(memberKey(playerId), { id: kampung });
  await store.expire(memberKey(playerId), KEEP_SECONDS);
  return loadMember(store, playerId);
}

/** Notes that the player now wears their kampung as flair. */
export async function noteFlair(
  store: Store,
  playerId: string,
  kampung: KampungId
): Promise<Member> {
  await store.hSet(memberKey(playerId), { flair: kampung });
  await store.expire(memberKey(playerId), KEEP_SECONDS);
  return loadMember(store, playerId);
}

/** Adds a scored flight's points to the player's kampung, if they fly for one. */
export async function addPoints(
  store: Store,
  day: number,
  playerId: string,
  points: number
): Promise<KampungId | null> {
  const { kampung } = await loadMember(store, playerId);
  if (!kampung) return null;
  await store.expire(memberKey(playerId), KEEP_SECONDS);
  if (points <= 0) return kampung;
  await store.zIncrBy(dayKey(day), kampung, points);
  await store.expire(dayKey(day), KEEP_SECONDS);
  return kampung;
}

async function scoresOn(store: Store, day: number) {
  const rows = await store.zRange(dayKey(day), 0, -1, { by: 'rank' });
  const points: Partial<Record<KampungId, number>> = {};
  for (const row of rows)
    if (isKampung(row.member)) points[row.member] = row.score;
  return rankKampungs(points);
}

/** Today's kampung points, and who won yesterday. */
export async function kampungBoard(
  store: Store,
  day: number
): Promise<KampungBoard> {
  return {
    today: await scoresOn(store, day),
    yesterday: winnerOf(await scoresOn(store, day - 1)),
  };
}
