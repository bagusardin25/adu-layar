import './styles/theme.css';
import './styles/base.css';
import './styles/board.css';
import './styles/game.css';

import { showLoginPrompt } from '@devvit/web/client';
import { useMemo, useState } from 'react';
import type { BoardResponse, BoardStats, RunResult } from '../shared/api.ts';
import { dayLabel, msUntilNextDay } from '../shared/days.ts';
import {
  firstLanding,
  pick,
  playableHoles,
  playLine,
  starsFor,
  startRun,
} from '../shared/puzzle.ts';
import type { Puzzle, Run } from '../shared/puzzle.ts';
import { LevelChip, Pips, StarRow, Wordmark } from './bits.tsx';
import { Board } from './board/Board.tsx';
import { useSowing } from './board/useSowing.ts';
import { ApiError, sendRun } from './lib/api.ts';
import { duration } from './lib/format.ts';
import { readLocalResult, saveLocalResult } from './lib/localResult.ts';
import { mount } from './lib/mount.tsx';
import { narrate } from './lib/narrate.ts';
import { useNow } from './lib/prefs.ts';
import { useBoard } from './lib/useBoard.ts';
import { Standings } from './Standings.tsx';

/** `counted` is the day's one scored run; `explore` is free practice on the same board. */
type View = 'counted' | 'explore';

/** What happened to the counted run after it was sent to the server. */
type Saving =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'failed'; line: number[]; message: string };

export function Game() {
  const state = useBoard();
  if (state.status === 'loading') {
    return (
      <main className="stage stage--waiting" aria-busy="true">
        <Wordmark />
        <p className="waiting__note">Setting out today’s seeds…</p>
      </main>
    );
  }
  if (state.status === 'failed') {
    return (
      <main className="stage stage--waiting">
        <Wordmark />
        <p className="waiting__note" role="alert">
          {state.message}
        </p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={state.retry}
        >
          Try again
        </button>
      </main>
    );
  }
  return <Play board={state.board} />;
}

/** A stored line replayed on the board, or null if it is not a real line there. */
function replay(puzzle: Puzzle, result: RunResult | null): Run | null {
  if (!result) return null;
  try {
    const run = playLine(puzzle, result.line);
    return run.score === result.score ? run : null;
  } catch {
    return null;
  }
}

function Play({ board }: { board: BoardResponse }) {
  const puzzle = useMemo<Puzzle>(
    () => ({ cells: board.cells, picks: board.picks }),
    [board]
  );
  const open = board.day === board.today;
  const loggedIn = board.player.name !== null;

  // The run that counts: the server's for a player, the device's for a visitor.
  const [initial] = useState(() => {
    const result =
      board.result ?? (loggedIn ? null : readLocalResult(board.day));
    const run = replay(puzzle, result);
    return run ? { result, run } : null;
  });
  const [counted, setCounted] = useState<RunResult | null>(
    initial?.result ?? null
  );
  const [stats, setStats] = useState<BoardStats>(board.stats);
  const [streak, setStreak] = useState(board.player.streak);
  const [saving, setSaving] = useState<Saving>({ status: 'idle' });

  // A past board has nothing left to count, so it opens straight in explore.
  const [view, setView] = useState<View>(
    open || initial ? 'counted' : 'explore'
  );
  const [run, setRun] = useState<Run>(() => initial?.run ?? startRun(puzzle));
  const [selected, setSelected] = useState<number | undefined>();
  const [news, setNews] = useState('');
  const [standings, setStandings] = useState(false);
  const sowing = useSowing();
  const { frame, animating } = sowing;

  const playing = !run.over && !animating;
  const finished = run.over && !animating;
  const playable = playing ? playableHoles(run.board) : [];
  const landing =
    selected === undefined ? undefined : firstLanding(run.board, selected);

  async function save(line: number[], score: number) {
    setSaving({ status: 'saving' });
    try {
      const answer = await sendRun(board.day, line);
      setStats(answer.stats);
      setStreak(answer.streak);
      setCounted(answer.result);
      if (answer.reason === 'anonymous')
        saveLocalResult(board.day, answer.result);
      // Already played elsewhere: show the run that counts, not the one just finished.
      if (answer.reason === 'already') {
        const kept = replay(puzzle, answer.result);
        if (kept) setRun(kept);
      }
      setSaving({ status: 'idle' });
    } catch (error) {
      setCounted({ line, score });
      setSaving({
        status: 'failed',
        line,
        message:
          error instanceof ApiError
            ? error.message
            : 'Your result could not be saved.',
      });
    }
  }

  function sowSelected() {
    if (selected === undefined || !playing) return;
    const step = pick(run, selected);
    sowing.enqueue({ before: run.board, result: step.result });
    setRun(step.run);
    setSelected(undefined);
    setNews(narrate(selected, step.result));
    if (step.run.over && view === 'counted' && !counted) {
      setCounted({ line: step.run.line, score: step.run.score });
      void save(step.run.line, step.run.score);
    }
  }

  function explore() {
    sowing.skip();
    setView('explore');
    setRun(startRun(puzzle));
    setSelected(undefined);
    setNews('');
  }

  function backToResult() {
    const kept = replay(puzzle, counted);
    if (!kept) return;
    sowing.skip();
    setView('counted');
    setRun(kept);
    setSelected(undefined);
    setNews('');
  }

  const hint = animating
    ? 'Sowing… tap the board to skip.'
    : selected !== undefined
      ? `Hole ${selected + 1}: its first lap ends on the dashed ring.`
      : news || 'Pick a hole on your side.';

  return (
    <main className={`stage${finished ? ' stage--finished' : ''}`}>
      <header className="top">
        <Wordmark />
        <p className="top__day">
          <span className="num">Day {board.day}</span>
          <span className="top__date">{dayLabel(board.day)}</span>
        </p>
      </header>

      <div className="hud">
        {!open ? (
          <span className="chip chip--explore">Past board</span>
        ) : view === 'explore' ? (
          <span className="chip chip--explore">Exploring</span>
        ) : (
          <LevelChip level={board.level} />
        )}
        <span className="hud__picks">
          <Pips total={board.picks} left={run.picksLeft} />
          <span className="num">
            {run.picksLeft} {run.picksLeft === 1 ? 'pick' : 'picks'} left
          </span>
        </span>
      </div>

      <div className="stage__board">
        <Board
          board={run.board}
          frame={frame}
          playable={playable}
          selected={selected}
          landing={landing}
          onSelect={(hole) => setSelected(hole === selected ? undefined : hole)}
          onSkip={sowing.skip}
          goal={board.perfect}
          label={`Tebar board, day ${board.day}`}
        />
      </div>

      {finished ? (
        <ResultCard
          board={board}
          open={open}
          view={view}
          score={run.score}
          counted={counted}
          stats={stats}
          streak={streak}
          saving={saving}
          onRetry={() =>
            saving.status === 'failed' &&
            counted &&
            void save(saving.line, counted.score)
          }
          onExplore={explore}
          onBack={backToResult}
          onStandings={() => setStandings(true)}
        />
      ) : (
        <div className="dock">
          <p className="dock__hint" aria-live="polite">
            {hint}
          </p>
          <button
            type="button"
            className="btn btn--primary dock__sow"
            disabled={selected === undefined || !playing}
            onClick={sowSelected}
          >
            {selected === undefined
              ? 'Sow'
              : `Sow ${run.board[selected]} from hole ${selected + 1}`}
          </button>
        </div>
      )}

      {standings && (
        <Standings
          day={board.day}
          perfect={board.perfect}
          stats={stats}
          mine={
            counted && saving.status === 'idle' && loggedIn && open
              ? counted.score
              : undefined
          }
          onClose={() => setStandings(false)}
        />
      )}
    </main>
  );
}

