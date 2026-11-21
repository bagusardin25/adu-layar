// The HTTP surface of the game: rounds scored from their taps, coins and the cosmetic shop, the
// player's kite and name, and the routes Reddit calls to keep one post per day.
// Everything that depends on where the server runs is passed in, so the same routes serve
// Reddit (index.ts), the tests and the local preview (vite.local.config.ts).

import { Hono } from 'hono';
import type { TriggerResponse, UiResponse } from '@devvit/web/shared';
import { flightCard } from '../shared/card.ts';
import { dayNumber } from '../shared/days.ts';
import {
  ensureDailyPost,
  KEEP_SECONDS,
  postIdFor,
  postLink,
} from './core/posts.ts';
import type { Player } from './core/posts.ts';
import { loadProfile, saveProfile } from './core/profiles.ts';
import {
  joinKampung,
  kampungBoard,
  loadMember,
  noteFlair,
} from './core/kampung.ts';
import { isKampung, kampungOf } from '../shared/kampung.ts';
import { entryText } from '../shared/contest.ts';
import type { ContestView } from '../shared/contest.ts';
import {
  claimEntry,
  contestThread,
  dropEntry,
  hasEntered,
  rankedEntries,
  saveEntry,
  setContestThread,
  settleContest,
} from './core/contest.ts';
import type { Scores } from './core/contest.ts';
import { skyForFight, standingsFor } from './core/fight.ts';
import {
  buyItem,
  lastFlight,
  loadWallet,
  ownedItems,
  playerCuts,
  playRound,
  sharedKey,
} from './core/wallet.ts';
import { COIN_ROUNDS } from '../shared/coins.ts';
import { missingItems, parseProfile } from '../shared/kite.ts';
import { playTaps, validTaps } from '../shared/sim/match.ts';
import type { Store } from './core/store.ts';
import { mountTelemetry } from './telemetry.ts';

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
  /** The Reddit post this request is playing inside, when there is one. */
  postId?: (req: Request) => string | undefined;
  /**
   * Posts a comment as the app or as the player. Absent in tests and the local preview:
   * sharing then returns the text without posting it.
   */
  comment?: (args: {
    id: string;
    text: string;
    as: 'APP' | 'USER';
    sticky?: boolean;
  }) => Promise<{ id: string }>;
  /**
   * Sets a player's user flair in the subreddit. Absent in tests and the local preview, where
   * the game offers no flair.
   */
  setFlair?: (args: {
    username: string;
    text: string;
    backgroundColor: string;
  }) => Promise<void>;
  /** Upvotes on comments, for the kite contest. Absent in tests of other things. */
  commentScores?: Scores;
};

