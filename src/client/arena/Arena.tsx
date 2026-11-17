import { useEffect, useRef, useState } from 'react';
import { decide } from '../../shared/sim/ai.ts';
import { sound } from './sound.ts';
import {
  aftermath,
  createMatch,
  healthOf,
  step,
  watch,
} from '../../shared/sim/match.ts';
import type { Taps } from '../../shared/sim/match.ts';
import { toRadians } from '../../shared/sim/trig.ts';
import {
  PLAYER_ID,
  ROOF,
  ROOF_DAMAGE,
  ROUND_TICKS,
  TICKS_PER_SECOND,
} from '../../shared/sim/types.ts';
import type { EndReason, Kite, Match, Sky } from '../../shared/sim/types.ts';
import {
  burst,
  createStage,
  drawScene,
  fit,
  jolt,
  resetStage,
  shock,
} from './draw.ts';
import type { Floater, Pose } from './draw.ts';
import type { Look } from './design.ts';
import type { Mood } from './mood.ts';

const STEP_MS = 1000 / TICKS_PER_SECOND;
/** Never run more than this many simulation steps in one frame, so a slow frame cannot snowball. */
const MAX_STEPS_PER_FRAME = 6;
/**
 * The feed card plays itself at 30 frames a second rather than 60, and not at all while it is
 * scrolled out of view or the app is in the background, to spare phones in the feed.
 */
const ATTRACT_FRAME_MS = 1000 / 30;
/** The picture holds still for a moment when a string is cut, so the cut is felt. */
const HIT_PAUSE_MS = 90;
/** When the player's own string is cut, the sky runs slowly for a moment as the kite drifts off. */
const SLOW_MS = 900;
const SLOW_RATE = 0.3;
/** How long the sky is watched after the round is decided, before the player is told. */
const AFTER_MS: Record<EndReason, number> = {
  cut: 1200,
  crashed: 1200,
  cleared: 1500,
  time: 700,
};
/** With one kite left there is no fight to watch: it flies this long, then the watching is over. */
const LAST_KITE_TICKS = 5 * TICKS_PER_SECOND;
/** The feed card starts a new round this long after one ends. */
const ATTRACT_RESTART_MS = 3500;

const GOLD = '255, 236, 190';
const RED = '255, 120, 110';
const ROOF_DUST = ['#A1462C', '#D9B88F', '#7C3324'];

export type ArenaProps = {
  sky: Sky;
  /** `play`: the player's finger flies the red kite. `attract`: the game plays itself, for the feed card. */
  mode: 'play' | 'attract';
  /** The time of day the sky is drawn in. Changing it never restarts the round. */
  mood: Mood;
  /** How the player's kite looks and the name it flies under. Changing it never restarts the round. */
  player: { look: Look; name: string };
  /** While true the round cannot be launched: a menu is open over the sky. */
  locked?: boolean;
  /** The practice flight has no clock. */
  practice?: boolean;
  /** Called once, on the first press. */
  onStart?: () => void;
  /**
   * Called once, a moment after the round is decided, with the taps that reproduce it. If the
   * player's kite went down, the rivals are still flying behind whatever is shown next.
   */
  onEnd?: (match: Match, taps: Taps) => void;
  /** Called once, after `onEnd`, when the rivals' fight is over and there is nothing left to watch. */
  onWatchEnd?: () => void;
};

/** Plays the red kite the way a rival would, for the feed card. */
function autopilot(match: Match): boolean {
  const me = match.kites[PLAYER_ID];
  if (match.contacts.some((c) => c.a === PLAYER_ID || c.b === PLAYER_ID))
    return true;
  return decide({ ...me, style: 'gesit', aim: 0.9 }, match);
}

/** A round is plain data, so it copies through JSON. */
const copyOf = (match: Match): Match =>
  JSON.parse(JSON.stringify(match)) as Match;

