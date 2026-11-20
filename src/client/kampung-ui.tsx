// The kampungs on screen: the day's points as a row of three, and the sheet where a player
// picks the kampung they fly for and, if they want, wears it as their flair.

import { context } from '@devvit/web/client';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { KAMPUNGS, kampungOf } from '../shared/kampung.ts';
import type { KampungBoard, KampungId } from '../shared/kampung.ts';
import type { KampungView } from './lib/kampung.ts';

const tint = (id: KampungId) =>
  ({ '--kampung': kampungOf(id).colour }) as CSSProperties;

/** The three kampungs and their points today, the player's own marked. */
export function KampungBar({
  board,
  mine,
}: {
  board: KampungBoard;
  mine: KampungId | null;
}) {
  const leader = board.today[0];
  const leading = leader && leader.points > 0 ? leader.id : null;
  return (
    <ol className="kampung-bar" aria-label="Kampung points today">
      {board.today.map((k) => (
        <li
          key={k.id}
          className="kampung-bar__item"
          style={tint(k.id)}
          data-mine={k.id === mine || undefined}
          data-lead={k.id === leading || undefined}
        >
          <span className="kampung-dot" aria-hidden="true" />
          <span className="kampung-bar__name">{kampungOf(k.id).short}</span>
          <span className="kampung-bar__points">{k.points}</span>
        </li>
      ))}
    </ol>
  );
}

export function KampungSheet({
  view,
  onJoin,
  onFlair,
  onDone,
}: {
  view: KampungView;
  onJoin: (kampung: KampungId) => Promise<void>;
  onFlair: () => Promise<void>;
  onDone: () => void;
}) {
  const done = useRef<HTMLButtonElement>(null);
  const finish = useRef(onDone);
  useEffect(() => {
    finish.current = onDone;
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Focus lands on Done when the sheet opens, and Escape closes it.
  useEffect(() => {
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await work();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const points = Object.fromEntries(
    view.board.today.map((k) => [k.id, k.points])
  ) as Record<KampungId, number>;
  const mine = view.kampung ? kampungOf(view.kampung) : null;
  const who = view.name ? `u/${view.name}` : 'you';

  return (
    <div className="overlay overlay--workshop">
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kampung-title"
      >
        <header className="sheet__head">
          <h2 id="kampung-title" className="sheet__title">
            Your kampung
          </h2>
          <button
            ref={done}
            type="button"
            className="btn sheet__done"
            onClick={onDone}
          >
            Done
          </button>
        </header>

        <p className="sheet__lead">
          Every scored flight adds its points to your kampung. The kampung with
          the most points wins the day.
        </p>

        {view.guest ? (
          <p className="sheet__note">Log in to Reddit to fly for a kampung.</p>
        ) : (
          <div className="kampung-picks" role="group" aria-label="Kampungs">
            {KAMPUNGS.map((k) => (
              <button
                key={k.id}
                type="button"
                className="kampung-pick"
                style={tint(k.id)}
                aria-pressed={k.id === view.kampung}
                aria-label={`${k.label}, ${k.gloss}, ${points[k.id] ?? 0} points today`}
                disabled={busy}
                onClick={() => void act(() => onJoin(k.id))}
              >
                <span className="kampung-dot" aria-hidden="true" />
                <span className="kampung-pick__name">
                  <strong>{k.label}</strong>
                  <span>{k.gloss}</span>
                </span>
                <span className="kampung-pick__points">
                  {points[k.id] ?? 0}
                  <small>today</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {mine && (
          <p className="sheet__note">
            You fly for {mine.label}. If you move later, the points you already
            earned stay behind.
          </p>
        )}

        {mine && !view.canFlair && (
          <p className="sheet__note">
            On Reddit you can also wear it as your user flair.
          </p>
        )}

        {mine && view.canFlair && view.flair !== view.kampung && (
          <div className="flair-offer">
            <p className="flair-offer__preview">
              <span>{who}</span>
              <span className="flair-chip" style={tint(mine.id)}>
                {mine.label}
              </span>
            </p>
            <p className="sheet__note">
              Wear it as your user flair in r/{context.subredditName}. Everyone
              sees it next to your name there. You can change it in the
              subreddit any time.
            </p>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void act(onFlair)}
            >
              Wear as my flair
            </button>
          </div>
        )}

        {mine && view.flair === view.kampung && (
          <p className="sheet__note">You wear {mine.label} as your flair.</p>
        )}

        {problem && (
          <p className="sheet__problem" role="alert">
            {problem}
          </p>
        )}
      </section>
    </div>
  );
}
