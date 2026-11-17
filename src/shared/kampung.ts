// The kampungs a player can fly for. Every scored flight adds its points to the player's
// kampung for that day, and the kampung with the most points wins the day. A player can wear
// their kampung as user flair in the subreddit, by their own choice.
//
// Like names and kite looks, kampungs come from this fixed list, never typed.

export const KAMPUNGS = [
  {
    id: 'hulu',
    label: 'Kampung Hulu',
    short: 'Hulu',
    gloss: 'up the river',
    colour: '#237A4B',
  },
  {
    id: 'hilir',
    label: 'Kampung Hilir',
    short: 'Hilir',
    gloss: 'down the river',
    colour: '#1E6FB8',
  },
  {
    id: 'pesisir',
    label: 'Kampung Pesisir',
    short: 'Pesisir',
    gloss: 'by the sea',
    colour: '#C4521A',
  },
] as const;

export type KampungId = (typeof KAMPUNGS)[number]['id'];
export type Kampung = (typeof KAMPUNGS)[number];

/** One kampung's points on a day. */
export type KampungScore = { id: KampungId; points: number };

/** The day's kampungs, most points first. On a tie, the list order decides. */
export type KampungBoard = {
  today: KampungScore[];
  /** The kampung that won yesterday, if anyone flew yesterday. */
  yesterday: KampungId | null;
};

export const isKampung = (value: unknown): value is KampungId =>
  KAMPUNGS.some((k) => k.id === value);

export const kampungOf = (id: KampungId): Kampung =>
  KAMPUNGS.find((k) => k.id === id) ?? KAMPUNGS[0];

/** Orders scores for display: most points first, then the list order. */
export function rankKampungs(
  points: Partial<Record<KampungId, number>>
): KampungScore[] {
  return KAMPUNGS.map((k, i) => ({ id: k.id, points: points[k.id] ?? 0, i }))
    .sort((a, b) => b.points - a.points || a.i - b.i)
    .map(({ id, points }) => ({ id, points }));
}

/** The winner of a finished day, or null when nobody scored or the top two tied. */
export function winnerOf(scores: KampungScore[]): KampungId | null {
  const [top, next] = scores;
  if (!top || top.points <= 0) return null;
  return next && next.points === top.points ? null : top.id;
}

/** One line on the day: who leads, or who won yesterday. Null when there is nothing yet. */
export function kampungNews(board: KampungBoard): string | null {
  const [top, next] = board.today;
  if (top && top.points > 0 && (!next || next.points < top.points))
    return `${kampungOf(top.id).label} leads today`;
  if (board.yesterday)
    return `Yesterday ${kampungOf(board.yesterday).label} won`;
  return null;
}