const TITLES = [
  'A thin harvest.',
  'A fair harvest.',
  'A good harvest.',
  'A perfect harvest.',
] as const;

/** Where a score stands among the day's players, in one sentence. */
function standing(score: number, perfect: number, stats: BoardStats): string {
  if (stats.players <= 1) return 'You are the first to finish today.';
  if (score >= perfect) {
    return stats.perfect <= 1
      ? `The only one of ${stats.players} players with the best line.`
      : `One of ${stats.perfect} players with the best line, out of ${stats.players}.`;
  }
  let below = 0;
  for (const [s, count] of Object.entries(stats.histogram))
    if (Number(s) < score) below += count;
  const share = Math.round((below / (stats.players - 1)) * 100);
  return `Ahead of ${share}% of the other ${stats.players - 1} players today.`;
}

function ResultCard(props: {
  board: BoardResponse;
  open: boolean;
  view: View;
  score: number;
  counted: RunResult | null;
  stats: BoardStats;
  streak: number;
  saving: Saving;
  onRetry: () => void;
  onExplore: () => void;
  onBack: () => void;
  onStandings: () => void;
}) {
  const { board, open, view, score, counted, stats, streak, saving } = props;
  const now = useNow();
  const perfect = board.perfect;
  const stars = starsFor(score, perfect);
  const short = perfect - score;
  const loggedIn = board.player.name !== null;

  let title: string;
  let note: string;
  if (view === 'explore') {
    title =
      short === 0
        ? 'That is the best line.'
        : open
          ? 'An explore run.'
          : 'A practice run.';
    note = !open
      ? 'This board’s day is over, so runs here are for practice.'
      : `Exploring never changes your score.${counted ? ` Counted today: ${counted.score} of ${perfect}.` : ''}`;
  } else {
    title = TITLES[stars];
    if (saving.status === 'saving') note = 'Saving your result…';
    else if (saving.status === 'failed') note = saving.message;
    else if (!loggedIn)
      note =
        'Log in to keep your result, your streak and your place in the standings.';
    else if (!open) note = 'Your result from that day.';
    else note = standing(score, perfect, stats);
  }

  return (
    <section className="result" aria-live="polite">
      <div className="result__head">
        <StarRow stars={stars} />
        <p className="result__score num">
          <strong>{score}</strong>
          <span> of {perfect}</span>
        </p>
      </div>

      <h1 className="result__title">{title}</h1>
      <p
        className="result__note"
        role={
          saving.status === 'failed' && view === 'counted' ? 'alert' : undefined
        }
      >
        {note}
      </p>

      <div className="result__actions">
        {view === 'counted' && saving.status === 'failed' ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={props.onRetry}
          >
            Save again
          </button>
        ) : view === 'counted' && !loggedIn ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => showLoginPrompt()}
          >
            Log in
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={props.onExplore}
          >
            {view === 'explore' ? 'Try again' : 'Explore this board'}
          </button>
        )}
        {view === 'counted' && (saving.status === 'failed' || !loggedIn) && (
          <button
            type="button"
            className="btn btn--quiet"
            onClick={props.onExplore}
          >
            Explore
          </button>
        )}
        {view === 'explore' && counted && (
          <button
            type="button"
            className="btn btn--quiet"
            onClick={props.onBack}
          >
            My result
          </button>
        )}
        <button
          type="button"
          className="btn btn--quiet"
          onClick={props.onStandings}
        >
          Standings
        </button>
      </div>

      <p className="result__next num">
        {streak > 1 && view === 'counted' ? `${streak}-day streak · ` : ''}
        {open
          ? `Next board in ${duration(msUntilNextDay(now))}`
          : 'This board is over'}
      </p>
    </section>
  );
}

mount(<Game />);
