// Who flies today besides the kampung's pilots.
//
// The set is fixed for the whole day: yesterday's best flights, filled out with the seeded
// kampung flyers when yesterday was quiet. It does not change as people play today, so a
// round replayed later still meets the same kites. Today's best flights become tomorrow's.

import { place } from '../../shared/sim/ghost.ts';
import { seedGhosts } from '../../shared/sim/seeds.ts';
import { skyForDay } from '../../shared/sim/sky.ts';
import type { GhostSpec, Sky } from '../../shared/sim/types.ts';
import { chosenKite } from './contest.ts';
import { KEEP_SECONDS } from './posts.ts';
import type { Store } from './store.ts';

/** Same key the wallet uses for the day's best scores. */
const boardKey = (day: number) => `board:${day}`;
const recKey = (day: number, id: string) => `rec:${day}:${id}`;
const nameKey = (id: string) => `name:${id}`;

/** Roofs for the king, then the other recordings. The player stands at 180. */
const ANCHORS = [242, 64, 306];

export type StoredFlight = {
  id: string;
  name: string;
  score: number;
  colors: [string, string];
  track: string;
};

export type King = { name: string; score: number; seed: boolean };

export type Fight = {
  sky: Sky;
  king: King | null;
  /** Players who have a scored flight today. */
  fliers: number;
};

function parseFlight(raw: string | undefined): StoredFlight | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const row = data as Partial<StoredFlight>;
    if (
      typeof row.id !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.score !== 'number' ||
      typeof row.track !== 'string' ||
      !Array.isArray(row.colors) ||
      row.colors.length !== 2
    )
      return null;
    return {
      id: row.id,
      name: row.name,
      score: row.score,
      colors: [String(row.colors[0]), String(row.colors[1])],
      track: row.track,
    };
  } catch {
    return null;
  }
}

/** Keeps a counted flight so it can be flown against tomorrow. */
export async function saveFlight(
  store: Store,
  day: number,
  flight: StoredFlight
): Promise<void> {
  await store.set(recKey(day, flight.id), JSON.stringify(flight));
  await store.expire(recKey(day, flight.id), KEEP_SECONDS);
  await store.set(nameKey(flight.id), flight.name);
  await store.expire(nameKey(flight.id), KEEP_SECONDS);
}

export async function loadName(store: Store, id: string): Promise<string> {
  return (await store.get(nameKey(id))) || 'Flyer';
}

/**
 * Today's sky for every player: the day's wind and pilots, plus Raja Langit and up to two
 * recorded flights. Recordings come from yesterday, so the sky stays the same all day.
 */
export async function skyForFight(store: Store, day: number): Promise<Fight> {
  const yesterday = await store.zRange(boardKey(day - 1), 0, 7, {
    by: 'rank',
    reverse: true,
  });
  const flown: StoredFlight[] = [];
  for (const row of yesterday) {
    const flight = parseFlight(await store.get(recKey(day - 1, row.member)));
    if (flight) flown.push(flight);
  }

  const seeds = seedGhosts();
  const ghosts: GhostSpec[] = [];
  const kingFlight = flown[0];
  if (kingFlight) {
    ghosts.push(place(kingFlight, ANCHORS[0], 'king'));
  } else {
    const seedKing = seeds.find((s) => s.kind === 'king') ?? seeds[0];
    ghosts.push(seedKing);
  }
  for (const flight of flown.slice(1, 3)) {
    const anchor = ANCHORS[ghosts.length] ?? ANCHORS[ANCHORS.length - 1];
    ghosts.push(place(flight, anchor, 'ghost'));
  }
  for (const seed of seeds) {
    if (ghosts.length >= 3) break;
    if (seed.kind === 'king') continue;
    if (ghosts.some((g) => Math.abs(g.anchorX - seed.anchorX) < 24)) continue;
    ghosts.push(seed);
  }

  // Raja Langit flies the kite the kampung chose yesterday, once that contest is settled.
  const chosen = await chosenKite(store, day - 1);
  const kingAt = ghosts.findIndex((g) => g.kind === 'king');
  if (chosen && kingAt >= 0) ghosts[kingAt] = { ...ghosts[kingAt], chosen };

  const king = ghosts.find((g) => g.kind === 'king') ?? null;
  return {
    sky: { ...skyForDay(day), ghosts },
    king: king
      ? { name: king.name, score: king.score, seed: !kingFlight }
      : null,
    fliers: await store.zCard(boardKey(day)),
  };
}

export type Standing = {
  rank: number;
  id: string;
  name: string;
  score: number;
};

/** The top of today's board. Rank 1 is the best score. */
export async function standingsFor(
  store: Store,
  day: number,
  limit = 5
): Promise<Standing[]> {
  const rows = await store.zRange(boardKey(day), 0, limit - 1, {
    by: 'rank',
    reverse: true,
  });
  const out: Standing[] = [];
  for (let i = 0; i < rows.length; i++) {
    out.push({
      rank: i + 1,
      id: rows[i].member,
      name: await loadName(store, rows[i].member),
      score: rows[i].score,
    });
  }
  return out;
}

/** 1-based rank on today's board, or null when the player has no scored flight. */
export async function rankOf(
  store: Store,
  day: number,
  playerId: string
): Promise<number | null> {
  const rows = await store.zRange(boardKey(day), 0, 99, {
    by: 'rank',
    reverse: true,
  });
  const index = rows.findIndex((row) => row.member === playerId);
  return index < 0 ? null : index + 1;
}
