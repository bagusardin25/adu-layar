// A way to tell the moderators something is wrong, from inside the game, as the Devvit Rules
// ask. It opens a message to the moderators of the subreddit the game is played in, with the
// day filled in so they know which sky it was.

import { context, navigateTo } from '@devvit/web/client';

export function reportProblem(day: number): void {
  const subreddit = context.subredditName || 'AduLayangan';
  const query = new URLSearchParams({
    to: `/r/${subreddit}`,
    subject: 'Adu Layangan: a problem',
    message: `Day ${day}. What happened:\n\n`,
  });
  navigateTo(`https://www.reddit.com/message/compose/?${query.toString()}`);
}
