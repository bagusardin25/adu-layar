// The player's kite and name: kept on their Reddit account by the server, with a copy on the
// device so the game can show it at once, and so a logged-out player can still choose one.

import { context } from '@devvit/web/client';
import { useEffect, useState } from 'react';
import { defaultProfile, parseProfile } from '../../shared/kite.ts';
import type { Profile } from '../../shared/kite.ts';

const KEY = 'adu-layangan:profile';

/** The profile last saved on this device, if any. Storage can be blocked in a webview. */
function readCache(): Profile | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? parseProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(profile: Profile): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Storage is unavailable: the account copy is the only one.
  }
}

/** True when the player is logged in to Reddit, so their kite can be kept on their account. */
export const loggedIn = (): boolean => Boolean(context.userId);

/** The kite to show before the server answers: the device copy, or the account's starting kite. */
export function quickProfile(): Profile {
  return readCache() ?? defaultProfile(context.userId ?? 'guest');
}

async function fetchProfile(): Promise<{
  profile: Profile;
  saved: boolean;
} | null> {
  const res = await fetch('/api/profile');
  if (!res.ok) return null;
  const data = (await res.json()) as { profile?: unknown; saved?: unknown };
  const profile = parseProfile(data.profile);
  return profile ? { profile, saved: data.saved === true } : null;
}

async function storeProfile(profile: Profile): Promise<boolean> {
  const res = await fetch('/api/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(profile),
  });
  return res.ok;
}

/**
 * The player's profile, and a way to save a new one. A kite saved on the account wins; failing
 * that, one saved on this device; failing that, the account's starting kite.
 */
export function useProfile(): {
  profile: Profile;
  save: (profile: Profile) => void;
} {
  const [profile, setProfile] = useState<Profile>(quickProfile);

  useEffect(() => {
    let current = true;
    fetchProfile()
      .then((answer) => {
        if (!current || !answer) return;
        if (answer.saved) {
          setProfile(answer.profile);
          writeCache(answer.profile);
        } else if (!readCache()) {
          setProfile(answer.profile);
        }
      })
      .catch(() => {
        // Offline or the server is busy: keep what is shown.
      });
    return () => {
      current = false;
    };
  }, []);

  const save = (next: Profile) => {
    setProfile(next);
    writeCache(next);
    if (!loggedIn()) return;
    storeProfile(next).catch(() => {
      // Kept on this device; the next save will try the account again.
    });
  };

  return { profile, save };
}
