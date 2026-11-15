// Checks that the round behaves the way a kite fight does: strings hang, rub and fray; gravity
// and the wind act on kites; and nothing mends itself.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide } from './ai.ts';
import { bendOf, stringBend, tracePoints } from './line.ts';
import { createMatch, lineVelocity, step, wear } from './match.ts';
import { random } from './random.ts';
import { skyForDay } from './sky.ts';
import { ANG, dirY } from './trig.ts';
import {
  CRASH_Y,
  PLAYER_ID,
  PLAYER_SHARPNESS,
  ROOF,
  ROOF_DAMAGE,
  STRING_LENGTH,
} from './types.ts';
import type { Kite, Match, Sky } from './types.ts';

/** A day's sky with the wind switched off, so a test sees one force at a time. */
const calm: Sky = { ...skyForDay(1), windX: 0, gustAmp: 0 };

const tapper = (seed: number) => {
  const next = random(seed);
  let flipAt = 0;
  let pull = false;
  return (m: Match) => {
    if (m.tick >= flipAt) {
      pull = !pull;
      flipAt = m.tick + 10 + Math.floor(next() * 60);
    }
    return pull;
  };
};

const hunter = (m: Match) =>
  m.contacts.some((c) => c.a === PLAYER_ID || c.b === PLAYER_ID) ||
  decide({ ...m.kites[PLAYER_ID], style: 'gesit', aim: 0.9 }, m);

/** Two kites to rub together: the player's and one rival's, both hanging still. */
function pair(): [Kite, Kite] {
  const [a, b] = createMatch(calm).kites;
  for (const k of [a, b]) {
    k.x = k.ax;
    k.y = k.ay - 300;
    k.vx = 0;
    k.vy = 0;
    k.slack = 0;
  }
  return [a, b];
}

/** Distance from a point to a string as it is drawn (its curve, finely sampled). */
function distanceToString(
  k: Kite,
  m: Match,
  tick: number,
  p: { x: number; y: number }
) {
  const bend = stringBend(k, m.sky, tick);
  let best = Infinity;
  let px = k.ax;
  let py = k.ay;
  for (let i = 1; i <= 240; i++) {
    const t = i / 240;
    const u = 1 - t;
    const x = u * u * k.ax + 2 * u * t * bend.cx + t * t * k.x;
    const y = u * u * k.ay + 2 * u * t * bend.cy + t * t * k.y;
    const sx = x - px;
    const sy = y - py;
    const along = Math.min(
      1,
      Math.max(
        0,
        ((p.x - px) * sx + (p.y - py) * sy) / (sx * sx + sy * sy || 1)
      )
    );
    best = Math.min(
      best,
      Math.hypot(p.x - (px + sx * along), p.y - (py + sy * along))
    );
    px = x;
    py = y;
  }
  return best;
}

test('a string starts at the hand, ends at the kite, and hangs deeper when slack', () => {
  const taut = bendOf(100, 548, 100, 148, 0, 0);
  const slack = bendOf(100, 548, 100, 148, 1, 0);
  assert.ok(slack.cy > taut.cy + 20, 'slack hangs deeper');
  assert.ok(taut.cy > (548 + 148) / 2, 'even a taut string hangs a little');
  const short = bendOf(100, 548, 100, 448, 1, 0);
  assert.ok(
    short.cy - (548 + 448) / 2 < slack.cy - (548 + 148) / 2,
    'short strings hang less'
  );
  const blown = bendOf(100, 548, 100, 148, 1, 40);
  assert.ok(blown.cx > slack.cx, 'the wind pushes a belly downwind');

  const points = tracePoints(100, 548, 160, 148, slack);
  assert.deepEqual(points.slice(0, 2), [100, 548]);
  assert.deepEqual(points.slice(-2), [160, 148]);
});

test('where strings touch is on both strings as they are drawn', () => {
  let seen = 0;
  for (let day = 1; day <= 12; day++) {
    const match = createMatch(skyForDay(day));
    const policy = tapper(day);
    while (!match.over) {
      const tick = match.tick;
      step(match, policy(match));
      for (const c of match.contacts) {
        const a = match.kites[c.a];
        const b = match.kites[c.b];
        // A roof bounce moves the kite after the touch was found.
        if (a.y === CRASH_Y || b.y === CRASH_Y) continue;
        if (a.state !== 'flying' || b.state !== 'flying') continue;
        assert.ok(
          distanceToString(a, match, tick, c) < 1,
          `day ${day} tick ${tick}`
        );
        assert.ok(
          distanceToString(b, match, tick, c) < 1,
          `day ${day} tick ${tick}`
        );
        seen += 1;
      }
    }
  }
  assert.ok(seen > 200, 'enough touches were checked');
});

test('a point on a string moves like a string, not like the kite', () => {
  const [a] = pair();
  // Swinging sideways about the hand: halfway up the string moves half as fast.
  a.vx = 100;
  assert.deepEqual(lineVelocity(a, 0.5), { x: 50, y: 0 });
  assert.deepEqual(lineVelocity(a, 1), { x: 100, y: 0 });
  assert.deepEqual(lineVelocity(a, 0), { x: 0, y: 0 });
  // Flying straight away from the hand: string pays out, and all of it runs at full speed.
  a.vx = 0;
  a.vy = -100;
  assert.deepEqual(lineVelocity(a, 0.25), { x: 0, y: -100 });
});

