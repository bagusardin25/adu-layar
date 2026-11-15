// Pictures of kites outside the sky: small ones for buttons and lists, and a large one that
// sways on its tail in the workshop. They use the same drawing as the kites in the sky.

import { useEffect, useRef } from 'react';
import { drawKiteBody, tailYOf } from './arena/design.ts';
import type { Look } from './arena/design.ts';
import { createTail, drawTail, strokeLine, updateTail } from './arena/kites.ts';
import type { Tail } from './arena/kites.ts';
import { useReducedMotion } from './lib/prefs.ts';

/** Sizes a canvas to its CSS box for the screen's pixel density, and returns its context. */
function prepare(
  canvas: HTMLCanvasElement
): { ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  return { ctx, w, h, dpr };
}

/** A still picture of a kite, `size` CSS pixels tall. */
export function KiteThumb({
  look,
  size,
  mine = false,
}: {
  look: Look;
  size: number;
  mine?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const c = canvas && prepare(canvas);
    if (!c) return;
    const s = (c.h / 44) * c.dpr;
    c.ctx.setTransform(s, 0, 0, s, (c.w / 2) * c.dpr, (c.h / 2) * c.dpr);
    c.ctx.clearRect(-30, -30, 60, 60);
    drawKiteBody(c.ctx, look, mine);
  }, [look, mine, size]);
  return (
    <canvas
      ref={ref}
      className="kite-thumb"
      style={{ width: size * 0.9, height: size }}
      aria-hidden="true"
    />
  );
}

/** How much larger than in the sky the workshop kite is drawn. */
const BIG = 1.25;

/** A kite hanging in the air on its tail, swaying in a light breeze. */
export function KitePreview({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const still = useReducedMotion();
  const lookNow = useRef(look);
  useEffect(() => {
    lookNow.current = look;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let c = prepare(canvas);
    const observer = new ResizeObserver(() => {
      c = canvas ? prepare(canvas) : null;
    });
    observer.observe(canvas);
    let tail: Tail | null = null;
    let last = performance.now();
    let raf = 0;

    const frame = (t: number) => {
      const dt = Math.min(50, t - last) / 1000;
      last = t;
      if (c) {
        // Kite units: the kite is drawn 50 tall and its tail hangs about 45 below it.
        const s = (c.h / 100) * c.dpr;
        const cx = c.w / 2 / (c.h / 100);
        const sway = still ? 0 : 1;
        const pose = {
          x: cx + Math.sin(t / 1300) * 7 * sway,
          y: 30 + Math.sin(t / 900) * 2.5 * sway,
          angle: Math.sin(t / 1100) * 0.16 * sway,
        };
        const breeze = 14 + Math.sin(t / 1500) * 10 * sway;
        const shape = lookNow.current;
        const tailY = tailYOf(shape.shape) * BIG;
        // The tail starts out hanging straight down from the kite.
        tail ??= createTail(pose.x, pose.y + tailY);
        updateTail(tail, pose, breeze, still ? 1 : dt, tailY);
        c.ctx.setTransform(1, 0, 0, 1, 0, 0);
        c.ctx.clearRect(0, 0, canvas.width, canvas.height);
        c.ctx.setTransform(s, 0, 0, s, 0, 0);
        // The string runs down to a hand off to the left, so its look shows too.
        const hx = cx - 95;
        c.ctx.beginPath();
        c.ctx.moveTo(hx, 104);
        c.ctx.quadraticCurveTo((hx + pose.x) / 2, 84, pose.x, pose.y);
        strokeLine(
          c.ctx,
          shape.line,
          { ax: hx, ay: 104, x: pose.x, y: pose.y },
          100 / c.h,
          t,
          '255, 248, 236',
          0,
          true
        );
        drawTail(c.ctx, tail, shape);
        c.ctx.save();
        c.ctx.translate(pose.x, pose.y);
        c.ctx.rotate(pose.angle);
        c.ctx.scale(BIG, BIG);
        drawKiteBody(c.ctx, shape, true);
        c.ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [still]);

  return <canvas ref={ref} className="kite-preview" aria-hidden="true" />;
}

/**
 * A small still picture of one part of a kite: its tail hanging under a little kite, or a
 * length of its string. For the workshop's choices.
 */
export function PartThumb({
  look,
  part,
  size,
}: {
  look: Look;
  part: 'tail' | 'line';
  size: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const c = canvas && prepare(canvas);
    if (!c) return;
    // Drawing units: 60 tall, 40 wide.
    const k = (c.h / 60) * c.dpr;
    c.ctx.setTransform(k, 0, 0, k, 0, 0);
    c.ctx.clearRect(0, 0, 60, 60);
    if (part === 'tail') {
      const tail = createTail(20, 14);
      for (let i = 0; i < tail.length / 2; i++) {
        tail[i * 2] = 20 + Math.sin(i * 0.8) * 2.2 * (i / 4);
        tail[i * 2 + 1] = 14 + i * 4.8;
      }
      drawTail(c.ctx, tail, look);
      c.ctx.save();
      c.ctx.translate(20, 8);
      c.ctx.scale(0.4, 0.4);
      drawKiteBody(c.ctx, look, false);
      c.ctx.restore();
    } else {
      c.ctx.beginPath();
      c.ctx.moveTo(4, 56);
      c.ctx.quadraticCurveTo(8, 18, 36, 4);
      strokeLine(
        c.ctx,
        look.line,
        { ax: 4, ay: 56, x: 36, y: 4 },
        60 / c.h,
        0,
        '255, 248, 236',
        0,
        false
      );
    }
  }, [look, part, size]);
  return (
    <canvas
      ref={ref}
      className="kite-thumb"
      style={{ width: (size * 2) / 3, height: size }}
      aria-hidden="true"
    />
  );
}
