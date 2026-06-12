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
