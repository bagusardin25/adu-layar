// Tebar's calendar. A day starts at 00:00 UTC for everyone, so every player gets the same board
// no matter where they are. Day 1 is 12 November 2026.

export const DAY_MS = 86_400_000;
export const FIRST_DAY_MS = Date.UTC(2026, 10, 12);

/** The day number at a moment in time. Day 1 is the first day; earlier moments give 0 or less. */
export function dayNumber(nowMs: number): number {
  return Math.floor((nowMs - FIRST_DAY_MS) / DAY_MS) + 1;
}

/** 00:00 UTC of a day, in milliseconds. */
export function dayStartMs(day: number): number {
  return FIRST_DAY_MS + (day - 1) * DAY_MS;
}

/** 0 = Sunday … 6 = Saturday, in UTC. */
export function weekdayOf(day: number): number {
  return new Date(dayStartMs(day)).getUTCDay();
}

/** Milliseconds until the next board. */
export function msUntilNextDay(nowMs: number): number {
  return dayStartMs(dayNumber(nowMs) + 1) - nowMs;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "Fri 13 Nov", in UTC, without depending on the device's locale. */
export function dayLabel(day: number): string {
  const d = new Date(dayStartMs(day));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Weeks run Monday to Sunday (UTC). Days in the same week share a week number. */
export function weekOf(day: number): number {
  const mondayOffset = (weekdayOf(1) + 6) % 7;
  return Math.floor((day - 1 + mondayOffset) / 7);
}
