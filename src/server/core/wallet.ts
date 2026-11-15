// A player's coins and the things they have bought, and the rounds that earn the coins.
//
// Rounds are scored here, by replaying the player's taps on the day's sky, so neither the score
// nor the coins can be made up by the client. Everything about a player is kept 30 days after
// it last changed.

import { COIN_ROUNDS, COINS, coinsFor, total } from '../../shared/coins.ts';
import type { CoinLine } from '../../shared/coins.ts';
import { itemOf } from '../../shared/kite.ts';
import type { ItemId } from '../../shared/kite.ts';
import { replay } from '../../shared/sim/match.ts';
import type { Taps } from '../../shared/sim/match.ts';
import { skyForDay } from '../../shared/sim/sky.ts';
import type { EndReason } from '../../shared/sim/types.ts';
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
};

/**
 * Scores a round from its taps and pays its coins. Only the first COIN_ROUNDS rounds of a day
 * pay; the first of them also pays the daily bonus and keeps the streak going.
 */
export async function playRound(
  store: Store,
  playerId: string,
  day: number,
  taps: Taps
): Promise<RoundResult> {
  const match = replay(skyForDay(day), taps);
  await loadWallet(store, playerId, day);

  const flown = await store.hIncrBy(spoolsKey(day), playerId, 1);
  await store.expire(spoolsKey(day), KEEP_SECONDS);
  const counted = flown <= COIN_ROUNDS;
  let lines: CoinLine[] = [];

  if (counted) {
    const first = flown === 1;
    let streak = 0;
    if (first) {
      const fields = await store.hGetAll(walletKey(playerId));
      const lastDay = Number(fields.lastDay) || 0;
      const before = Number(fields.streak) || 0;
      streak = lastDay === day ? before : lastDay === day - 1 ? before + 1 : 1;
      await store.hSet(walletKey(playerId), {
        lastDay: String(day),
        streak: String(streak),
      });
    }
    lines = coinsFor(match, { firstOfDay: first, streak });
    const earned = total(lines);
    if (earned > 0) await store.hIncrBy(walletKey(playerId), 'coins', earned);
    const best = await store.zScore(boardKey(day), playerId);
    if (best === undefined || match.score > best)
      await store.zAdd(boardKey(day), { member: playerId, score: match.score });
    await store.expire(boardKey(day), KEEP_SECONDS);
    await keep(store, playerId);
  }

  return {
    score: match.score,
    cuts: match.cuts,
    reason: match.reason,
    counted,
    coins: { lines, earned: total(lines) },
    wallet: await loadWallet(store, playerId, day),
  };
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
