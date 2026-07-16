import { DateTime } from 'luxon';

export function getDashboardDateFilter(userTimeZone?: string, now = DateTime.now()) {
  const zonedNow = userTimeZone ? now.setZone(userTimeZone) : now;

  return (zonedNow.isValid ? zonedNow : now).toFormat('yyyy-MM-dd');
}
