// The daily post. One per day, however many callers ask at once.

import { kampungOf } from '../../shared/kampung.ts';
import type { KampungId } from '../../shared/kampung.ts';
import type { Store } from './store.ts';

/** A logged-in player, or null for someone browsing logged out. */
export type Player = { id: string; name: string } | null;

/** Thirty days, in seconds: the longest anything about a player is kept. */
export const KEEP_SECONDS = 30 * 24 * 60 * 60;

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

/**
 * The day's post title, as it shows in the feed: the day, Raja Langit to cut down, and the
 * kampung that won yesterday, so the rivalry is visible before anyone opens the post.
 */
export function dailyTitle(
  day: number,
  king: string | null,
  yesterdayWinner: KampungId | null
): string {
  const parts = [
    'Adu Layangan',
    `Day ${day}`,
    `Cut down ${king ?? 'the kampung'}`,
  ];
  if (yesterdayWinner)
    parts.push(`${kampungOf(yesterdayWinner).label} won yesterday`);
  return parts.join(' · ');
}
