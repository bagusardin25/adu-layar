// The near kampung: the roofs the flyers stand on, and the life on them.
//
// The houses do not move, so they are painted once per canvas size and time of day: in their
// daylight colours first, then washed with the colour of the hour, then lamps and the light on
// the ridges on top. The flyers, the flag, the washing and the trees are drawn every frame.

import { ROOF_Y } from '../../shared/sim/types.ts';
import type { Kite } from '../../shared/sim/types.ts';
import { drawPalm } from './backdrop.ts';
import type { Look } from './design.ts';
import { lit } from './mood.ts';
import type { Palette } from './mood.ts';
import { clamp, hash, rounded, TAU } from './view.ts';
import type { Ctx, View } from './view.ts';

/** The five flyers' houses meet at these lines; each flyer stands mid-roof. */
const CORE_EDGES = [10, 74, 143, 217, 286, 350];
const ROOFS = ['#B5553A', '#A8492E', '#C0603F', '#9E4A33'];
const WALLS = ['#E8D3B0', '#DCC0A0', '#EADCC0', '#C9D6C0', '#E6C0B0'];
const DARK = '#1E1420';

const FLAG = { x: 217, top: 523 };
const WASHING = { x0: 126, x1: 163, y: 556 };

type House = { x0: number; x1: number; ridge: number; seed: number };

function houses(v: View): House[] {
  const edges = CORE_EDGES.slice();
  while (edges[0] > v.left - 70) edges.unshift(edges[0] - 64);
  while (edges[edges.length - 1] < v.right + 70)
    edges.push(edges[edges.length - 1] + 64);
  const out: House[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const x0 = edges[i];
    const x1 = edges[i + 1];
    const seed = Math.round(x0);
    const core = x0 >= CORE_EDGES[0] && x1 <= CORE_EDGES[CORE_EDGES.length - 1];
    out.push({
      x0,
      x1,
      seed,
      ridge: core ? ROOF_Y : ROOF_Y + 5 + hash(seed) * 11,
    });
  }
  return out;
}

/** Where a house's window is. */
const windowOf = (h: House) => {
  const w = h.x1 - h.x0;
  return { x: h.x0 + w * 0.16, y: h.ridge + 30, w: w * 0.24, h: 14 };
};

