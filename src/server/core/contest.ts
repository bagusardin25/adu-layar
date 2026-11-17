// The kite contest's storage: each day's entries, a short-lived copy of their upvotes, and the
// winner, which is settled once after the day is over and then never changes.
//
// Entries name a player, so like everything about a player they are kept 30 days at most. An
// entry whose comment was deleted or removed on Reddit is dropped the next time it is read.

import { byVotes } from '../../shared/contest.ts';
import type { ChosenKite } from '../../shared/contest.ts';
import { parseDesign } from '../../shared/kite.ts';
import type { KiteDesign } from '../../shared/kite.ts';
import { KEEP_SECONDS } from './posts.ts';
import type { Store } from './store.ts';

const entriesKey = (day: number) => `contest:${day}`;
const threadKey = (day: number) => `contest-thread:${day}`;
const votesKey = (day: number) => `contest-votes:${day}`;
const chosenKey = (day: number) => `contest-chosen:${day}`;

/** How long a read of the upvotes is reused before Reddit is asked again. */
export const VOTES_FRESH_MS = 60_000;
/** Marks a player's entry while its comment is being posted. */
const PENDING = 'pending';
/** Marks a finished day that had no kites. */
const NONE = 'none';

export type StoredEntry = {
  userId: string;
  by: string;
  design: KiteDesign;
  commentId: string;
  /** The post the comment is in, for a link to it. */
  postId: string;
  /** When the kite was entered, for breaking ties. */
  at: number;
};

/**
 * Each comment's score on Reddit. `null` means the comment is gone (deleted or removed);
 * a missing id means Reddit could not be asked just now.
 */
export type Scores = (
  commentIds: string[]
) => Promise<Record<string, number | null>>;

function parseEntry(userId: string, raw: string): StoredEntry | null {
  if (raw === PENDING) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredEntry>;
    const design = parseDesign(data.design);
    if (
      !design ||
      typeof data.by !== 'string' ||
      typeof data.commentId !== 'string' ||
      typeof data.postId !== 'string' ||
      typeof data.at !== 'number'
    )
      return null;
    return {
      userId,
      by: data.by,
      design,
      commentId: data.commentId,
      postId: data.postId,
      at: data.at,
    };
  } catch {
    return null;
  }
}

export async function loadEntries(
  store: Store,
  day: number
): Promise<StoredEntry[]> {
  const all = await store.hGetAll(entriesKey(day));
  const out: StoredEntry[] = [];
  for (const [userId, raw] of Object.entries(all)) {
    const entry = parseEntry(userId, raw);
    if (entry) out.push(entry);
  }
  return out;
}

/** Whether the player has a kite in the day's contest, or one on its way. */
export async function hasEntered(
  store: Store,
  day: number,
  userId: string
): Promise<boolean> {
  return (await store.hGet(entriesKey(day), userId)) !== undefined;
}

/** Holds the player's place while their comment is posted. False if they already have one. */
export async function claimEntry(
  store: Store,
  day: number,
  userId: string
): Promise<boolean> {
  const claimed = await store.hSetNX(entriesKey(day), userId, PENDING);
  await store.expire(entriesKey(day), KEEP_SECONDS);
  return claimed === 1;
}

export async function saveEntry(
  store: Store,
  day: number,
  entry: StoredEntry
): Promise<void> {
  const { userId, ...rest } = entry;
  await store.hSet(entriesKey(day), { [userId]: JSON.stringify(rest) });
  await store.expire(entriesKey(day), KEEP_SECONDS);
}

export async function dropEntry(
  store: Store,
  day: number,
  userId: string
): Promise<void> {
  await store.hDel(entriesKey(day), [userId]);
}

/** The app's comment that entries reply to, once it exists. */
export async function contestThread(
  store: Store,
  day: number
): Promise<string | undefined> {
  return store.get(threadKey(day));
}

export async function setContestThread(
  store: Store,
  day: number,
  commentId: string
): Promise<void> {
  await store.set(threadKey(day), commentId);
  await store.expire(threadKey(day), KEEP_SECONDS);
}

