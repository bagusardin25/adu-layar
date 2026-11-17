// Devvit Journeys. The official router is Express; the game's server is Hono, so these routes
// call the same telemetry client the router would. Outside Reddit the plugin is missing and the
// route answers 503, which the client already treats as "not recorded".

import type { Hono } from 'hono';

type Json = Record<string, unknown>;

async function client() {
  const mod = await import('@devvit/analytics/server/reddit');
  return mod;
}

export function mountTelemetry(app: Hono): void {
  const fail = (error: unknown) => {
    console.warn('Journey telemetry is unavailable.', error);
    return {
      error: 'Telemetry is unavailable.',
      receipt: {
        status: 'JOURNEY_RECEIPT_DENIED_DISABLED',
        message: 'Not recorded outside Reddit.',
      },
    };
  };

  app.post('/api/telemetry/journey/start', async (c) => {
    try {
      const { telemetry } = await client();
      return c.json(await telemetry.startJourney());
    } catch (error) {
      return c.json(fail(error), 503);
    }
  });

  app.post('/api/telemetry/journey/app-ready', async (c) => {
    try {
      const { telemetry } = await client();
      return c.json(await telemetry.appReady());
    } catch (error) {
      return c.json(fail(error), 503);
    }
  });

  app.post('/api/telemetry/journey/progress', async (c) => {
    try {
      const body = (await c.req.json()) as Json;
      const { telemetry } = await client();
      return c.json(
        await telemetry.journeyProgress({
          journeyId: String(body.journeyId ?? ''),
          progress: Number(body.progress),
          ...(typeof body.action === 'string' ? { action: body.action } : {}),
          ...(typeof body.actionDetails === 'string'
            ? { actionDetails: body.actionDetails }
            : {}),
        })
      );
    } catch (error) {
      return c.json(fail(error), 503);
    }
  });

  app.post('/api/telemetry/journey/interaction', async (c) => {
    try {
      const body = (await c.req.json()) as Json;
      const { telemetry } = await client();
      return c.json(
        await telemetry.journeyInteraction({
          journeyId: typeof body.journeyId === 'string' ? body.journeyId : '',
          action: String(body.action ?? ''),
          actionDetails:
            typeof body.actionDetails === 'string' ? body.actionDetails : '',
        })
      );
    } catch (error) {
      return c.json(fail(error), 503);
    }
  });

  app.post('/api/telemetry/journey/end', async (c) => {
    try {
      const body = (await c.req.json()) as Json;
      const game = body.game as Json | undefined;
      const { telemetry } = await client();
      return c.json(
        await telemetry.endJourney({
          journeyId: String(body.journeyId ?? ''),
          complete: body.complete === true,
          ...(game
            ? {
                game: {
                  win: game.win === true,
                  score: typeof game.score === 'number' ? game.score : 0,
                },
              }
            : {}),
        })
      );
    } catch (error) {
      return c.json(fail(error), 503);
    }
  });
}
