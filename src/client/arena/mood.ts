// The time of day the sky is drawn in. It is the player's choice and changes nothing about the
// round: the wind, the rivals and the score are the same in the morning as at night.

export type Mood = 'pagi' | 'siang' | 'sore' | 'malam';

export const MOODS: readonly { id: Mood; label: string }[] = [
  { id: 'pagi', label: 'Morning' },
  { id: 'siang', label: 'Noon' },
  { id: 'sore', label: 'Dusk' },
  { id: 'malam', label: 'Night' },
];

export const DEFAULT_MOOD: Mood = 'sore';

/**
 * The hour each time of day shows, on a 24-hour clock. Morning catches the sun half risen and
 * dusk catches it half set; between them the sky is a blend of the two nearest.
 */
export const MOOD_HOUR: Record<Mood, number> = {
  pagi: 6.1,
  siang: 12,
  sore: 17.9,
  malam: 22,
};

/** The times of day in clock order. */
const BY_HOUR: readonly Mood[] = ['pagi', 'siang', 'sore', 'malam'];

/** The two times of day an hour falls between, and how far it is from the first to the second. */
export function moodsAt(hour: number): { a: Mood; b: Mood; f: number } {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < BY_HOUR.length; i++) {
    const a = BY_HOUR[i];
    const b = BY_HOUR[(i + 1) % BY_HOUR.length];
    const from = MOOD_HOUR[a];
    let to = MOOD_HOUR[b];
    if (to <= from) to += 24;
    let at = h;
    if (at < from) at += 24;
    if (at < to) return { a, b, f: (at - from) / (to - from) };
  }
  return { a: DEFAULT_MOOD, b: DEFAULT_MOOD, f: 0 };
}

type Rgb = readonly [number, number, number];

export type Palette = {
  /** The sky from the top (0) down to the roofs (1). */
  sky: readonly (readonly [number, string])[];
  /** How many stars, how far down they reach, and how bright they are. */
  stars: { count: number; reach: number; glow: number };
  volcano: string;
  hills: string;
  /** The kampung on the horizon, and how many of its windows are lit. */
  far: string;
  farLamps: number;
  /** Haze over the horizon as "r, g, b", and how thick. */
  haze: string;
  hazeAlpha: number;
  /** Clouds: colour high up, colour low down, how solid, and the colour of their underside. */
  cloudHigh: Rgb;
  cloudLow: Rgb;
  cloudAlpha: number;
  cloudUnder: string;
  birds: string | null;
  farKites: number;
  /** A wash over the near houses: "rgba(...)" or null in full daylight. */
  tint: string | null;
  /** Share of near windows with a lamp on, and the light along the ridges. */
  lamps: number;
  ridge: string;
  /** Trees close by, and how brightly people and cloth on the roofs are lit (1 is daylight). */
  foliage: string;
  life: number;
  /** Strings, the player's heading marker and wisps of wind, each as "r, g, b". */
  string: string;
  marker: string;
  wisp: string;
};

export const PALETTES: Record<Mood, Palette> = {
  pagi: {
    sky: [
      [0, '#3D6FA9'],
      [0.3, '#6E9CCB'],
      [0.58, '#A9C6E0'],
      [0.78, '#F0D2B4'],
      [0.92, '#FFE3BE'],
      [1, '#FFF0D6'],
    ],
    stars: { count: 0, reach: 0, glow: 0 },
    volcano: 'rgba(112, 134, 170, 0.45)',
    hills: 'rgba(96, 124, 132, 0.8)',
    far: '#667A92',
    farLamps: 0.06,
    haze: '255, 244, 226',
    hazeAlpha: 0.42,
    cloudHigh: [236, 226, 236],
    cloudLow: [255, 226, 204],
    cloudAlpha: 0.62,
    cloudUnder: 'rgba(255, 244, 226, 0.4)',
    birds: 'rgba(40, 48, 72, 0.6)',
    farKites: 0.6,
    tint: 'rgba(255, 214, 180, 0.1)',
    lamps: 0.08,
    ridge: 'rgba(255, 244, 220, 0.7)',
    string: '48, 44, 78',
    marker: '32, 30, 66',
    foliage: '#2C4A38',
    life: 0.95,
    wisp: '255, 255, 255',
  },
  siang: {
    sky: [
      [0, '#2B78CB'],
      [0.35, '#4F9BE2'],
      [0.7, '#93C6F0'],
      [0.93, '#CFE7F8'],
      [1, '#E2F1FB'],
    ],
    stars: { count: 0, reach: 0, glow: 0 },
    volcano: 'rgba(118, 150, 192, 0.5)',
    hills: 'rgba(96, 142, 116, 0.88)',
    far: '#6C8AA4',
    farLamps: 0,
    haze: '255, 255, 255',
    hazeAlpha: 0.3,
    cloudHigh: [252, 252, 255],
    cloudLow: [246, 249, 255],
    cloudAlpha: 0.86,
    cloudUnder: 'rgba(170, 190, 216, 0.5)',
    birds: 'rgba(36, 44, 70, 0.6)',
    farKites: 0.75,
    tint: null,
    lamps: 0,
    ridge: 'rgba(255, 250, 236, 0.5)',
    string: '40, 38, 72',
    marker: '28, 28, 62',
    foliage: '#2A5236',
    life: 1,
    wisp: '255, 255, 255',
  },
  sore: {
    sky: [
      [0, '#141C46'],
      [0.22, '#2B2A66'],
      [0.42, '#5C3A7E'],
      [0.6, '#B4527A'],
      [0.74, '#E9765A'],
      [0.86, '#F8A95C'],
      [0.95, '#FFD79A'],
      [1, '#FFE7BC'],
    ],
    stars: { count: 54, reach: 220, glow: 1 },
    volcano: 'rgba(104, 62, 118, 0.5)',
    hills: 'rgba(86, 44, 86, 0.8)',
    far: '#43234A',
    farLamps: 0.5,
    haze: '255, 196, 140',
    hazeAlpha: 0.3,
    cloudHigh: [98, 76, 134],
    cloudLow: [226, 128, 116],
    cloudAlpha: 0.4,
    cloudUnder: 'rgba(255, 204, 160, 0.34)',
    birds: 'rgba(40, 24, 52, 0.7)',
    farKites: 0.72,
    tint: 'rgba(46, 18, 50, 0.4)',
    lamps: 0.58,
    ridge: 'rgba(255, 196, 140, 0.8)',
    string: '255, 248, 236',
    marker: '255, 246, 220',
    foliage: '#231528',
    life: 0.8,
    wisp: '255, 244, 228',
  },
  malam: {
    sky: [
      [0, '#060A22'],
      [0.4, '#0E153C'],
      [0.75, '#1A2254'],
      [0.94, '#2A2F68'],
      [1, '#34387A'],
    ],
    stars: { count: 150, reach: 440, glow: 1.5 },
    volcano: 'rgba(34, 40, 86, 0.7)',
    hills: 'rgba(20, 24, 58, 0.92)',
    far: '#12163A',
    farLamps: 0.8,
    haze: '120, 132, 210',
    hazeAlpha: 0.14,
    cloudHigh: [58, 64, 112],
    cloudLow: [70, 76, 128],
    cloudAlpha: 0.5,
    cloudUnder: 'rgba(170, 182, 236, 0.16)',
    birds: null,
    farKites: 0.35,
    tint: 'rgba(8, 10, 42, 0.62)',
    lamps: 0.85,
    ridge: 'rgba(170, 186, 240, 0.45)',
    string: '236, 240, 255',
    marker: '236, 240, 255',
    foliage: '#0B0D26',
    life: 0.5,
    wisp: '220, 228, 255',
  },
};

