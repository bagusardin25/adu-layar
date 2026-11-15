import type { PickResult } from '../../shared/puzzle.ts';

const seeds = (n: number): string => `${n} ${n === 1 ? 'seed' : 'seeds'}`;

/** One short sentence about a pick, for the line under the board and for screen readers. */
export function narrate(hole: number, r: PickResult): string {
  const relay =
    r.relays === 0
      ? ''
      : r.relays === 1
        ? 'Relayed once. '
        : `Relayed ${r.relays} times. `;
  switch (r.outcome) {
    case 'capture': {
      const capture = r.steps.find((s) => s.kind === 'capture');
      const taken = capture && capture.kind === 'capture' ? capture.seeds : 0;
      return `${relay}Captured ${seeds(taken)}. +${r.gained} in your store.`;
    }
    case 'store':
      return `${relay}Hole ${hole + 1} ended in your store. +${r.gained}.`;
    case 'rest':
      return `${relay}The last seed rests in an empty hole of yours.${r.gained ? ` +${r.gained}.` : ''}`;
    case 'far':
      return `${relay}The last seed fell in an empty far hole.${r.gained ? ` +${r.gained}.` : ''}`;
    case 'limit':
      return `${relay}The sowing was stopped.`;
  }
}
