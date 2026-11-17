// The player's coins and what they own, as the server keeps them. The client never decides an
// amount: it sends a finished round's taps, and the server replays the round and pays.

import { useCallback, useEffect, useState } from 'react';
import type { CoinLine } from '../../shared/coins.ts';
import type { KampungBoard, KampungId } from '../../shared/kampung.ts';
import type { Taps } from '../../shared/sim/match.ts';

export type WalletView = {
  /** Logged out: no coins, nothing to buy with. */
  guest: boolean;
  coins: number;
  owned: string[];
  streak: number;
  /** Rounds left today that earn coins. */
  spoolsLeft: number;
};

export type Standing = { rank: number; name: string; score: number };

/** What the server said about a finished round. */
export type RoundAnswer = {
  score: number;
  counted: boolean;
  coins: { lines: CoinLine[]; earned: number };
  wallet: WalletView | null;
  best: number;
  rank: number | null;
  streak: number;
  kingCut: boolean;
  names: string[];
  standings: Standing[];
  /** The kampung this round's points went to, if it was scored and the player has one. */
  kampung: KampungId | null;
  kampungs: KampungBoard;
};

/** The score card, and whether it is (or can be) posted as the player's comment. */
export type ShareAnswer = {
  text: string;
  /** This flight's card is in the comments. */
  posted: boolean;
  /** False outside a Reddit post, where there is nowhere to post it. */
  canPost: boolean;
  /** The Reddit username the comment is posted under. */
  as: string;
  error?: string;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}

export function useWallet(): {
  wallet: WalletView | null;
  buy: (item: string) => Promise<string | null>;
  submitRound: (day: number, taps: Taps) => Promise<RoundAnswer>;
  share: (confirm: boolean) => Promise<ShareAnswer>;
} {
  const [wallet, setWallet] = useState<WalletView | null>(null);

  useEffect(() => {
    let current = true;
    fetch('/api/wallet')
      .then((res) => (res.ok ? (res.json() as Promise<WalletView>) : null))
      .then((w) => {
        if (current && w) setWallet(w);
      })
      .catch(() => {
        // Offline: the coins show once the server answers again.
      });
    return () => {
      current = false;
    };
  }, []);

  /** Buys an item. Resolves to null when bought, or to the reason it was not. */
  const buy = useCallback(async (item: string): Promise<string | null> => {
    try {
      const answer = await post<{ wallet: WalletView }>('/api/shop/buy', {
        item,
      });
      setWallet({ ...answer.wallet, guest: false });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not buy that.';
    }
  }, []);

  const submitRound = useCallback(
    async (day: number, taps: Taps): Promise<RoundAnswer> => {
      const answer = await post<RoundAnswer>('/api/round', { day, taps });
      if (answer.wallet) setWallet({ ...answer.wallet, guest: false });
      return answer;
    },
    []
  );

  const share = useCallback(async (confirm: boolean): Promise<ShareAnswer> => {
    return post<ShareAnswer>('/api/share', { confirm });
  }, []);

  return { wallet, buy, submitRound, share };
}
