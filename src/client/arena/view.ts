// How the 360 × 640 sky sits inside the canvas, and small helpers every drawing file shares.

import { SKY_H, SKY_W } from '../../shared/sim/types.ts';

export type Ctx = CanvasRenderingContext2D;

export type View = {
  /** Canvas size in CSS pixels, and device pixels per CSS pixel. */
  w: number;
  h: number;
  dpr: number;
  /** CSS pixels per sky unit, and where the sky's corner sits. */
  scale: number;
  ox: number;
  oy: number;
  /** The part of the world the canvas shows, in sky units. Wider than the sky on a wide screen. */
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function fit(cssW: number, cssH: number, dpr: number): View {
  const scale = Math.min(cssW / SKY_W, cssH / SKY_H);
  const ox = (cssW - SKY_W * scale) / 2;
  const oy = (cssH - SKY_H * scale) / 2;
  return {
    w: cssW,
    h: cssH,
    dpr,
    scale,
    ox,
    oy,
    left: -ox / scale,
    right: (cssW - ox) / scale,
    top: -oy / scale,
    bottom: (cssH - oy) / scale,
  };
}

/** Draw in sky units from here on. `dx` and `dy` shift everything, in CSS pixels. */
export function inWorld(ctx: Ctx, v: View, dx = 0, dy = 0): void {
  const k = v.dpr * v.scale;
  ctx.setTransform(k, 0, 0, k, v.dpr * (v.ox + dx), v.dpr * (v.oy + dy));
}

/** Draw in CSS pixels from here on. */
export function inScreen(ctx: Ctx, v: View, dx = 0, dy = 0): void {
  ctx.setTransform(v.dpr, 0, 0, v.dpr, v.dpr * dx, v.dpr * dy);
}

export const TAU = Math.PI * 2;

export const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x > hi ? hi : x;

/** A repeatable "random" number in [0, 1) for placing scenery. Not for the simulation. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Wraps x into [lo, hi). */
export function wrapInto(x: number, lo: number, hi: number): number {
  const span = hi - lo;
  return lo + ((((x - lo) % span) + span) % span);
}

/** Traces a rectangle with rounded corners. (ctx.roundRect is missing from older webviews.) */
export function rounded(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
