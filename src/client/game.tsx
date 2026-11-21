import './styles/theme.css';
import './styles/base.css';
import './styles/game.css';

import { navigateTo } from '@devvit/web/client';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { dayLabel, dayNumber } from '../shared/days.ts';
import { keepOwned, nameOf } from '../shared/kite.ts';
import type { Profile } from '../shared/kite.ts';
import { lessonSky } from '../shared/sim/lesson.ts';
import type { Taps } from '../shared/sim/match.ts';
import {
  PLAYER_ID,
  POINTS,
  ROUND_TICKS,
  TICKS_PER_SECOND,
} from '../shared/sim/types.ts';
import type { Match, Sky } from '../shared/sim/types.ts';
import { Arena } from './arena/Arena.tsx';
import { ghostLook, lookOf, rivalLook, skyLook } from './arena/design.ts';
import { loadMood, MOODS, saveMood } from './arena/mood.ts';
import type { Mood } from './arena/mood.ts';
import { Coin, Wordmark } from './bits.tsx';
import { KiteThumb } from './kite-art.tsx';
import type { FightView } from './lib/fight.ts';
import {
  noteEnd,
  noteLesson,
  noteReady,
  noteShare,
  noteStart,
} from './lib/journey.ts';
import { STYLE_NOTE, windLabel } from './lib/labels.ts';
import { mount } from './lib/mount.tsx';
import { useReducedMotion } from './lib/prefs.ts';
import { useKampung } from './lib/kampung.ts';
import type { KampungView } from './lib/kampung.ts';
import { loggedIn, useProfile } from './lib/profile.ts';
import { reportProblem } from './lib/report.ts';
import { useWallet } from './lib/wallet.ts';
import type { RoundAnswer, ShareAnswer, WalletView } from './lib/wallet.ts';
import { ContestSheet } from './contest-ui.tsx';
import { KampungBar, KampungSheet } from './kampung-ui.tsx';
import { useContest } from './lib/contest.ts';
import { Workshop } from './workshop.tsx';
import { kampungNews, kampungOf } from '../shared/kampung.ts';

const LESSON_KEY = 'adu-layangan:lesson';

