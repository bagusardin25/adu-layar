// What a player can choose about their kite and the name they fly under.
//
// Everything is picked from the lists below, never typed: Reddit asks apps to limit what
// players can put in front of others to "predefined, safe dictionaries". A player's choice is
// stored as ids only, so the server can check it against these same lists.
//
// Some choices cost coins (`price`). Coins buy looks only, never speed or strength: every
// player flies the same sky each day, and the score has to show skill.

import { random } from './sim/random.ts';

export type Option<Id extends string> = {
  id: Id;
  label: string;
  /** Coins it costs to own. Free when absent. */
  price?: number;
};

export const SHAPES = [
  { id: 'aduan', label: 'Fighter' },
  { id: 'wajik', label: 'Diamond' },
  { id: 'pari', label: 'Stingray' },
] as const satisfies readonly Option<string>[];

export const MOTIFS = [
  { id: 'bendera', label: 'Flag' },
  { id: 'belah', label: 'Split' },
  { id: 'garis', label: 'Stripes' },
  { id: 'mata', label: 'Eyes' },
  { id: 'bulan', label: 'Moon' },
  { id: 'bintang', label: 'Star' },
  { id: 'kawung', label: 'Kawung' },
  { id: 'parang', label: 'Parang' },
  { id: 'mendung', label: 'Mendung', price: 60 },
  { id: 'truntum', label: 'Truntum', price: 60 },
  { id: 'sisik', label: 'Scales', price: 80 },
  { id: 'pelangi', label: 'Rainbow', price: 120 },
] as const satisfies readonly Option<string>[];

/** What hangs from the kite. */
export const TAILS = [
  { id: 'pita', label: 'Ribbon' },
  { id: 'ganda', label: 'Twin', price: 50 },
  { id: 'rumbai', label: 'Tassels', price: 70 },
  { id: 'lampion', label: 'Lanterns', price: 140 },
] as const satisfies readonly Option<string>[];

/** How the player's string looks. Only the look: every string cuts the same. */
export const LINES = [
  { id: 'biasa', label: 'Plain' },
  { id: 'emas', label: 'Gold', price: 80 },
  { id: 'neon', label: 'Neon', price: 100 },
  { id: 'pelangi', label: 'Rainbow', price: 140 },
] as const satisfies readonly Option<string>[];

export const COLOURS = [
  { id: 'merah', label: 'Red', hex: '#D7263D' },
  { id: 'putih', label: 'White', hex: '#F4F0E6' },
  { id: 'kuning', label: 'Yellow', hex: '#F2C230' },
  { id: 'jingga', label: 'Orange', hex: '#F07A1A' },
  { id: 'jambu', label: 'Pink', hex: '#E86A9A' },
  { id: 'ungu', label: 'Purple', hex: '#7A3EA0' },
  { id: 'hijau', label: 'Green', hex: '#2F8F5B' },
  { id: 'toska', label: 'Teal', hex: '#1FA6A0' },
  { id: 'biru', label: 'Blue', hex: '#1E6FB8' },
  { id: 'nila', label: 'Indigo', hex: '#2B3A8C' },
  { id: 'coklat', label: 'Brown', hex: '#8A5A3B' },
  { id: 'hitam', label: 'Black', hex: '#1F2333' },
] as const satisfies readonly (Option<string> & { hex: string })[];

/** How people in the kampung call each other. `none` leaves the nickname on its own. */
export const TITLES = [
  { id: 'none', label: '' },
  { id: 'bang', label: 'Bang' },
  { id: 'mas', label: 'Mas' },
  { id: 'kang', label: 'Kang' },
  { id: 'cak', label: 'Cak' },
  { id: 'bli', label: 'Bli' },
  { id: 'uda', label: 'Uda' },
  { id: 'bung', label: 'Bung' },
  { id: 'om', label: 'Om' },
  { id: 'si', label: 'Si' },
  { id: 'neng', label: 'Neng' },
  { id: 'mbak', label: 'Mbak' },
  { id: 'teh', label: 'Teh' },
  { id: 'uni', label: 'Uni' },
  { id: 'kak', label: 'Kak' },
] as const satisfies readonly Option<string>[];

