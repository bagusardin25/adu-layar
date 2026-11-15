// One round of the kite fight, a tick at a time.
//
// The same code runs in the browser, where the player's finger drives it, and on the server,
// which replays the player's taps to score the round. Nothing here reads the clock, draws, or
// uses an unseeded random number, so the same sky and the same taps always give the same round.

import { decide } from './ai.ts';
import { clamp, length } from './geometry.ts';
import { stringBend, touch, tracePoints } from './line.ts';
import { PLAYER_ANCHOR_X, PLAYER_COLOURS, PLAYER_HANDLING } from './sky.ts';
import { ANG, cosA, dirX, dirY, sinA, wrap } from './trig.ts';
import {
  CRASH_Y,
  DT,
  HAND_Y,
  PLAYER_ID,
  PLAYER_SHARPNESS,
  PLAYER_STRING_HEALTH,
  POINTS,
  ROOF,
  ROOF_DAMAGE,
  ROUND_TICKS,
  SKY_W,
  STRING_HEALTH,
  STRING_LENGTH,
  TICKS_PER_SECOND,
  TOP_Y,
} from './types.ts';
import type { Contact, EndReason, Kite, Match, Sky } from './types.ts';
import { windAt } from './wind.ts';

// ───────────────────────────── Flight ─────────────────────────────

/** How fast a pulled kite reaches its speed, and how fast a slack one settles into the wind. */
const PULL_RESPONSE = 0.14;
const SLACK_RESPONSE = 0.05;
/** How much of the wind a kite feels while pulled and while slack. */
const PULL_WIND = 0.25;
const SLACK_WIND = 0.6;
/** Gravity helps a dive and holds back a climb, by this share of the kite's pull speed. */
const DIVE_BOOST = 0.16;
/** A slack kite sinks slowly. */
const SINK = 22;
/**
 * Warm air rises off the sun-baked roofs. The lift is nothing at THERMAL_TOP and grows steadily
 * to THERMAL at the roofs, so a slack kite settles a little way above them instead of landing.
 */
const THERMAL_TOP = 380;
const THERMAL = 62;
/** How fast a string goes taut when pulled or stretched, and how fast it goes slack. */
const TIGHTEN = 0.25;
const LOOSEN = 0.05;
/** How slack a string hangs when the kite is at the end of it but not being pulled. */
const STRETCHED_SLACK = 0.2;

// ───────────────────────────── Cutting ─────────────────────────────

/** Fray per tick, per unit of speed that two strings slide over each other. */
const CUT_RATE = 0.0105;
/** Two limp strings lying across each other press together this much less than taut ones. */
const LIMP = 0.8;
/**
 * When the rivals fight on after the player is down, their strings wear this much slower, so a
 * duel lasts long enough to watch. It changes nothing about a scored round.
 */
const WATCH_WEAR = 0.4;

// ───────────────────────────── Roofs and falling ─────────────────────────────

/** How hard a kite bounces off a roof. */
const ROOF_BOUNCE = 110;
/** A cut kite flutters down like a leaf: average fall speed, side-to-side swing, and rocking. */
const FALL_SPEED = 38;
const FLUTTER = 9;
const FLUTTER_SWING = 46;
const FLUTTER_ROCK = 150;
/** Ticks over which a cut kite stops pointing where it was heading and starts to rock. */
const FLUTTER_SETTLE = 36;

type KiteBase = Omit<
  Kite,
  | 'id'
  | 'vx'
  | 'vy'
  | 'a'
  | 'pull'
  | 'slack'
  | 'state'
  | 'damage'
  | 'hitBy'
  | 'rest'
  | 'engaged'
  | 'endTick'
  | 'endX'
  | 'endY'
  | 'endA'
>;

function kite(id: number, base: KiteBase): Kite {
  return {
    ...base,
    id,
    vx: 0,
    vy: 0,
    a: 0,
    pull: false,
    slack: 1,
    state: 'flying',
    damage: 0,
    hitBy: -1,
    rest: 0,
    engaged: false,
    endTick: -1,
    endX: 0,
    endY: 0,
    endA: 0,
  };
}

