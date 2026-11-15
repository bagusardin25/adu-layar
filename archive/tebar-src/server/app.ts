// The HTTP surface of the game: three endpoints for the web view and four that Reddit calls.
// Everything that depends on where the server runs is passed in, so the same routes serve
// Reddit (index.ts), the tests and the local preview (vite.local.config.ts).

import { Hono } from 'hono';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import type { ErrorResponse } from '../shared/api.ts';
import { dayNumber } from '../shared/days.ts';
import {
  ensureDailyPost,
  getBoard,
  getStandings,
  Refused,
  submitRun,
} from './core/game.ts';
import type { Player } from './core/game.ts';
import type { Store } from './core/store.ts';

export type AppDeps = {
  store: Store;
  now: (req: Request) => number;
  /** The player behind a request, or null when logged out. */
  player: (req: Request) => Promise<Player> | Player;
  /** The day stored on the post the request comes from, if any. */
  postDay: (req: Request) => number | undefined;
  subredditName: (req: Request) => string;
  /** Creates the Reddit post for a day's board. */
  createPost: (day: number) => Promise<{ id: string }>;
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const game = (req: Request) => ({ store: deps.store, nowMs: deps.now(req) });

  app.onError((error, c) => {
    if (error instanceof Refused)
      return c.json<ErrorResponse>({ error: error.message }, error.status);
    console.error('Unexpected error', error);
    return c.json<ErrorResponse>(
      { error: 'Something went wrong on our side.' },
      500
    );
  });

  // ── For the web view ──

  app.get('/api/board', async (c) => {
    const req = c.req.raw;
    return c.json(
      await getBoard(game(req), await deps.player(req), deps.postDay(req))
    );
  });

  app.post('/api/run', async (c) => {
    const req = c.req.raw;
    let body: { day?: unknown; line?: unknown };
    try {
      body = await c.req.json();
    } catch {
      throw new Refused(400, 'The run could not be read.');
    }
    return c.json(
      await submitRun(game(req), await deps.player(req), {
        day: body?.day,
        line: body?.line,
      })
    );
  });

  app.get('/api/standings', async (c) => {
    const req = c.req.raw;
    const day = Number(c.req.query('day'));
    return c.json(await getStandings(game(req), await deps.player(req), day));
  });

  // ── Called by Reddit ──

  const postToday = (req: Request) =>
    ensureDailyPost(deps.store, dayNumber(deps.now(req)), deps.createPost);

  app.post('/internal/cron/daily-post', async (c) => {
    const result = await postToday(c.req.raw);
    return c.json({ status: 'ok', created: result.created });
  });

  for (const path of [
    '/internal/triggers/on-app-install',
    '/internal/triggers/on-app-upgrade',
  ]) {
    app.post(path, async (c) => {
      try {
        const result = await postToday(c.req.raw);
        return c.json<TriggerResponse>({
          status: 'success',
          message: result.created
            ? `Posted today's board (${result.id}).`
            : "Today's board is already posted.",
        });
      } catch (error) {
        console.error('Could not post today’s board', error);
        return c.json<TriggerResponse>(
          { status: 'error', message: 'The post could not be created.' },
          400
        );
      }
    });
  }

  app.post('/internal/menu/post-create', async (c) => {
    try {
      const result = await postToday(c.req.raw);
      if (!result.id)
        return c.json<UiResponse>({
          showToast: "Today's board is being posted. Try again in a moment.",
        });
      const url = `https://reddit.com/r/${deps.subredditName(c.req.raw)}/comments/${result.id}`;
      return c.json<UiResponse>(
        result.created
          ? { navigateTo: url }
          : { showToast: "Today's board is already posted.", navigateTo: url }
      );
    } catch (error) {
      console.error('Could not post today’s board', error);
      return c.json<UiResponse>(
        { showToast: 'The post could not be created.' },
        400
      );
    }
  });

  return app;
}