/** Birds, weather, the sky, and street food: the kind of names a kampung gives a flyer. */
export const NICKS = [
  { id: 'elang', label: 'Elang' },
  { id: 'rajawali', label: 'Rajawali' },
  { id: 'walet', label: 'Walet' },
  { id: 'camar', label: 'Camar' },
  { id: 'kenari', label: 'Kenari' },
  { id: 'capung', label: 'Capung' },
  { id: 'kumbang', label: 'Kumbang' },
  { id: 'kancil', label: 'Kancil' },
  { id: 'macan', label: 'Macan' },
  { id: 'banteng', label: 'Banteng' },
  { id: 'petir', label: 'Petir' },
  { id: 'kilat', label: 'Kilat' },
  { id: 'badai', label: 'Badai' },
  { id: 'topan', label: 'Topan' },
  { id: 'bayu', label: 'Bayu' },
  { id: 'senja', label: 'Senja' },
  { id: 'fajar', label: 'Fajar' },
  { id: 'bintang', label: 'Bintang' },
  { id: 'komet', label: 'Komet' },
  { id: 'gelasan', label: 'Gelasan' },
  { id: 'cilok', label: 'Cilok' },
  { id: 'bakwan', label: 'Bakwan' },
  { id: 'tempe', label: 'Tempe' },
  { id: 'sambal', label: 'Sambal' },
  { id: 'kerupuk', label: 'Kerupuk' },
  { id: 'cendol', label: 'Cendol' },
  { id: 'kopi', label: 'Kopi' },
  { id: 'rambutan', label: 'Rambutan' },
] as const satisfies readonly Option<string>[];

export type ShapeId = (typeof SHAPES)[number]['id'];
export type MotifId = (typeof MOTIFS)[number]['id'];
export type TailId = (typeof TAILS)[number]['id'];
export type LineId = (typeof LINES)[number]['id'];
export type ColourId = (typeof COLOURS)[number]['id'];
export type TitleId = (typeof TITLES)[number]['id'];
export type NickId = (typeof NICKS)[number]['id'];

export type KiteDesign = {
  shape: ShapeId;
  motif: MotifId;
  /** The body of the kite, and the colour of its motif. */
  main: ColourId;
  trim: ColourId;
  tail: TailId;
  line: LineId;
};

export type FlyerName = { title: TitleId; nick: NickId };

export type Profile = { design: KiteDesign; name: FlyerName };

const has = <Id extends string>(
  list: readonly Option<Id>[],
  value: unknown
): value is Id => list.some((o) => o.id === value);

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * A profile rebuilt from untrusted data, keeping only known fields with known values, or null
 * if anything is missing or unknown.
 */
export function parseProfile(x: unknown): Profile | null {
  if (!isRecord(x) || !isRecord(x.design) || !isRecord(x.name)) return null;
  const { shape, motif, main, trim } = x.design;
  // Kites saved before tails and strings could be chosen have the plain ones.
  const tail = x.design.tail ?? 'pita';
  const line = x.design.line ?? 'biasa';
  const { title, nick } = x.name;
  if (
    !has(SHAPES, shape) ||
    !has(MOTIFS, motif) ||
    !has(COLOURS, main) ||
    !has(COLOURS, trim) ||
    !has(TAILS, tail) ||
    !has(LINES, line) ||
    !has(TITLES, title) ||
    !has(NICKS, nick)
  ) {
    return null;
  }
  return {
    design: { shape, motif, main, trim, tail, line },
    name: { title, nick },
  };
}

/** A kite design rebuilt from untrusted data, or null if any part is not one of the choices. */
export function parseDesign(x: unknown): KiteDesign | null {
  return (
    parseProfile({ design: x, name: { title: 'none', nick: 'elang' } })
      ?.design ?? null
  );
}

/** The kite in words, for a comment: "Fighter · Kawung · Red and White · Ribbon tail". */
export function describeKite(design: KiteDesign): string {
  const label = (list: readonly Option<string>[], id: string) =>
    list.find((o) => o.id === id)?.label ?? id;
  const main = label(COLOURS, design.main);
  const trim = label(COLOURS, design.trim);
  const parts = [
    label(SHAPES, design.shape),
    label(MOTIFS, design.motif),
    main === trim ? main : `${main} and ${trim}`,
    `${label(TAILS, design.tail)} tail`,
  ];
  if (design.line !== 'biasa')
    parts.push(`${label(LINES, design.line)} string`);
  return parts.join(' · ');
}