export function createMatch(sky: Sky): Match {
  const kites: Kite[] = [
    kite(PLAYER_ID, {
      role: 'player',
      name: 'You',
      style: null,
      colors: PLAYER_COLOURS,
      handling: PLAYER_HANDLING,
      aim: 1,
      ax: PLAYER_ANCHOR_X,
      ay: HAND_Y,
      x: PLAYER_ANCHOR_X,
      y: 330,
    }),
    ...sky.rivals.map((r, i) =>
      kite(i + 1, {
        role: 'rival',
        name: r.name,
        style: r.style,
        colors: r.colors,
        handling: { spin: r.spin, pullSpeed: r.pullSpeed },
        aim: r.aim,
        ax: r.anchorX,
        ay: HAND_Y,
        x: r.anchorX,
        y: 250 + i * 25,
      })
    ),
  ];
  return {
    sky,
    tick: 0,
    kites,
    contacts: [],
    events: [],
    score: 0,
    cuts: 0,
    over: false,
    reason: null,
  };
}

/** How much fray a kite's string takes before it snaps. */
export const healthOf = (k: Kite): number =>
  k.role === 'player' ? PLAYER_STRING_HEALTH : STRING_HEALTH;

const sharpnessOf = (k: Kite): number =>
  k.role === 'player' ? PLAYER_SHARPNESS : 1;

/** The lift of the warm air at a height: zero high up, strongest at the roofs. */
export function thermalAt(y: number): number {
  return THERMAL * clamp((y - THERMAL_TOP) / (CRASH_Y - THERMAL_TOP), 0, 1);
}

function move(k: Kite, sky: Sky, tick: number): void {
  const wind = windAt(sky, tick, k.y);
  let tvx: number;
  let tvy: number;
  let response: number;
  if (k.pull) {
    // Pulled, the kite darts where its nose points: faster in a dive, slower in a climb.
    const hx = dirX(k.a);
    const hy = dirY(k.a);
    const speed = k.handling.pullSpeed * (1 + DIVE_BOOST * hy);
    tvx = hx * speed + wind.x * PULL_WIND;
    tvy = hy * speed + wind.y * PULL_WIND;
    response = PULL_RESPONSE;
  } else {
    // Slack, it spins, is carried by the wind, and sinks until the warm air holds it up.
    k.a = wrap(k.a + k.handling.spin);
    tvx = wind.x * SLACK_WIND;
    tvy = wind.y * SLACK_WIND + SINK - thermalAt(k.y);
    response = SLACK_RESPONSE;
  }
  k.vx += (tvx - k.vx) * response;
  k.vy += (tvy - k.vy) * response;
  k.x += k.vx * DT;
  k.y += k.vy * DT;

  // The string is only so long: a stretched string stops the kite moving away from the flyer.
  const dx = k.x - k.ax;
  const dy = k.y - k.ay;
  const d = length(dx, dy);
  const stretched = d >= STRING_LENGTH;
  if (d > STRING_LENGTH) {
    k.x = k.ax + (dx * STRING_LENGTH) / d;
    k.y = k.ay + (dy * STRING_LENGTH) / d;
    const outward = (k.vx * dx + k.vy * dy) / d;
    if (outward > 0) {
      k.vx -= (outward * dx) / d;
      k.vy -= (outward * dy) / d;
    }
  }

  // The edges of the sky.
  if (k.x < 8) {
    k.x = 8;
    if (k.vx < 0) k.vx = 0;
  } else if (k.x > SKY_W - 8) {
    k.x = SKY_W - 8;
    if (k.vx > 0) k.vx = 0;
  }
  if (k.y < TOP_Y) {
    k.y = TOP_Y;
    if (k.vy < 0) k.vy = 0;
  }

  // The string goes taut quickly under a pull, and hangs loose again a moment after.
  if (k.pull) k.slack += (0 - k.slack) * TIGHTEN;
  else if (stretched) k.slack += (STRETCHED_SLACK - k.slack) * TIGHTEN;
  else k.slack += (1 - k.slack) * LOOSEN;
}

