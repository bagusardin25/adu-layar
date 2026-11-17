// The kite contest sheet: the kite Raja Langit flies today, the kites entered for tomorrow
// with their upvotes on Reddit, and the way to enter your own. Voting itself happens on
// Reddit: each kite opens its comment, where it can be upvoted.

import { navigateTo } from '@devvit/web/client';
import { useEffect, useRef, useState } from 'react';
import type { ContestView } from '../shared/contest.ts';
import { lookOf } from './arena/design.ts';
import type { Look } from './arena/design.ts';
import { KiteThumb } from './kite-art.tsx';

export function ContestSheet({
  view,
  load,
  onEnter,
  myLook,
  onDone,
}: {
  view: ContestView | null;
  load: () => Promise<void>;
  onEnter: () => Promise<void>;
  /** The player's kite as it is saved now: the one that would be entered. */
  myLook: Look;
  onDone: () => void;
}) {
  const done = useRef<HTMLButtonElement>(null);
  const finish = useRef(onDone);
  useEffect(() => {
    finish.current = onDone;
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Focus lands on Done when the sheet opens, Escape closes it, and the upvotes are read fresh.
  useEffect(() => {
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish.current();
    };
    window.addEventListener('keydown', onKey);
    load().catch((error: unknown) =>
      setProblem(
        error instanceof Error ? error.message : 'The contest could not load.'
      )
    );
    return () => window.removeEventListener('keydown', onKey);
  }, [load]);

  const enter = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await onEnter();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const mine = view?.entries.find((e) => e.mine);

  return (
    <div className="overlay overlay--workshop">
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contest-title"
      >
        <header className="sheet__head">
          <h2 id="contest-title" className="sheet__title">
            Raja’s kite
          </h2>
          <button
            ref={done}
            type="button"
            className="btn btn--primary sheet__done"
            onClick={onDone}
          >
            Done
          </button>
        </header>

        <p className="sheet__lead">
          The kampung chooses the kite Raja Langit flies. Enter your kite in
          today’s thread: the one with the most upvotes when the day ends flies
          as Raja Langit’s kite tomorrow.
        </p>

        {view?.flying ? (
          <p className="contest-flying">
            <KiteThumb look={lookOf(view.flying.design)} size={34} />
            <span>
              <strong>Flying today: u/{view.flying.by}’s kite</strong>
              <span>
                {view.flying.votes}{' '}
                {view.flying.votes === 1 ? 'upvote' : 'upvotes'} yesterday
              </span>
            </span>
          </p>
        ) : (
          view && (
            <p className="sheet__note">
              Today Raja Langit flies its own colours. Tomorrow it flies yours,
              if the kampung votes for it.
            </p>
          )
        )}

        <div className="contest-enter">
          {!view ? (
            <p className="sheet__note">Reading today’s kites…</p>
          ) : view.guest ? (
            <p className="sheet__note">Log in to Reddit to enter your kite.</p>
          ) : view.entered ? (
            <>
              <p className="contest-enter__done">
                Your kite is in today’s contest.
              </p>
              {mine?.link && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => mine.link && navigateTo(mine.link)}
                >
                  See it in the thread
                </button>
              )}
            </>
          ) : view.canEnter ? (
            <>
              <p className="contest-enter__preview">
                <KiteThumb look={myLook} size={40} mine />
                <span>
                  This posts your kite as a comment from{' '}
                  <strong>u/{view.name}</strong> in today’s thread, where anyone
                  can see and upvote it. To enter a different kite, change it in
                  Customize first.
                </span>
              </p>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void enter()}
              >
                Enter my kite
              </button>
            </>
          ) : (
            <p className="sheet__note">
              Open today’s post on Reddit to enter your kite.
            </p>
          )}
        </div>

        {view && (
          <div className="contest-list">
            <p className="contest-list__head">
              Today’s kites · {view.entries.length}
            </p>
            {view.entries.length === 0 ? (
              <p className="sheet__note">
                No kites yet today. Yours could be the first.
              </p>
            ) : (
              <ol className="contest-kites">
                {view.entries.map((e, i) => (
                  <li key={`${e.by}-${i}`}>
                    <button
                      type="button"
                      className="contest-kite"
                      data-mine={e.mine || undefined}
                      disabled={!e.link}
                      aria-label={`u/${e.by}’s kite, ${e.votes} ${e.votes === 1 ? 'upvote' : 'upvotes'}. Opens its comment, where you can upvote it.`}
                      onClick={() => e.link && navigateTo(e.link)}
                    >
                      <span className="contest-kite__rank">{i + 1}</span>
                      <KiteThumb look={lookOf(e.design)} size={34} />
                      <span className="contest-kite__by">
                        u/{e.by}
                        {e.mine ? ' · you' : ''}
                      </span>
                      <span className="contest-kite__votes">▲ {e.votes}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {view.entries.length > 0 && (
              <p className="sheet__note">
                Voting happens on Reddit: tap a kite to open its comment and
                upvote it there.
              </p>
            )}
          </div>
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