/**
 * The day's entries with their upvotes, most first. Entries whose comment is gone are dropped
 * from storage. Upvotes are read from Reddit at most once a minute; without `scores` (tests of
 * other things, or before anyone has voted) every kite counts as 0.
 */
export async function rankedEntries(
  store: Store,
  day: number,
  now: number,
  scores: Scores | undefined
): Promise<(StoredEntry & { votes: number })[]> {
  const entries = await loadEntries(store, day);
  let votes: Record<string, number | null> = {};
  const cached = await store.get(votesKey(day));
  let readAt = -Infinity;
  if (cached) {
    try {
      const data = JSON.parse(cached) as {
        at: number;
        votes: Record<string, number | null>;
      };
      votes = data.votes;
      readAt = data.at;
    } catch {
      votes = {};
    }
  }
  const fresh = now - readAt < VOTES_FRESH_MS;
  const ids = entries.map((e) => e.commentId);
  // A full read once a minute; in between, only kites entered since the last read are asked
  // about. A kite Reddit cannot tell us about counts 0 until the next full read, so it is not
  // asked about again on every view.
  const ask = fresh ? ids.filter((id) => !(id in votes)) : ids;
  if (scores && ask.length > 0) {
    const read = await scores(ask);
    votes = { ...votes };
    for (const id of ask) votes[id] = id in read ? read[id] : (votes[id] ?? 0);
    await store.set(
      votesKey(day),
      JSON.stringify({ at: fresh ? readAt : now, votes })
    );
    await store.expire(votesKey(day), KEEP_SECONDS);
  }
  const kept: (StoredEntry & { votes: number })[] = [];
  for (const entry of entries) {
    const v = votes[entry.commentId];
    if (v === null) {
      await dropEntry(store, day, entry.userId);
      continue;
    }
    kept.push({ ...entry, votes: v ?? 0 });
  }
  return byVotes(kept);
}

/** The kite chosen in a finished day's contest, if it has been settled and had any kites. */
export async function chosenKite(
  store: Store,
  day: number
): Promise<ChosenKite | null> {
  const raw = await store.hGet(chosenKey(day), 'kite');
  if (!raw || raw === NONE) return null;
  try {
    const data = JSON.parse(raw) as Partial<ChosenKite>;
    const design = parseDesign(data.design);
    return design && typeof data.by === 'string'
      ? { design, by: data.by, votes: Number(data.votes) || 0 }
      : null;
  } catch {
    return null;
  }
}

/**
 * Settles a finished day's contest: the kite with the most upvotes, read fresh from Reddit.
 * Settled once; later calls return the same kite. If Reddit cannot say how one of the kites
 * stands, nothing is settled yet, so a kite is never chosen on a partial count.
 */
export async function settleContest(
  store: Store,
  day: number,
  scores: Scores | undefined
): Promise<ChosenKite | null> {
  const settled = await store.hGet(chosenKey(day), 'kite');
  if (settled !== undefined) return chosenKite(store, day);

  const entries = await loadEntries(store, day);
  let ranked: (StoredEntry & { votes: number })[] = [];
  if (entries.length > 0) {
    const read = scores
      ? await scores(entries.map((e) => e.commentId))
      : Object.fromEntries(entries.map((e) => [e.commentId, 0]));
    if (entries.some((e) => !(e.commentId in read))) return null;
    for (const entry of entries) {
      const v = read[entry.commentId];
      if (v === null || v === undefined)
        await dropEntry(store, day, entry.userId);
      else ranked.push({ ...entry, votes: v });
    }
    ranked = byVotes(ranked);
  }
  const top = ranked[0];
  const value = top
    ? JSON.stringify({ design: top.design, by: top.by, votes: top.votes })
    : NONE;
  await store.hSetNX(chosenKey(day), 'kite', value);
  await store.expire(chosenKey(day), KEEP_SECONDS);
  return chosenKite(store, day);
}
