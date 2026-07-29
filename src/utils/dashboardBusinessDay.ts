import { DateTime } from 'luxon';

export interface DashboardBusinessDayRange {
  dateFilter: string;
  fromDate: string;
  thruDate: string;
  timeZoneId: string;
}

/**
 * Resolve the dashboard's current business day to explicit instant bounds.
 *
 * Adding one calendar day in the selected zone (instead of adding 24 hours)
 * keeps the exclusive upper bound correct across daylight-saving changes.
 */
export function getDashboardBusinessDayRange(
  userTimeZone?: string,
  now = DateTime.now()
): DashboardBusinessDayRange {
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const requestedTimeZone = userTimeZone || browserTimeZone;
  const requestedNow = now.setZone(requestedTimeZone);
  const timeZoneId = requestedNow.isValid ? requestedTimeZone : browserTimeZone;
  const zonedNow = requestedNow.isValid ? requestedNow : now.setZone(timeZoneId);
  const startOfDay = (zonedNow.isValid ? zonedNow : now.toUTC()).startOf('day');
  const startOfNextDay = startOfDay.plus({ days: 1 }).startOf('day');

  return {
    dateFilter: startOfDay.toFormat('yyyy-MM-dd'),
    fromDate: startOfDay.toUTC().toISO()!,
    thruDate: startOfNextDay.toUTC().toISO()!,
    timeZoneId
  };
}