test('strings fray only when they slide, and the faster string saws the slower', () => {
  const [a, b] = pair();
  assert.deepEqual(
    wear(a, 0.5, b, 0.5),
    { rub: 0, toA: 0, toB: 0 },
    'still strings do no harm'
  );

  b.vx = 120;
  const sawn = wear(a, 0.5, b, 0.5);
  assert.equal(sawn.rub, 60);
  assert.ok(sawn.toA > 0, 'the still string is sawn');
  assert.equal(sawn.toB, 0, 'the moving string is not');

  // Moving the same way at the same speed, the strings do not slide over each other.
  a.vx = 120;
  assert.equal(wear(a, 0.5, b, 0.5).rub, 0);

  // Head on at equal speed, both fray, and the glass-coated string frays the other more.
  a.vx = -120;
  const both = wear(a, 0.5, b, 0.5);
  assert.ok(both.toA > 0 && both.toB > 0);
  assert.ok(Math.abs(both.toB / both.toA - PLAYER_SHARPNESS) < 1e-9);

  // The same sweep does less the nearer the hand it happens.
  a.vx = 0;
  assert.ok(wear(a, 0.5, b, 0.2).toA < wear(a, 0.5, b, 0.8).toA);

  // Two limp strings barely press on each other.
  const tight = wear(a, 0.5, b, 0.5).toA;
  a.slack = 1;
  b.slack = 1;
  assert.ok(wear(a, 0.5, b, 0.5).toA < tight * 0.3);
});

test('fray never mends', () => {
  for (let day = 1; day <= 20; day++) {
    const match = createMatch(skyForDay(day));
    const policy = tapper(day * 3);
    const before = match.kites.map(() => 0);
    while (!match.over) {
      step(match, policy(match));
      match.kites.forEach((k, i) => {
        assert.ok(k.damage >= before[i], `day ${day}: string ${i} mended`);
        before[i] = k.damage;
      });
    }
  }
});

test('a dive is faster than a climb', () => {
  const speedAfter = (heading: number) => {
    const match = createMatch(calm);
    match.kites[PLAYER_ID].a = heading;
    for (let i = 0; i < 40; i++) step(match, true);
    return Math.abs(match.kites[PLAYER_ID].vy);
  };
  const dive = speedAfter(ANG / 2);
  const climb = speedAfter(0);
  assert.ok(dive > climb * 1.25, `dive ${dive}, climb ${climb}`);
});

test('a slack kite settles above the roofs instead of landing on them', () => {
  const match = createMatch(calm);
  const me = match.kites[PLAYER_ID];
  for (let i = 0; i < 1500 && !match.over; i++) {
    step(match, false);
    assert.ok(me.y < CRASH_Y, 'never sinks onto a roof');
  }
  assert.ok(me.y > 400, 'it does sink from where it started');
});

test('a kite that dives into a roof glances off it once, frayed', () => {
  const match = createMatch(calm);
  const me = match.kites[PLAYER_ID];
  me.y = 500;
  me.a = ANG / 2;
  for (let i = 0; i < 90; i++) step(match, true);
  assert.equal(me.damage, ROOF_DAMAGE, 'one brush, not a grind');
  assert.equal(me.hitBy, ROOF);
  assert.ok(dirY(me.a) < 0, 'nose knocked upwards');
  assert.ok(me.y < CRASH_Y - 40, 'and it climbs away');
});

test('a kite at the end of its string has a taut string', () => {
  const match = createMatch(calm);
  const me = match.kites[PLAYER_ID];
  for (let i = 0; i < 240; i++) step(match, true);
  assert.ok(Math.hypot(me.x - me.ax, me.y - me.ay) > STRING_LENGTH - 1);
  step(match, false);
  step(match, false);
  assert.ok(me.slack < 0.3, 'still stretched just after letting go');
});

test('a cut kite flutters down: always falling, swinging both ways', () => {
  let checked = 0;
  for (let day = 1; day <= 40 && checked < 3; day++) {
    const match = createMatch(skyForDay(day));
    let victim: Kite | null = null;
    let lastY = 0;
    let lastX = 0;
    let left = 0;
    let right = 0;
    let ticks = 0;
    while (!match.over && ticks < 220) {
      step(match, hunter(match));
      if (!victim) {
        victim = match.kites.find((k) => k.state === 'cut') ?? null;
        if (victim) {
          lastX = victim.x;
          lastY = victim.y;
        }
        continue;
      }
      assert.ok(victim.y > lastY, 'always falling');
      if (victim.x > lastX) right += 1;
      else left += 1;
      lastX = victim.x;
      lastY = victim.y;
      ticks += 1;
    }
    if (ticks < 200) continue;
    assert.ok(left > 20 && right > 20, `day ${day}: swings both ways`);
    checked += 1;
  }
  assert.ok(checked > 0, 'at least one cut kite was watched');
});
