import { DateTime } from 'luxon';

type Translate = (key: string, params?: Record<string, unknown>) => string;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type ElapsedUnit = 'years' | 'months' | 'days' | 'hours' | 'minutes';

const UNIT_KEYS: Record<ElapsedUnit, [string, string]> = {
  years: ['{count} year', '{count} years'],
  months: ['{count} month', '{count} months'],
  days: ['{count} day', '{count} days'],
  hours: ['{count} hour', '{count} hours'],
  minutes: ['{count} minute', '{count} minutes'],
};

/**
 * The time between two moments in its two largest units, rounded at the second one, so
 * 1 day 18 hours 57 minutes reads "1 day 19 hours" and 59 minutes 40 seconds reads
 * "59 minutes". Empty under a minute, when a date is missing, or when the end comes first.
 */
export function elapsedParts(start?: number, end?: number): Array<{ unit: ElapsedUnit; count: number }> {
  if (start === undefined || end === undefined) return [];
  const span = end - start;
  if (!(span >= MINUTE)) return [];
  if (span < HOUR) return [{ unit: 'minutes', count: Math.floor(span / MINUTE) }];

  const byMinute = Math.round(span / MINUTE) * MINUTE;
  const units: ElapsedUnit[] = byMinute < DAY ? ['hours', 'minutes'] : ['years', 'months', 'days', 'hours'];
  const rounded = byMinute < DAY ? byMinute : Math.round(span / HOUR) * HOUR;
  const duration = DateTime.fromMillis(start + rounded).diff(DateTime.fromMillis(start), units).toObject();

  const index = units.findIndex((unit) => Math.floor(duration[unit] || 0) > 0);
  if (index < 0) return [];
  const parts = [{ unit: units[index], count: Math.floor(duration[units[index]] || 0) }];
  const next = units[index + 1];
  const nextCount = next ? Math.round(duration[next] || 0) : 0;
  if (next && nextCount > 0) parts.push({ unit: next, count: nextCount });
  return parts;
}

/** "1 day 19 hours", or '' under a minute. */
export function formatElapsed(start: number | undefined, end: number | undefined, translate: Translate): string {
  return elapsedParts(start, end)
    .map(({ unit, count }) => translate(UNIT_KEYS[unit][count === 1 ? 0 : 1], { count }))
    .join(' ');
}

export const formatClock = (at: number) => DateTime.fromMillis(at).toLocaleString(DateTime.TIME_SIMPLE);

export const formatClockWithSeconds = (at: number) => DateTime.fromMillis(at).toLocaleString(DateTime.TIME_WITH_SECONDS);

export const formatDay = (at: number) =>
  DateTime.fromMillis(at).toLocaleString({ weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

export const dayKey = (at: number) => DateTime.fromMillis(at).toISODate() || '';

/** A moment with its date, for spans that cross a day: "Sep 11, 2026, 12:32 PM". */
export const formatDateTimeShort = (at: number) => DateTime.fromMillis(at).toLocaleString(DateTime.DATETIME_MED);
