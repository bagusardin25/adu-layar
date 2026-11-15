// The web view's three questions to the server. Types come from the shared contract.

import type {
  BoardResponse,
  ErrorResponse,
  RunResponse,
  StandingsResponse,
} from '../../shared/api.ts';

/** A request that did not succeed. `message` is fit to show to the player. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError('No connection. Check your network and try again.');
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('The server sent something unreadable. Try again.');
  }
  if (!res.ok) {
    const message = (body as Partial<ErrorResponse> | null)?.error;
    throw new ApiError(
      typeof message === 'string' ? message : 'Something went wrong. Try again.'
    );
  }
  return body as T;
}

export const getBoard = (): Promise<BoardResponse> => request('/api/board');

export const sendRun = (day: number, line: number[]): Promise<RunResponse> =>
  request('/api/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ day, line }),
  });

export const getStandings = (day: number): Promise<StandingsResponse> =>
  request(`/api/standings?day=${day}`);
