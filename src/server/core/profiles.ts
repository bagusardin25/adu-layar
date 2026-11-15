// A player's kite and name. Kept 30 days after the player last saved it, like everything else
// about a player.

import { defaultProfile, parseProfile } from '../../shared/kite.ts';
import type { Profile } from '../../shared/kite.ts';
import { KEEP_SECONDS } from './posts.ts';
import type { Player } from './posts.ts';
import type { Store } from './store.ts';

const key = (playerId: string) => `profile:${playerId}`;

/** What the game shows for a player: their saved profile, or the one they start with. */
export async function loadProfile(
  store: Store,
  player: Player
): Promise<{ profile: Profile; saved: boolean }> {
  if (!player) return { profile: defaultProfile('guest'), saved: false };
  const raw = await store.get(key(player.id));
  let stored: Profile | null = null;
  if (raw) {
    try {
      stored = parseProfile(JSON.parse(raw));
    } catch {
      stored = null;
    }
  }
  return stored
    ? { profile: stored, saved: true }
    : { profile: defaultProfile(player.id), saved: false };
}

/** Saves a profile, or returns null if it is not made of known choices. */
export async function saveProfile(
  store: Store,
  playerId: string,
  input: unknown
): Promise<Profile | null> {
  const profile = parseProfile(input);
  if (!profile) return null;
  await store.set(key(playerId), JSON.stringify(profile));
  await store.expire(key(playerId), KEEP_SECONDS);
  return profile;
}
