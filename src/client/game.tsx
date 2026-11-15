import './styles/theme.css';
import './styles/base.css';
import './styles/game.css';

import { useMemo, useState } from 'react';
import { dayLabel, dayNumber } from '../shared/days.ts';
import { keepOwned, nameOf } from '../shared/kite.ts';
import type { Profile } from '../shared/kite.ts';
import type { Taps } from '../shared/sim/match.ts';
import { skyForDay } from '../shared/sim/sky.ts';
import {
  PLAYER_ID,
  POINTS,
  ROUND_TICKS,
  TICKS_PER_SECOND,
} from '../shared/sim/types.ts';
import type { Match, Sky } from '../shared/sim/types.ts';
import { Arena } from './arena/Arena.tsx';
import { lookOf, rivalLook } from './arena/design.ts';
import { loadMood, MOODS, saveMood } from './arena/mood.ts';
import type { Mood } from './arena/mood.ts';
import { Coin, Wordmark } from './bits.tsx';
import { KiteThumb } from './kite-art.tsx';
import { STYLE_NOTE, windLabel } from './lib/labels.ts';
import { mount } from './lib/mount.tsx';
import { loggedIn, useProfile } from './lib/profile.ts';
import { useWallet } from './lib/wallet.ts';
import type { RoundAnswer, WalletView } from './lib/wallet.ts';
import { Workshop } from './workshop.tsx';

type Phase =
  | { name: 'ready' }
  | { name: 'flying' }
  /**
   * The player's kite is down but the rivals fly on. `watching`: the player chose to watch
   * them. `nothingLeft`: their fight is over too.
   */
  | {
      name: 'down';
      match: Match;
      taps: Taps;
      watching: boolean;
      nothingLeft: boolean;
    }
  | { name: 'over'; match: Match; taps: Taps };