/** A cut kite flutters down like a leaf, swinging from side to side as the wind carries it. */
function drift(k: Kite, sky: Sky, tick: number): void {
  const wind = windAt(sky, tick, k.y);
  const age = tick - k.endTick;
  const phase = age * FLUTTER + k.id * 170;
  const swing = cosA(phase);
  k.x += (wind.x * 0.9 + swing * FLUTTER_SWING) * DT;
  // It drops fastest in the middle of a swing and almost hangs at each end.
  k.y += FALL_SPEED * (0.55 + 0.9 * swing * swing) * DT;
  const keep = clamp(1 - age / FLUTTER_SETTLE, 0, 1);
  k.a = wrap(Math.round(k.endA * keep + sinA(phase) * FLUTTER_ROCK));
}

/**
 * How fast a string moves at a point along it. The hand end is still and the kite end moves
 * with the kite. Motion along the string runs through the whole string at full speed (the
 * string pays out or comes in); motion across it is a swing about the hand, so a point halfway
 * up moves half as fast as the kite.
 */
export function lineVelocity(k: Kite, s: number): { x: number; y: number } {
  const dx = k.x - k.ax;
  const dy = k.y - k.ay;
  const d = length(dx, dy);
  if (d === 0) return { x: k.vx * s, y: k.vy * s };
  const along = (k.vx * dx + k.vy * dy) / d;
  return {
    x: s * k.vx + ((1 - s) * along * dx) / d,
    y: s * k.vy + ((1 - s) * along * dy) / d,
  };
}

/**
 * What two touching strings do to each other in one tick. Fray comes from the strings sliding
 * over each other, so strings that are crossed but still do no harm. Of the two, the string
 * moving faster at the touch saws the slower one: its fresh length keeps running over one
 * spot of the other. `sa` and `sb` are how far along each string the touch is.
 */
export function wear(
  a: Kite,
  sa: number,
  b: Kite,
  sb: number
): { rub: number; toA: number; toB: number } {
  const ua = lineVelocity(a, sa);
  const ub = lineVelocity(b, sb);
  const rub = length(ua.x - ub.x, ua.y - ub.y);
  const pa = length(ua.x, ua.y);
  const pb = length(ub.x, ub.y);
  if (pa + pb === 0) return { rub: 0, toA: 0, toB: 0 };
  const press = 1 - LIMP * Math.min(a.slack, b.slack);
  const grind = rub * press * CUT_RATE;
  return {
    rub,
    toA: (grind * sharpnessOf(b) * pb) / (pa + pb),
    toB: (grind * sharpnessOf(a) * pa) / (pa + pb),
  };
}

function fray(
  victim: Kite,
  by: number,
  amount: number,
  at: { x: number; y: number }
): void {
  victim.damage += amount;
  victim.hitBy = by;
  victim.endX = at.x;
  victim.endY = at.y;
}

function finish(match: Match, reason: EndReason, points: number): void {
  match.over = true;
  match.reason = reason;
  match.score += points;
  match.events.push({ type: 'end', tick: match.tick, reason, points });
}

/**
 * One tick of flying, rubbing and falling, for every kite. During a round only fights that
 * involve the player count: the rivals are all after the player, and a rival cutting another
 * would take away the player's target. `freeForAll` lifts that, for when the player is down.
 */
