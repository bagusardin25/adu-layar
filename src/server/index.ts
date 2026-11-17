// The server as it runs on Reddit: the game's routes, wired to Reddit's Redis, user and post.

import { serve } from '@hono/node-server';
import {
  context,
  createServer,
  getServerPort,
  reddit,
  redis,
} from '@devvit/web/server';
import { skyForFight } from './core/fight.ts';
import { kampungBoard } from './core/kampung.ts';
import { dailyTitle } from './core/posts.ts';
import { createApp } from './app.ts';

const app = createApp({
  store: redis,
  now: () => Date.now(),
  player: async () => {
    const id = context.userId;
    if (!id) return null;
    const name = context.username ?? (await reddit.getCurrentUsername());
    return name ? { id, name } : null;
  },
  postDay: () => {
    const day = context.postData?.day;
    return typeof day === 'number' ? day : undefined;
  },
  subredditName: () => context.subredditName,
  postId: () => context.postId,
  createPost: async (day) => {
    const fight = await skyForFight(redis, day);
    const { yesterday } = await kampungBoard(redis, day);
    return reddit.submitCustomPost({
      title: dailyTitle(day, fight.king?.name ?? null, yesterday),
      postData: { day },
    });
  },
  comment: async ({ id, text, as, sticky }) => {
    const comment = await reddit.submitComment({
      id: id as `t1_${string}` | `t3_${string}`,
      text,
      runAs: as,
    });
    if (sticky) await comment.distinguish(true);
    return { id: comment.id };
  },
  commentScores: async (ids) => {
    const out: Record<string, number | null> = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          const c = await reddit.getCommentById(id as `t1_${string}`);
          const gone =
            c.removed ||
            c.spam ||
            c.body === '[deleted]' ||
            c.authorName === '[deleted]';
          out[id] = gone ? null : c.score;
        } catch (error) {
          // Left out: not known right now, which is not the same as gone.
          console.warn('Could not read the score of', id, error);
        }
      })
    );
    return out;
  },
  setFlair: async ({ username, text, backgroundColor }) => {
    await reddit.setUserFlair({
      subredditName: context.subredditName,
      username,
      text,
      backgroundColor,
      textColor: 'light',
    });
  },
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
