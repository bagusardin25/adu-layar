// The shapes and numbers of the kite fight. Everything is in "sky units": the sky is 360 wide
// and 640 tall, y grows downwards, and the rooftops where flyers stand are near the bottom.

/** Simulation steps per second. A round is a whole number of steps, never wall-clock time. */
export const TICKS_PER_SECOND = 60;
export const DT = 1 / TICKS_PER_SECOND;
export const ROUND_SECONDS = 60;
export const ROUND_TICKS = ROUND_SECONDS * TICKS_PER_SECOND;

export const SKY_W = 360;
export const SKY_H = 640;
/** Where every flyer stands: the line of rooftops. */
export const ROOF_Y = 560;
/** Where a flyer holds the string: a raised hand. Every string starts at this height. */
export const HAND_Y = ROOF_Y - 12;
/** A kite that sinks below this line brushes a roof: it bounces, and its string frays. */
export const CRASH_Y = 540;
/** String damage from brushing a roof. Enough of it snaps the string. */
export const ROOF_DAMAGE = 30;
/** The top edge of the sky. */
export const TOP_Y = 26;
/** Longest a string can be. */
export const STRING_LENGTH = 470;

/** Fray a string can take before it snaps. Fray never mends: a worn string stays worn. */
export const STRING_HEALTH = 140;
/** The player flies with glass-coated string (benang gelasan): it takes more damage to cut... */
export const PLAYER_STRING_HEALTH = 300;
/** ...and wears through a rival's plain string faster than theirs wears through it. */
export const PLAYER_SHARPNESS = 1.6;

export const POINTS = {
  cut: 100,
  /** Cutting yesterday's best flyer, Raja Langit. */
  king: 300,
  /** Lasting the whole round. */
  survive: 150,
  /** Per second left when every rival is down before time runs out. */
  perSecondLeft: 5,
} as const;

/**
 * One sample of a recorded flight, taken 20 times a second. `f` is 0 slack, 1 pulling,
 * 2 cut, 3 crashed. Positions are sky units; `a` is the heading in angle units.
 */
export type Sample = { x: number; y: number; a: number; f: number };

export type Style = 'nekat' | 'gesit' | 'kalem';

/** How a kite flies. The player's kite uses the same numbers as everyone else's. */
export type Handling = {
  /** Angle units per tick the kite turns while the string is slack. */
  spin: number;
  /** Top speed (sky units per second) while the string is pulled. */
  pullSpeed: number;
};

export type RivalSpec = Handling & {
  name: string;
  style: Style;
  anchorX: number;
  colors: readonly [string, string];
  /** How well the kite lines up before pulling: the cosine it waits for. */
  aim: number;
};

/** A recorded flight played back in someone else's sky. */
export type GhostSpec = {
  id: string;
  /** The name the flyer used. The kite tag adds "Raja ·" for the king. */
  name: string;
  colors: readonly [string, string];
  anchorX: number;
  kind: 'king' | 'ghost';
  /** Packed samples. See `pack` in ghost.ts. */
  track: string;
  /** The score this flight earned, for the king's label. */
  score: number;
};

/** One day's sky: the wind, the kampung's pilots, and the recorded flights. */
export type Sky = {
  day: number;
  /** Steady wind, sky units per second. */
  windX: number;
  windY: number;
  /** Gusts: a slow swing added to the steady wind. */
  gustAmp: number;
  /** Angle units per tick; the swing repeats every 1024 / gustRate ticks. */
  gustRate: number;
  gustPhase: number;
  rivals: readonly RivalSpec[];
  /** Recorded flights. Absent on a sky that has not been given any. */
  ghosts?: readonly GhostSpec[];
  /** The practice flight has no clock. A real round always ends. */
  untimed?: boolean;
};

export type KiteRole = 'player' | 'rival';
export type KiteState = 'flying' | 'cut' | 'crashed';

export type Kite = {
  id: number;
  role: KiteRole;
  name: string;
  style: Style | null;
  colors: readonly [string, string];
  handling: Handling;
  aim: number;
  /** Where the string starts: the flyer's hand. */
  ax: number;
  ay: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Heading in angle units: 0 is up, 256 is right. */
  a: number;
  pull: boolean;
  /** How loose the string hangs: 0 is taut, 1 is fully slack. It follows the pull with a lag. */
  slack: number;
  state: KiteState;
  /** Fray on the string; it snaps at STRING_HEALTH. Only ever grows. */
  damage: number;
  /** The last kite whose string rubbed this one: who gets the credit for a cut. */
  hitBy: number;
  /** Rivals only: the tick until which the kite rests after an attack, and whether it is in one. */
  rest: number;
  engaged: boolean;
  /** Tick the kite was cut or crashed, where its string parted, and how it was heading. */
  endTick: number;
  endX: number;
  endY: number;
  endA: number;
  /** Points the player scores for cutting this kite. */
  worth: number;
  /** A recorded flight. The kite follows it instead of a pilot. */
  track: Sample[] | null;
  kind: 'player' | 'ai' | 'king' | 'ghost';
};

export type MatchEvent =
  | {
      type: 'cut';
      tick: number;
      victim: number;
      by: number;
      x: number;
      y: number;
      points: number;
    }
  | { type: 'crash'; tick: number; victim: number; x: number; y: number }
  | { type: 'end'; tick: number; reason: EndReason; points: number };

export type EndReason = 'time' | 'cut' | 'crashed' | 'cleared';

/**
 * Two strings touching this tick: where, whose, and how fast they slide over each other
 * (sky units per second). Strings that are crossed but still do not rub.
 */
export type Contact = {
  x: number;
  y: number;
  a: number;
  b: number;
  rub: number;
};

export type Match = {
  sky: Sky;
  tick: number;
  kites: Kite[];
  /** Strings touching on the latest tick, for sparks. */
  contacts: Contact[];
  events: MatchEvent[];
  score: number;
  /** Rivals cut by the player. */
  cuts: number;
  over: boolean;
  reason: EndReason | null;
};

export const PLAYER_ID = 0;
/** Stands in for a kite id when the roofs did the damage. */
export const ROOF = -2;
