import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMove, CELLS, SOUTH } from './rules.ts';
import type { Board } from './rules.ts';
import {
  firstLanding,
  IllegalPick,
  pick,
  playableHoles,
  playLine,
  SIZE,
  solve,
  sow,
  starsFor,
  startRun,
  STORE,
} from './puzzle.ts';
import type { Puzzle } from './puzzle.ts';

// Cells: 0..4 South holes, 7 South store, 8..12 North holes, 15 North store (unused).
function board(south: number[], north: number[], store = 0): Board {
  const b = new Array<number>(CELLS).fill(0);
  south.forEach((n, i) => (b[i] = n));
  north.forEach((n, i) => (b[8 + i] = n));
  b[STORE] = store;
  return b;
}

const total = (b: Board): number => b.reduce((a, n) => a + n, 0);

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function randomBoard(next: () => number, max = 6): Board {
  const b = new Array<number>(CELLS).fill(0);
  for (let i = 0; i < SIZE; i++) {
    b[i] = Math.floor(next() * (max + 1));
    b[8 + i] = Math.floor(next() * (max + 1));
  }
  b[STORE] = Math.floor(next() * 4);
  return b;
}

test('a pick that ends in the store is over, with no second move', () => {
  // Hole 4 is next to the store: one seed lands in it.
  const r = sow(board([0, 0, 0, 0, 1], [0, 0, 0, 0, 0]), 4);
  assert.equal(r.outcome, 'store');
  assert.equal(r.gained, 1);
  assert.equal(r.board[STORE], 1);
  assert.equal(r.drops, 1);
});

test('sowing passes the store, goes round the far row and skips the far store', () => {
  // 8 seeds from hole 3: hole 4, store, five far holes, then back to hole 0.
  const r = sow(board([0, 0, 0, 8, 0], [0, 0, 0, 0, 0]), 3);
  assert.deepEqual(
    r.steps.filter((s) => s.kind === 'drop').map((s) => s.cell),
    [4, STORE, 8, 9, 10, 11, 12, 0]
  );
  assert.equal(r.board[15], 0, 'the far store never receives a seed');
  // The last seed fell in empty hole 0, with one seed across it in far hole 4 (cell 12):
  // a capture of 2, on top of the seed dropped in the store on the way round.
  assert.equal(r.outcome, 'capture');
  assert.deepEqual(r.board.slice(0, 5), [0, 0, 0, 0, 1]);
  assert.deepEqual(r.board.slice(8, 13), [1, 1, 1, 1, 0]);
  assert.equal(r.board[STORE], 3);
  assert.equal(r.gained, 3);
});

test('a last seed on seeds relays: they are lifted and sowing goes on', () => {
  // Hole 0 has 1 seed and lands on hole 1 (2 seeds). Those 3 go to holes 2, 3, 4.
  const r = sow(board([1, 2, 0, 0, 0], [0, 0, 0, 0, 0]), 0);
  assert.equal(r.relays, 1);
  assert.equal(r.drops, 4);
  assert.deepEqual(r.board.slice(0, 5), [0, 0, 1, 1, 1]);
  assert.equal(
    r.outcome,
    'rest',
    'hole 4 was empty and nothing sits across it'
  );
  assert.deepEqual(
    r.steps.filter((s) => s.kind === 'lift').map((s) => s.cell),
    [0, 1]
  );
});

test('a last seed in an empty hole of yours captures the hole across', () => {
  // Hole 0 (1 seed) lands in empty hole 1; across hole 1 is far hole 3 (cell 11) with 4.
  const r = sow(board([1, 0, 0, 0, 0], [0, 0, 0, 4, 0]), 0);
  assert.equal(r.outcome, 'capture');
  assert.equal(r.gained, 5);
  assert.equal(r.board[1], 0);
  assert.equal(r.board[11], 0);
  const capture = r.steps.find((s) => s.kind === 'capture');
  assert.deepEqual(capture, { kind: 'capture', cell: 1, from: 11, seeds: 5 });
});

test('a last seed in an empty far hole ends the pick with nothing gained beyond the store pass', () => {
  // 3 seeds from hole 3: hole 4, store, far hole 0 (empty).
  const r = sow(board([0, 0, 0, 3, 0], [0, 2, 0, 0, 0]), 3);
  assert.equal(r.outcome, 'far');
  assert.equal(r.gained, 1);
  assert.equal(r.board[8], 1);
});

test('the input board is left untouched and seeds are conserved', () => {
  const next = seeded(11);
  for (let i = 0; i < 500; i++) {
    const b = randomBoard(next);
    const copy = b.slice();
    for (const hole of playableHoles(b)) {
      const r = sow(b, hole);
      assert.deepEqual(b, copy);
      assert.equal(total(r.board), total(b));
      assert.equal(r.steps.filter((s) => s.kind === 'drop').length, r.drops);
    }
  }
});