function lessonDone(): boolean {
  try {
    return window.localStorage.getItem(LESSON_KEY) === '1';
  } catch {
    return false;
  }
}

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
  const practice = useMemo(() => lessonSky(), []);
  /** True once the practice flight has been finished or skipped. */
  const [taught, setTaught] = useState(lessonDone);
  const [fight, setFight] = useState<FightView | null>(null);
  const sky = fight?.sky ?? null;
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>({ name: 'ready' });
  const [best, setBest] = useState(0);
  const [mood, setMood] = useState<Mood>(loadMood);
  const pickMood = (next: Mood) => {
    setMood(next);
    saveMood(next);
  };
  const { profile, save } = useProfile();
  const { wallet, buy, submitRound, share } = useWallet();
  const kampung = useKampung();
  /** The kampung sheet is open. */
  const [picking, setPicking] = useState(false);
  const contest = useContest();
  /** The kite contest sheet is open. */
  const [contesting, setContesting] = useState(false);
  useEffect(() => {
    noteReady();
    let current = true;
    fetch('/api/fight')
      .then((res) => (res.ok ? (res.json() as Promise<FightView>) : null))
      .then((view) => {
        if (current && view) setFight(view);
      })
      .catch(() => {
        // The ready screen stays until the sky arrives.
      });
    return () => {
      current = false;
    };
  }, []);
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

  const finishLesson = () => {
    try {
      window.localStorage.setItem(LESSON_KEY, '1');
    } catch {
      // The lesson can be shown again next visit.
    }
    setTaught(true);
    setPhase({ name: 'ready' });
  };

  const showResult = () =>
    setPhase((p) =>
      p.name === 'down' ? { name: 'over', match: p.match, taps: p.taps } : p
    );

  const playing = taught ? sky : practice;

  return (
    <main className="game" data-phase={phase.name}>
      {playing && (
        <Arena
          key={`${taught ? 'sky' : 'lesson'}-${round}`}
          sky={playing}
          mode="play"
          mood={mood}
          player={player}
          practice={!taught}
          locked={draft !== null || picking || contesting}
          onStart={() => {
            noteStart();
            if (!taught) noteLesson();
            setPhase({ name: 'flying' });
          }}
          onEnd={(match, taps) => {
            if (!taught) {
              finishLesson();
              return;
            }
            noteEnd(
              match.cuts > 0 ||
                match.reason === 'time' ||
                match.reason === 'cleared',
              match.score
            );
            setBest((b) => Math.max(b, match.score));
            // The server replays the round from its taps and pays its coins.
            setAnswer(undefined);
            submitRound(day, taps)
              .then((reply) => {
                setAnswer(reply);
                kampung.setBoard(reply.kampungs);
              })
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
      )}
      {taught &&
        phase.name === 'ready' &&
        draft === null &&
        !picking &&
        !contesting &&
        sky && (
          <Ready
            sky={sky}
            day={day}
            king={fight?.king ?? null}
            fliers={fight?.fliers ?? 0}
            first={round === 0}
            mood={mood}
            onMood={pickMood}
            profile={profile}
            wallet={wallet}
            onCustomize={() => setDraft(profile)}
            kampung={kampung.view}
            onPickKampung={() => setPicking(true)}
            onContest={() => setContesting(true)}
            oldPost={
              fight?.todayPost &&
              fight.viewing !== null &&
              fight.viewing < fight.day
                ? {
                    day: fight.viewing,
                    today: fight.day,
                    link: fight.todayPost,
                  }
                : null
            }
          />
        )}
      {taught && phase.name === 'ready' && !sky && (
        <p className="hint">Raising today’s sky…</p>
      )}
      {!taught && draft === null && (
        <Coach flying={phase.name === 'flying'} onSkip={finishLesson} />
      )}
      {taught && phase.name === 'flying' && (
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
      {contesting && (
        <ContestSheet
          view={contest.view}
          load={contest.load}
          onEnter={contest.enter}
          myLook={lookOf(profile.design)}
          onDone={() => setContesting(false)}
        />
      )}
      {picking && (
        <KampungSheet
          view={kampung.view}
          onJoin={kampung.join}
          onFlair={kampung.wearFlair}
          onDone={() => setPicking(false)}
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
          day={day}
          match={phase.match}
          best={best}
          answer={answer}
          guest={!loggedIn()}
          share={share}
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
  king,
  fliers,
  first,
  mood,
  onMood,
  profile,
  wallet,
  onCustomize,
  kampung,
  onPickKampung,
  onContest,
  oldPost,
}: {
  sky: Sky;
  day: number;
  king: { name: string; score: number; seed: boolean } | null;
  fliers: number;
  first: boolean;
  mood: Mood;
  onMood: (mood: Mood) => void;
  profile: Profile;
  wallet: WalletView | null;
  onCustomize: () => void;
  kampung: KampungView;
  onPickKampung: () => void;
  onContest: () => void;
  /** Open in an older day's post: that day, today, and a link to today's post. */
  oldPost: { day: number; today: number; link: string } | null;
}) {
  const mine = kampung.kampung ? kampungOf(kampung.kampung) : null;
  return (
    <div className="overlay overlay--ready">
      <div className="ready__head">
        <Wordmark />
        <p className="ready__day">
          Day {day} · {dayLabel(day)} · {windLabel(sky.windX)}
        </p>
        {oldPost && (
          <button
            type="button"
            className="old-post"
            onClick={() => navigateTo(oldPost.link)}
          >
            This is Day {oldPost.day}’s post. Today’s sky is in Day{' '}
            {oldPost.today}’s post ›
          </button>
        )}
        {/* One sheet of kite paper: you, your kampung, and who is in today's sky. */}
        <div className="paper ready__card">
          <div className="me">
            <KiteThumb look={lookOf(profile.design)} size={34} mine />
            <p className="me__who">
              <span>{mine ? `Flying for ${mine.short}` : 'Your kite'}</span>
              <strong>{nameOf(profile.name)}</strong>
            </p>
            <button
              type="button"
              className="btn me__edit"
              onClick={onCustomize}
            >
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
                    ? `${wallet.spoolsLeft} of 3 scored flights left. Your best is kept.`
                    : 'Scored flights used up. Practice on — it won’t change today’s rank.'}
                </>
              )}
            </p>
          )}
          <Kampungs view={kampung} fliers={fliers} onPick={onPickKampung} />
          <Rivals sky={sky} king={king} onContest={onContest} />
        </div>
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
        <Report day={day} />
      </div>

      <div className="how">
        {first && (
          <p className="how__keys">
            <span>
              <b>Hold</b> = Dart
            </span>
            <span>
              <b>Release</b> = Steer
            </span>
          </p>
        )}
        <p className="how__go">Press and hold to launch</p>
      </div>
    </div>
  );
}