function fly(match: Match, playerPull: boolean, freeForAll: boolean): void {
  const { sky, tick } = match;
  const flying = match.kites.filter((k) => k.state === 'flying');

  // Everyone decides on the same picture of the sky, then everyone moves.
  const pulls = flying.map((k) =>
    k.role === 'player' ? playerPull : decide(k, match)
  );
  flying.forEach((k, i) => {
    k.pull = pulls[i];
  });
  for (const k of flying) move(k, sky, tick);
  for (const k of match.kites) if (k.state === 'cut') drift(k, sky, tick);

  // Strings that touch rub each other.
  const lines = flying.map((k) =>
    tracePoints(k.ax, k.ay, k.x, k.y, stringBend(k, sky, tick))
  );
  const contacts: Contact[] = [];
  for (let i = 0; i < flying.length; i++) {
    for (let j = i + 1; j < flying.length; j++) {
      const a = flying[i];
      const b = flying[j];
      if (!freeForAll && a.role !== 'player' && b.role !== 'player') continue;
      const at = touch(lines[i], lines[j]);
      if (!at) continue;
      const w = wear(a, at.sa, b, at.sb);
      contacts.push({ x: at.x, y: at.y, a: a.id, b: b.id, rub: w.rub });
      const ease = freeForAll ? WATCH_WEAR : 1;
      if (w.toA > 0) fray(a, b.id, w.toA * ease, at);
      if (w.toB > 0) fray(b, a.id, w.toB * ease, at);
    }
  }
  match.contacts = contacts;

  for (const k of flying) {
    if (k.y > CRASH_Y) {
      // Brushed a roof: the kite glances off it, nose knocked upwards, and the string frays.
      k.y = CRASH_Y;
      if (k.vy > 0) k.vy = -ROOF_BOUNCE;
      if (dirY(k.a) > 0) k.a = wrap(ANG / 2 - k.a);
      fray(k, ROOF, ROOF_DAMAGE, k);
    }
    if (k.damage < healthOf(k)) continue;
    k.endTick = tick;
    k.endA = k.a > ANG / 2 ? k.a - ANG : k.a;
    if (k.hitBy === ROOF) {
      k.state = 'crashed';
      match.events.push({
        type: 'crash',
        tick,
        victim: k.id,
        x: k.x,
        y: k.y,
      });
    } else {
      k.state = 'cut';
      const byPlayer = k.hitBy === PLAYER_ID;
      const points = byPlayer ? POINTS.cut : 0;
      if (byPlayer) {
        match.cuts += 1;
        match.score += points;
      }
      match.events.push({
        type: 'cut',
        tick,
        victim: k.id,
        by: k.hitBy,
        x: k.endX,
        y: k.endY,
        points,
      });
    }
  }

  match.tick += 1;
}

/** Advances the round by one tick. `playerPull` is whether the player's finger is down. */
export function step(match: Match, playerPull: boolean): void {
  if (match.over) return;
  fly(match, playerPull, false);

  const player = match.kites[PLAYER_ID];
  if (player.state !== 'flying') {
    finish(match, player.state === 'cut' ? 'cut' : 'crashed', 0);
  } else if (
    match.kites.every((k) => k.role === 'player' || k.state !== 'flying')
  ) {
    const secondsLeft = Math.floor(
      (ROUND_TICKS - match.tick) / TICKS_PER_SECOND
    );
    finish(
      match,
      'cleared',
      POINTS.survive + POINTS.perSecondLeft * secondsLeft
    );
  } else if (match.tick >= ROUND_TICKS) {
    finish(match, 'time', POINTS.survive);
  }
}

/**
 * After the round is over, cut kites keep fluttering down so the screen does not freeze on the
 * last tick. For drawing only: it scores nothing, and the server never calls it. `tick` keeps
 * counting on from where the round stopped.
 */
export function aftermath(match: Match, tick: number): void {
  for (const k of match.kites) if (k.state === 'cut') drift(k, match.sky, tick);
}

/**
 * After the player's kite is down, the rivals fight on among themselves, so there is still a
 * sky to watch. For the screen only: it scores nothing, and the server never calls it. Run it
 * on a copy of the round, so the round that was scored stays exactly as it ended. Returns false
 * once there is nothing left to watch: time is up, or no kite is flying.
 */
export function watch(match: Match): boolean {
  if (match.tick >= ROUND_TICKS) return false;
  if (!match.kites.some((k) => k.state === 'flying')) return false;
  fly(match, false, true);
  return true;
}

// ───────────────────────────── Taps ─────────────────────────────

/**
 * A round's input: the ticks at which the player's finger went down or came up, in order. The
 * finger starts up; each entry flips it. A round normally begins with a press at tick 0.
 */
export type Taps = number[];

/** Plays a whole round from its taps. This is how the server scores a round. */
export function replay(sky: Sky, taps: Taps): Match {
  const match = createMatch(sky);
  let i = 0;
  let pull = false;
  while (!match.over) {
    while (i < taps.length && taps[i] <= match.tick) {
      pull = !pull;
      i += 1;
    }
    step(match, pull);
  }
  return match;
}

/** True when taps are well formed: whole, non-negative, strictly increasing, within the round. */
export function validTaps(taps: unknown): taps is Taps {
  if (!Array.isArray(taps) || taps.length > ROUND_TICKS) return false;
  let last = -1;
  for (const t of taps) {
    if (!Number.isInteger(t) || t <= last || t >= ROUND_TICKS) return false;
    last = t;
  }
  return true;
}