test('sowing agrees with the two-player engine wherever the two rule sets overlap', () => {
  // rules.ts is the engine that was checked against the Dakon contract. Tebar differs only in
  // what happens after a pick (no extra move, no end-of-game sweep), so the sowing itself must match.
  const map = {
    extra: 'store',
    capture: 'capture',
    rest: 'rest',
    dead: 'far',
    limit: 'limit',
  } as const;
  const next = seeded(677);
  let compared = 0;
  let boardsCompared = 0;
  for (let i = 0; i < 1500; i++) {
    const b = randomBoard(next);
    for (const hole of playableHoles(b)) {
      const mine = sow(b, hole);
      const engine = applyMove(b, SIZE, SOUTH, hole);
      assert.equal(mine.outcome, map[engine.outcome]);
      assert.equal(mine.drops, engine.sown);
      assert.equal(mine.relays, engine.relays);
      compared += 1;
      if (!engine.ended) {
        assert.deepEqual(mine.board, engine.board);
        boardsCompared += 1;
      }
    }
  }
  assert.ok(compared > 5000, `only ${compared} picks compared`);
  assert.ok(boardsCompared > 4000, `only ${boardsCompared} boards compared`);
});

test('firstLanding is the cell that gets the last seed of the first lap', () => {
  const next = seeded(5);
  for (let i = 0; i < 300; i++) {
    const b = randomBoard(next);
    for (const hole of playableHoles(b)) {
      const drops = sow(b, hole).steps.filter((s) => s.kind === 'drop');
      assert.equal(firstLanding(b, hole), drops[b[hole] - 1].cell);
    }
  }
});

test('empty holes and holes off the board cannot be picked', () => {
  const b = board([0, 2, 0, 0, 0], [1, 1, 1, 1, 1]);
  assert.throws(() => sow(b, 0), IllegalPick);
  assert.throws(() => sow(b, 5), IllegalPick);
  assert.throws(() => sow(b, -1), IllegalPick);
  assert.throws(() => sow(b, 1.5), IllegalPick);
  assert.deepEqual(playableHoles(b), [1]);
});

test('a run spends one pick per hole and ends when picks or seeds run out', () => {
  const puzzle: Puzzle = {
    cells: board([1, 1, 1, 1, 1], [2, 2, 2, 2, 2]),
    picks: 3,
  };
  let run = startRun(puzzle);
  assert.equal(run.picksLeft, 3);
  assert.equal(run.over, false);
  run = pick(run, 4).run; // straight into the store
  assert.equal(run.score, 1);
  assert.equal(run.picksLeft, 2);
  run = pick(run, 3).run;
  run = pick(run, 2).run;
  assert.equal(run.over, true);
  assert.deepEqual(run.line, [4, 3, 2]);
  assert.throws(() => pick(run, 1), IllegalPick);

  // The South row can also run dry before the picks do.
  const dry = startRun({
    cells: board([0, 0, 0, 0, 1], [0, 0, 0, 0, 0]),
    picks: 4,
  });
  const after = pick(dry, 4).run;
  assert.equal(after.over, true);
  assert.equal(after.picksLeft, 3);
});

test('playLine scores a complete line and refuses a made-up or unfinished one', () => {
  const puzzle: Puzzle = {
    cells: board([1, 1, 1, 1, 1], [2, 2, 2, 2, 2]),
    picks: 3,
  };
  assert.equal(
    playLine(puzzle, [4, 3, 2]).score,
    startRunScore(puzzle, [4, 3, 2])
  );
  assert.throws(() => playLine(puzzle, [4, 3]), IllegalPick, 'stops early');
  assert.throws(
    () => playLine(puzzle, [4, 4, 3]),
    IllegalPick,
    'picks an empty hole'
  );
  assert.throws(
    () => playLine(puzzle, [4, 3, 2, 1]),
    IllegalPick,
    'one pick too many'
  );
});

function startRunScore(puzzle: Puzzle, line: number[]): number {
  let b = puzzle.cells;
  for (const hole of line) b = sow(b, hole).board;
  return b[STORE];
}

test('solve finds the true best score, a line that reaches it, and counts every line', () => {
  const next = seeded(2026);
  for (let i = 0; i < 60; i++) {
    const cells = randomBoard(next, 4);
    cells[STORE] = 0;
    const puzzle: Puzzle = { cells, picks: 3 + (i % 3) };
    if (playableHoles(cells).length === 0) continue;
    const s = solve(puzzle);

    // An independent count: walk every line with the public run API.
    let best = -1;
    let lines = 0;
    let perfectLines = 0;
    const walk = (run: ReturnType<typeof startRun>): void => {
      if (run.over) {
        lines += 1;
        if (run.score > best) {
          best = run.score;
          perfectLines = 1;
        } else if (run.score === best) perfectLines += 1;
        return;
      }
      for (const hole of playableHoles(run.board)) walk(pick(run, hole).run);
    };
    walk(startRun(puzzle));

    assert.equal(s.perfect, best);
    assert.equal(s.lines, lines);
    assert.equal(s.perfectLines, perfectLines);
    assert.equal(playLine(puzzle, s.bestLine).score, s.perfect);
    assert.equal(
      Object.values(s.histogram).reduce((a, n) => a + n, 0),
      lines
    );
    assert.equal(s.histogram[s.perfect], perfectLines);
    assert.ok(s.reader <= s.perfect);
    assert.ok(s.mean <= s.perfect);
    assert.equal(s.seeds, total(cells));
  }
});

test('stars: three for perfect, two from 80%, one from 55%', () => {
  assert.equal(starsFor(20, 20), 3);
  assert.equal(starsFor(16, 20), 2);
  assert.equal(starsFor(15, 20), 1);
  assert.equal(starsFor(11, 20), 1);
  assert.equal(starsFor(10, 20), 0);
  assert.equal(
    starsFor(0, 0),
    3,
    'a board with nothing to win is trivially perfect'
  );
});
