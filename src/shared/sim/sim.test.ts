import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide } from './ai.ts';
import { crossing } from './geometry.ts';
import { createMatch, replay, step, validTaps, watch } from './match.ts';
import type { Taps } from './match.ts';
import { random } from './random.ts';
import { PLAYER_ANCHOR_X, skyForDay } from './sky.ts';
import { ANG, cosA, dirX, dirY, sinA } from './trig.ts';
import {
  CRASH_Y,
  PLAYER_ID,
  ROOF_Y,
  ROUND_TICKS,
  SKY_W,
  STRING_LENGTH,
  TOP_Y,
} from './types.ts';
import type { Match } from './types.ts';
import { WIND_HIGH, WIND_LOW, windAt, windShare } from './wind.ts';

/** Plays a round with a policy, recording the taps exactly as the client does. */
function play(
  day: number,
  policy: (m: Match) => boolean
): { match: Match; taps: Taps } {
  const match = createMatch(skyForDay(day));
  const taps: Taps = [];
  let pull = false;
  while (!match.over) {
    const want = policy(match);
    if (want !== pull) {
      taps.push(match.tick);
      pull = want;
    }
    step(match, pull);
  }
  return { match, taps };
}

const randomTapper = (seed: number) => {
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

/** Plays like a rival would, and defends when its string is rubbed. */
const hunter = (m: Match) => {
  const me = m.kites[PLAYER_ID];
  if (m.contacts.some((c) => c.a === PLAYER_ID || c.b === PLAYER_ID))
    return true;
  return decide({ ...me, style: 'gesit', aim: 0.9 }, m);
};

const fingerprint = (m: Match) =>
  JSON.stringify({
    tick: m.tick,
    score: m.score,
    cuts: m.cuts,
    reason: m.reason,
    events: m.events,
    kites: m.kites,
  });

test('the sine table matches Math.sin closely and is exactly symmetric', () => {
  for (let a = 0; a < ANG; a++) {
    const exact = Math.sin((a * 2 * Math.PI) / ANG);
    assert.ok(Math.abs(sinA(a) - exact) < 1e-12, `sin(${a})`);
    assert.equal(sinA(a), -sinA(a + ANG / 2));
    assert.equal(cosA(a), sinA(a + ANG / 4));
  }
  assert.equal(sinA(0), 0);
  assert.equal(dirX(0), 0);
  assert.equal(dirY(0), -1, 'heading 0 points up the screen');
  assert.equal(dirX(256), 1, 'heading 256 points right');
});

test('segments that cross are found, segments that miss are not', () => {
  assert.deepEqual(crossing(0, 0, 10, 10, 0, 10, 10, 0), {
    x: 5,
    y: 5,
    t: 0.5,
    u: 0.5,
  });
  assert.equal(crossing(0, 0, 10, 0, 0, 1, 10, 1), null, 'parallel');
  assert.equal(crossing(0, 0, 4, 4, 6, 0, 10, -4), null, 'apart');
});

test('the same sky is built from the same day, and days differ', () => {
  assert.deepEqual(skyForDay(9), skyForDay(9));
  const winds = new Set<string>();
  for (let d = 1; d <= 30; d++) {
    const sky = skyForDay(d);
    assert.equal(sky.rivals.length, 3);
    assert.deepEqual(sky.rivals.map((r) => r.style).sort(), [
      'gesit',
      'kalem',
      'nekat',
    ]);
    assert.ok(sky.rivals.every((r) => r.anchorX !== PLAYER_ANCHOR_X));
    winds.add(
      `${sky.windX},${sky.gustAmp},${sky.rivals.map((r) => r.name).join()}`
    );
  }
  assert.ok(winds.size > 25);
});

test('a round replayed from its taps is identical, tick for tick', () => {
  for (let day = 1; day <= 40; day++) {
    for (const policy of [randomTapper(day), hunter]) {
      const live = play(day, policy);
      const again = replay(skyForDay(day), live.taps);
      assert.equal(fingerprint(again), fingerprint(live.match), `day ${day}`);
    }
  }
});

test('kites stay on their strings and inside the sky', () => {
  for (let day = 1; day <= 20; day++) {
    const match = createMatch(skyForDay(day));
    const policy = randomTapper(day * 7);
    while (!match.over) {
      step(match, policy(match));
      for (const k of match.kites) {
        if (k.state !== 'flying') continue;
        const d = Math.sqrt((k.x - k.ax) ** 2 + (k.y - k.ay) ** 2);
        assert.ok(d <= STRING_LENGTH + 1e-9, 'string length');
        assert.ok(k.x >= 8 && k.x <= SKY_W - 8, 'sides');
        assert.ok(k.y >= TOP_Y && k.y <= CRASH_Y, 'top and roofs');
      }
    }
  }
});

test('rivals never cut each other, and only the player scores', () => {
  for (let day = 1; day <= 40; day++) {
    const { match } = play(day, randomTapper(day));
    for (const e of match.events) {
      if (e.type !== 'cut') continue;
      assert.ok(
        e.victim === PLAYER_ID || e.by === PLAYER_ID,
        `day ${day}: rival cut a rival`
      );
      assert.equal(e.points, e.by === PLAYER_ID ? 100 : 0);
    }
    const cutByPlayer = match.events.filter(
      (e) => e.type === 'cut' && e.by === PLAYER_ID
    ).length;
    assert.equal(match.cuts, cutByPlayer);
  }
});

test('a round always ends, within the time limit, with a reason and the right bonus', () => {
  for (let day = 1; day <= 40; day++) {
    const { match } = play(day, randomTapper(day + 100));
    assert.ok(match.over);
    assert.ok(match.tick <= ROUND_TICKS);
    const end = match.events.at(-1);
    assert.equal(end?.type, 'end');
    if (end?.type !== 'end') continue;
    assert.equal(end.reason, match.reason);
    if (match.reason === 'time') assert.equal(end.points, 150);
    if (match.reason === 'cut' || match.reason === 'crashed')
      assert.equal(end.points, 0);
    if (match.reason === 'cleared') assert.ok(end.points >= 150);
    assert.equal(match.score, match.cuts * 100 + end.points);
  }
});

test('a player who never pulls is not cut in the first seconds', () => {
  for (let day = 1; day <= 40; day++) {
    const { match } = play(day, (m) => m.tick === 0);
    assert.ok(
      match.tick > 4 * 60,
      `day ${day}: over after ${match.tick} ticks`
    );
  }
});

test('the wind swings around its steady value, and is weaker near the roofs', () => {
  const sky = skyForDay(3);
  assert.equal(windShare(ROOF_Y), WIND_LOW);
  assert.equal(windShare(TOP_Y), WIND_HIGH);
  for (let y = TOP_Y; y < ROOF_Y; y += 20)
    assert.ok(windShare(y) > windShare(y + 20), 'stronger higher up');
  for (let t = 0; t < ROUND_TICKS; t += 37) {
    for (const y of [TOP_Y, 300, ROOF_Y]) {
      const w = windAt(sky, t, y);
      const steady = sky.windX * windShare(y);
      assert.ok(
        Math.abs(w.x - steady) <= sky.gustAmp * windShare(y) + 1e-9,
        'gusts stay within their strength'
      );
    }
  }
});

test('taps must be whole, increasing, and inside the round', () => {
  assert.ok(validTaps([0, 10, 25]));
  assert.ok(validTaps([]));
  assert.ok(!validTaps([0, 0]));
  assert.ok(!validTaps([5, 3]));
  assert.ok(!validTaps([-1]));
  assert.ok(!validTaps([0.5]));
  assert.ok(!validTaps([ROUND_TICKS]));
  assert.ok(!validTaps('0,1'));
});

test('after the player is down the rivals fight on, and the scored round is untouched', () => {
  let duels = 0;
  let watched = 0;
  for (let day = 1; day <= 60; day++) {
    const { match } = play(day, randomTapper(day));
    if (match.reason !== 'cut' && match.reason !== 'crashed') continue;
    const scored = fingerprint(match);
    const show = structuredClone(match);
    const from = show.events.length;
    while (watch(show)) assert.ok(show.tick <= ROUND_TICKS);
    watched += 1;
    assert.equal(fingerprint(match), scored, 'the scored round is untouched');
    assert.equal(show.score, match.score, 'watching scores nothing');
    assert.equal(show.cuts, match.cuts);
    assert.ok(show.tick >= match.tick);
    const later = show.events.slice(from);
    assert.ok(later.every((e) => e.type !== 'end'));
    if (later.some((e) => e.type === 'cut')) duels += 1;
  }
  assert.ok(watched > 20, 'enough rounds ended with the player down');
  assert.ok(duels > 5, 'rivals do cut each other once the player is out');
});
