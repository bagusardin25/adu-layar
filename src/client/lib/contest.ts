// Today's kite contest as the server sees it: the kites entered, their upvotes on Reddit, and
// the kite Raja Langit flies today.

import { useCallback, useState } from 'react';
import type { ContestView } from '../../shared/contest.ts';

async function read<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}

export function useContest(): {
  view: ContestView | null;
  /** Fetches the contest again: upvotes change while the sheet is closed. */
  load: () => Promise<void>;
  /** Enters the player's saved kite. */
  enter: () => Promise<void>;
} {
  const [view, setView] = useState<ContestView | null>(null);

  const load = useCallback(async () => {
    setView(await read<ContestView>(await fetch('/api/contest')));
  }, []);

  const enter = useCallback(async () => {
    const res = await fetch('/api/contest/enter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    setView(await read<ContestView>(res));
  }, []);

  return { view, load, enter };
}
