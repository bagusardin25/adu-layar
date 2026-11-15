// How a kite looks: its shape, the motif on its paper, and its two colours. The same drawing
// serves the sky, the workshop where a player designs their kite, and the small pictures of it.
//
// Every kite is drawn nose up around (0, 0), about 36 sky units tall.

import { colourHex } from '../../shared/kite.ts';
import type {
  KiteDesign,
  LineId,
  MotifId,
  ShapeId,
  TailId,
} from '../../shared/kite.ts';
import { MOTIFS, SHAPES } from '../../shared/kite.ts';
import type { Kite } from '../../shared/sim/types.ts';
import { TAU } from './view.ts';
import type { Ctx } from './view.ts';

/** A design with its colours worked out. */
export type Look = {
  shape: ShapeId;
  motif: MotifId;
  main: string;
  trim: string;
  tail: TailId;
  line: LineId;
};

export function lookOf(design: KiteDesign): Look {
  return {
    shape: design.shape,
    motif: design.motif,
    main: colourHex(design.main),
    trim: colourHex(design.trim),
    tail: design.tail,
    line: design.line,
  };
}

/** A stable number from a name, for giving each rival their own shape and motif. */
function hashName(name: string): number {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

/** A rival's kite: the colours of the day's sky, and a shape and motif that go with their name. */
export function rivalLook(k: Pick<Kite, 'name' | 'colors'>): Look {
  const h = hashName(k.name);
  return {
    shape: SHAPES[h % SHAPES.length].id,
    motif: MOTIFS[(h >>> 3) % MOTIFS.length].id,
    main: k.colors[0],
    trim: k.colors[1],
    tail: 'pita',
    line: 'biasa',
  };
}

type Shape = {
  outline: (ctx: Ctx) => void;
  /** The bamboo frame. */
  frame: (ctx: Ctx) => void;
  /** How far down the tail hangs from, and the height of the cross-spar (for motifs). */
  tailY: number;
  sparY: number;
};

const SHAPE: Record<ShapeId, Shape> = {
  // The fighter kite: bowed leading edges, straight trailing edges.
  aduan: {
    outline: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.quadraticCurveTo(10, -15.5, 15, -3);
      ctx.lineTo(0, 18);
      ctx.lineTo(-15, -3);
      ctx.quadraticCurveTo(-10, -15.5, 0, -18);
      ctx.closePath();
    },
    frame: (ctx) => {
      ctx.moveTo(0, -18);
      ctx.lineTo(0, 18);
      ctx.moveTo(-15, -3);
      ctx.quadraticCurveTo(0, -11.5, 15, -3);
    },
    tailY: 18,
    sparY: -3,
  },
  // The plain diamond every child makes first: straight edges, a little taller.
  wajik: {
    outline: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(13, -5);
      ctx.lineTo(0, 20);
      ctx.lineTo(-13, -5);
      ctx.closePath();
    },
    frame: (ctx) => {
      ctx.moveTo(0, -20);
      ctx.lineTo(0, 20);
      ctx.moveTo(-13, -5);
      ctx.lineTo(13, -5);
    },
    tailY: 20,
    sparY: -5,
  },
  // Wide and short, with swept wings, like a ray gliding.
  pari: {
    outline: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.quadraticCurveTo(12, -12, 18.5, 0);
      ctx.quadraticCurveTo(8, 5, 0, 16);
      ctx.quadraticCurveTo(-8, 5, -18.5, 0);
      ctx.quadraticCurveTo(-12, -12, 0, -15);
      ctx.closePath();
    },
    frame: (ctx) => {
      ctx.moveTo(0, -15);
      ctx.lineTo(0, 16);
      ctx.moveTo(-18.5, 0);
      ctx.quadraticCurveTo(0, -9, 18.5, 0);
    },
    tailY: 16,
    sparY: 0,
  },
};

export const tailYOf = (shape: ShapeId): number => SHAPE[shape].tailY;

/** The colours of the rainbow pattern and the rainbow string. */
export const RAINBOW = [
  '#E8483B',
  '#F28C28',
  '#F2C230',
  '#4CAF5A',
  '#2E86DE',
  '#7A3EA0',
];

