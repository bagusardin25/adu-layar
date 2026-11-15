// The server as it runs on Reddit: the game's routes, wired to Reddit's Redis, user and post.

import { serve } from '@hono/node-server';
import {
  context,
  createServer,
  getServerPort,
  reddit,
  redis,
} from '@devvit/web/server';
import { dayLabel } from '../shared/days.ts';
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
  createPost: (day) =>
    reddit.submitCustomPost({
      title: `Adu Layangan · Day ${day} · ${dayLabel(day)}`,
      postData: { day },
    }),
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