/** Paints the houses and everything fixed to them. The context must be in sky units. */
export function paintKampung(ctx: Ctx, v: View, p: Palette): void {
  const all = houses(v);
  for (const h of all) house(ctx, v, h);
  fixtures(ctx, v);

  // The colour of the hour, laid over everything painted so far and nothing else.
  if (p.tint) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = p.tint;
    ctx.fillRect(v.left - 2, 500, v.right - v.left + 4, v.bottom - 500 + 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  for (const h of all) {
    // Lamps in the windows.
    if (hash(h.seed + 5) < p.lamps) {
      const win = windowOf(h);
      ctx.fillStyle = 'rgba(255, 196, 110, 0.22)';
      ctx.fillRect(win.x - 3, win.y - 3, win.w + 6, win.h + 6);
      ctx.fillStyle = '#FFD68A';
      ctx.fillRect(win.x, win.y, win.w, win.h);
      ctx.strokeStyle = 'rgba(52, 30, 30, 0.8)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(win.x, win.y, win.w, win.h);
      ctx.beginPath();
      ctx.moveTo(win.x + win.w / 2, win.y);
      ctx.lineTo(win.x + win.w / 2, win.y + win.h);
      ctx.stroke();
    }
    // The light of the sky along the ridge and down one slope.
    const inset = (h.x1 - h.x0) * 0.2;
    ctx.strokeStyle = p.ridge;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(h.x0 + inset, h.ridge);
    ctx.lineTo(h.x1 - inset, h.ridge);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(h.x1 - inset, h.ridge);
    ctx.lineTo(h.x1 + 2, h.ridge + 20);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function house(ctx: Ctx, v: View, h: House): void {
  const w = h.x1 - h.x0;
  const eave = h.ridge + 20;

  ctx.fillStyle = WALLS[Math.floor(hash(h.seed + 1) * WALLS.length)];
  ctx.fillRect(h.x0 + 3, eave - 1, w - 6, v.bottom - eave + 3);
  // The eave throws a shadow, and the wall darkens towards the lane.
  const shade = ctx.createLinearGradient(0, eave, 0, eave + 70);
  shade.addColorStop(0, 'rgba(34, 18, 40, 0.34)');
  shade.addColorStop(0.12, 'rgba(34, 18, 40, 0.08)');
  shade.addColorStop(1, 'rgba(34, 18, 40, 0.3)');
  ctx.fillStyle = shade;
  ctx.fillRect(h.x0 + 3, eave - 1, w - 6, v.bottom - eave + 3);

  // A window and a door.
  const win = windowOf(h);
  ctx.fillStyle = 'rgba(44, 34, 56, 0.82)';
  ctx.fillRect(win.x, win.y, win.w, win.h);
  ctx.strokeStyle = 'rgba(52, 30, 30, 0.8)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(win.x, win.y, win.w, win.h);
  ctx.beginPath();
  ctx.moveTo(win.x + win.w / 2, win.y);
  ctx.lineTo(win.x + win.w / 2, win.y + win.h);
  ctx.stroke();
  ctx.fillStyle = 'rgba(74, 44, 36, 0.9)';
  ctx.fillRect(h.x0 + w * 0.6, eave + 9, w * 0.2, 60);

  // The roof: clay tiles in rows.
  const inset = w * 0.2;
  ctx.fillStyle = ROOFS[Math.floor(hash(h.seed + 2) * ROOFS.length)];
  ctx.beginPath();
  ctx.moveTo(h.x0 - 2, eave);
  ctx.lineTo(h.x0 + inset, h.ridge);
  ctx.lineTo(h.x1 - inset, h.ridge);
  ctx.lineTo(h.x1 + 2, eave);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 10, 8, 0.34)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let r = 1; r < 4; r++) {
    const y = h.ridge + r * 5;
    const spread = ((inset + 2) * r) / 4;
    ctx.moveTo(h.x0 + inset - spread, y);
    ctx.lineTo(h.x1 - inset + spread, y);
  }
  for (let x = h.x0 + inset + 4; x < h.x1 - inset; x += 5.5) {
    const lean = ((x - (h.x0 + h.x1) / 2) / (w / 2 - inset)) * (inset + 2);
    ctx.moveTo(x, h.ridge + 1);
    ctx.lineTo(x + lean * 0.9, eave - 0.5);
  }
  ctx.stroke();
}

/** Things fixed to the roofs: a water tank, an aerial, poles, a cat, and the lane's wires. */
function fixtures(ctx: Ctx, v: View): void {
  // A water tank on its stand.
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(334.5, 582);
  ctx.lineTo(334.5, 557);
  ctx.moveTo(345.5, 582);
  ctx.lineTo(345.5, 557);
  ctx.moveTo(334.5, 566);
  ctx.lineTo(345.5, 574);
  ctx.moveTo(332.5, 557);
  ctx.lineTo(347.5, 557);
  ctx.stroke();
  ctx.fillStyle = '#E0782E';
  rounded(ctx, 333.5, 541.5, 13, 15, 2.4);
  ctx.fill();
  ctx.fillStyle = 'rgba(40, 16, 10, 0.3)';
  ctx.fillRect(333.5, 546, 13, 1);
  ctx.fillRect(333.5, 551, 13, 1);
  ctx.fillStyle = 'rgba(255, 220, 170, 0.5)';
  ctx.fillRect(344.6, 543, 1.2, 12);

  // A TV aerial.
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(74, 584);
  ctx.lineTo(74, 532);
  ctx.moveTo(66, 536);
  ctx.lineTo(82, 536);
  for (const x of [67.5, 71, 77, 80.5]) {
    ctx.moveTo(x, 533);
    ctx.lineTo(x, 539);
  }
  ctx.stroke();

  // The flagpole (the flag itself moves) and the posts of the washing line.
  ctx.strokeStyle = '#6A4A30';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(FLAG.x, 584);
  ctx.lineTo(FLAG.x, FLAG.top - 1.5);
  ctx.stroke();
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(WASHING.x0, 580);
  ctx.lineTo(WASHING.x0, WASHING.y - 1);
  ctx.moveTo(WASHING.x1, 580);
  ctx.lineTo(WASHING.x1, WASHING.y - 1);
  ctx.stroke();

  // A cat watching from a ridge.
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.ellipse(267, 557, 3.3, 3, 0, 0, TAU);
  ctx.arc(269.8, 553.2, 1.9, 0, TAU);
  ctx.moveTo(268.4, 552.2);
  ctx.lineTo(268.8, 549.9);
  ctx.lineTo(270, 551.6);
  ctx.lineTo(271, 549.9);
  ctx.lineTo(271.5, 552.4);
  ctx.fill();
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(264, 558.5);
  ctx.quadraticCurveTo(260.4, 558.5, 260.6, 554.6);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Power lines strung along the lane below.
  ctx.strokeStyle = 'rgba(20, 12, 24, 0.5)';
  ctx.lineWidth = 0.7;
  for (const [y, sag] of [
    [600, 7],
    [606, 8],
  ] as const) {
    ctx.beginPath();
    for (let x = Math.floor(v.left / 150) * 150 - 40; x < v.right; x += 150) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 75, y + sag, x + 150, y);
    }
    ctx.stroke();
  }
}