function star(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.42 : r;
    if (i) ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    else ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

/** Paints a motif in the trim colour over a body already painted in the main colour. */
function paintMotif(ctx: Ctx, look: Look, sparY: number): void {
  ctx.fillStyle = look.trim;
  ctx.strokeStyle = look.trim;
  switch (look.motif) {
    case 'bendera':
      // Two colours, upper and lower, split at the cross-spar.
      ctx.fillRect(-20, sparY, 40, 24);
      break;
    case 'belah':
      ctx.fillRect(-20, -22, 20, 44);
      break;
    case 'garis':
      ctx.fillRect(-20, -9, 40, 5);
      ctx.fillRect(-20, 1, 40, 5);
      ctx.fillRect(-20, 11, 40, 10);
      break;
    case 'mata':
      ctx.beginPath();
      ctx.arc(-5.6, sparY - 2, 3.4, 0, TAU);
      ctx.arc(5.6, sparY - 2, 3.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = look.main;
      ctx.beginPath();
      ctx.arc(-5, sparY - 1.6, 1.4, 0, TAU);
      ctx.arc(6.2, sparY - 1.6, 1.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = look.trim;
      ctx.fillRect(-20, 8, 40, 14);
      break;
    case 'bulan':
      ctx.beginPath();
      ctx.arc(0, sparY + 1, 7.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = look.main;
      ctx.beginPath();
      ctx.arc(2.8, sparY - 1, 6.4, 0, TAU);
      ctx.fill();
      break;
    case 'bintang':
      star(ctx, 0, sparY + 2, 7.5);
      ctx.fillRect(-20, 13, 40, 2.4);
      break;
    case 'kawung':
      // Batik kawung: four ovals meeting in an X around a small dot, repeated with room between.
      for (let gx = -18; gx <= 18; gx += 12) {
        for (let gy = -24; gy <= 24; gy += 12) {
          ctx.fillStyle = look.trim;
          ctx.beginPath();
          for (let q = 0; q < 4; q++) {
            const a = Math.PI / 4 + (q * Math.PI) / 2;
            const ex = gx + Math.cos(a) * 3.3;
            const ey = gy + Math.sin(a) * 3.3;
            ctx.moveTo(ex + Math.cos(a) * 3, ey + Math.sin(a) * 3);
            ctx.ellipse(ex, ey, 3, 1.75, a, 0, TAU);
          }
          ctx.fill();
          ctx.fillStyle = look.main;
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, TAU);
          ctx.fill();
        }
      }
      break;
    case 'mendung': {
      // Batik mega mendung: layered clouds, rings of the two colours in turn.
      const cloud = (cx: number, cy: number, k: number) => {
        ctx.beginPath();
        ctx.arc(cx - 5 * k, cy, 4 * k, Math.PI * 0.6, Math.PI * 1.9);
        ctx.arc(cx, cy - 3 * k, 5 * k, Math.PI * 1.1, Math.PI * 1.95);
        ctx.arc(cx + 5.5 * k, cy, 4 * k, Math.PI * 1.15, Math.PI * 0.4);
        ctx.closePath();
        ctx.fill();
      };
      for (const [cx, cy] of [
        [-4, sparY - 4],
        [6, sparY + 11],
      ] as const) {
        ctx.fillStyle = look.trim;
        cloud(cx, cy, 1.35);
        ctx.fillStyle = look.main;
        cloud(cx, cy + 0.6, 1);
        ctx.fillStyle = look.trim;
        cloud(cx, cy + 1.1, 0.62);
      }
      break;
    }
    case 'truntum':
      // Batik truntum: small eight-petal blossoms scattered like stars.
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 5; col++) {
          const x = -18 + col * 9 + (row % 2) * 4.5;
          const y = -22 + row * 8.5;
          ctx.beginPath();
          for (let q = 0; q < 8; q++) {
            const a = (q * Math.PI) / 4;
            const ex = x + Math.cos(a) * 1.6;
            const ey = y + Math.sin(a) * 1.6;
            ctx.moveTo(ex + Math.cos(a) * 1.3, ey + Math.sin(a) * 1.3);
            ctx.ellipse(ex, ey, 1.3, 0.6, a, 0, TAU);
          }
          ctx.fill();
        }
      }
      break;
    case 'sisik':
      // Overlapping scales, half-moons edged in the body colour.
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 8; col++) {
          const x = -21 + col * 6 + (row % 2) * 3;
          const y = -22 + row * 4.6;
          ctx.fillStyle = (row + col) % 3 === 0 ? look.main : look.trim;
          ctx.beginPath();
          ctx.arc(x, y, 3.2, 0, Math.PI);
          ctx.fill();
          ctx.strokeStyle = look.main;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      break;
    case 'pelangi':
      // A rainbow arching over the kite, whatever its colours.
      ctx.lineWidth = 3.4;
      RAINBOW.forEach((colour, i) => {
        ctx.strokeStyle = colour;
        ctx.beginPath();
        ctx.arc(0, 20, 30 - i * 3.4, Math.PI, 0);
        ctx.stroke();
      });
      break;
    case 'parang':
      // Batik parang: rows of S-shaped waves running on the slant.
      ctx.save();
      ctx.rotate(-Math.PI / 4);
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (let y0 = -30; y0 <= 30; y0 += 7.5) {
        ctx.beginPath();
        for (let x = -30; x <= 30; x += 1.5) {
          const y = y0 + Math.sin(x / 2.2) * 1.6;
          if (x === -30) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      break;
  }
}

/**
 * Draws a kite's body at the origin, nose up: paper, motif, shading, frame and edge.
 * `mine` gives it the bright edge that marks the player's own kite.
 */
export function drawKiteBody(ctx: Ctx, look: Look, mine: boolean): void {
  const shape = SHAPE[look.shape];
  ctx.save();
  shape.outline(ctx);
  ctx.clip();
  ctx.fillStyle = look.main;
  ctx.fillRect(-20, -22, 40, 44);
  paintMotif(ctx, look, shape.sparY);
  // The paper folds along the spine: one side in shade, the other catching the light.
  ctx.fillStyle = 'rgba(20, 10, 30, 0.16)';
  ctx.fillRect(-20, -22, 20, 44);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(0, -22, 20, 44);
  ctx.restore();

  ctx.strokeStyle = 'rgba(58, 34, 20, 0.75)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  shape.frame(ctx);
  ctx.stroke();
  ctx.strokeStyle = mine ? 'rgba(255, 255, 255, 0.9)' : 'rgba(26, 14, 30, 0.5)';
  ctx.lineWidth = mine ? 1.2 : 0.8;
  shape.outline(ctx);
  ctx.stroke();
}
