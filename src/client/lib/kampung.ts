// The kampung the player flies for and the day's kampung points, as the server keeps them.

import { useCallback, useEffect, useState } from 'react';
import type { KampungBoard, KampungId } from '../../shared/kampung.ts';
import { rankKampungs } from '../../shared/kampung.ts';

export type KampungView = {
  guest: boolean;
  kampung: KampungId | null;
  flair: KampungId | null;
  /** False outside Reddit, where no flair can be set. */
  canFlair: boolean;
  board: KampungBoard;
};

const EMPTY: KampungView = {
  guest: true,
  kampung: null,
  flair: null,
  canFlair: false,
  board: { today: rankKampungs({}), yesterday: null },
};

async function post(path: string, body: unknown): Promise<KampungView> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as KampungView & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}

export function useKampung(): {
  view: KampungView;
  /** False until the server has answered once. */
  loaded: boolean;
  join: (kampung: KampungId) => Promise<void>;
  wearFlair: () => Promise<void>;
  /** The board as a finished round reported it. */
  setBoard: (board: KampungBoard) => void;
} {
  const [view, setView] = useState<KampungView>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let current = true;
    fetch('/api/kampung')
      .then((res) => (res.ok ? (res.json() as Promise<KampungView>) : null))
      .then((v) => {
        if (current && v) {
          setView(v);
          setLoaded(true);
        }
      })
      .catch(() => {
        // Offline: the kampungs show once the server answers again.
      });
    return () => {
      current = false;
    };
  }, []);

  const join = useCallback(async (kampung: KampungId) => {
    setView(await post('/api/kampung', { kampung }));
  }, []);

  const wearFlair = useCallback(async () => {
    setView(await post('/api/kampung/flair', {}));
  }, []);

  const setBoard = useCallback(
    (board: KampungBoard) => setView((v) => ({ ...v, board })),
    []
  );

  return { view, loaded, join, wearFlair, setBoard };
}