/**
 * Everything on the roofs that moves: the trees at the edges, the washing, the flag and the
 * flyers. `wind` is the wind just above the roofs.
 */
export function drawKampungLife(
  ctx: Ctx,
  kites: Kite[],
  wind: number,
  now: number,
  p: Palette,
  lookFor: (k: Kite) => Look
): void {
  const sway = clamp(wind / 34, -1, 1) + Math.sin(now / 900) * 0.06;

  // Banana leaves at one side and a palm at the other frame the sky, and lean with the wind.
  ctx.fillStyle = p.foliage;
  for (const [x, lean, tip, i] of [
    [-4, 14, 531, 0],
    [-8, -9, 537, 1],
    [-2, 3, 519, 2],
  ] as const) {
    const tx =
      x +
      lean +
      sway * 7 +
      Math.sin(now / 260 + i * 2) * (0.5 + Math.abs(sway) * 1.6);
    ctx.beginPath();
    ctx.moveTo(x, 606);
    ctx.bezierCurveTo(x - 10, 584, tx - 9, tip + 24, tx, tip);
    ctx.bezierCurveTo(tx + 9, tip + 26, x + 10, 584, x, 606);
    ctx.fill();
  }
  ctx.strokeStyle = p.foliage;
  drawPalm(ctx, 366, 610, 512, -2, sway, now, 1.12);

  // Washing on the line leans with the wind.
  ctx.strokeStyle = 'rgba(30, 18, 30, 0.7)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(WASHING.x0, WASHING.y);
  ctx.quadraticCurveTo(
    (WASHING.x0 + WASHING.x1) / 2,
    WASHING.y + 3,
    WASHING.x1,
    WASHING.y
  );
  ctx.stroke();
  const lean = clamp(wind / 40, -0.75, 0.75);
  for (const [t, w, h, colour, i] of [
    [0.22, 6, 8, '#F2ECDC', 0],
    [0.5, 7.5, 11, '#8A5AB0', 1],
    [0.78, 5.5, 7, '#E6B23E', 2],
  ] as const) {
    const x = WASHING.x0 + (WASHING.x1 - WASHING.x0) * t;
    const y = WASHING.y + 6 * t * (1 - t) + 0.3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(
      -lean + Math.sin(now / 310 + i * 2.1) * 0.07 * (1 + Math.abs(lean) * 4)
    );
    ctx.fillStyle = lit(colour, p);
    ctx.fillRect(-w / 2, 0, w, h);
    ctx.restore();
  }

  // The flag flies with the wind and hangs when it drops.
  const fill = clamp(Math.abs(wind) / 20, 0.25, 1);
  const dir = wind >= 0 ? 1 : -1;
  const edge = (drop: number): [number, number][] => {
    const points: [number, number][] = [];
    for (let j = 0; j <= 5; j++) {
      const u = j / 5;
      points.push([
        FLAG.x + dir * u * 11.5 * (0.45 + 0.55 * fill),
        FLAG.top +
          drop +
          Math.sin(now / 150 - j * 0.95) * 1.5 * u * fill +
          (1 - fill) * 9 * u * u,
      ]);
    }
    return points;
  };
  const band = (
    a: [number, number][],
    b: [number, number][],
    colour: string
  ) => {
    ctx.fillStyle = lit(colour, p);
    ctx.beginPath();
    a.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    b.slice()
      .reverse()
      .forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();
  };
  const top = edge(0);
  const mid = edge(3.3);
  band(top, mid, '#D7263D');
  band(mid, edge(6.6), '#F4F0E6');

  for (const k of kites) flyer(ctx, k, now, p, lookFor(k));
}