export function Game() {
  const [day] = useState(() => dayNumber(Date.now()));
  const sky = useMemo(() => skyForDay(day), [day]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>({ name: 'ready' });
  const [best, setBest] = useState(0);
  const [mood, setMood] = useState<Mood>(loadMood);
  const pickMood = (next: Mood) => {
    setMood(next);
    saveMood(next);
  };
  const { profile, save } = useProfile();
  const { wallet, buy, submitRound } = useWallet();
  /** What the server said about the last round: its coins. Undefined while it is counting. */
  const [answer, setAnswer] = useState<RoundAnswer | null | undefined>(
    undefined
  );
  /** The kite being changed in the workshop, while it is open. */
  const [draft, setDraft] = useState<Profile | null>(null);
  const shown = draft ?? profile;
  const player = useMemo(
    () => ({ look: lookOf(shown.design), name: nameOf(shown.name) }),
    [shown]
  );
  const closeWorkshop = () => {
    // Anything only tried on goes back to what the player had.
    if (draft)
      save({
        ...draft,
        design: keepOwned(draft.design, profile.design, wallet?.owned ?? []),
      });
    setDraft(null);
  };

  const showResult = () =>
    setPhase((p) =>
      p.name === 'down' ? { name: 'over', match: p.match, taps: p.taps } : p
    );

  return (
    <main className="game" data-phase={phase.name}>
      <Arena
        key={round}
        sky={sky}
        mode="play"
        mood={mood}
        player={player}
        locked={draft !== null}
        onStart={() => setPhase({ name: 'flying' })}
        onEnd={(match, taps) => {
          setBest((b) => Math.max(b, match.score));
          // The server replays the round from its taps and pays its coins.
          setAnswer(undefined);
          submitRound(day, taps)
            .then(setAnswer)
            .catch(() => setAnswer(null));
          const down = match.reason === 'cut' || match.reason === 'crashed';
          setPhase(
            down
              ? {
                  name: 'down',
                  match,
                  taps,
                  watching: false,
                  nothingLeft: false,
                }
              : { name: 'over', match, taps }
          );
        }}
        onWatchEnd={() =>
          setPhase((p) => {
            if (p.name !== 'down') return p;
            // Someone watching is taken to the result; someone still choosing is left to choose.
            return p.watching
              ? { name: 'over', match: p.match, taps: p.taps }
              : { ...p, nothingLeft: true };
          })
        }
      />
      {phase.name === 'ready' && draft === null && (
        <Ready
          sky={sky}
          day={day}
          first={round === 0}
          mood={mood}
          onMood={pickMood}
          profile={profile}
          wallet={wallet}
          onCustomize={() => setDraft(profile)}
        />
      )}
      {phase.name === 'flying' && (
        <p className="hint">Hold to pull · Let go to turn</p>
      )}
      {phase.name === 'down' && (
        <Down
          match={phase.match}
          watching={phase.watching}
          nothingLeft={phase.nothingLeft}
          onWatch={() =>
            setPhase((p) => (p.name === 'down' ? { ...p, watching: true } : p))
          }
          onResult={showResult}
        />
      )}
      {draft !== null && (
        <Workshop
          profile={draft}
          wallet={wallet}
          canKeep={loggedIn()}
          onChange={setDraft}
          onBuy={buy}
          onDone={closeWorkshop}
        />
      )}
      {phase.name === 'over' && (
        <Result
          match={phase.match}
          best={best}
          answer={answer}
          guest={!loggedIn()}
          onAgain={() => {
            setRound((r) => r + 1);
            setPhase({ name: 'ready' });
          }}
        />
      )}
    </main>
  );
}

function Ready({
  sky,
  day,
  first,
  mood,
  onMood,
  profile,
  wallet,
  onCustomize,
}: {
  sky: Sky;
  day: number;
  first: boolean;
  mood: Mood;
  onMood: (mood: Mood) => void;
  profile: Profile;
  wallet: WalletView | null;
  onCustomize: () => void;
}) {
  return (
    <div className="overlay overlay--ready">
      <div className="ready__head">
        <Wordmark />
        <p className="ready__day">
          Day {day} · {dayLabel(day)} · {windLabel(sky.windX)}
        </p>
        <div className="me">
          <KiteThumb look={lookOf(profile.design)} size={34} mine />
          <p className="me__who">
            <span>You</span>
            <strong>{nameOf(profile.name)}</strong>
          </p>
          <button type="button" className="btn me__edit" onClick={onCustomize}>
            Customize
          </button>
        </div>
        {wallet && (
          <p className="purse">
            {wallet.guest ? (
              'Log in to Reddit to earn coins.'
            ) : (
              <>
                <span className="coins">
                  <Coin size={15} />
                  {wallet.coins}
                </span>
                {wallet.spoolsLeft > 0
                  ? `${wallet.spoolsLeft} coin ${wallet.spoolsLeft === 1 ? 'flight' : 'flights'} left today`
                  : 'Coin flights used up today. Practice on!'}
              </>
            )}
          </p>
        )}
        <ul className="rivals" aria-label="Today's rivals">
          {sky.rivals.map((r) => (
            <li key={r.name} className="rival">
              <KiteThumb look={rivalLook(r)} size={26} />
              <p>
                <strong>{r.name}</strong> <span>{STYLE_NOTE[r.style]}</span>
              </p>
            </li>
          ))}
        </ul>
        <div className="sky-pick" role="group" aria-label="Time of day">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className="sky-pick__btn"
              aria-pressed={m.id === mood}
              onClick={() => onMood(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="how">
        {first && (
          <>
            <p className="how__keys">
              <span>
                <b>Hold</b> to pull
              </span>
              <span>
                <b>Let go</b> to turn
              </span>
            </p>
            <p>
              Pulled, your kite darts where its nose points. Slack, it spins.
              Where strings cross, the faster one saws the slower: cross theirs
              while you pull. A frayed string never mends.
            </p>
          </>
        )}
        <p className="how__go">Press and hold to launch</p>
      </div>
    </div>
  );
}

const TITLES: Record<NonNullable<Match['reason']>, [string, string]> = {
  cut: ['Layangan putus!', 'Your string was cut.'],
  crashed: ['Nyangkut!', 'Your kite caught on the roofs.'],
  time: ['Still flying!', 'You lasted the whole round.'],
  cleared: ['Langit bersih!', 'You cleared the sky.'],
};

/** Who cut the player's string, if anyone did. */
function killerOf(match: Match): string | null {
  const cut = match.events.find(
    (e) => e.type === 'cut' && e.victim === PLAYER_ID
  );
  return cut && cut.type === 'cut' ? (match.kites[cut.by]?.name ?? null) : null;
}

/**
 * The player's kite is down, but the sky is not empty: stay and watch the rivals fight it out,
 * or go to the result. Small and low on the screen, so the sky stays in view.
 */
function Down({
  match,
  watching,
  nothingLeft,
  onWatch,
  onResult,
}: {
  match: Match;
  watching: boolean;
  nothingLeft: boolean;
  onWatch: () => void;
  onResult: () => void;
}) {
  const [title, sub] = TITLES[match.reason ?? 'cut'];
  const killer = killerOf(match);

  if (watching) {
    return (
      <div className="overlay overlay--down">
        <p className="watching">
          Watching the others
          <button type="button" className="btn btn--primary" onClick={onResult}>
            See result
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="overlay overlay--down">
      <section className="down" aria-live="polite">
        <h1 className="down__title">{title}</h1>
        <p className="down__sub">
          {killer ? `Cut by ${killer}.` : sub}{' '}
          {nothingLeft ? 'The sky has gone quiet.' : 'The others fly on.'}
        </p>
        <div className="down__actions">
          {!nothingLeft && (
            <button type="button" className="btn" onClick={onWatch}>
              Watch the others
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={onResult}>
            See result
          </button>
        </div>
      </section>
    </div>
  );
}

/** The coins a round earned, as the server counted them. */
function Earned({
  answer,
  guest,
}: {
  answer: RoundAnswer | null | undefined;
  guest: boolean;
}) {
  if (guest)
    return <p className="earned__note">Log in to Reddit to earn coins.</p>;
  if (answer === undefined)
    return <p className="earned__note">Counting your coins…</p>;
  if (answer === null)
    return (
      <p className="earned__note">
        Coins could not be counted right now. Your round still stands.
      </p>
    );
  if (!answer.counted)
    return (
      <p className="earned__note">
        Practice flight: coins come from your first 3 flights each day.
      </p>
    );
  if (answer.coins.earned === 0)
    return (
      <p className="earned__note">
        No coins this flight. Cut a kite or last the round to earn some.
      </p>
    );
  return (
    <div className="earned">
      <p className="earned__total">
        <Coin size={18} />+{answer.coins.earned} coins
      </p>
      {answer.coins.lines.length > 0 && (
        <p className="earned__lines">
          {answer.coins.lines.map((l) => `${l.label} +${l.coins}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

function Result({
  match,
  best,
  answer,
  guest,
  onAgain,
}: {
  match: Match;
  best: number;
  answer: RoundAnswer | null | undefined;
  guest: boolean;
  onAgain: () => void;
}) {
  const reason = match.reason ?? 'time';
  const [title, sub] = TITLES[reason];
  const cut = match.events.filter(
    (e) => e.type === 'cut' && e.by === PLAYER_ID
  );
  const end = match.events.find((e) => e.type === 'end');
  const killerName = killerOf(match);
  const seconds = Math.round(match.tick / TICKS_PER_SECOND);
  const secondsLeft = Math.floor((ROUND_TICKS - match.tick) / TICKS_PER_SECOND);

  return (
    <div className="overlay overlay--over">
      <section className="result" aria-live="polite">
        <h1 className="result__title">{title}</h1>
        <p className="result__sub">
          {killerName ? `Cut by ${killerName}.` : sub}
        </p>
        <p className="result__score">{match.score}</p>

        <ul className="lines">
          <li>
            <span>Kites cut: {cut.length}</span>
            <span>+{cut.length * POINTS.cut}</span>
          </li>
          {reason === 'time' && (
            <li>
              <span>Lasted {seconds} s</span>
              <span>+{POINTS.survive}</span>
            </li>
          )}
          {reason === 'cleared' && end?.type === 'end' && (
            <li>
              <span>Cleared with {secondsLeft} s left</span>
              <span>+{end.points}</span>
            </li>
          )}
          {(reason === 'cut' || reason === 'crashed') && (
            <li>
              <span>Lasted {seconds} s</span>
              <span>+0</span>
            </li>
          )}
        </ul>

        {cut.length > 0 && (
          <div className="trophies" aria-label="Kites you cut">
            {cut.map((e) => {
              const k = e.type === 'cut' ? match.kites[e.victim] : null;
              return k ? (
                <span key={k.id} className="trophy">
                  <KiteThumb look={rivalLook(k)} size={22} />
                  {k.name}
                </span>
              ) : null;
            })}
          </div>
        )}

        <Earned answer={answer} guest={guest} />

        <button type="button" className="btn btn--primary" onClick={onAgain}>
          Fly again
        </button>
        <p className="result__best">Best today: {best}</p>
      </section>
    </div>
  );
}

mount(<Game />);
