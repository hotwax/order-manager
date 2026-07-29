import { DateTime } from 'luxon';

function getDashboardDateTime(userTimeZone?: string, now = DateTime.now()) {
  if (!userTimeZone) return now;

  const zonedNow = now.setZone(userTimeZone);
  return zonedNow.isValid ? zonedNow : now;
}

export function getDashboardDateFilter(userTimeZone?: string, now = DateTime.now()) {
  return getDashboardDateTime(userTimeZone, now).toFormat('yyyy-MM-dd');
}

export function getDashboardDateRange(userTimeZone?: string, now = DateTime.now()) {
  const startOfDay = getDashboardDateTime(userTimeZone, now).startOf('day');
  const endOfDay = startOfDay.plus({ days: 1 }).startOf('day');

  return {
    dateFilter: startOfDay.toFormat('yyyy-MM-dd'),
    startOfDayStr: startOfDay.toFormat('yyyy-MM-dd HH:mm:ss'),
    endOfDayStr: endOfDay.toFormat('yyyy-MM-dd HH:mm:ss')
  };
}

export function getHoursSinceDayStart(userTimeZone?: string, now = DateTime.now()) {
  return getDashboardDateTime(userTimeZone, now).hour;
}

export function getDashboardDateRefreshKey(userTimeZone?: string, now = DateTime.now()) {
  return `${userTimeZone || 'local'}|${getDashboardDateFilter(userTimeZone, now)}`;
}

export function getMillisecondsUntilNextDashboardHour(userTimeZone?: string, now = DateTime.now()) {
  const zonedNow = getDashboardDateTime(userTimeZone, now);
  const nextHour = zonedNow.plus({ hours: 1 }).startOf('hour');

  return Math.max(1, Math.ceil(nextHour.diff(zonedNow).as('milliseconds')));
}
