// The HTTP surface of the game: rounds scored from their taps, coins and the cosmetic shop, the
// player's kite and name, and the routes Reddit calls to keep one post per day.
// Everything that depends on where the server runs is passed in, so the same routes serve
// Reddit (index.ts), the tests and the local preview (vite.local.config.ts).

import { Hono } from 'hono';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import { dayNumber } from '../shared/days.ts';
import { ensureDailyPost } from './core/posts.ts';
import type { Player } from './core/posts.ts';
import { loadProfile, saveProfile } from './core/profiles.ts';
import { buyItem, loadWallet, ownedItems, playRound } from './core/wallet.ts';
import { COIN_ROUNDS } from '../shared/coins.ts';
import { missingItems, parseProfile } from '../shared/kite.ts';
import { replay, validTaps } from '../shared/sim/match.ts';
import { skyForDay } from '../shared/sim/sky.ts';
import type { Store } from './core/store.ts';

export type AppDeps = {
  store: Store;
  now: (req: Request) => number;
  /** The player behind a request, or null when logged out. */
  player: (req: Request) => Promise<Player> | Player;
  /** The day stored on the post the request comes from, if any. */
  postDay: (req: Request) => number | undefined;
  subredditName: (req: Request) => string;
  /** Creates the Reddit post for a day. */
  createPost: (day: number) => Promise<{ id: string }>;
};

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    console.error('Unexpected error', error);
    return c.json({ error: 'Something went wrong on our side.' }, 500);
  });

  const postToday = (req: Request) =>
    ensureDailyPost(deps.store, dayNumber(deps.now(req)), deps.createPost);

  const today = (req: Request) => dayNumber(deps.now(req));

  async function body(req: Request): Promise<Record<string, unknown>> {
    try {
      const data: unknown = await req.json();
      return typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  // ───────────── Rounds, coins and the shop ─────────────

  app.get('/api/wallet', async (c) => {
    const player = await deps.player(c.req.raw);
    if (!player)
      return c.json({
        guest: true,
        coins: 0,
        owned: [],
        streak: 0,
        spoolsLeft: COIN_ROUNDS,
      });
    const wallet = await loadWallet(deps.store, player.id, today(c.req.raw));
    return c.json({ guest: false, ...wallet });
  });

  /** A finished round: the server replays its taps on the day's sky and pays its coins. */
  app.post('/api/round', async (c) => {
    const { day, taps } = await body(c.req.raw);
    const now = today(c.req.raw);
    // A round that began just before midnight (UTC) still counts for the day it began.
    if (typeof day !== 'number' || (day !== now && day !== now - 1))
      return c.json({ error: 'That round is not from today.' }, 400);
    if (!validTaps(taps))
      return c.json({ error: 'That round could not be read.' }, 400);
    const player = await deps.player(c.req.raw);
    if (!player) {
      const match = replay(skyForDay(day), taps);
      return c.json({
        score: match.score,
        cuts: match.cuts,
        reason: match.reason,
        counted: false,
        coins: { lines: [], earned: 0 },
        wallet: null,
      });
    }
    return c.json(await playRound(deps.store, player.id, day, taps));
  });

  app.post('/api/shop/buy', async (c) => {
    const player = await deps.player(c.req.raw);
    if (!player) return c.json({ error: 'Log in to buy things.' }, 401);
    const { item } = await body(c.req.raw);
    const result = await buyItem(deps.store, player.id, today(c.req.raw), item);
    return result.ok
      ? c.json({ wallet: result.wallet })
      : c.json({ error: result.error }, result.status);
  });

  // ───────────── The player's kite and name ─────────────

  app.get('/api/profile', async (c) => {
    const player = await deps.player(c.req.raw);
    return c.json(await loadProfile(deps.store, player));
  });

  app.post('/api/profile', async (c) => {
    const player = await deps.player(c.req.raw);
    if (!player) return c.json({ error: 'Log in to keep your kite.' }, 401);
    const input = parseProfile(await body(c.req.raw));
    if (!input) return c.json({ error: 'That kite is not one we know.' }, 400);
    const missing = missingItems(
      input.design,
      await ownedItems(deps.store, player.id)
    );
    if (missing.length > 0)
      return c.json({ error: 'Buy it in the shop first.', missing }, 403);
    const profile = await saveProfile(deps.store, player.id, input);
    return c.json({ profile, saved: true });
  });

  // ───────────── The daily post ─────────────

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
            ? `Posted today's sky (${result.id}).`
            : "Today's sky is already posted.",
        });
      } catch (error) {
        console.error('Could not post today’s sky', error);
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
      if (!result.id) {
        return c.json<UiResponse>({
          showToast: "Today's sky is being posted. Try again in a moment.",
        });
      }
      const url = `https://reddit.com/r/${deps.subredditName(c.req.raw)}/comments/${result.id}`;
      return c.json<UiResponse>(
        result.created
          ? { navigateTo: url }
          : { showToast: "Today's sky is already posted.", navigateTo: url }
      );
    } catch (error) {
      console.error('Could not post today’s sky', error);
      return c.json<UiResponse>(
        { showToast: 'The post could not be created.' },
        400
      );
    }
  });

  return app;
}
