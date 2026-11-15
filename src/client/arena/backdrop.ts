// The far scenery: sky, sun or moon, a volcano, hills and the kampung on the horizon. None of
// it moves, so it is painted once per canvas size and time of day, and kept as a picture.
//
// Then the things that do move: clouds, birds, far-off kites, swaying palms, and the air itself.

import { ROOF_Y } from '../../shared/sim/types.ts';
import type { Palette } from './mood.ts';
import { clamp, hash, TAU, wrapInto } from './view.ts';
import type { Ctx, View } from './view.ts';

/** The sky itself and its stars, drawn every frame so two times of day can blend. */
export function drawSky(ctx: Ctx, v: View, p: Palette, alpha = 1): void {
  ctx.globalAlpha = alpha;
  const width = v.right - v.left;
  const sky = ctx.createLinearGradient(0, 0, 0, ROOF_Y);
  for (const [at, colour] of p.sky) sky.addColorStop(at, colour);
  ctx.fillStyle = sky;
  ctx.fillRect(v.left - 12, v.top - 12, width + 24, v.bottom - v.top + 24);

  // Stars, where the sky is dark enough to show them.
  ctx.fillStyle = '#FFF4E0';
  for (let i = 0; i < p.stars.count; i++) {
    const x = v.left + hash(i) * width;
    const y = v.top + hash(i + 50) * (p.stars.reach - v.top);
    const fade = clamp((p.stars.reach + 10 - y) / 190, 0, 1);
    const glow = (0.15 + 0.5 * hash(i + 90)) * fade * p.stars.glow;
    const size = 0.8 + hash(i + 130) * 1.1;
    ctx.globalAlpha = Math.min(1, glow) * alpha;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

/**
 * Where the sun is at an hour of the day, on a 24-hour clock. It rises behind the mosque at six,
 * is high over the right of the sky at noon, and sets over the right-hand roofs at six. `alt`
 * is its height above the horizon, 1 at noon and below 0 at night. The moon runs the same path
 * twelve hours behind.
 */
export function skyArc(hour: number): { x: number; y: number; alt: number } {
  const turn = ((hour - 6) / 12) * Math.PI;
  const alt = Math.sin(turn);
  return {
    x: 180 - 120 * Math.cos(turn) + 70 * alt,
    y: 518 - 440 * alt,
    alt,
  };
}

const ease = (a: number, b: number, f: number) => a + (b - a) * f;

/**
 * The sun and the moon at an hour. Drawn between the sky and the hills, so they rise and set
 * behind the land. A low sun is large, warm and throws rays; a high one is small and white.
 */
export function drawSunAndMoon(ctx: Ctx, v: View, hour: number): void {
  const width = v.right - v.left;
  const sun = skyArc(hour);
  const moon = skyArc(hour - 12);

  if (moon.alt > -0.08) {
    // The moon shows as the sky darkens.
    const r = 15;
    const bright = clamp(-sun.alt * 3, 0.3, 1);
    ctx.globalAlpha = bright;
    const halo = ctx.createRadialGradient(
      moon.x,
      moon.y,
      r * 0.4,
      moon.x,
      moon.y,
      r * 3.6
    );
    halo.addColorStop(0, 'rgba(255, 240, 210, 0.26)');
    halo.addColorStop(1, 'rgba(255, 240, 210, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(moon.x - r * 4, moon.y - r * 4, r * 8, r * 8);
    ctx.fillStyle = '#F6F0D8';
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 124, 150, 0.2)';
    ctx.beginPath();
    ctx.arc(moon.x - r * 0.3, moon.y - r * 0.25, r * 0.32, 0, TAU);
    ctx.arc(moon.x + r * 0.35, moon.y + r * 0.2, r * 0.24, 0, TAU);
    ctx.arc(moon.x - r * 0.1, moon.y + r * 0.5, r * 0.18, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (sun.alt < -0.12) return;
  // How low the sun is: 1 on the horizon, 0 from mid-morning on. Its light fades as it sinks.
  const low = 1 - clamp((sun.alt - 0.05) / 0.45, 0, 1);
  const light = clamp(1 + sun.alt * 8, 0, 1);
  const glow = [
    255,
    Math.round(ease(250, 192, low)),
    Math.round(ease(226, 124, low)),
  ].join(', ');
  const reach = ease(140, 240, low);
  const r = ease(19, 27, low);

  ctx.globalAlpha = light;
  const halo = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, reach);
  halo.addColorStop(0, 'rgba(255, 250, 230, 0.95)');
  halo.addColorStop(0.11, `rgba(${glow}, 0.72)`);
  halo.addColorStop(0.42, `rgba(${glow}, 0.24)`);
  halo.addColorStop(1, `rgba(${glow}, 0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(v.left - 12, v.top - 12, width + 24, v.bottom - v.top + 24);

  if (low > 0.05) {
    // Long rays fanning up through the haze from a low sun.
    const ray = ctx.createRadialGradient(sun.x, sun.y, 30, sun.x, sun.y, 360);
    ray.addColorStop(0, `rgba(255, 232, 186, ${(0.13 * low).toFixed(3)})`);
    ray.addColorStop(1, 'rgba(255, 232, 186, 0)');
    ctx.fillStyle = ray;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * (0.08 + i * 0.105) + (hash(i + 7) - 0.5) * 0.05;
      const half = 0.022 + hash(i + 3) * 0.02;
      ctx.beginPath();
      ctx.moveTo(sun.x, sun.y);
      ctx.lineTo(
        sun.x + Math.cos(a - half) * 370,
        sun.y + Math.sin(a - half) * 370
      );
      ctx.lineTo(
        sun.x + Math.cos(a + half) * 370,
        sun.y + Math.sin(a + half) * 370
      );
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.fillStyle = low > 0.5 ? '#FFF1D2' : '#FFFCF0';
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, r, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Paints the land in front of the sky: a volcano, hills, and the far kampung. Kept as a picture. */
export function paintLand(ctx: Ctx, v: View, p: Palette): void {
  const width = v.right - v.left;

  // A volcano far away, pale in the haze.
  ctx.fillStyle = p.volcano;
  ctx.beginPath();
  ctx.moveTo(-60, 528);
  ctx.quadraticCurveTo(52, 506, 97, 436);
  ctx.lineTo(101, 432);
  ctx.lineTo(112, 433);
  ctx.quadraticCurveTo(150, 502, 262, 528);
  ctx.closePath();
  ctx.fill();

  // Hills.
  ctx.fillStyle = p.hills;
  ctx.beginPath();
  ctx.moveTo(v.left - 2, ROOF_Y + 40);
  for (let x = v.left - 2; x <= v.right + 6; x += 6)
    ctx.lineTo(x, 510 + Math.sin(x / 41) * 8 + Math.sin(x / 17 + 1) * 3);
  ctx.lineTo(v.right + 6, ROOF_Y + 40);
  ctx.closePath();
  ctx.fill();

  farKampung(ctx, v, p);

  // Haze over the horizon: far things fade into the light.
  const haze = ctx.createLinearGradient(0, 430, 0, ROOF_Y);
  haze.addColorStop(0, `rgba(${p.haze}, 0)`);
  haze.addColorStop(1, `rgba(${p.haze}, ${p.hazeAlpha})`);
  ctx.fillStyle = haze;
  ctx.fillRect(v.left - 2, 430, width + 4, ROOF_Y - 430);
}

/** The rest of the kampung, small on the horizon: roofs, a mosque, poles and a mast. */
function farKampung(ctx: Ctx, v: View, p: Palette): void {
  const base = 552;

  // Power poles and their sagging wires.
  ctx.strokeStyle = p.far;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 0.7;
  const firstPole = Math.floor(v.left / 88) - 1;
  const lastPole = Math.ceil(v.right / 88) + 1;
  for (let i = firstPole; i <= lastPole; i++) {
    const x = i * 88 + 24;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, 523);
    ctx.moveTo(x - 4, 526);
    ctx.lineTo(x + 4, 526);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 3.5, 526);
    ctx.quadraticCurveTo(x + 40, 534, x + 84.5, 526);
    ctx.moveTo(x + 3.5, 526);
    ctx.quadraticCurveTo(x + 48, 535, x + 91.5, 526);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Rows of small roofs, some with a lamp on.
  const first = Math.floor(v.left / 22) - 1;
  const last = Math.ceil(v.right / 22) + 1;
  for (let i = first; i <= last; i++) {
    const x = i * 22 + hash(i) * 6;
    const w = 14 + hash(i + 7) * 10;
    const h = 9 + hash(i + 13) * 12;
    ctx.fillStyle = p.far;
    ctx.fillRect(x, base - h, w, h + 30);
    ctx.beginPath();
    ctx.moveTo(x - 1.5, base - h);
    ctx.lineTo(x + w / 2, base - h - 5 - hash(i + 3) * 3);
    ctx.lineTo(x + w + 1.5, base - h);
    ctx.closePath();
    ctx.fill();
    if (hash(i + 29) < p.farLamps) {
      ctx.fillStyle = 'rgba(255, 207, 122, 0.85)';
      ctx.fillRect(x + w * (0.25 + hash(i + 31) * 0.4), base - h + 3, 1.7, 1.9);
    }
  }

  // The mosque: dome, crescent, minaret.
  ctx.fillStyle = p.far;
  ctx.fillRect(48, 526, 34, 30);
  ctx.beginPath();
  ctx.arc(65, 526, 12.5, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(64.4, 507, 1.2, 8);
  ctx.beginPath();
  ctx.arc(65, 506, 1.6, 0, TAU);
  ctx.fill();
  ctx.fillRect(90, 498, 4.4, 58);
  ctx.fillRect(88.6, 510, 7.2, 1.6);
  ctx.beginPath();
  ctx.arc(92.2, 498, 2.9, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(91.8, 490, 0.8, 6);

  // A telecom mast with its red lamp.
  ctx.strokeStyle = p.far;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(240, base);
  ctx.lineTo(245.2, 470);
  ctx.lineTo(250.4, base);
  for (let y = 482; y < base; y += 11) {
    const half = ((y - 470) / (base - 470)) * 5.2;
    ctx.moveTo(245.2 - half, y);
    ctx.lineTo(245.2 + half, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 110, 96, 0.95)';
  ctx.beginPath();
  ctx.arc(245.2, 469, 1.2, 0, TAU);
  ctx.fill();
}

// ───────────────────────────── Moving sky ─────────────────────────────

const PALMS = [
  [150, 492, 5],
  [204, 503, -4],
  [338, 489, 4],
  [-46, 496, -5],
  [418, 499, 5],
] as const;

const FRONDS = [
  [-17, 6],
  [-13, -5],
  [-4, -11],
  [7, -10],
  [15, -3],
  [17, 8],
] as const;

/**
 * A coconut palm bending in the wind. `sway` is how hard the wind leans on it, about -1 to 1;
 * the trunk bends from its foot and the fronds stream downwind and shiver.
 */
export function drawPalm(
  ctx: Ctx,
  x: number,
  foot: number,
  top: number,
  lean: number,
  sway: number,
  now: number,
  size = 1
): void {
  const tx = x + lean + sway * 7 * size;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4 * size;
  ctx.beginPath();
  ctx.moveTo(x, foot);
  ctx.quadraticCurveTo(x + lean * 1.6 + sway * 2, (foot + top) / 2, tx, top);
  ctx.stroke();
  ctx.lineWidth = 1.5 * size;
  FRONDS.forEach(([dx, dy], i) => {
    const shiver =
      Math.sin(now / 210 + i * 1.9 + x) * (0.6 + Math.abs(sway) * 2.2);
    const ex = tx + (dx + sway * 6) * size;
    const ey =
      top +
      (dy + 4 + shiver - Math.abs(sway) * (dx * sway > 0 ? 2 : -3)) * size;
    ctx.beginPath();
    ctx.moveTo(tx, top);
    ctx.quadraticCurveTo(
      tx + (dx * 0.55 + sway * 2) * size,
      top + (dy - 5) * size,
      ex,
      ey
    );
    ctx.stroke();
  });
  ctx.lineCap = 'butt';
}

/** The palms among the far houses. */
export function drawFarPalms(
  ctx: Ctx,
  p: Palette,
  sway: number,
  now: number
): void {
  ctx.strokeStyle = p.far;
  for (const [x, top, lean] of PALMS)
    drawPalm(ctx, x, 556, top, lean, sway, now);
}

const CLOUDS = [
  { x: 30, y: 150, s: 1.15, far: 0 },
  { x: 215, y: 96, s: 1.5, far: 0 },
  { x: 430, y: 196, s: 1.25, far: 0 },
  { x: 330, y: 240, s: 1, far: 1 },
  { x: 120, y: 312, s: 0.85, far: 1 },
  { x: 520, y: 366, s: 0.75, far: 1 },
] as const;

const PUFFS = [
  [-26, 0, 22, 9],
  [0, -6, 26, 13],
  [24, -1, 20, 9],
  [6, 4, 36, 7],
] as const;

/** Clouds. `shift` is how far the wind has carried them. */
export function drawClouds(ctx: Ctx, v: View, shift: number, p: Palette): void {
  const lo = v.left - 130;
  const hi = Math.max(v.right + 130, lo + 700);
  for (const c of CLOUDS) {
    const x = wrapInto(c.x + shift * (0.3 + 0.25 * c.far), lo, hi);
    const low = clamp(c.y / 400, 0, 1);
    const mix = (i: 0 | 1 | 2) =>
      Math.round(p.cloudHigh[i] + (p.cloudLow[i] - p.cloudHigh[i]) * low);
    ctx.fillStyle = `rgba(${mix(0)}, ${mix(1)}, ${mix(2)}, ${p.cloudAlpha})`;
    ctx.beginPath();
    for (const [dx, dy, rx, ry] of PUFFS) {
      ctx.moveTo(x + (dx + rx) * c.s, c.y + dy * c.s);
      ctx.ellipse(x + dx * c.s, c.y + dy * c.s, rx * c.s, ry * c.s, 0, 0, TAU);
    }
    ctx.fill();
    // The underside: lit by a low sun, in shadow under a high one.
    ctx.fillStyle = p.cloudUnder;
    ctx.beginPath();
    for (const [dx, dy, rx, ry] of PUFFS) {
      const cy = c.y + (dy + ry * 0.45) * c.s;
      ctx.moveTo(x + (dx + 2 + rx * 0.85) * c.s, cy);
      ctx.ellipse(
        x + (dx + 2) * c.s,
        cy,
        rx * 0.85 * c.s,
        ry * 0.42 * c.s,
        0,
        0,
        TAU
      );
    }
    ctx.fill();
  }
}

/** A small flock crossing the sky. */
export function drawBirds(
  ctx: Ctx,
  v: View,
  now: number,
  colour: string
): void {
  const lo = v.left - 70;
  const hi = Math.max(v.right + 70, lo + 520);
  const x = wrapInto(lo + now * 0.013, lo, hi);
  const y = 178 + Math.sin(now / 4100) * 16;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.9;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const row = Math.ceil(i / 2);
    const bx = x - row * 9 + hash(i + 40) * 3;
    const by = y + (i % 2 ? row : -row) * 5.2 + Math.sin(now / 900 + i) * 1.2;
    const flap = Math.sin(now / 120 + i * 1.7) * 2.3;
    ctx.moveTo(bx - 3.4, by - flap);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + 3.4, by - flap);
  }
  ctx.stroke();
}

const FAR_KITES = [
  [38, 404, '#E9D27A'],
  [128, 380, '#C96A8A'],
  [226, 414, '#8FC2B2'],
  [316, 394, '#E8935E'],
  [272, 356, '#D8D0F0'],
  [-70, 388, '#E9D27A'],
  [440, 402, '#C96A8A'],
] as const;

/** Other people's kites, far off: it is kite season and the whole kampung is out. */
export function drawFarKites(ctx: Ctx, now: number, p: Palette): void {
  FAR_KITES.forEach(([kx, ky, colour], i) => {
    const x = kx + Math.sin(now / 1700 + i * 2) * 5;
    const y = ky + Math.cos(now / 2300 + i) * 4;
    const footX = kx + (i % 2 ? 22 : -22);
    ctx.strokeStyle = `rgba(${p.string}, 0.2)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(footX, 546);
    ctx.quadraticCurveTo((footX + x) / 2, (546 + y) / 2 + 14, x, y);
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(now / 1300 + i * 3) * 0.3);
    ctx.globalAlpha = p.farKites;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, -3.6);
    ctx.lineTo(2.9, -0.6);
    ctx.lineTo(0, 3.6);
    ctx.lineTo(-2.9, -0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

// ───────────────────────────── The air ─────────────────────────────

/** A streak of moving air: it shows which way the wind blows and how hard, at its height. */
type Wisp = { x: number; y: number; beat: number };
/** A leaf torn loose and carried along. */
type Leaf = {
  x: number;
  y: number;
  seed: number;
  size: number;
  colour: string;
};

/** What the wind carries across the sky. */
export type Air = { wisps: Wisp[]; leaves: Leaf[] };

const LEAF_COLOURS = ['#C9A227', '#8FAE3B', '#B5651D', '#6E8B3D', '#D98E32'];

export function createAir(): Air {
  return {
    wisps: Array.from({ length: 15 }, (_, i) => ({
      x: hash(i + 200) * 520 - 80,
      y: 96 + i * 29 + hash(i + 210) * 12,
      beat: hash(i + 220) * TAU,
    })),
    leaves: Array.from({ length: 18 }, (_, i) => ({
      x: hash(i + 300) * 520 - 80,
      y: 170 + hash(i + 310) * 360,
      seed: hash(i + 320) * 100,
      size: 1.5 + hash(i + 330) * 1.2,
      colour: LEAF_COLOURS[i % LEAF_COLOURS.length],
    })),
  };
}

/**
 * Draws the moving air: long streaks that run with the wind, faster and bolder where it blows
 * harder, and leaves tumbling along with it. In still air the streaks fade and the leaves just
 * drift down.
 */
export function drawAir(
  ctx: Ctx,
  v: View,
  air: Air,
  windAtHeight: (y: number) => number,
  p: Palette,
  now: number,
  dt: number
): void {
  const lo = v.left - 60;
  const hi = Math.max(v.right + 60, lo + 480);

  ctx.lineCap = 'round';
  ctx.lineWidth = 0.9;
  for (const w of air.wisps) {
    const speed = windAtHeight(w.y);
    w.x = wrapInto(w.x + speed * 2 * dt, lo, hi);
    const strength = Math.abs(speed);
    if (strength < 1.5) continue;
    const dir = Math.sign(speed);
    const len = (12 + strength * 1.1) * dir;
    const pulse = 0.55 + 0.45 * Math.sin(now / 700 + w.beat);
    const alpha = (0.1 + clamp(strength / 32, 0, 1) * 0.3) * pulse;
    ctx.strokeStyle = `rgba(${p.wisp}, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(w.x - len, w.y);
    ctx.quadraticCurveTo(w.x - len * 0.45, w.y - 2.4, w.x, w.y + 0.6);
    // A strong gust curls over at its leading end.
    if (strength > 13)
      ctx.quadraticCurveTo(
        w.x + dir * 4.2,
        w.y + 1.4,
        w.x + dir * 2.4,
        w.y - 2.8
      );
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  const breeze = Math.abs(windAtHeight(300));
  const count =
    6 + Math.round(clamp(breeze / 26, 0, 1) * (air.leaves.length - 6));
  for (let i = 0; i < count; i++) {
    const leaf = air.leaves[i];
    const speed = windAtHeight(leaf.y);
    leaf.x += (speed * 2.1 + Math.sin(now / 600 + leaf.seed) * 7) * dt;
    // The wind holds a leaf up; in still air it sinks.
    leaf.y +=
      (12 +
        Math.sin(now / 450 + leaf.seed * 3) * 15 -
        Math.min(Math.abs(speed), 30) * 0.3) *
      dt;
    if (leaf.y > ROOF_Y - 8 || leaf.x < lo || leaf.x > hi) {
      // Gone past the edge or down among the roofs: another comes in from upwind.
      leaf.y = 150 + Math.random() * 330;
      leaf.x =
        Math.abs(speed) < 2
          ? lo + Math.random() * (hi - lo)
          : speed > 0
            ? lo
            : hi;
    }
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(now / (170 + leaf.seed) + leaf.seed);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = leaf.colour;
    ctx.beginPath();
    ctx.ellipse(0, 0, leaf.size, leaf.size * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
