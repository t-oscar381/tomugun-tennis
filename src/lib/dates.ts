/**
 * Play days are calendar dates in Jakarta, and nothing else.
 *
 * A match played at 21:00 on Saturday is Saturday's match, whatever UTC says —
 * and UTC says Saturday 14:00, which is fine, but a 06:30 Sunday-morning game
 * is *Saturday* in UTC and Sunday in Jakarta, which is the kind of off-by-one
 * that quietly files results under the wrong night. Jakarta has no daylight
 * saving, so a fixed +07:00 offset is exact, not an approximation.
 */

const OFFSET_HOURS = 7;
const DAY_MS = 24 * 3600 * 1000;

/** Today's date in Jakarta, as YYYY-MM-DD. */
export function jakartaDate(when: Date = new Date()): string {
  return new Date(when.getTime() + OFFSET_HOURS * 3600 * 1000).toISOString().slice(0, 10);
}

/** True for a real calendar date written YYYY-MM-DD (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** [start, end) of a Jakarta calendar day, as UTC instants. */
export function dayBounds(date: string): { start: string; end: string } {
  const start = new Date(`${date}T00:00:00+07:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + DAY_MS).toISOString() };
}

/**
 * The instant stored as `played_at` for a match filed under a play day. Midday,
 * so it sits well inside the day on either side of any timezone display bug.
 */
export function playedAtFor(date: string): string {
  return new Date(`${date}T12:00:00+07:00`).toISOString();
}

/** The Jakarta calendar date a stored instant belongs to. */
export function dateOf(instant: string): string {
  return jakartaDate(new Date(instant));
}

/** "Sat 15 Nov". */
export function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "Saturday 15 November 2026". */
export function formatDayLong(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today / Yesterday / the date — for headings where "today" is the useful word. */
export function relativeDay(date: string, now: Date = new Date()): string {
  const today = jakartaDate(now);
  if (date === today) return "Today";
  if (date === jakartaDate(new Date(now.getTime() - DAY_MS))) return "Yesterday";
  return formatDay(date);
}

/** The date `days` after (or before, if negative) a YYYY-MM-DD date. */
export function shiftDate(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** "19:45", in Jakarta time. */
export function formatTime(instant: string): string {
  return new Date(instant).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}
