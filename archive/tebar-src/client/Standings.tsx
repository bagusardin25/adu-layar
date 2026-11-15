import { useEffect, useRef, useState } from 'react';
import type { BoardStats, StandingsResponse } from '../shared/api.ts';
import { ApiError, getStandings } from './lib/api.ts';

type Loaded =
  | { status: 'loading' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; data: StandingsResponse };

/** How everyone did: the day's scores, who found the best line, and the week's stars. */
export function Standings(props: {
  day: number;
  perfect: number;
  stats: BoardStats;
  /** This player's counted score, when they have one on this board. */
  mine: number | undefined;
  onClose: () => void;
}) {
  const { day, perfect, stats, mine, onClose } = props;
  const [state, setState] = useState<Loaded>({ status: 'loading' });
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let current = true;
    getStandings(day).then(
      (data) => current && setState({ status: 'ready', data }),
      (error: unknown) =>
        current &&
        setState({
          status: 'failed',
          message:
            error instanceof ApiError
              ? error.message
              : 'The standings could not be loaded.',
        })
    );
    return () => {
      current = false;
    };
  }, [day]);

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="standings-title"
    >
      <header className="sheet__head">
        <h1 id="standings-title">Standings</h1>
        <button
          ref={close}
          type="button"
          className="btn btn--quiet sheet__close"
          onClick={onClose}
        >
          Close
        </button>
      </header>

      <div className="sheet__body">
        <section className="panel">
          <h2 className="panel__title">Scores on day {day}</h2>
          {stats.players === 0 ? (
            <p className="panel__empty">Nobody has finished this board yet.</p>
          ) : (
            <ScoreChart stats={stats} perfect={perfect} mine={mine} />
          )}
        </section>

        {state.status === 'loading' && <p className="panel__empty">Loading…</p>}
        {state.status === 'failed' && (
          <p className="panel__empty" role="alert">
            {state.message}
          </p>
        )}
        {state.status === 'ready' && (
          <>
            <section className="panel">
              <h2 className="panel__title">
                Found the best line{' '}
                <span className="panel__count num">
                  {state.data.perfectClub.count}
                </span>
              </h2>
              {state.data.perfectClub.count === 0 ? (
                <p className="panel__empty">Nobody yet. It is out there.</p>
              ) : (
                <p className="names">
                  {state.data.perfectClub.names.join(', ')}
                  {state.data.perfectClub.count >
                    state.data.perfectClub.names.length &&
                    ` and ${state.data.perfectClub.count - state.data.perfectClub.names.length} more`}
                </p>
              )}
            </section>

            <section className="panel">
              <h2 className="panel__title">This week’s stars</h2>
              {state.data.week.entries.length === 0 ? (
                <p className="panel__empty">
                  The week starts with the first finished board.
                </p>
              ) : (
                <ol className="ranks">
                  {state.data.week.entries.slice(0, 10).map((e, i) => (
                    <li key={`${e.name}-${i}`} className="ranks__row">
                      <span className="ranks__rank num">{e.rank}</span>
                      <span className="ranks__name">{e.name}</span>
                      <span className="ranks__stars num">{e.stars}</span>
                    </li>
                  ))}
                </ol>
              )}
              {state.data.week.me && (
                <p className="panel__me num">
                  You: rank {state.data.week.me.rank} with{' '}
                  {state.data.week.me.stars}{' '}
                  {state.data.week.me.stars === 1 ? 'star' : 'stars'}
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One column per score, from the lowest anyone got up to the best possible. One series, so no
 * legend: the player's own column is the accent, everyone else's is quiet, and the readout
 * under the title says in words what the touched column shows.
 */
function ScoreChart({
  stats,
  perfect,
  mine,
}: {
  stats: BoardStats;
  perfect: number;
  mine: number | undefined;
}) {
  const scores = Object.keys(stats.histogram).map(Number);
  const lowest = Math.min(...scores, mine ?? perfect);
  const columns = [];
  for (let score = lowest; score <= perfect; score++) {
    columns.push({ score, players: stats.histogram[String(score)] ?? 0 });
  }
  const tallest = Math.max(1, ...columns.map((c) => c.players));
  const [touched, setTouched] = useState<number | undefined>();
  const shown =
    columns.find((c) => c.score === (touched ?? mine)) ??
    columns[columns.length - 1];
  const people = (n: number): string =>
    `${n} ${n === 1 ? 'player' : 'players'}`;

  return (
    <figure className="chart">
      <figcaption className="chart__readout num" aria-live="polite">
        <strong>{people(shown.players)}</strong> brought home {shown.score}
        {shown.score === perfect ? ', the best' : ''}
        {shown.score === mine ? ' (you)' : ''}
      </figcaption>

      <div className="chart__plot" onPointerLeave={() => setTouched(undefined)}>
        {columns.map((c) => (
          <button
            key={c.score}
            type="button"
            className={`chart__slot${c.score === mine ? ' chart__slot--mine' : ''}`}
            aria-label={`Score ${c.score}: ${people(c.players)}${c.score === mine ? ', your score' : ''}`}
            onPointerEnter={() => setTouched(c.score)}
            onFocus={() => setTouched(c.score)}
            onBlur={() => setTouched(undefined)}
            onClick={() => setTouched(c.score)}
          >
            <span
              className="chart__bar"
              style={{
                height:
                  c.players === 0
                    ? 0
                    : `max(3px, ${(c.players / tallest) * 100}%)`,
              }}
            />
          </button>
        ))}
      </div>

      <div className="chart__axis num" aria-hidden="true">
        <span>{lowest}</span>
        <span>seeds brought home</span>
        <span>{perfect}</span>
      </div>

      <table className="sr-only">
        <caption>Players per score on this board</caption>
        <thead>
          <tr>
            <th scope="col">Score</th>
            <th scope="col">Players</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.score}>
              <td>{c.score}</td>
              <td>{c.players}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
