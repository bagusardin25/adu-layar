import type { Style } from '../../shared/sim/types.ts';

/** What each rival does, in a few words. */
export const STYLE_NOTE: Record<Style, string> = {
  nekat: 'Reckless. Comes straight for you.',
  gesit: 'Quick. Joins the fight at 0:15.',
  kalem: 'Calm. Comes down at 0:30.',
};

/** "Wind from the left, 18" style label. */
export function windLabel(windX: number): string {
  const strength = Math.abs(windX);
  if (strength < 6) return 'Wind: calm';
  return `Wind: ${windX > 0 ? '→' : '←'} ${strength < 18 ? 'light' : strength < 26 ? 'steady' : 'strong'}`;
}