/** A link to a comment on Reddit, where it can be read and upvoted. */
const permalink = (subreddit: string, postId: string, commentId: string) =>
  `https://www.reddit.com/r/${subreddit}/comments/${postId.replace(/^t3_/, '')}/comment/${commentId.replace(/^t1_/, '')}/`;

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  mountTelemetry(app);

  app.onError((error, c) => {
    console.error('Unexpected error', error);
    return c.json({ error: 'Something went wrong on our side.' }, 500);
  });

  /** Settles yesterday's kite contest, so the new day's Raja Langit flies the winning kite. */
  const settleYesterday = (req: Request) =>
    settleContest(deps.store, dayNumber(deps.now(req)) - 1, deps.commentScores);

  const postToday = async (req: Request) => {
    await settleYesterday(req);
    return ensureDailyPost(
      deps.store,
      dayNumber(deps.now(req)),
      deps.createPost
    );
  };

  const today = (req: Request) => dayNumber(deps.now(req));

  /**
   * The post a day's comments belong in: that day's own post, whichever post the player has
   * open. Today's is made now if the scheduler has not made it yet; null while it is on its way.
   */
  const postFor = async (req: Request, day: number): Promise<string | null> => {
    const stored = await postIdFor(deps.store, day);
    if (stored) return stored;
    return day === today(req) ? (await postToday(req)).id : null;
  };

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

  app.get('/api/fight', async (c) => {
    const day = today(c.req.raw);
    await settleYesterday(c.req.raw);
    const fight = await skyForFight(deps.store, day);
    // Opened in an older day's post: point the player to today's.
    const viewing = deps.postDay(c.req.raw) ?? null;
    const todaysId =
      viewing !== null && viewing < day
        ? await postIdFor(deps.store, day)
        : null;
    return c.json({
      day,
      ...fight,
      kampungs: await kampungBoard(deps.store, day),
      viewing,
      todayPost: todaysId
        ? postLink(deps.subredditName(c.req.raw), todaysId)
        : null,
    });
  });

  app.get('/api/board', async (c) => {
    const day = today(c.req.raw);
    return c.json({
      day,
      standings: await standingsFor(deps.store, day, 8),
    });
  });

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
      const fight = await skyForFight(deps.store, day);
      const { match } = playTaps(fight.sky, taps);
      const cut = playerCuts(match);
      return c.json({
        score: match.score,
        cuts: match.cuts,
        reason: match.reason,
        counted: false,
        coins: { lines: [], earned: 0 },
        wallet: null,
        best: 0,
        rank: null,
        streak: 0,
        kingCut: cut.kingCut,
        names: cut.names,
        standings: await standingsFor(deps.store, day),
        kampung: null,
        kampungs: await kampungBoard(deps.store, day),
      });
    }
    return c.json(
      await playRound(deps.store, player.id, player.name, day, taps)
    );
  });

  /**
   * The score card for the comments. `confirm` posts it, as the player, under the day's
   * thread. Without it, the route only returns the text so the player can read it first,
   * along with the name it would be posted under (`as`) and whether it can be posted here.
   * A flight's card is posted once: a second confirm answers `posted` and posts nothing.
   */
  app.post('/api/share', async (c) => {
    const player = await deps.player(c.req.raw);
    if (!player) return c.json({ error: 'Log in to post your flight.' }, 401);
    const last = await lastFlight(deps.store, player.id);
    if (!last) return c.json({ error: 'Fly a round first.' }, 400);
    const text = flightCard(last);
    const as = player.name;
    const comment = deps.comment;
    // Outside Reddit (the local preview, tests) there is nowhere to post.
    if (!comment) return c.json({ text, posted: false, canPost: false, as });

    const shared = sharedKey(player.id);
    const { confirm } = await body(c.req.raw);
    if (confirm !== true) {
      const posted = (await deps.store.hGet(shared, 'posted')) !== undefined;
      return c.json({ text, posted, canPost: true, as });
    }

    // Claimed before anything else, so a double tap or two requests at once post one comment.
    if ((await deps.store.hSetNX(shared, 'posted', '1')) === 0)
      return c.json({ text, posted: true, canPost: true, as });
    await deps.store.expire(shared, KEEP_SECONDS);
    try {
      // The card goes under the thread of the day the flight was flown, in that day's post,
      // even when the player opened an older post.
      const postId = await postFor(c.req.raw, last.day);
      if (!postId) {
        await deps.store.hDel(shared, ['posted']);
        return c.json(
          {
            text,
            posted: false,
            canPost: true,
            as,
            error: 'Today’s post is on its way. Try again in a moment.',
          },
          503
        );
      }
      const threadKey = `thread:${last.day}`;
      let parent = await deps.store.get(threadKey);
      if (!parent) {
        const anchor = await comment({
          id: postId,
          as: 'APP',
          sticky: true,
          text: 'Reply here with your flight. The card shows your score, who you cut, whether Raja Langit is still up, and which kampung your points went to.',
        });
        parent = anchor.id;
        await deps.store.set(threadKey, parent);
      }
      await comment({ id: parent, as: 'USER', text });
    } catch (error) {
      // Nothing was posted for the player, so they can try again.
      await deps.store.hDel(shared, ['posted']);
      throw error;
    }
    return c.json({ text, posted: true, canPost: true, as });
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

  // ───────────── Kampungs ─────────────

  /** The player's kampung, the day's kampung points, and whether flair can be worn here. */
  const kampungView = async (req: Request) => {
    const player = await deps.player(req);
    const member = player
      ? await loadMember(deps.store, player.id)
      : { kampung: null, flair: null };
    return {
      guest: !player,
      /** The Reddit username a flair would be worn by. */
      name: player?.name ?? null,
      ...member,
      canFlair: Boolean(deps.setFlair),
      board: await kampungBoard(deps.store, today(req)),
    };
  };

  app.get('/api/kampung', async (c) => c.json(await kampungView(c.req.raw)));

  app.post('/api/kampung', async (c) => {
    const player = await deps.player(c.req.raw);
    if (!player) return c.json({ error: 'Log in to fly for a kampung.' }, 401);
    const { kampung } = await body(c.req.raw);
    if (!isKampung(kampung))
      return c.json({ error: 'That kampung is not one we know.' }, 400);
    await joinKampung(deps.store, player.id, kampung);
    return c.json(await kampungView(c.req.raw));
  });

  /** Wears the player's kampung as their user flair. Only ever from the player's own tap. */
  app.post('/api/kampung/flair', async (c) => {
    const player = await deps.player(c.req.raw);
    if (!player) return c.json({ error: 'Log in to wear a flair.' }, 401);
    if (!deps.setFlair)
      return c.json({ error: 'Flair can only be set on Reddit.' }, 400);
    const { kampung } = await loadMember(deps.store, player.id);
    if (!kampung) return c.json({ error: 'Pick a kampung first.' }, 400);
    const place = kampungOf(kampung);
    await deps.setFlair({
      username: player.name,
      text: place.label,
      backgroundColor: place.colour,
    });
    await noteFlair(deps.store, player.id, kampung);
    return c.json(await kampungView(c.req.raw));
  });

  // ───────────── The kite contest ─────────────

  const contestView = async (req: Request): Promise<ContestView> => {
    const player = await deps.player(req);
    const day = today(req);
    const flying = await settleYesterday(req);
    const ranked = await rankedEntries(
      deps.store,
      day,
      deps.now(req),
      deps.commentScores
    );
    const subreddit = deps.subredditName(req);
    const entered = player
      ? await hasEntered(deps.store, day, player.id)
      : false;
    return {
      day,
      entries: ranked.map((e) => ({
        by: e.by,
        design: e.design,
        votes: e.votes,
        link: permalink(subreddit, e.postId, e.commentId),
        mine: e.userId === player?.id,
      })),
      flying,
      guest: !player,
      name: player?.name ?? null,
      entered,
      // From any post: the kite goes under today's contest, in today's post.
      canEnter: Boolean(player && deps.comment && !entered),
    };
  };

  app.get('/api/contest', async (c) => c.json(await contestView(c.req.raw)));

  /**
   * Enters the player's saved kite in today's contest: a comment, posted as the player, in
   * reply to the app's contest comment on today's post. One kite per player per day.
   */
  app.post('/api/contest/enter', async (c) => {
    const player = await deps.player(c.req.raw);
    if (!player) return c.json({ error: 'Log in to enter your kite.' }, 401);
    const day = today(c.req.raw);
    const comment = deps.comment;
    if (!comment)
      return c.json({ error: 'Kites are entered from Reddit.' }, 400);
    if (!(await claimEntry(deps.store, day, player.id)))
      return c.json({ error: 'Your kite is already in today’s contest.' }, 409);
    try {
      // Today's post, whichever post the player has open.
      const postId = await postFor(c.req.raw, day);
      if (!postId) {
        await dropEntry(deps.store, day, player.id);
        return c.json(
          { error: 'Today’s post is on its way. Try again in a moment.' },
          503
        );
      }
      const { profile } = await loadProfile(deps.store, player);
      let parent = await contestThread(deps.store, day);
      if (!parent) {
        const anchor = await comment({
          id: postId,
          as: 'APP',
          text: `Kite contest, Day ${day}. Kites are entered from the game and appear as replies here. The kite with the most upvotes when the day ends is the kite Raja Langit flies on Day ${day + 1}.`,
        });
        parent = anchor.id;
        await setContestThread(deps.store, day, parent);
      }
      const posted = await comment({
        id: parent,
        as: 'USER',
        text: entryText(day, profile.design),
      });
      await saveEntry(deps.store, day, {
        userId: player.id,
        by: player.name,
        design: profile.design,
        commentId: posted.id,
        postId,
        at: deps.now(c.req.raw),
      });
    } catch (error) {
      // Nothing of the player's was posted, so they can try again.
      await dropEntry(deps.store, day, player.id);
      throw error;
    }
    return c.json(await contestView(c.req.raw));
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
