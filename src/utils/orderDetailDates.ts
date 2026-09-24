import { DateTime } from 'luxon';
import { translate } from '@common';

/**
 * Epoch millis for the date shapes the order document mixes: epoch millis, 10-digit epoch
 * seconds, SQL timestamps and ISO strings. undefined when the value is empty or unparseable.
 */
export function timelineMillis(value: any): number | undefined {
  if (!value) return undefined;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return String(value).length === 10 ? numericValue * 1000 : numericValue;
  }

  const stringValue = String(value);
  const sqlDate = DateTime.fromSQL(stringValue);
  if (sqlDate.isValid) return sqlDate.toMillis();

  const isoDate = DateTime.fromISO(stringValue);
  return isoDate.isValid ? isoDate.toMillis() : undefined;
}

const TIME_DIFF_UNITS = ['years', 'months', 'days', 'hours', 'minutes'] as const;

/** Elapsed time between two dates as "+ 2 days 3 hours", or '' when either date is missing. */
export function findTimeDiff(startTime: any, endTime: any): string {
  const startMillis = timelineMillis(startTime);
  const endMillis = timelineMillis(endTime);
  if (!startMillis || !endMillis) return '';

  const timeDiff = DateTime.fromMillis(endMillis).diff(DateTime.fromMillis(startMillis), [...TIME_DIFF_UNITS]);
  const parts = TIME_DIFF_UNITS
    .filter((unit) => timeDiff[unit])
    .map((unit) => `${Math.round(timeDiff[unit])} ${translate(unit)}`);
  return parts.length ? `+ ${parts.join(' ')}` : '';
}

export function formatDateTime(value: any): string {
  const millis = timelineMillis(value);
  return millis
    ? DateTime.fromMillis(millis).toLocaleString({ hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric', hourCycle: 'h12' })
    : '';
}

function parseDisplayDate(value: any): DateTime {
  const num = Number(value);
  return Number.isFinite(num) && String(value).length >= 10 ? DateTime.fromMillis(num) : DateTime.fromISO(String(value));
}

export function formatDate(value: any): string {
  if (!value) return '';
  const dt = parseDisplayDate(value);
  return dt.isValid ? dt.toFormat('yyyy-LL-dd HH:mm') : String(value);
}

export function formatTime(value: any): string {
  if (!value) return '';
  const dt = parseDisplayDate(value);
  return dt.isValid ? dt.toFormat('HH:mm') : String(value);
}

/** A timestamp or ISO string as YYYY-MM-DD, the value `<ion-input type="date">` binds. */
export function toDateInputValue(value: any): string {
  if (!value) return '';
  const dt = /^\d+$/.test(String(value)) ? DateTime.fromMillis(Number(value)) : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toISODate() ?? '' : '';
}