const KEY = 'adu-layangan:mood';

/** The sky the player last chose, or dusk. Storage can be blocked in a webview; then it is dusk. */
export function loadMood(): Mood {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (MOODS.some((m) => m.id === saved)) return saved as Mood;
  } catch {
    // Storage is unavailable: fall through to the default.
  }
  return DEFAULT_MOOD;
}

export function saveMood(mood: Mood): void {
  try {
    window.localStorage.setItem(KEY, mood);
  } catch {
    // Storage is unavailable: the choice lasts for this visit only.
  }
}

/** A "#RRGGBB" colour as it looks in this light: darker at dusk and at night. */
export function lit(hex: string, p: Palette): string {
  const n = parseInt(hex.slice(1), 16);
  const k = p.life;
  return `rgb(${Math.round(((n >> 16) & 255) * k)}, ${Math.round(((n >> 8) & 255) * k)}, ${Math.round((n & 255) * k)})`;
}

// ───────────────────────────── Blending two times of day ─────────────────────────────

const mix = (a: number, b: number, f: number) => a + (b - a) * f;

const rgbOf = (text: string): number[] => {
  if (text.startsWith('#')) {
    const n = parseInt(text.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const parts = text
    .replace(/rgba?(|)/g, '')
    .split(',')
    .map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
};

const mixRgb = (a: string, b: string, f: number): string => {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return [0, 1, 2].map((i) => Math.round(mix(x[i], y[i], f))).join(', ');
};

const mixRgba = (a: string, b: string, f: number): string => {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return `rgba(${mixRgb(a, b, f)}, ${mix(x[3], y[3], f).toFixed(3)})`;
};

/**
 * The colours of the things drawn every frame, part way from one time of day to another. The
 * still scenery is blended by laying one picture over the other instead.
 */
export function blendPalette(a: Palette, b: Palette, f: number): Palette {
  if (f <= 0) return a;
  if (f >= 1) return b;
  const near = f < 0.5 ? a : b;
  const birds =
    a.birds && b.birds
      ? mixRgba(a.birds, b.birds, f)
      : a.birds && f < 0.5
        ? a.birds
        : b.birds && f >= 0.5
          ? b.birds
          : null;
  return {
    ...near,
    far: `rgb(${mixRgb(a.far, b.far, f)})`,
    cloudHigh: [0, 1, 2].map((i) =>
      mix(a.cloudHigh[i], b.cloudHigh[i], f)
    ) as unknown as Rgb,
    cloudLow: [0, 1, 2].map((i) =>
      mix(a.cloudLow[i], b.cloudLow[i], f)
    ) as unknown as Rgb,
    cloudAlpha: mix(a.cloudAlpha, b.cloudAlpha, f),
    cloudUnder: mixRgba(a.cloudUnder, b.cloudUnder, f),
    birds,
    farKites: mix(a.farKites, b.farKites, f),
    foliage: `rgb(${mixRgb(a.foliage, b.foliage, f)})`,
    life: mix(a.life, b.life, f),
    string: mixRgb(a.string, b.string, f),
    marker: mixRgb(a.marker, b.marker, f),
    wisp: mixRgb(a.wisp, b.wisp, f),
  };
}
