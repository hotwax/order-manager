import { DateTime } from 'luxon';

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

  const date = parseDate(value);
  return date.isValid ? date.toLocaleString(DateTime.DATE_MED) : displayValue(value);
}

export function taskOrderSubtitle(value: string | number | null | undefined, orderedLabel: string): string {
  const orderDate = formatTaskDate(value);
  return orderDate ? `${orderedLabel} ${orderDate}` : '';
}

export function formatTaskAmount(value?: string | number | null, currency = 'USD'): string {
  if (value === undefined || value === null || value === '') return '';

  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';

  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
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

  const date = parseDate(value);
  return date.isValid ? `${taskCreatedLabel}: ${date.toLocaleString(DateTime.DATETIME_MED)}` : '';
}
