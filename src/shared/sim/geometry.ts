// Small geometry helpers. Arithmetic and Math.sqrt only, so results match on every device.

/** Where two segments cross: the point, and how far along each segment (0 to 1) it lies. */
export type Crossing = { x: number; y: number; t: number; u: number };

/** Where two segments cross, or null. Touching ends count as crossing. */
export function crossing(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  q1x: number,
  q1y: number,
  q2x: number,
  q2y: number
): Crossing | null {
  const rx = p2x - p1x;
  const ry = p2y - p1y;
  const sx = q2x - q1x;
  const sy = q2y - q1y;
  const den = rx * sy - ry * sx;
  if (den === 0) return null;
  const qx = q1x - p1x;
  const qy = q1y - p1y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: p1x + t * rx, y: p1y + t * ry, t, u };
}

export const length = (x: number, y: number): number =>
  Math.sqrt(x * x + y * y);

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
