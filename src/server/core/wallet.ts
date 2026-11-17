// A player's coins and the things they have bought, and the rounds that earn the coins.
//
// Rounds are scored here, by replaying the player's taps on the day's sky, so neither the score
// nor the coins can be made up by the client. Everything about a player is kept 30 days after
// it last changed.

import { COIN_ROUNDS, COINS, coinsFor, total } from '../../shared/coins.ts';
import type { CoinLine } from '../../shared/coins.ts';
import { colourHex, itemOf } from '../../shared/kite.ts';
import type { ItemId } from '../../shared/kite.ts';
import { isKampung } from '../../shared/kampung.ts';
import type { KampungBoard, KampungId } from '../../shared/kampung.ts';
import type { Card } from '../../shared/card.ts';
import { playTaps } from '../../shared/sim/match.ts';
import type { Taps } from '../../shared/sim/match.ts';
import { pack } from '../../shared/sim/ghost.ts';
import { PLAYER_ID } from '../../shared/sim/types.ts';
import type { EndReason, Match } from '../../shared/sim/types.ts';
import { saveFlight, skyForFight, standingsFor, rankOf } from './fight.ts';
import type { Standing } from './fight.ts';
import { addPoints, kampungBoard } from './kampung.ts';
import { loadProfile } from './profiles.ts';
import { KEEP_SECONDS } from './posts.ts';
import type { Store } from './store.ts';

const walletKey = (id: string) => `wallet:${id}`;
const ownedKey = (id: string) => `owned:${id}`;
/** How many rounds each player has flown on a day. */
const spoolsKey = (day: number) => `spools:${day}`;
/** Each player's best counted score on a day; the day's standings will read from it. */
const boardKey = (day: number) => `board:${day}`;

export type Wallet = {
  coins: number;
  owned: ItemId[];
  streak: number;
  /** Rounds left today that earn coins. */
  spoolsLeft: number;
};

async function keep(store: Store, playerId: string): Promise<void> {
  await store.expire(walletKey(playerId), KEEP_SECONDS);
  await store.expire(ownedKey(playerId), KEEP_SECONDS);
}

/** A player's wallet. The first time a player is seen, it is opened with the starter coins. */
export async function loadWallet(
  store: Store,
  playerId: string,
  day: number
): Promise<Wallet> {
  const opened = await store.hSetNX(
    walletKey(playerId),
    'coins',
    String(COINS.starter)
  );
  if (opened) await keep(store, playerId);
  const [fields, owned, flown] = await Promise.all([
    store.hGetAll(walletKey(playerId)),
    store.hGetAll(ownedKey(playerId)),
    store.hGet(spoolsKey(day), playerId),
  ]);
  return {
    coins: Number(fields.coins) || 0,
    owned: Object.keys(owned).filter((id): id is ItemId => !!itemOf(id)),
    streak: Number(fields.streak) || 0,
    spoolsLeft: Math.max(0, COIN_ROUNDS - (Number(flown) || 0)),
  };
}

export type RoundResult = {
  score: number;
  cuts: number;
  reason: EndReason | null;
  /** Whether this round earned coins and counts for the day's best. */
  counted: boolean;
  coins: { lines: CoinLine[]; earned: number };
  wallet: Wallet;
  /** This player's best counted score today, after the round. */
  best: number;
  rank: number | null;
  streak: number;
  kingCut: boolean;
  /** Names of the kites this round cut, as they appear in the sky. */
  names: string[];
  standings: Standing[];
  /** The kampung this round's points went to; null when it was not scored or has none. */
  kampung: KampungId | null;
  /** The day's kampung points, after this round. */
  kampungs: KampungBoard;
};

const lastKey = (id: string) => `last:${id}`;
/**
 * Marks the last flight's card as posted to the comments, so it is posted once. Each new flight
 * clears it, since that flight has a card of its own.
 */
export const sharedKey = (id: string) => `shared:${id}`;

/** Kites the player cut in this round, and whether one of them was Raja Langit. */
export function playerCuts(match: Match): {
  names: string[];
  kingCut: boolean;
} {
  const names: string[] = [];
  let kingCut = false;
  for (const event of match.events) {
    if (event.type !== 'cut' || event.by !== PLAYER_ID) continue;
    const kite = match.kites[event.victim];
    if (!kite) continue;
    names.push(kite.name);
    if (kite.kind === 'king') kingCut = true;
  }
  return { names, kingCut };
}

/**
 * Scores a round from its taps and pays its coins. Only the first COIN_ROUNDS rounds of a day
 * pay; the first of them also pays the daily bonus and keeps the streak going.
 */
