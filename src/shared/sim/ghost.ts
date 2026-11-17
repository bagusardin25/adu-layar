// A recorded flight, packed small enough to keep and send with the day's sky.
//
// Twenty samples a second is enough for the string to be cut where the flyer really was.
// The recording is played back as positions, not re-simulated, because tomorrow's wind is
// different and the flight should stay the one they flew.

import { PLAYER_ANCHOR_X } from './sky.ts';
import { SKY_W } from './types.ts';
import type { GhostSpec, Sample } from './types.ts';

/** Ticks between samples. 60 ticks a second, so this is 20 samples a second. */
export const SAMPLE_EVERY = 3;

export function pack(samples: readonly Sample[]): string {
  return samples.map((s) => `${s.x},${s.y},${s.a},${s.f}`).join(';');
}

export function unpack(track: string): Sample[] {
  if (!track) return [];
  const out: Sample[] = [];
  for (const part of track.split(';')) {
    const [x, y, a, f] = part.split(',').map(Number);
    if (![x, y, a, f].every((n) => Number.isInteger(n))) continue;
    out.push({ x, y, a, f });
  }
  return out;
}

/** The sample a recorded kite is on at this tick. The last sample holds. */
export function sampleAt(samples: readonly Sample[], tick: number): Sample | undefined {
  if (samples.length === 0) return undefined;
  const i = Math.min(samples.length - 1, Math.floor(tick / SAMPLE_EVERY));
  return samples[i];
}

/**
 * Moves a recording onto another rooftop. The shape of the flight stays; the whole path
 * shifts by the same amount as the hand that holds the string.
 */
export function place(
  spec: Omit<GhostSpec, 'anchorX' | 'kind'> & { anchorX?: number },
  anchorX: number,
  kind: GhostSpec['kind']
): GhostSpec {
  const dx = anchorX - (spec.anchorX ?? PLAYER_ANCHOR_X);
  const samples = unpack(spec.track).map((s) => ({
    ...s,
    x: Math.max(8, Math.min(SKY_W - 8, s.x + dx)),
  }));
  return {
    id: spec.id,
    name: spec.name,
    colors: spec.colors,
    score: spec.score,
    anchorX,
    kind,
    track: pack(samples),
  };
}
