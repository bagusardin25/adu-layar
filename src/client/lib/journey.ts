// Devvit Journeys. Events fire on a committed action: launching a flight, finishing it,
// and posting the score card. A failure to record never blocks the game.

import { telemetry } from '@devvit/analytics/client/reddit';

const quiet = (work: Promise<unknown>) => {
  void work.catch(() => {
    // Playtest and the local preview are not on the Journeys allowlist.
  });
};

export const noteReady = (): void => quiet(telemetry.appReady());

export const noteStart = (): void => quiet(telemetry.startJourney());

export const noteLesson = (): void =>
  quiet(telemetry.interaction({ action: 'lesson' }));

export const noteShare = (): void =>
  quiet(telemetry.interaction({ action: 'share' }));

export const noteEnd = (win: boolean, score: number): void =>
  quiet(telemetry.endJourney({ complete: true, game: { win, score } }));
