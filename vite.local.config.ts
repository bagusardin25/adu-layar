import { fileURLToPath } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createApp } from './src/server/app.ts';
import { createMemoryStore } from './src/server/core/memoryStore.ts';
import { DAY_MS } from './src/shared/days.ts';

// Local preview, outside Reddit: `npm run dev:local`, then http://localhost:5180/splash.html.
//
// The real game server runs inside Vite's dev server with storage kept in memory, so the whole
// loop (board, scoring, streaks, standings) works without a Reddit account. Three cookies stand
// in for what Reddit would provide:
//
//   tebar_user=ani        who is playing (`anon` for a logged-out visitor)
//   tebar_shift=1         days to move the clock forward, to see tomorrow's board
//   tebar_post_day=3      the day of the post being viewed, to open an old post
//
// Set one from the browser console: document.cookie = 'tebar_user=budi; path=/'

function cookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function localServer(): Plugin {
  return {
    name: 'tebar-local-server',
    configureServer(server) {
      let posts = 0;
      const app = createApp({
        store: createMemoryStore(),
        now: (req) =>
          Date.now() + (Number(cookie(req, 'tebar_shift')) || 0) * DAY_MS,
        player: (req) => {
          const name = cookie(req, 'tebar_user') ?? 'local_player';
          return name === 'anon' ? null : { id: `t2_${name}`, name };
        },
        postDay: (req) => {
          const day = Number(cookie(req, 'tebar_post_day'));
          return Number.isInteger(day) && day > 0 ? day : undefined;
        },
        subredditName: () => 'AduLayangan',
        createPost: async (day) => ({ id: `t3_local${day}_${++posts}` }),
        // Stands in for Reddit's user flair, so the flair offer can be tried here.
        setFlair: async ({ username, text }) => {
          console.info(`[local] flair for u/${username}: ${text}`);
        },
      });
      const listener = getRequestListener(app.fetch);
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url.startsWith('/api/') || url.startsWith('/internal/'))
          void listener(req, res);
        else next();
      });
    },
  };
}

export default defineConfig({
  root: 'src/client',
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react(), localServer()],
  resolve: {
    alias: {
      // The Devvit client SDK only works inside a Reddit post, so it is swapped for a stand-in.
      '@devvit/web/client': fileURLToPath(
        new URL('./src/client/lib/devvit-local.ts', import.meta.url)
      ),
    },
  },
  server: { port: 5180, strictPort: true },
});