const shortest = (from: number, to: number): number => {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export function Arena({
  sky,
  mode,
  mood,
  player,
  locked = false,
  practice = false,
  onStart,
  onEnd,
  onWatchEnd,
}: ArenaProps) {
  const [muted, setMuted] = useState(() => sound.isMuted());
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const timeBar = useRef<HTMLSpanElement>(null);
  const timeText = useRef<HTMLSpanElement>(null);
  const stringBar = useRef<HTMLSpanElement>(null);
  const stringText = useRef<HTMLSpanElement>(null);
  const scoreText = useRef<HTMLSpanElement>(null);
  const callbacks = useRef({ onStart, onEnd, onWatchEnd });
  const live = useRef({ mood, player, locked, practice });
  useEffect(() => {
    callbacks.current = { onStart, onEnd, onWatchEnd };
    live.current = { mood, player, locked, practice };
  });

  useEffect(() => {
    const el = canvas.current;
    const box = host.current;
    const ctx = el?.getContext('2d');
    if (!el || !box || !ctx) return;

    /** The round that is scored. It stops the moment it is decided. */
    let match = createMatch(sky);
    /** The round on screen: the scored one, then a copy of it in which the rivals fight on. */
    let show = match;
    /** The tick on screen. It follows the round, then keeps counting while kites fall. */
    let shown = 0;
    let started = mode === 'attract';
    let pull = false;
    let lastPull = false;
    let taps: Taps = [];
    let endedAt = 0;
    let reported = false;
    let watching = false;
    let watchOver = false;
    let watchReported = false;
    let lastKiteTicks = 0;
    let holdUntil = 0;
    let slowUntil = 0;
    let acc = 0;
    let last = performance.now();
    let view = fit(1, 1, 1);
    const stage = createStage();
    const floaters: Floater[] = [];
    const prev = new Map<number, { x: number; y: number; a: number }>();
    let scoreShown = 0;
    let frayLevel: 0 | 1 | 2 = 0;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const r = box.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(r.width * dpr));
      el.height = Math.max(1, Math.round(r.height * dpr));
      view = fit(r.width, r.height, dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);

    const press = (down: boolean) => {
      if (mode !== 'play' || match.over) return;
      if (down && !started && live.current.locked) return;
      if (down) sound.unlock();
      pull = down;
      if (down && !started) {
        started = true;
        last = performance.now();
        acc = STEP_MS; // the first step runs this frame, with the finger down
        callbacks.current.onStart?.();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      box.setPointerCapture?.(e.pointerId);
      press(true);
    };
    const onUp = () => press(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      // Space on a focused button presses that button, not the kite's string.
      const target = e.target instanceof Element ? e.target : null;
      if (e.code === 'Space' && target?.closest('button, input, select, a'))
        return;
      e.preventDefault();
      if (e.repeat) return;
      press(e.type === 'keydown');
    };
    const onBlur = () => press(false);
    if (mode === 'play') {
      box.addEventListener('pointerdown', onDown);
      box.addEventListener('pointerup', onUp);
      box.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      window.addEventListener('blur', onBlur);
    }

    const hud = () => {
      if (mode !== 'play') return;
      // Time runs on while the rivals are watched; the string and the score are the round's.
      const ticksLeft = Math.max(0, ROUND_TICKS - show.tick);
      if (timeBar.current)
        timeBar.current.style.transform = `scaleX(${live.current.practice ? 1 : ticksLeft / ROUND_TICKS})`;
      if (timeText.current)
        timeText.current.textContent = live.current.practice
          ? '∞'
          : `${Math.ceil(ticksLeft / TICKS_PER_SECOND)}s`;
      const me = match.kites[PLAYER_ID];
      const left =
        me.state === 'flying' ? Math.max(0, 1 - me.damage / healthOf(me)) : 0;
      if (stringBar.current) {
        stringBar.current.style.transform = `scaleX(${left})`;
        stringBar.current.dataset.low = left < 0.4 ? 'true' : 'false';
      }
      if (stringText.current)
        stringText.current.textContent = `${Math.ceil(left * 100)}%`;
      // The edges of the sky pulse red while the string is nearly gone.
      const fray =
        !started || match.over || me.state !== 'flying'
          ? ''
          : left < 0.2
            ? 'critical'
            : left < 0.4
              ? 'low'
              : '';
      if (box.dataset.fray !== fray) box.dataset.fray = fray;
      frayLevel = fray === 'critical' ? 2 : fray === 'low' ? 1 : 0;
      if (scoreText.current && match.score !== scoreShown) {
        scoreShown = match.score;
        scoreText.current.textContent = String(match.score);
        // The score jumps when it grows.
        if (!calm && match.score > 0)
          scoreText.current.parentElement?.animate(
            [
              { transform: 'scale(1)', color: '#FFE08A' },
              { transform: 'scale(1.38)', color: '#FFE08A', offset: 0.3 },
              { transform: 'scale(1)' },
            ],
            { duration: 460, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
          );
      }
    };

    /** A kite's two colours, for the scraps of paper when it is cut. */
    const coloursOf = (k: Kite): readonly string[] =>
      k.id === PLAYER_ID
        ? [live.current.player.look.main, live.current.player.look.trim]
        : k.colors;

    const remember = () => {
      for (const k of show.kites) prev.set(k.id, { x: k.x, y: k.y, a: k.a });
    };

    /** Holds the picture still for a moment. */
    const hold = (t: number, ms: number) => {
      holdUntil = t + ms;
      acc = 0;
      remember();
    };

    /** One tick of the round, and what the screen does about what happened in it. */
    const advance = (t: number) => {
      const want = mode === 'attract' ? autopilot(match) : pull;
      if (want !== lastPull) {
        taps.push(match.tick);
        lastPull = want;
      }
      const me = match.kites[PLAYER_ID];
      const frayBefore = me.damage;
      const seen = match.events.length;
      step(match, want);
      shown = match.tick;

      if (
        me.state === 'flying' &&
        me.hitBy === ROOF &&
        me.damage - frayBefore >= ROOF_DAMAGE
      ) {
        floaters.push({
          x: me.x,
          y: me.y - 24,
          text: 'Atap!',
          born: t,
          tone: 'loss',
        });
        jolt(stage, t, 4);
        burst(stage, me.x, me.y + 14, ROOF_DUST, t, 12);
        if (mode === 'play') sound.playRoofHit();
      }

      for (const e of match.events.slice(seen)) {
        if (e.type === 'end') continue;
        const victim = match.kites[e.victim];
        const lost = e.victim === PLAYER_ID;
        if (e.type === 'crash') {
          if (!lost) continue;
          floaters.push({
            x: e.x,
            y: e.y - 24,
            text: 'Nyangkut!',
            born: t,
            tone: 'loss',
          });
          jolt(stage, t, 8, RED);
          burst(stage, e.x, e.y, coloursOf(victim), t);
          if (mode === 'play') sound.playCrash();
          continue;
        }
        const mine = e.by === PLAYER_ID;
        const king = mine && victim?.kind === 'king';
        floaters.push({
          x: e.x,
          y: e.y,
          text: king
            ? `RAJA! +${e.points}`
            : mine
              ? `PUTUS! +${e.points}`
              : lost
                ? 'PUTUS!'
                : 'Putus',
          born: t,
          tone: lost ? 'loss' : 'gain',
        });
        jolt(stage, t, lost ? 8 : 5, lost ? RED : GOLD);
        burst(stage, e.x, e.y, coloursOf(victim), t);
        shock(stage, e.x, e.y, t, lost ? RED : GOLD);
        hold(t, lost ? HIT_PAUSE_MS * 1.5 : HIT_PAUSE_MS);
        if (lost) slowUntil = holdUntil + SLOW_MS;
        if (mode === 'play') sound.playCut(mine);
      }

      if (match.over) {
        endedAt = t;
        if (mode === 'play') {
          sound.stopAll();
          if (match.reason === 'cleared') {
            sound.playCleared();
          } else if (match.reason === 'time') {
            sound.playTimeUp();
          }
        }
        if (match.reason === 'cut' || match.reason === 'crashed') {
          // The player's kite is down. The rivals fight on, in a copy the score cannot see.
          show = copyOf(match);
          watching = true;
        } else {
          watchOver = true;
        }
      }
    };

    /** One tick of the rivals fighting on among themselves, after the player's kite is down. */
    const spectate = (t: number) => {
      const seen = show.events.length;
      if (!watch(show)) {
        watching = false;
        watchOver = true;
        return;
      }
      shown = show.tick;
      for (const e of show.events.slice(seen)) {
        if (e.type === 'end') continue;
        const victim = show.kites[e.victim];
        floaters.push({
          x: e.x,
          y: e.type === 'crash' ? e.y - 24 : e.y,
          text: `${victim.name} ${e.type === 'crash' ? 'nyangkut' : 'putus'}!`,
          born: t,
          tone: 'gain',
        });
        jolt(stage, t, 3);
        burst(stage, e.x, e.y, coloursOf(victim), t, 24);
        if (e.type === 'cut') shock(stage, e.x, e.y, t);
        if (mode === 'play') {
          if (e.type === 'crash') sound.playCrash();
          else sound.playCut(false);
        }
      }
      const flying = show.kites.filter((k) => k.state === 'flying').length;
      lastKiteTicks = flying <= 1 ? lastKiteTicks + 1 : 0;
      if (lastKiteTicks > LAST_KITE_TICKS) watchOver = true;
    };

    let raf = 0;
    let onScreen = true;
    let lastDrawn = -Infinity;
    const asleep = () =>
      mode === 'attract' &&
      (!onScreen || document.visibilityState === 'hidden');
    const frame = (t: number) => {
      raf = 0;
      // Asleep, nothing is scheduled; `wake` starts the frames again.
      if (asleep()) return;
      if (mode === 'attract' && t - lastDrawn < ATTRACT_FRAME_MS - 2) {
        raf = requestAnimationFrame(frame);
        return;
      }
      lastDrawn = t;
      const dt = Math.min(100, t - last);
      last = t;

      if (
        mode === 'attract' &&
        match.over &&
        t - endedAt > ATTRACT_RESTART_MS
      ) {
        match = createMatch(sky);
        show = match;
        shown = 0;
        watching = false;
        watchOver = false;
        lastKiteTicks = 0;
        prev.clear();
        floaters.length = 0;
        resetStage(stage);
      }

      if (started && t >= holdUntil) {
        acc += dt * (t < slowUntil ? SLOW_RATE : 1);
        let steps = 0;
        while (acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
          remember();
          if (!match.over) {
            advance(t);
          } else if (watching) {
            spectate(t);
          } else {
            // Nothing is flying on; kites that were cut go on falling.
            shown += 1;
            aftermath(show, shown);
          }
          steps += 1;
          if (t < holdUntil) break;
          acc -= STEP_MS;
        }
        if (steps === MAX_STEPS_PER_FRAME) acc = 0;
      }

      if (mode === 'play' && match.over) {
        if (!reported && t - endedAt >= AFTER_MS[match.reason ?? 'time']) {
          reported = true;
          callbacks.current.onEnd?.(match, taps);
          taps = [];
        }
        if (reported && watchOver && !watchReported) {
          watchReported = true;
          callbacks.current.onWatchEnd?.();
        }
      }

      const alpha = started ? Math.min(1, acc / STEP_MS) : 1;
      const poses = new Map<number, Pose>();
      for (const k of show.kites) {
        const p = prev.get(k.id);
        const a = toRadians(k.a);
        poses.set(
          k.id,
          p
            ? {
                x: p.x + (k.x - p.x) * alpha,
                y: p.y + (k.y - p.y) * alpha,
                angle: toRadians(p.a) + shortest(toRadians(p.a), a) * alpha,
              }
            : { x: k.x, y: k.y, angle: a }
        );
      }
      while (floaters.length > 0 && t - floaters[0].born > 2000)
        floaters.shift();
      drawScene(
        ctx,
        view,
        {
          match: show,
          poses,
          floaters,
          now: t,
          tick: shown,
          showHeading: mode === 'play',
          mood: live.current.mood,
          player: live.current.player,
          fray: frayLevel,
        },
        stage
      );
      if (mode === 'play') {
        if (started && !match.over) {
          const me = match.kites[PLAYER_ID];
          if (me && me.state === 'flying') {
            sound.updateWind(me.pull, me.vy);
            const contact = match.contacts.find(
              (c) => c.a === PLAYER_ID || c.b === PLAYER_ID
            );
            sound.updateFriction(contact ? contact.rub : 0);
          } else {
            sound.stopAll();
          }
        } else {
          sound.stopAll();
        }
      }
      hud();
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (raf || asleep()) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const sight =
      mode === 'attract' && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            onScreen = entries.some((e) => e.isIntersecting);
            wake();
          })
        : null;
    sight?.observe(box);
    document.addEventListener('visibilitychange', wake);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      sight?.disconnect();
      document.removeEventListener('visibilitychange', wake);
      sound.stopAll();
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointerup', onUp);
      box.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, [sky, mode]);

  return (
    <div ref={host} className={`arena arena--${mode}`} data-mood={mood}>
      <canvas ref={canvas} className="arena__canvas" aria-hidden="true" />
      {mode === 'play' && (
        <>
          <button
            type="button"
            className="sound-toggle"
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            title={muted ? 'Sound: Off' : 'Sound: On'}
            onClick={(e) => {
              e.stopPropagation();
              sound.unlock();
              const next = sound.toggleMute();
              setMuted(next);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {muted ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
          <div className="hud" aria-hidden="true">
            <div className="hud__bars">
              <div className="hud__row">
                <span className="hud__label">
                  {practice ? 'Drill' : 'Time'}
                </span>
                <span className="hud__bar hud__bar--time">
                  <span ref={timeBar} />
                </span>
                <span className="hud__value" ref={timeText}>
                  60s
                </span>
              </div>
              <div className="hud__row">
                <span className="hud__label">String</span>
                <span className="hud__bar hud__bar--string">
                  <span ref={stringBar} />
                </span>
                <span className="hud__value" ref={stringText}>
                  100%
                </span>
              </div>
            </div>
            <span className="hud__score">
              <span ref={scoreText}>0</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