/** The name as it is shown: "Bang Petir", or just "Petir". */
export function nameOf(name: FlyerName): string {
  const title = TITLES.find((t) => t.id === name.title)?.label ?? '';
  const nick = NICKS.find((n) => n.id === name.nick)?.label ?? '';
  return title ? `${title} ${nick}` : nick;
}

export function colourHex(id: ColourId): string {
  return COLOURS.find((c) => c.id === id)?.hex ?? '#D7263D';
}

const pick = <T>(list: readonly T[], next: () => number): T =>
  list[Math.floor(next() * list.length)];

/** A name drawn at random. */
export function randomName(next: () => number = Math.random): FlyerName {
  return { title: pick(TITLES, next).id, nick: pick(NICKS, next).id };
}

const priced = (o: Option<string>): boolean => (o.price ?? 0) > 0;

/** A whole profile drawn at random, from the free choices only. Body and motif always differ, so the motif shows. */
export function randomProfile(next: () => number = Math.random): Profile {
  const main = pick(COLOURS, next).id;
  const others = COLOURS.filter((c) => c.id !== main);
  return {
    design: {
      shape: pick(SHAPES, next).id,
      motif: pick(
        MOTIFS.filter((m) => !priced(m)),
        next
      ).id,
      main,
      trim: pick(others, next).id,
      tail: 'pita',
      line: 'biasa',
    },
    name: randomName(next),
  };
}

/** A stable number from a string (FNV-1a). */
function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The kite and name a player starts with before choosing their own: always the same for the
 * same account, so it does not change between visits or devices.
 */
export function defaultProfile(seed: string): Profile {
  return randomProfile(random(hashString(seed)));
}

// ───────────────────────────── The shop ─────────────────────────────

/** Something that can be bought: "motif:mendung", "tail:lampion", "line:emas". */
export type ItemId = `${'motif' | 'tail' | 'line'}:${string}`;

export type Item = { id: ItemId; label: string; price: number };

/** Everything that costs coins. */
export const SHOP: readonly Item[] = [
  ...MOTIFS.filter(priced).map((o: Option<string>) => ({
    id: `motif:${o.id}` as ItemId,
    label: `${o.label} pattern`,
    price: o.price ?? 0,
  })),
  ...TAILS.filter(priced).map((o: Option<string>) => ({
    id: `tail:${o.id}` as ItemId,
    label: `${o.label} tail`,
    price: o.price ?? 0,
  })),
  ...LINES.filter(priced).map((o: Option<string>) => ({
    id: `line:${o.id}` as ItemId,
    label: `${o.label} string`,
    price: o.price ?? 0,
  })),
];

export const itemOf = (id: unknown): Item | undefined =>
  SHOP.find((i) => i.id === id);

/** The items a design uses that cost coins. */
export function itemsIn(design: KiteDesign): ItemId[] {
  const used: ItemId[] = [
    `motif:${design.motif}`,
    `tail:${design.tail}`,
    `line:${design.line}`,
  ];
  return used.filter((id) => itemOf(id) !== undefined);
}

/** The items a design uses that the player does not own yet. */
export function missingItems(
  design: KiteDesign,
  owned: readonly string[]
): ItemId[] {
  return itemsIn(design).filter((id) => !owned.includes(id));
}

/**
 * A design with anything not owned put back to what the player had before, so closing the
 * workshop never keeps something they only tried on.
 */
export function keepOwned(
  design: KiteDesign,
  before: KiteDesign,
  owned: readonly string[]
): KiteDesign {
  const has = (id: ItemId) => !itemOf(id) || owned.includes(id);
  return {
    ...design,
    motif: has(`motif:${design.motif}`) ? design.motif : before.motif,
    tail: has(`tail:${design.tail}`) ? design.tail : before.tail,
    line: has(`line:${design.line}`) ? design.line : before.line,
  };
}
