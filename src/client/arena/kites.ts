// Kites, their strings and tails, the sparks where strings rub, and the scraps of paper that
// fly when a string is cut. All in sky units.

import { stringBend } from '../../shared/sim/line.ts';
import { healthOf } from '../../shared/sim/match.ts';
import { CRASH_Y, PLAYER_ID, ROOF_Y } from '../../shared/sim/types.ts';
import type { Contact, Kite, Match } from '../../shared/sim/types.ts';
import type { LineId } from '../../shared/kite.ts';
import { drawKiteBody, RAINBOW } from './design.ts';
import type { Look } from './design.ts';
import { clamp, TAU } from './view.ts';
import type { Ctx } from './view.ts';

/** Where a kite is drawn this frame: between its last two simulated positions. */
export type Pose = { x: number; y: number; angle: number };

const poseOf = (k: Kite, poses: Map<number, Pose>): Pose =>
  poses.get(k.id) ?? { x: k.x, y: k.y, angle: 0 };

// ───────────────────────────── Strings ─────────────────────────────

/**
 * Strings of kites still flying. Each is the same curve the simulation tests for touches. A
 * string turns from white to red as it frays, and breaks into strands when it is nearly gone.
 * `px` is one CSS pixel in sky units.
 */
export function drawStrings(
  ctx: Ctx,
  match: Match,
  poses: Map<number, Pose>,
  tick: number,
  now: number,
  px: number,
  ink: string,
  playerLine: LineId
): void {
  for (const k of match.kites) {
    if (k.state !== 'flying') continue;
    const p = poseOf(k, poses);
    const bend = stringBend(k, match.sky, tick, p.x, p.y);
    const frayed = clamp(k.damage / healthOf(k), 0, 1);
    ctx.beginPath();
    ctx.moveTo(k.ax, k.ay);
    ctx.quadraticCurveTo(bend.cx, bend.cy, p.x, p.y);
    if (k.id === PLAYER_ID) {
      strokeLine(
        ctx,
        playerLine,
        { ax: k.ax, ay: k.ay, x: p.x, y: p.y },
        px,
        now,
        ink,
        frayed,
        k.pull
      );
      continue;
    }
    // Rivals' plain strings, fainter than the player's, and redder as they fray.
    const [r0, g0, b0] = ink.split(',').map(Number);
    const worn = (from: number, to: number) =>
      Math.round(from + (to - from) * frayed);
    ctx.strokeStyle = `rgba(${worn(r0, 255)}, ${worn(g0, 98)}, ${worn(b0, 46)}, 0.62)`;
    ctx.lineWidth = 1.15 * px;
    ctx.setLineDash(frayed > 0.6 ? [6 * px, 2.5 * px] : []);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/** What is left of strings that were cut or snagged: they fall limp onto the roofs. */
export function drawLooseStrings(
  ctx: Ctx,
  match: Match,
  poses: Map<number, Pose>,
  tick: number,
  windX: number,
  now: number,
  px: number,
  ink: string
): void {
  ctx.lineWidth = px;
  for (const k of match.kites) {
    if (k.state === 'flying') continue;
    const age = (tick - k.endTick) / 60;
    if (k.state === 'crashed') {
      // Snagged: the string lies slack from the hand to the kite on the roof.
      ctx.strokeStyle = `rgba(${ink}, 0.45)`;
      ctx.beginPath();
      ctx.moveTo(k.ax, k.ay);
      ctx.quadraticCurveTo((k.ax + k.x) / 2, ROOF_Y + 6, k.x, CRASH_Y + 8);
      ctx.stroke();
      continue;
    }
    // The piece still in the flyer's hand drops from where it was cut.
    if (age < 1.7) {
      const ex = k.endX + (k.ax - k.endX) * clamp(age * 0.35, 0, 0.5);
      const ey = Math.min(ROOF_Y - 3, k.endY + 260 * age * age);
      ctx.strokeStyle = `rgba(${ink}, ${(clamp(1.7 - age, 0, 1) * 0.6).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(k.ax, k.ay);
      ctx.quadraticCurveTo(
        (k.ax + ex) / 2 + windX * 0.2 * age,
        Math.min(ROOF_Y + 2, (k.ay + ey) / 2 + 14 + 40 * age),
        ex,
        ey
      );
      ctx.stroke();
    }
    // The piece on the kite trails above it as it falls.
    const p = poseOf(k, poses);
    const sway = Math.sin(now / 300 + k.id) * 8;
    ctx.strokeStyle = `rgba(${ink}, 0.45)`;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(
      p.x + sway,
      p.y - 30,
      p.x - windX * 0.5 - sway * 0.5,
      p.y - 62
    );
    ctx.stroke();
  }
}

/** Sparks where strings slide over each other. Strings that are only crossed show a dot. */
export function drawSparks(
  ctx: Ctx,
  contacts: Contact[],
  now: number,
  px: number
): void {
  ctx.lineCap = 'round';
  for (const c of contacts) {
    const heat = clamp(c.rub / 130, 0, 1);
    if (heat < 0.06) {
      ctx.fillStyle = 'rgba(255, 244, 214, 0.55)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 1.4, 0, TAU);
      ctx.fill();
      continue;
    }
    const count = 4 + Math.round(heat * 6);
    ctx.lineWidth = 1.3 * px;
    for (let s = 0; s < count; s++) {
      const angle = now / 55 + s * 2.399 + c.a;
      const len = (3 + heat * 8) * (0.45 + ((now / 28 + s * 7.3) % 5) / 5);
      ctx.strokeStyle =
        s % 2 ? 'rgba(255, 246, 190, 0.95)' : 'rgba(255, 170, 90, 0.9)';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(angle) * len, c.y + Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 250, 225, 0.92)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 1.2 + heat * 1.9, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = 'butt';
}

// ───────────────────────────── Tails ─────────────────────────────

const TAIL_LINKS = 9;
const LINK = 4.8;

/** A ribbon tail: a chain of points that trails behind the kite and hangs when it is still. */
export type Tail = Float32Array;

export function createTail(x: number, y: number): Tail {
  const tail = new Float32Array(TAIL_LINKS * 2);
  for (let i = 0; i < TAIL_LINKS; i++) {
    tail[i * 2] = x;
    tail[i * 2 + 1] = y + i * LINK;
  }
  return tail;
}

/** Drags the tail after the kite's tail tip, with the wind and its own weight on it. */
export function updateTail(
  tail: Tail,
  pose: Pose,
  windX: number,
  dt: number,
  tailY = 18
): void {
  tail[0] = pose.x - Math.sin(pose.angle) * tailY;
  tail[1] = pose.y + Math.cos(pose.angle) * tailY;
  for (let i = 1; i < TAIL_LINKS; i++) {
    const x = tail[i * 2] + windX * 0.5 * dt;
    const y = tail[i * 2 + 1] + 34 * dt;
    const dx = x - tail[i * 2 - 2];
    const dy = y - tail[i * 2 - 1];
    const d = Math.hypot(dx, dy) || 1;
    tail[i * 2] = tail[i * 2 - 2] + (dx / d) * LINK;
    tail[i * 2 + 1] = tail[i * 2 - 1] + (dy / d) * LINK;
  }
}

/** Draws a kite's tail in its two colours, in the style chosen for it. */
export function drawTail(ctx: Ctx, tail: Tail, look: Look): void {
  const at = (i: number) => [tail[i * 2], tail[i * 2 + 1]] as const;
  const cord = () => {
    ctx.beginPath();
    for (let i = 0; i < TAIL_LINKS; i++) {
      const [x, y] = at(i);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  ctx.lineCap = 'round';

  if (look.tail === 'ganda') {
    // Two ribbons that part as they hang, one of each colour.
    for (const side of [-1, 1]) {
      ctx.strokeStyle = side < 0 ? look.main : look.trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < TAIL_LINKS; i++) {
        const [x, y] = at(i);
        const [nx, ny] = at(Math.min(TAIL_LINKS - 1, i + 1));
        const [bx, by] = at(Math.max(0, i - 1));
        const dx = nx - bx;
        const dy = ny - by;
        const d = Math.hypot(dx, dy) || 1;
        const spread = 0.8 + i * 0.35;
        const ox = (-dy / d) * spread * side;
        const oy = (dx / d) * spread * side;
        if (i === 0) ctx.moveTo(x + ox, y + oy);
        else ctx.lineTo(x + ox, y + oy);
      }
      ctx.stroke();
    }
  } else if (look.tail === 'rumbai') {
    // A cord with tufts of tassels along it.
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 1;
    cord();
    ctx.strokeStyle = look.main;
    ctx.lineWidth = 0.9;
    for (let i = 2; i < TAIL_LINKS; i += 2) {
      const [x, y] = at(i);
      const [bx, by] = at(i - 1);
      const a = Math.atan2(y - by, x - bx);
      ctx.beginPath();
      for (const fan of [-0.5, 0, 0.5]) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a + fan) * 3.6, y + Math.sin(a + fan) * 3.6);
      }
      ctx.stroke();
    }
  } else if (look.tail === 'lampion') {
    // A thin cord with three little lanterns, glowing.
    ctx.strokeStyle = 'rgba(40, 24, 20, 0.8)';
    ctx.lineWidth = 0.7;
    cord();
    for (const i of [2, 5, 8]) {
      const [x, y] = at(i);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
      glow.addColorStop(0, 'rgba(255, 200, 110, 0.55)');
      glow.addColorStop(1, 'rgba(255, 200, 110, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillStyle = i === 5 ? look.trim : '#E0402E';
      ctx.beginPath();
      ctx.ellipse(x, y, 2.4, 3.1, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#F2C230';
      ctx.fillRect(x - 1.4, y - 3.6, 2.8, 0.9);
      ctx.fillRect(x - 1.4, y + 2.7, 2.8, 0.9);
    }
  } else {
    // A ribbon, a pair of links in each colour.
    for (let i = 1; i < TAIL_LINKS; i++) {
      ctx.strokeStyle = Math.floor((i - 1) / 2) % 2 ? look.main : look.trim;
      ctx.lineWidth = 3 - i * 0.24;
      ctx.beginPath();
      ctx.moveTo(tail[i * 2 - 2], tail[i * 2 - 1]);
      ctx.lineTo(tail[i * 2], tail[i * 2 + 1]);
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
}

/**
 * Strokes the player's string, already traced as a path, in the style chosen for it. `ink` is
 * the plain string's colour for this time of day, `frayed` how worn it is (0 to 1).
 */
export function strokeLine(
  ctx: Ctx,
  line: LineId,
  ends: { ax: number; ay: number; x: number; y: number },
  px: number,
  now: number,
  ink: string,
  frayed: number,
  pulling: boolean
): void {
  ctx.setLineDash(frayed > 0.6 ? [6 * px, 2.5 * px] : []);
  if (line === 'emas') {
    ctx.strokeStyle = 'rgba(242, 194, 48, 0.95)';
    ctx.lineWidth = 1.9 * px;
    ctx.stroke();
  } else if (line === 'neon') {
    ctx.strokeStyle = 'rgba(90, 240, 255, 0.25)';
    ctx.lineWidth = 5 * px;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190, 252, 255, 0.95)';
    ctx.lineWidth = 1.5 * px;
    ctx.stroke();
  } else if (line === 'pelangi') {
    const g = ctx.createLinearGradient(ends.ax, ends.ay, ends.x, ends.y);
    RAINBOW.forEach((colour, i) =>
      g.addColorStop(i / (RAINBOW.length - 1), colour)
    );
    ctx.strokeStyle = g;
    ctx.lineWidth = 2 * px;
    ctx.stroke();
  } else {
    // Plain: dark against a bright sky, pale against a dark one, and redder as it frays.
    const [r0, g0, b0] = ink.split(',').map(Number);
    const worn = (from: number, to: number) =>
      Math.round(from + (to - from) * frayed);
    ctx.strokeStyle = `rgba(${worn(r0, 255)}, ${worn(g0, 98)}, ${worn(b0, 46)}, 0.95)`;
    ctx.lineWidth = 1.7 * px;
    ctx.stroke();
  }
  // Glints of the glass coating. They run down the string while it is being pulled in.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2.3 * px;
  ctx.setLineDash([1.6, 11]);
  ctx.lineDashOffset = pulling ? now * 0.09 : 0;
  ctx.stroke();
  ctx.lineDashOffset = 0;
  ctx.setLineDash([]);
}

// ───────────────────────────── Kites ─────────────────────────────

export type KiteLook = {
  /** Shape, motif and colours. */
  design: Look;
  /** The player's own kite gets a bright edge. */
  mine: boolean;
  alpha: number;
  /** 1 is flat on to the viewer; less as the paper flutters or the kite tumbles. */
  face: number;
  /** Show where a pull will take it. */
  marker: boolean;
  /** The colour of the marker and of speed streaks, as "r, g, b". */
  ink: string;
};

/** What the drawing needs to know about a kite's flight. */
type Flight = Pick<Kite, 'state' | 'pull' | 'vx' | 'vy'>;

export function drawKite(
  ctx: Ctx,
  k: Flight,
  pose: Pose,
  tail: Tail | undefined,
  look: KiteLook
): void {
  ctx.globalAlpha = look.alpha;
  if (tail) drawTail(ctx, tail, look.design);

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);

  // Streaks behind a kite that is being pulled hard.
  const speed = Math.hypot(k.vx, k.vy);
  if (k.state === 'flying' && k.pull && speed > 70) {
    ctx.strokeStyle = `rgba(${look.ink}, 0.22)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of [-9, 9]) {
      ctx.moveTo(x, 12);
      ctx.lineTo(x, 12 + speed / 8);
    }
    ctx.stroke();
  }

  if (look.marker) {
    ctx.fillStyle = `rgba(${look.ink}, ${k.pull ? 0.95 : 0.6})`;
    ctx.beginPath();
    for (let j = 0; j < 3; j++) {
      ctx.moveTo(1.1, -26 - j * 6);
      ctx.arc(0, -26 - j * 6, 1.1, 0, TAU);
    }
    ctx.moveTo(0, -50);
    ctx.lineTo(4.6, -43);
    ctx.lineTo(-4.6, -43);
    ctx.closePath();
    ctx.fill();
  }

  ctx.scale(look.face, 1);
  drawKiteBody(ctx, look.design, look.mine);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ───────────────────────────── Scraps and sparks ─────────────────────────────

/** A scrap of kite paper or a spark, thrown out when a string is cut or a kite hits a roof. */
export type Bit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  colour: string;
  size: number;
  paper: boolean;
};

export function throwBits(
  bits: Bit[],
  x: number,
  y: number,
  colours: readonly string[],
  now: number,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const paper = i % 5 !== 0;
    const speed = (paper ? 30 : 70) + Math.random() * (paper ? 60 : 90);
    bits.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      born: now,
      life: paper ? 900 + Math.random() * 700 : 260 + Math.random() * 200,
      colour: paper ? colours[i % colours.length] : '#FFF2B8',
      size: paper ? 1.6 + Math.random() * 1.6 : 1,
      paper,
    });
  }
  if (bits.length > 160) bits.splice(0, bits.length - 160);
}

export function drawBits(
  ctx: Ctx,
  bits: Bit[],
  windX: number,
  now: number,
  dt: number
): void {
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    const age = now - b.born;
    if (age > b.life) {
      bits.splice(i, 1);
      continue;
    }
    // Paper is light: the air slows it and the wind carries it. Sparks just fall.
    const drag = b.paper ? 2.4 : 0.6;
    b.vx += ((b.paper ? windX * 0.8 : 0) - b.vx) * drag * dt;
    b.vy += ((b.paper ? 46 : 260) - b.vy) * drag * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    ctx.globalAlpha = clamp(1 - age / b.life, 0, 1);
    ctx.fillStyle = b.colour;
    if (b.paper) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(age / 90 + i);
      ctx.fillRect(-b.size, -b.size * 0.6, b.size * 2, b.size * 1.2);
      ctx.restore();
    } else {
      ctx.fillRect(b.x - 0.6, b.y - 0.6, 1.2, 1.2);
    }
  }
  ctx.globalAlpha = 1;
}
