// Puts a frame together: the still scenery, the moving sky, strings and kites, the kampung in
// front, then words and flashes. Nothing here feeds back into the simulation, so it may use
// ordinary Math.sin, Math.random and the clock freely.

import { toRadians } from '../../shared/sim/trig.ts';
import { CRASH_Y, PLAYER_ID, SKY_H } from '../../shared/sim/types.ts';
import type { Kite, Match } from '../../shared/sim/types.ts';
import { windAt } from '../../shared/sim/wind.ts';
import {
  createAir,
  drawAir,
  drawBirds,
  drawClouds,
  drawFarKites,
  drawFarPalms,
  drawSky,
  drawSunAndMoon,
  paintLand,
} from './backdrop.ts';
import type { Air } from './backdrop.ts';
import { rivalLook, tailYOf } from './design.ts';
import type { Look } from './design.ts';
import { drawKampungLife, paintKampung } from './kampung.ts';
import {
  createTail,
  drawBits,
  drawKite,
  drawLooseStrings,
  drawSparks,
  drawStrings,
  throwBits,
  updateTail,
} from './kites.ts';
import type { Bit, Pose, Tail } from './kites.ts';
import { blendPalette, MOOD_HOUR, moodsAt, PALETTES } from './mood.ts';
import type { Mood, Palette } from './mood.ts';
import { clamp, inScreen, inWorld, TAU } from './view.ts';
import type { Ctx, View } from './view.ts';

export { fit } from './view.ts';
export type { View } from './view.ts';
export type { Pose } from './kites.ts';

/** A short-lived word over the sky: "PUTUS! +100". */
export type Floater = {
  x: number;
  y: number;
  text: string;
  born: number;
  tone: 'gain' | 'loss';
};

export type Scene = {
  match: Match;
  poses: Map<number, Pose>;
  floaters: Floater[];
  now: number;
  /** The simulation tick being shown; it keeps counting after the round is over. */
  tick: number;
  /** Show the player's heading marker. */
  showHeading: boolean;
  /** The time of day to draw the sky in. */
  mood: Mood;
  /** How the player's kite looks, and the name it flies under. */
  player: { look: Look; name: string };
  /** How close the player's string is to going: 0 fine, 1 worn, 2 nearly gone. */
  fray: 0 | 1 | 2;
};

const CALM =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Still layers are painted this many CSS pixels larger all round, so a shake shows no edge. */
const PAD = 8;
const SHAKE_MS = 280;
const FLASH_MS = 220;
/** A ring of light spreads from the point where a string is cut. */
const RING_MS = 460;

type Ring = { x: number; y: number; born: number; colour: string };
/** A change of time of day takes a little longer the more hours the sky turns through. */
const TRIP_MIN_MS = 900;
const TRIP_MS_PER_HOUR = 140;
const TRIP_MAX_MS = 2200;

/** The still pictures for one time of day: the land behind the kites and the kampung in front. */
type Layers = { land: HTMLCanvasElement; front: HTMLCanvasElement };

/** A change from one time of day to another: the sun and moon run along their path. */
type Trip = { from: number; by: number; start: number; ms: number; to: Mood };

/** What the drawing remembers between frames. One per arena. */
export type Stage = {
  /** The canvas size the still pictures were painted for, and the pictures for each time of day. */
  size: string;
  layers: Map<Mood, Layers>;
  /** The hour the sky shows, and the change of time it is part way through, if any. */
  hour: number | null;
  trip: Trip | null;
  tails: Map<number, Tail>;
  bits: Bit[];
  rings: Ring[];
  air: Air;
  cloudShift: number;
  last: number;
  shakeAt: number;
  shakePower: number;
  flashAt: number;
  flashColour: string;
};

export function createStage(): Stage {
  return {
    size: '',
    layers: new Map(),
    hour: null,
    trip: null,
    tails: new Map(),
    bits: [],
    rings: [],
    air: createAir(),
    cloudShift: 0,
    last: 0,
    shakeAt: -1e9,
    shakePower: 0,
    flashAt: -1e9,
    flashColour: '255, 240, 200',
  };
}

/** Forgets the kites of the last round, so tails do not whip across the sky into the new one. */
export function resetStage(stage: Stage): void {
  stage.tails.clear();
  stage.bits.length = 0;
  stage.rings.length = 0;
}

/** Shakes the picture, and optionally flashes it with a colour given as "r, g, b". */
export function jolt(
  stage: Stage,
  now: number,
  power: number,
  flash?: string
): void {
  stage.shakeAt = now;
  stage.shakePower = power;
  if (flash) {
    stage.flashAt = now;
    stage.flashColour = flash;
  }
}

