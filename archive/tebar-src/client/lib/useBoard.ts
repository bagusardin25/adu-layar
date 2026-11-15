import { useCallback, useEffect, useState } from 'react';
import type { BoardResponse } from '../../shared/api.ts';
import { ApiError, getBoard } from './api.ts';

export type BoardState =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; board: BoardResponse };

/** Loads the post's board once, with a way to try again. */
export function useBoard(): BoardState & { retry: () => void } {
  const [state, setState] = useState<BoardState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    getBoard().then(
      (board) => current && setState({ status: 'ready', board }),
      (error: unknown) =>
        current &&
        setState({
          status: 'failed',
          message:
            error instanceof ApiError
              ? error.message
              : 'The board could not be loaded.',
        })
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