export async function playRound(
  store: Store,
  playerId: string,
  playerName: string,
  day: number,
  taps: Taps
): Promise<RoundResult> {
  const fight = await skyForFight(store, day);
  const { match, samples } = playTaps(fight.sky, taps);
  await loadWallet(store, playerId, day);

  const flown = await store.hIncrBy(spoolsKey(day), playerId, 1);
  await store.expire(spoolsKey(day), KEEP_SECONDS);
  const counted = flown <= COIN_ROUNDS;
  let lines: CoinLine[] = [];
  let streak: number;
  let kampung: KampungId | null = null;

  if (counted) {
    const first = flown === 1;
    if (first) {
      const fields = await store.hGetAll(walletKey(playerId));
      const lastDay = Number(fields.lastDay) || 0;
      const before = Number(fields.streak) || 0;
      streak = lastDay === day ? before : lastDay === day - 1 ? before + 1 : 1;
      await store.hSet(walletKey(playerId), {
        lastDay: String(day),
        streak: String(streak),
      });
    } else {
      const fields = await store.hGetAll(walletKey(playerId));
      streak = Number(fields.streak) || 0;
    }
    lines = coinsFor(match, { firstOfDay: first, streak });
    const earned = total(lines);
    if (earned > 0) await store.hIncrBy(walletKey(playerId), 'coins', earned);
    const previous = await store.zScore(boardKey(day), playerId);
    if (previous === undefined || match.score > previous) {
      await store.zAdd(boardKey(day), { member: playerId, score: match.score });
      const { profile } = await loadProfile(store, {
        id: playerId,
        name: playerName,
      });
      await saveFlight(store, day, {
        id: playerId,
        name: playerName,
        score: match.score,
        colors: [
          colourHex(profile.design.main),
          colourHex(profile.design.trim),
        ],
        track: pack(samples),
      });
    }
    await store.expire(boardKey(day), KEEP_SECONDS);
    await keep(store, playerId);
    // Every scored flight counts for the kampung, not only the day's best.
    kampung = await addPoints(store, day, playerId, match.score);
  } else {
    const fields = await store.hGetAll(walletKey(playerId));
    streak = Number(fields.streak) || 0;
  }

  const cut = playerCuts(match);
  const best = (await store.zScore(boardKey(day), playerId)) ?? 0;
  const rank = await rankOf(store, day, playerId);
  const standings = await standingsFor(store, day);
  const result: RoundResult = {
    score: match.score,
    cuts: match.cuts,
    reason: match.reason,
    counted,
    coins: { lines, earned: total(lines) },
    wallet: await loadWallet(store, playerId, day),
    best,
    rank,
    streak,
    kingCut: cut.kingCut,
    names: cut.names,
    standings,
    kampung,
    kampungs: await kampungBoard(store, day),
  };
  await store.set(
    lastKey(playerId),
    JSON.stringify({
      day,
      score: result.score,
      reason: result.reason,
      kingCut: result.kingCut,
      rank: result.rank,
      streak: result.streak,
      names: result.names,
      counted: result.counted,
      kampung: result.kampung,
    })
  );
  await store.expire(lastKey(playerId), KEEP_SECONDS);
  await store.del(sharedKey(playerId));
  return result;
}

/** The last round this player finished, if it is still kept. */
export async function lastFlight(
  store: Store,
  playerId: string
): Promise<Card | null> {
  const raw = await store.get(lastKey(playerId));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as {
      day?: unknown;
      score?: unknown;
      reason?: unknown;
      kingCut?: unknown;
      rank?: unknown;
      streak?: unknown;
      names?: unknown;
      counted?: unknown;
      kampung?: unknown;
    };
    if (typeof data.day !== 'number' || typeof data.score !== 'number')
      return null;
    return {
      day: data.day,
      score: data.score,
      reason: typeof data.reason === 'string' ? data.reason : null,
      kingCut: data.kingCut === true,
      rank: typeof data.rank === 'number' ? data.rank : null,
      streak: typeof data.streak === 'number' ? data.streak : 0,
      names: Array.isArray(data.names)
        ? data.names.filter((n): n is string => typeof n === 'string')
        : [],
      counted: data.counted === true,
      kampung: isKampung(data.kampung) ? data.kampung : null,
    };
  } catch {
    return null;
  }
}

export type BuyResult =
  | { ok: true; wallet: Wallet }
  | { ok: false; error: string; status: 400 | 404 };

/** Buys an item with coins. Buying something already owned costs nothing. */
export async function buyItem(
  store: Store,
  playerId: string,
  day: number,
  itemId: unknown
): Promise<BuyResult> {
  const item = itemOf(itemId);
  if (!item) return { ok: false, error: 'There is no such item.', status: 404 };
  const before = await loadWallet(store, playerId, day);
  if (before.owned.includes(item.id)) return { ok: true, wallet: before };

  // Take the coins first, and give them back if that went below zero: two buys at once can
  // never spend the same coins twice.
  const left = await store.hIncrBy(walletKey(playerId), 'coins', -item.price);
  if (left < 0) {
    await store.hIncrBy(walletKey(playerId), 'coins', item.price);
    return { ok: false, error: 'Not enough coins yet.', status: 400 };
  }
  await store.hSet(ownedKey(playerId), { [item.id]: String(day) });
  await keep(store, playerId);
  return { ok: true, wallet: await loadWallet(store, playerId, day) };
}

/** The items a player owns, for checking a kite they want to save. */
export async function ownedItems(
  store: Store,
  playerId: string
): Promise<string[]> {
  return Object.keys(await store.hGetAll(ownedKey(playerId)));
}