/** Throws scraps of paper and sparks from a point in the sky. */
export function burst(
  stage: Stage,
  x: number,
  y: number,
  colours: readonly string[],
  now: number,
  count = 40
): void {
  throwBits(stage.bits, x, y, colours, now, count);
}

/** A ring of light from a point in the sky, in a colour given as "r, g, b". */
export function shock(
  stage: Stage,
  x: number,
  y: number,
  now: number,
  colour = '255, 240, 200'
): void {
  stage.rings.push({ x, y, born: now, colour });
}

function drawRings(ctx: Ctx, rings: Ring[], now: number): void {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    const t = (now - r.born) / RING_MS;
    if (t >= 1) {
      rings.splice(i, 1);
      continue;
    }
    const out = 1 - Math.pow(1 - t, 3);
    // A bright heart that is gone almost at once.
    const glow = clamp(1 - t / 0.4, 0, 1);
    if (glow > 0) {
      const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, 34);
      g.addColorStop(0, `rgba(255, 252, 235, ${(glow * 0.85).toFixed(3)})`);
      g.addColorStop(1, `rgba(${r.colour}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(r.x - 34, r.y - 34, 68, 68);
    }
    for (const [reach, width, alpha] of [
      [70, 4.5, 0.9],
      [44, 2, 0.55],
    ]) {
      ctx.strokeStyle = `rgba(${r.colour}, ${((1 - t) * alpha).toFixed(3)})`;
      ctx.lineWidth = 0.6 + (1 - t) * width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + out * reach, 0, TAU);
      ctx.stroke();
    }
  }
}

const easeOutBack = (t: number) =>
  1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

function paintLayer(
  v: View,
  palette: Palette,
  paint: (ctx: Ctx, v: View, p: Palette) => void
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((v.w + PAD * 2) * v.dpr));
  canvas.height = Math.max(1, Math.round((v.h + PAD * 2) * v.dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const edge = PAD / v.scale;
  inWorld(ctx, v, PAD, PAD);
  paint(
    ctx,
    {
      ...v,
      left: v.left - edge,
      right: v.right + edge,
      top: v.top - edge,
      bottom: v.bottom + edge,
    },
    palette
  );
  return canvas;
}

function layersFor(stage: Stage, v: View, mood: Mood): Layers {
  let layers = stage.layers.get(mood);
  if (!layers) {
    const p = PALETTES[mood];
    layers = {
      land: paintLayer(v, p, paintLand),
      front: paintLayer(v, p, paintKampung),
    };
    stage.layers.set(mood, layers);
  }
  return layers;
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * The hour the sky shows this frame. When the time of day changes, the clock runs the short way
 * round to the new hour, so the sun climbs or sinks and the moon rises or sets on the way.
 */
function clockHour(stage: Stage, v: View, mood: Mood, now: number): number {
  const target = MOOD_HOUR[mood];
  if (stage.hour === null) stage.hour = target;
  if (stage.trip ? stage.trip.to !== mood : stage.hour !== target) {
    let by = (target - stage.hour) % 24;
    if (by > 12) by -= 24;
    if (by < -12) by += 24;
    stage.trip = {
      from: stage.hour,
      by,
      start: now,
      ms: clamp(
        TRIP_MIN_MS + Math.abs(by) * TRIP_MS_PER_HOUR,
        TRIP_MIN_MS,
        TRIP_MAX_MS
      ),
      to: mood,
    };
    // Paint every time of day the trip passes through now, so none is painted mid-way.
    for (let k = 0; k <= 8; k++) {
      const { a, b } = moodsAt(stage.hour + (by * k) / 8);
      layersFor(stage, v, a);
      layersFor(stage, v, b);
    }
  }
  if (stage.trip) {
    const t = clamp((now - stage.trip.start) / stage.trip.ms, 0, 1);
    stage.hour = stage.trip.from + stage.trip.by * easeInOut(t);
    if (t >= 1) {
      stage.hour = target;
      stage.trip = null;
      // Keep only the pictures of the time of day on show; the rest take memory on a phone.
      for (const m of [...stage.layers.keys()])
        if (m !== mood) stage.layers.delete(m);
    }
  }
  return stage.hour;
}

/** Draws a still picture, or two blended part way, a little larger than the canvas. */
function drawLayers(
  ctx: Ctx,
  v: View,
  pick: (l: Layers) => HTMLCanvasElement,
  a: Layers,
  b: Layers,
  fade: number
): void {
  ctx.drawImage(pick(a), -PAD, -PAD, v.w + PAD * 2, v.h + PAD * 2);
  if (fade <= 0) return;
  ctx.globalAlpha = fade;
  ctx.drawImage(pick(b), -PAD, -PAD, v.w + PAD * 2, v.h + PAD * 2);
  ctx.globalAlpha = 1;
}

export function drawScene(ctx: Ctx, v: View, scene: Scene, stage: Stage): void {
  const { match, poses, now, tick } = scene;

  const dt = clamp(now - stage.last, 0, 50) / 1000;
  stage.last = now;

  const size = `${v.w}x${v.h}@${v.dpr}`;
  if (stage.size !== size) {
    stage.size = size;
    stage.layers.clear();
  }
  // The time of day on show: one of the four, or part way from one to the next.
  const hour = clockHour(stage, v, scene.mood, now);
  const { a, b, f } = moodsAt(hour);
  const fade = f * f * (3 - 2 * f);
  const p = blendPalette(PALETTES[a], PALETTES[b], fade);
  const layersA = layersFor(stage, v, a);
  const layersB = fade > 0 ? layersFor(stage, v, b) : layersA;

  // A cut or a knock shakes the picture for a moment.
  const shake =
    stage.shakePower * clamp(1 - (now - stage.shakeAt) / SHAKE_MS, 0, 1);
  const sx = Math.sin(now * 0.093) * shake;
  const sy = Math.cos(now * 0.117) * shake;
  const px = 1 / v.scale;
  const windOf = (y: number) => windAt(match.sky, tick, y).x;
  const lookFor = (k: Kite): Look =>
    k.id === PLAYER_ID ? scene.player.look : rivalLook(k);

  // The sky, then the sun and moon, then the land they rise and set behind.
  inWorld(ctx, v, sx, sy);
  drawSky(ctx, v, PALETTES[a]);
  if (fade > 0) drawSky(ctx, v, PALETTES[b], fade);
  drawSunAndMoon(ctx, v, hour);
  inScreen(ctx, v, sx, sy);
  drawLayers(ctx, v, (l) => l.land, layersA, layersB, fade);

  // The moving sky.
  inWorld(ctx, v, sx, sy);
  const breeze = windOf(200);
  stage.cloudShift += (breeze * 0.5 + (breeze >= 0 ? 2 : -2)) * dt;
  drawFarPalms(
    ctx,
    p,
    clamp(windOf(500) / 34, -1, 1) + Math.sin(now / 1100) * 0.05,
    now
  );
  drawClouds(ctx, v, stage.cloudShift, p);
  drawFarKites(ctx, now, p);
  if (p.birds) drawBirds(ctx, v, now, p.birds);
  drawAir(ctx, v, stage.air, windOf, p, now, dt);

  // Strings first, so kites sit on top of them.
  drawStrings(
    ctx,
    match,
    poses,
    tick,
    now,
    px,
    p.string,
    scene.player.look.line
  );
  drawLooseStrings(ctx, match, poses, tick, windOf(300), now, px, p.string);
  drawSparks(ctx, match.contacts, now, px);

  for (const k of match.kites) {
    const pose = poses.get(k.id) ?? { x: k.x, y: k.y, angle: toRadians(k.a) };
    if (k.state === 'crashed') {
      // Snagged on a roof, lying where it came down.
      drawKite(
        ctx,
        k,
        { x: k.x, y: CRASH_Y + 9, angle: 1.9 + k.id },
        undefined,
        {
          design: lookFor(k),
          mine: k.id === PLAYER_ID,
          alpha: 0.92,
          face: 0.8,
          marker: false,
          ink: p.marker,
        }
      );
      stage.tails.delete(k.id);
      continue;
    }
    if (pose.y > SKY_H + 60) continue;
    const design = lookFor(k);
    const tailY = tailYOf(design.shape);
    let tail = stage.tails.get(k.id);
    if (!tail) {
      tail = createTail(pose.x, pose.y + tailY);
      stage.tails.set(k.id, tail);
    }
    updateTail(tail, pose, windOf(pose.y), dt, tailY);
    const flying = k.state === 'flying';
    // Slack paper flutters; a cut kite tumbles, showing its edge now and then.
    const flutter = 0.5 + 0.5 * Math.sin(now / (flying ? 95 : 150) + k.id * 2);
    drawKite(ctx, k, pose, tail, {
      design,
      mine: k.id === PLAYER_ID,
      alpha: flying ? 1 : 0.82,
      face: flying ? 1 - 0.2 * k.slack * flutter : 1 - 0.45 * flutter,
      marker: flying && k.id === PLAYER_ID && scene.showHeading,
      ink: p.marker,
    });
  }
  drawRings(ctx, stage.rings, now);
  drawBits(ctx, stage.bits, windOf(300), now, dt);

  // The kampung in front.
  inScreen(ctx, v, sx, sy);
  drawLayers(ctx, v, (l) => l.front, layersA, layersB, fade);
  inWorld(ctx, v, sx, sy);
  drawKampungLife(ctx, match.kites, windOf(540), now, p, lookFor);

  // Names under the kites. Tags never cover each other: the player's own is placed first, then
  // Raja Langit, then the rest, each moved down a step when its spot is taken and left out for
  // the moment when no step is free. The player's own is in the accent colour, drawn last.
  inScreen(ctx, v, sx, sy);
  ctx.font = `600 ${Math.max(10, 11 * v.scale)}px 'Schibsted Grotesk Variable', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  const rank = (k: Kite) =>
    k.id === PLAYER_ID ? 0 : k.kind === 'king' ? 1 : 2;
  const placeOrder = match.kites
    .filter((k) => k.state === 'flying')
    .sort((a, b) => rank(a) - rank(b));
  const taken: { l: number; r: number; t: number; b: number }[] = [];
  const free = (l: number, r: number, t: number, b: number) =>
    !taken.some(
      (o) => l < o.r + 3 && r > o.l - 3 && t < o.b + 2 && b > o.t - 2
    );
  const tags: {
    name: string;
    x: number;
    y: number;
    w: number;
    mine: boolean;
  }[] = [];
  for (const k of placeOrder) {
    const mine = k.id === PLAYER_ID;
    const name = mine ? scene.player.name : k.name;
    const pose = poses.get(k.id) ?? { x: k.x, y: k.y, angle: 0 };
    const w = ctx.measureText(name).width + 10;
    // Kept inside the canvas, so a kite near the edge still shows its whole name.
    const x = clamp(v.ox + pose.x * v.scale, w / 2 + 2, v.w - w / 2 - 2);
    const base = v.oy + (pose.y + 42) * v.scale;
    const y = [0, 16, 32]
      .map((step) => base + step)
      .find((at) => free(x - w / 2, x + w / 2, at - 10, at + 5));
    if (y === undefined && !mine) continue;
    const at = y ?? base;
    taken.push({ l: x - w / 2, r: x + w / 2, t: at - 10, b: at + 5 });
    tags.push({ name, x, y: at, w, mine });
  }
  for (const tag of tags.reverse()) {
    ctx.fillStyle = tag.mine
      ? 'rgba(255, 179, 71, 0.94)'
      : 'rgba(20, 16, 40, 0.55)';
    ctx.fillRect(tag.x - tag.w / 2, tag.y - 10, tag.w, 15);
    ctx.fillStyle = tag.mine ? '#2A1606' : 'rgba(255, 246, 232, 0.95)';
    ctx.fillText(tag.name, tag.x, tag.y + 1);
  }

  // Floating words.
  for (const f of scene.floaters) {
    const age = (now - f.born) / 1000;
    if (age > 1.6) continue;
    // The word springs up past its size and settles.
    const pop = 0.45 + 0.55 * easeOutBack(clamp(age / 0.32, 0, 1));
    const x = v.ox + f.x * v.scale;
    const y = v.oy + f.y * v.scale - age * 34;
    ctx.globalAlpha = clamp(1 - (age - 1) / 0.6, 0, 1);
    ctx.font = `800 ${Math.max(14, 17 * v.scale) * pop}px 'Bricolage Grotesque Variable', system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20, 12, 30, 0.75)';
    ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.tone === 'gain' ? '#FFE08A' : '#FF8A7A';
    ctx.fillText(f.text, x, y);
    ctx.globalAlpha = 1;
  }

  // The edges of the sky pulse red while the player's string is nearly gone.
  if (scene.fray > 0) {
    const urgent = scene.fray > 1;
    const beat = CALM ? 1 : 0.5 + 0.5 * Math.sin(now / (urgent ? 85 : 200));
    const strength = (urgent ? 0.8 : 0.42) * (0.45 + 0.55 * beat);
    inScreen(ctx, v);
    const g = ctx.createRadialGradient(
      v.w / 2,
      v.h * 0.48,
      Math.min(v.w, v.h) * 0.3,
      v.w / 2,
      v.h * 0.48,
      Math.hypot(v.w, v.h) * 0.58
    );
    g.addColorStop(0, 'rgba(255, 40, 30, 0)');
    g.addColorStop(1, `rgba(255, 40, 30, ${strength.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.w, v.h);
  }

  // A flash when a string goes.
  const flash = clamp(1 - (now - stage.flashAt) / FLASH_MS, 0, 1);
  if (flash > 0) {
    inScreen(ctx, v);
    ctx.fillStyle = `rgba(${stage.flashColour}, ${(flash * 0.3).toFixed(3)})`;
    ctx.fillRect(0, 0, v.w, v.h);
  }
}
