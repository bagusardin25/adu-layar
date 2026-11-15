// The kampung's champions. They fly with the same control as the player (pull or let go) and
// see the same state, so a round replays identically on the server.
//
// Each rival picks a target point, lets its kite spin until the nose faces that point, then
// pulls. To cut a string, it aims at a point just past the victim's string, so its own string
// sweeps across while it pulls. After each pass it falls back to its own patch of sky for a
// moment, so a fight comes in waves rather than one long scramble.
//
// A round is staged as three duels: the reckless rival comes first, the quick one joins a
// little later, and the calm one comes down for the last stretch.

import { length } from './geometry.ts';
import { cosA, dirX, dirY, sinA } from './trig.ts';
import { SKY_W, TOP_Y } from './types.ts';
import type { Kite, Match, Style } from './types.ts';

/** When each style starts hunting the player, in ticks. */
const HUNTS_FROM: Record<Style, number> = {
  nekat: 240,
  gesit: 900,
  kalem: 1800,
};
/** Rivals rethink every few ticks, like a person reacting. */
const DECIDE_EVERY = 3;
/** Rest after an attacking pass, in ticks. */
const REST_TICKS = 90;
/** Below this, a kite climbs before doing anything else. */
const LOW_Y = 455;
const HOME_Y = 190;
/** A rival does not pull towards an edge of the sky closer than this. */
const EDGE = 50;
/** Nobody fights in the first seconds, while kites climb into the sky. */
const SETTLE_TICKS = 240;
/** How close the player may come to a rival's kite before it fights back, outside its turn. */
const GUARD_RADIUS = 110;
/** How far past the victim's string the rival aims. */
const OVERSHOOT = 70;
/** Where along the victim's string the rival aims, from its flyer. */
const ALONG = 0.62;

type Point = { x: number; y: number };

const clampToSky = (p: Point): Point => ({
  x: Math.min(SKY_W - 30, Math.max(30, p.x)),
  y: Math.min(LOW_Y - 30, Math.max(TOP_Y + 30, p.y)),
});

function nearest(kite: Kite, others: Kite[], within = Infinity): Kite | null {
  let best: Kite | null = null;
  let bestD = within;
  for (const o of others) {
    const d = length(o.x - kite.x, o.y - kite.y);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

/** Whom this rival is after right now, or null to hold its own patch of sky. */
function pickVictim(kite: Kite, match: Match): Kite | null {
  const others = match.kites.filter(
    (k) => k.id !== kite.id && k.state === 'flying'
  );
  const player = others.find((k) => k.role === 'player');
  const lastRival = others.every((k) => k.role === 'player');
  const style = kite.style ?? 'kalem';
  // With the player's kite down, the rivals turn on each other.
  if (!player) return nearest(kite, others);
  if (match.tick < SETTLE_TICKS) return null;
  if (match.tick >= HUNTS_FROM[style] || lastRival) return player;
  // Outside its turn, a rival only fights the player when the player comes too close.
  return nearest(kite, [player], GUARD_RADIUS);
}

/** A point just past the victim's string, on the far side from this kite. */
function sweepPoint(kite: Kite, v: Kite): Point {
  const dx = v.x - v.ax;
  const dy = v.y - v.ay;
  const len = length(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const side = dx * (kite.y - v.ay) - dy * (kite.x - v.ax) >= 0 ? 1 : -1;
  return {
    x: v.ax + dx * ALONG - nx * side * OVERSHOOT,
    y: v.ay + dy * ALONG - ny * side * OVERSHOOT,
  };
}

/** Where a rival with nobody left to fight flies: a slow loop over its own roof. */
function lapPoint(kite: Kite, tick: number): Point {
  return {
    x: kite.ax + 95 * sinA(tick * 2 + kite.id * 300),
    y: HOME_Y + 40 + 70 * cosA(tick * 3 + kite.id * 300),
  };
}

export function targetFor(kite: Kite, match: Match): Point {
  const alone = !match.kites.some(
    (k) => k.id !== kite.id && k.state === 'flying'
  );
  const home = alone ? lapPoint(kite, match.tick) : { x: kite.ax, y: HOME_Y };
  if (kite.y > LOW_Y) return { x: kite.x, y: HOME_Y };
  if (match.tick < kite.rest) return home;
  const victim = pickVictim(kite, match);
  return clampToSky(victim ? sweepPoint(kite, victim) : home);
}

const inContact = (kite: Kite, match: Match): boolean =>
  match.contacts.some((c) => c.a === kite.id || c.b === kite.id);

/** Pull or not, this tick. */
export function decide(kite: Kite, match: Match): boolean {
  if ((match.tick + kite.id) % DECIDE_EVERY !== 0) return kite.pull;

  // A pass ends when the strings part: rest a moment before the next one.
  const touching = inContact(kite, match);
  if (kite.engaged && !touching) kite.rest = match.tick + REST_TICKS;
  kite.engaged = touching;

  // When its string is being rubbed, a careful rival pulls to defend. The reckless one does not.
  const hy = dirY(kite.a);
  if (touching && kite.style !== 'nekat' && !(kite.y > LOW_Y - 60 && hy > 0.3))
    return true;

  const t = targetFor(kite, match);
  const tx = t.x - kite.x;
  const ty = t.y - kite.y;
  const d = length(tx, ty);
  if (d < 22) return false;
  const hx = dirX(kite.a);
  // Never dive into the roofs or pin the kite against an edge of the sky.
  if (kite.y > LOW_Y - 40 && hy > 0.3) return false;
  if (
    (kite.x < EDGE && hx < -0.5) ||
    (kite.x > SKY_W - EDGE && hx > 0.5) ||
    (kite.y < TOP_Y + EDGE && hy < -0.5)
  ) {
    return false;
  }
  return (hx * tx + hy * ty) / d > kite.aim;
}
