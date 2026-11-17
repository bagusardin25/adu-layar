// Stand-in for `@devvit/web/client` when the client runs outside Reddit (`npm run dev:local`).
// It covers only what the app uses. Inside Reddit the real SDK is bundled instead.

export const context = {
  username: 'local_player',
  userId: 't2_local',
  postId: 't3_local',
  subredditName: 'AduLayangan',
};

/** In a Reddit post this opens the full-screen view; locally it just loads that page. */
export function requestExpandedMode(_event: MouseEvent, entry: string): void {
  window.location.assign(`/${entry === 'default' ? 'splash' : entry}.html`);
}

export function exitExpandedMode(_event: MouseEvent): void {
  window.location.assign('/splash.html');
}

export function navigateTo(url: string): void {
  console.info('[local] navigateTo', url);
}

export function showToast(text: string): void {
  console.info('[local] toast:', text);
}

export function showLoginPrompt(): void {
  console.info('[local] login prompt');
}