/**
 * A flyer on the roof, dressed in the colours of their kite: one hand on the string, the other
 * holding the spool.
 */
function flyer(ctx: Ctx, k: Kite, now: number, p: Palette, look: Look): void {
  const flying = k.state === 'flying';
  const side = k.x >= k.ax ? 1 : -1;
  const x = k.ax - 3.1 * side;
  const feet = ROOF_Y;
  // Pulling, the flyer leans back against the string.
  const lean = flying && k.pull ? -1.5 * side : 0;
  const hip = { x: x + lean * 0.3, y: feet - 7 };
  const neck = { x: x + lean, y: feet - 12.6 };
  const skin = lit('#9A6040', p);
  ctx.lineCap = 'round';

  ctx.strokeStyle = '#241826';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(x - 1.7, feet);
  ctx.lineTo(hip.x - 0.5, hip.y);
  ctx.moveTo(x + 1.9, feet);
  ctx.lineTo(hip.x + 0.5, hip.y);
  ctx.stroke();

  ctx.strokeStyle = lit(look.main, p);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y - 0.6);
  ctx.lineTo(neck.x, neck.y + 1.2);
  ctx.stroke();
  if (look.trim !== look.main) {
    ctx.strokeStyle = lit(look.trim, p);
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y - 0.6);
    ctx.lineTo((hip.x + neck.x) / 2, (hip.y + neck.y) / 2 + 0.6);
    ctx.stroke();
  }

  // The arm on the string, and the arm with the spool.
  const hand = flying
    ? { x: k.ax, y: k.ay }
    : { x: x + 2.6 * side, y: feet - 8 };
  const bend = flying && k.pull ? 2.4 : 0.7;
  ctx.strokeStyle = skin;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(neck.x, neck.y + 1.4);
  ctx.quadraticCurveTo(
    (neck.x + hand.x) / 2 - side * 0.6,
    (neck.y + hand.y) / 2 + bend,
    hand.x,
    hand.y
  );
  ctx.moveTo(neck.x, neck.y + 1.6);
  ctx.lineTo(x - 2.5 * side, feet - 8.4);
  ctx.stroke();
  ctx.fillStyle = lit('#D8B46A', p);
  ctx.fillRect(x - 2.5 * side - 1.3, feet - 9.6, 2.6, 3);

  // Head, turned up to watch the kite.
  const bob = flying ? Math.sin(now / 420 + k.id) * 0.25 : 0.8;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(neck.x + side * 0.5, neck.y - 1.9 + bob, 2.35, 0, TAU);
  ctx.fill();
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.arc(
    neck.x + side * 0.1,
    neck.y - 2.5 + bob,
    2.4,
    Math.PI * 0.95,
    Math.PI * 2.05
  );
  ctx.fill();
  ctx.lineCap = 'butt';
}
