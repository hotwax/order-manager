import { DateTime } from 'luxon';
import { formatDate, formatDateTime, formatMoney } from '@/utils/format';

function displayValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function parseDate(value: string | number): DateTime {
  const stringValue = String(value).trim();
  const numericValue = Number(stringValue);

  if (Number.isFinite(numericValue)) {
    return DateTime.fromMillis(stringValue.length <= 10 ? numericValue * 1000 : numericValue);
  }

  const isoDate = DateTime.fromISO(stringValue);
  return isoDate.isValid ? isoDate : DateTime.fromSQL(stringValue);
}

export function taskOrderTitle(task: any): string {
  return displayValue(task?.orderName)
    || displayValue(task?.orderId)
    || displayValue(task?.externalId)
    || displayValue(task?.workEffortName)
    || displayValue(task?.workEffortId);
}

export function formatTaskDate(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') return '';
  return formatDate(value) || displayValue(value);
}

export function taskOrderSubtitle(value: string | number | null | undefined, orderedLabel: string): string {
  const orderDate = formatTaskDate(value);
  return orderDate ? `${orderedLabel} ${orderDate}` : '';
}

/** A task's order total in the order's own currency; blank when there is none. */
export function formatTaskAmount(value?: string | number | null, currency?: string): string {
  if (value === undefined || value === null || value === '' || !Number.isFinite(Number(value))) return '';
  return formatMoney(value, currency);
}

export function taskAgeLabel(
  value: string | number | null | undefined,
  createdLabel: string,
  base = DateTime.local(),
): string {
  if (value === undefined || value === null || value === '') return '';

  const date = parseDate(value);
  if (!date.isValid) return '';

  const relativeAge = date.toRelative({ base });
  return relativeAge ? `${createdLabel} ${relativeAge}` : '';
}

export function taskCreatedTimestampLabel(
  value: string | number | null | undefined,
  taskCreatedLabel: string,
): string {
  if (value === undefined || value === null || value === '') return '';

  const created = formatDateTime(value);
  return created ? `${taskCreatedLabel}: ${created}` : '';
}
