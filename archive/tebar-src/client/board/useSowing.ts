import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board } from '../../shared/rules.ts';
import { STORE } from '../../shared/puzzle.ts';
import type { PickResult } from '../../shared/puzzle.ts';
import { useReducedMotion } from '../lib/prefs.ts';

/** What the board shows at one instant of a sowing. */
export type SowFrame = {
  board: Board;
  /** The cell the hand is over. */
  active?: number;
  /** Seeds still in the hand. */
  hand: number;
  /** Cells visited so far in this pick, in order. */
  path: number[];
  capture?: { cell: number; from: number };
  /** A seed in the air. `key` changes with every hop. */
  flight?: { from: number; to: number; key: number };
};

export type QueuedPick = { before: Board; result: PickResult };

/** Long sowings play faster, so no pick takes much more than five seconds. */
function timing(drops: number) {
  const drop = drops > 26 ? 85 : drops > 14 ? 115 : 160;
  return { lift: drop * 1.7, drop, capture: 560, settle: 320 };
}

/**
 * Plays picks back seed by seed. With reduced motion the seeds do not hop: the final board
 * appears with the sowing path outlined instead. skip() jumps to the end of what is queued.
 */
export function useSowing() {
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState<SowFrame | null>(null);
  const queue = useRef<(QueuedPick & { gen: number })[]>([]);
  const running = useRef(false);
  const generation = useRef(0);
  const wake = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const still = useRef(reduced);
  useEffect(() => {
    still.current = reduced;
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      wake.current?.();
    };
  }, []);

  const sleep = useCallback(
    (ms: number, gen: number) =>
      new Promise<void>((resolve) => {
        if (gen !== generation.current || !alive.current) return resolve();
        const id = window.setTimeout(() => {
          wake.current = null;
          resolve();
        }, ms);
        wake.current = () => {
          window.clearTimeout(id);
          wake.current = null;
          resolve();
        };
      }),
    []
  );

  const animate = useCallback(
    async (pick: QueuedPick, gen: number) => {
      const stale = () => gen !== generation.current || !alive.current;
      const { result } = pick;
      const t = timing(result.drops);
      const path: number[] = [];

      if (still.current) {
        for (const step of result.steps)
          if (step.kind === 'drop' || step.kind === 'lift')
            path.push(step.cell);
        setFrame({ board: result.board, hand: 0, path: [...new Set(path)] });
        await sleep(1100, gen);
        return;
      }

      const b = pick.before.slice();
      let active: number | undefined;
      let hand = 0;
      let hop = 0;
      for (const step of result.steps) {
        if (stale()) return;
        if (step.kind === 'lift') {
          b[step.cell] = 0;
          hand = step.count;
          active = step.cell;
          path.push(step.cell);
          setFrame({ board: b.slice(), active, hand, path: path.slice() });
          await sleep(t.lift, gen);
        } else if (step.kind === 'drop') {
          const from = active ?? step.cell;
          b[step.cell] += 1;
          hand -= 1;
          active = step.cell;
          path.push(step.cell);
          hop += 1;
          setFrame({
            board: b.slice(),
            active,
            hand,
            path: path.slice(),
            flight: { from, to: step.cell, key: hop },
          });
          await sleep(t.drop, gen);
        } else if (step.kind === 'capture') {
          setFrame({
            board: b.slice(),
            active,
            hand: 0,
            path: path.slice(),
            capture: step,
          });
          await sleep(t.capture, gen);
          b[step.from] = 0;
          b[step.cell] = 0;
          b[STORE] += step.seeds;
          setFrame({
            board: b.slice(),
            active: STORE,
            hand: 0,
            path: path.slice(),
          });
          await sleep(t.drop * 2, gen);
        }
      }
      if (stale()) return;
      setFrame({ board: result.board, hand: 0, path: path.slice() });
      await sleep(t.settle, gen);
    },
    [sleep]
  );

  const drain = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length > 0 && alive.current) {
      const next = queue.current.shift()!;
      if (next.gen !== generation.current) continue;
      await animate(next, next.gen);
    }
    running.current = false;
    if (alive.current) setFrame(null);
  }, [animate]);

  const enqueue = useCallback(
    (pick: QueuedPick) => {
      queue.current.push({ ...pick, gen: generation.current });
      void drain();
    },
    [drain]
  );

  /** Jumps past everything queued so far. */
  const skip = useCallback(() => {
    generation.current += 1;
    queue.current = [];
    wake.current?.();
  }, []);

  return { frame, animating: frame !== null, enqueue, skip };
}