/** The day's kampung points on the ready screen, and the way to pick or change kampung. */
function Kampungs({
  view,
  fliers,
  onPick,
}: {
  view: KampungView;
  fliers: number;
  onPick: () => void;
}) {
  return (
    <section className="kampungs" aria-label="Kampungs today">
      <p className="kampungs__head">
        <span>{kampungNews(view.board) ?? 'Kampungs today'}</span>
        <span>
          {fliers === 0
            ? 'Be the first to fly'
            : `${fliers} ${fliers === 1 ? 'flyer' : 'flyers'}`}
        </span>
      </p>
      <KampungBar board={view.board} mine={view.kampung} />
      {!view.guest && (
        <button
          type="button"
          className={
            view.kampung
              ? 'btn btn--quiet kampungs__pick'
              : 'btn kampungs__pick kampungs__pick--first'
          }
          onClick={onPick}
        >
          {view.kampung ? 'Change kampung' : 'Fly for a kampung'}
        </button>
      )}
    </section>
  );
}

/** Raja Langit up front; the rest of the sky folded into one line until opened. */
function Rivals({
  sky,
  king,
  onContest,
}: {
  sky: Sky;
  king: { name: string; score: number; seed: boolean } | null;
  /** Opens the contest that chooses the kite Raja Langit flies. */
  onContest: () => void;
}) {
  const ghosts = sky.ghosts ?? [];
  const raja = ghosts.find((g) => g.kind === 'king');
  const others = [
    ...ghosts
      .filter((g) => g.kind !== 'king')
      .map((g) => ({
        key: g.id,
        look: ghostLook(g),
        name: g.name,
        note: 'A recorded flight',
      })),
    ...sky.rivals.map((r) => ({
      key: r.name,
      look: rivalLook(r),
      name: r.name,
      note: STYLE_NOTE[r.style],
    })),
  ];
  return (
    <div className="rivals">
      {raja && (
        <button type="button" className="rival rival--king" onClick={onContest}>
          <KiteThumb look={ghostLook(raja)} size={26} />
          <span>
            <strong className="rival__name">Raja Langit {raja.name}</strong>
            <span className="rival__about">
              {king?.seed ? 'Kampung champion' : 'Yesterday’s best'},{' '}
              {raja.score}. Cut for 300.
            </span>
            <span className="rival__contest">
              {raja.chosen
                ? `u/${raja.chosen.by}’s kite, voted in ›`
                : 'Vote for tomorrow’s kite ›'}
            </span>
          </span>
        </button>
      )}
      {others.length > 0 && (
        <details className="rivals__more">
          <summary>
            <span className="rivals__thumbs" aria-hidden="true">
              {others.map((o) => (
                <KiteThumb key={o.key} look={o.look} size={18} />
              ))}
            </span>
            {others.length} more in the sky
          </summary>
          <ul>
            {others.map((o) => (
              <li key={o.key} className="rival">
                <KiteThumb look={o.look} size={26} />
                <p>
                  <strong>{o.name}</strong> <span>{o.note}</span>
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const TITLES: Record<NonNullable<Match['reason']>, [string, string]> = {
  cut: ['Layangan putus bro!', 'Your string was cut.'],
  crashed: ['Nyangkut mas bro!', 'Your kite caught on the roofs.'],
  time: ['Still flying!', 'You lasted the whole round.'],
  cleared: ['Langit bersih GG!', 'You cleared the sky.'],
};

/** The kite that cut the player's string, if one did. */
function killerOf(match: Match): Match['kites'][number] | null {
  const cut = match.events.find(
    (e) => e.type === 'cut' && e.victim === PLAYER_ID
  );
  return cut && cut.type === 'cut' ? (match.kites[cut.by] ?? null) : null;
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
  const killer = killerOf(match)?.name ?? null;

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
    return (
      <p className="earned__note">
        Log in to Reddit to earn coins and share your flight.
      </p>
    );
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
    <p className="earned__total">
      <Coin size={18} />+{answer.coins.earned} coins
    </p>
  );
}

/** Where a scored flight's points went: the player's kampung, and how the day stands. */
function KampungLine({
  answer,
  guest,
}: {
  answer: RoundAnswer | null | undefined;
  guest: boolean;
}) {
  if (!answer || guest || !answer.counted) return null;
  if (!answer.kampung)
    return (
      <p className="earned__note">
        Pick a kampung before your next flight, and its points count for your
        side.
      </p>
    );
  const place = kampungOf(answer.kampung);
  const [top, next] = answer.kampungs.today;
  const leading =
    top?.id === answer.kampung &&
    top.points > 0 &&
    (next?.points ?? 0) < top.points;
  const news = leading ? 'in the lead today' : kampungNews(answer.kampungs);
  const gain =
    answer.score > 0
      ? `+${answer.score} for ${place.label}`
      : `No points for ${place.label} this time`;
  return (
    <p
      className="result__kampung"
      style={{ '--kampung': place.colour } as CSSProperties}
    >
      <span className="kampung-dot" aria-hidden="true" />
      <strong>{gain}</strong>
      {news && <span className="result__news">{news}</span>}
    </p>
  );
}

/** A number that runs up from zero to `to` when it first appears. */
function useCountUp(to: number, ms: number, still: boolean): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (still) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const f = Math.min(1, (t - start) / ms);
      setShown(Math.round(to * (1 - Math.pow(1 - f, 3))));
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, still]);
  return still ? to : shown;
}

const CONFETTI = [
  '#FFB347',
  '#FFE08A',
  '#E0402E',
  '#FFF6E8',
  '#3FB8A8',
  '#B58BE8',
];

/** Scraps of kite paper falling over the result card when the sky was cleared. */
function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          style={
            {
              left: `${(i * 37 + 11) % 100}%`,
              background: CONFETTI[i % CONFETTI.length],
              '--delay': `${((i * 53) % 90) * 10}ms`,
              '--fall': `${1700 + ((i * 71) % 12) * 100}ms`,
              '--drift': `${((i * 29) % 80) - 40}px`,
              '--spin': `${360 + ((i * 97) % 5) * 180}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** The first flight: one line of steering, the nose arrow, and a way to skip. */
function Coach({ flying, onSkip }: { flying: boolean; onSkip: () => void }) {
  return (
    <div className="coach">
      <p className="coach__keys">
        <span>Hold = Dart</span>
        <span>Release = Steer</span>
      </p>
      {!flying && (
        <p className="coach__note">
          The arrow shows where the nose points. Cut Si Latih, or skip. No
          clock, and this flight is not scored.
        </p>
      )}
      {!flying && <p className="coach__go">Press and hold to launch</p>}
      <button type="button" className="btn" onClick={onSkip}>
        Skip
      </button>
    </div>
  );
}

/** What the player reads beside the card before and after posting it. */
function shareNote(reply: ShareAnswer): string {
  if (reply.posted) return 'Posted under today’s thread.';
  if (reply.error) return reply.error;
  if (reply.canPost)
    return `This posts as a comment from u/${reply.as} under today’s thread. Anyone can see it.`;
  return 'Nothing is posted outside Reddit. Copy the card instead.';
}

/** A quiet way to reach the subreddit's moderators, on the ready screen and the result card. */
function Report({ day }: { day: number }) {
  return (
    <button
      type="button"
      className="btn btn--quiet report"
      onClick={() => reportProblem(day)}
    >
      Report a problem
    </button>
  );
}

function Result({
  day,
  match,
  best,
  answer,
  guest,
  share,
  onAgain,
}: {
  day: number;
  match: Match;
  best: number;
  answer: RoundAnswer | null | undefined;
  guest: boolean;
  share: (confirm: boolean) => Promise<ShareAnswer>;
  onAgain: () => void;
}) {
  const reason = match.reason ?? 'time';
  const [title, sub] = TITLES[reason];
  const cut = match.events.filter(
    (e) => e.type === 'cut' && e.by === PLAYER_ID
  );
  const end = match.events.find((e) => e.type === 'end');
  const killer = killerOf(match);
  const place = answer?.rank
    ? `Rank ${answer.rank} today`
    : answer?.counted === false
      ? 'Practice flight'
      : 'Scored flight';
  /** The rest of where the player stands, as one plain sentence. */
  const standing = [
    answer && answer.streak > 1 ? `${answer.streak}-day streak` : null,
    answer?.wallet
      ? answer.wallet.spoolsLeft > 0
        ? `${answer.wallet.spoolsLeft} of 3 scored flights left`
        : 'no scored flights left today'
      : null,
  ]
    .filter((s): s is string => s !== null)
    .join(', ');
  const seconds = Math.round(match.tick / TICKS_PER_SECOND);
  const secondsLeft = Math.floor((ROUND_TICKS - match.tick) / TICKS_PER_SECOND);
  const still = useReducedMotion();
  const score = useCountUp(match.score, 900, still);
  const [card, setCard] = useState<string | null>(null);
  /** The server's last word on sharing: whether it can be posted, and whether it was. */
  const [shared, setShared] = useState<ShareAnswer | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shownBest = answer?.best ?? best;

  const ask = async (confirm: boolean) => {
    setBusy(true);
    try {
      const reply = await share(confirm);
      setCard(reply.text);
      setShared(reply);
      if (confirm && reply.posted) noteShare();
      setNote(shareNote(reply));
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not share.');
    } finally {
      setBusy(false);
    }
  };

  const copyCard = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card);
      setNote('Copied. Paste it under today’s post.');
    } catch {
      setNote('Select the card and copy it.');
    }
  };

  return (
    <div className="overlay overlay--over">
      {reason === 'cleared' && !still && <Confetti />}
      <section className="result" data-reason={reason}>
        <h1 className="result__title">{title}</h1>
        {killer ? (
          <p className="result__sub result__by">
            <KiteThumb look={skyLook(killer, match.sky)} size={30} />
            <span>
              Cut by <strong>{killer.name}</strong>
            </span>
          </p>
        ) : (
          <p className="result__sub">{sub}</p>
        )}
        <p className="result__score" aria-label={String(match.score)}>
          {score}
        </p>
        <p className="result__place">
          <strong>{place}</strong>
          {standing && (
            <span>{standing.charAt(0).toUpperCase() + standing.slice(1)}</span>
          )}
        </p>

        <div className="result__gains">
          <KampungLine answer={answer} guest={guest} />
          <Earned answer={answer} guest={guest} />
        </div>

        <div className="result__actions">
          <button type="button" className="btn btn--primary" onClick={onAgain}>
            Fly again
          </button>
          {!guest && !card && (
            <button
              type="button"
              className="btn"
              disabled={answer == null || busy}
              onClick={() => void ask(false)}
            >
              Share
            </button>
          )}
        </div>

        {!guest && card && (
          <div className="share">
            <pre className="share__card">{card}</pre>
            {note && <p className="share__note">{note}</p>}
            <div className="share__actions">
              {shared?.canPost && !shared.posted && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() => void ask(true)}
                >
                  Post comment
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => void copyCard()}
              >
                Copy
              </button>
            </div>
          </div>
        )}
        {!guest && !card && note && <p className="share__note">{note}</p>}

        <details className="result__more">
          <summary>
            {answer && answer.standings.length > 0
              ? 'Flight details and today’s standings'
              : 'Flight details'}
          </summary>
          <ul className="lines">
            {cut.map((e) => {
              const k = e.type === 'cut' ? match.kites[e.victim] : null;
              if (!k || e.type !== 'cut') return null;
              return (
                <li key={`${k.id}-${e.tick}`}>
                  <span className="lines__kite">
                    <KiteThumb look={skyLook(k, match.sky)} size={20} />
                    {k.name}
                  </span>
                  <span>+{e.points}</span>
                </li>
              );
            })}
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
          {answer && answer.counted && answer.coins.lines.length > 0 && (
            <p className="earned__lines">
              Coins:{' '}
              {answer.coins.lines
                .map((l) => `${l.label} +${l.coins}`)
                .join(' · ')}
            </p>
          )}
          {answer && answer.standings.length > 0 && (
            <p className="result__more-label">Today’s best</p>
          )}
          {answer && answer.standings.length > 0 && (
            <ol className="standings" aria-label="Today's best flights">
              {answer.standings.map((row) => (
                <li key={row.rank}>
                  <span>
                    {row.rank}. {row.name}
                  </span>
                  <span>{row.score}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="result__best">Your best today: {shownBest}</p>
        </details>

        <Report day={day} />
      </section>
    </div>
  );
}

mount(<Game />);
