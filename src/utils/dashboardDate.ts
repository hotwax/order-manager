import { DateTime } from 'luxon';

function getDashboardDateTime(userTimeZone?: string, now = DateTime.now()) {
  if (!userTimeZone) return now;

  const zonedNow = now.setZone(userTimeZone);
  return zonedNow.isValid ? zonedNow : now;
}

export function getDashboardDateFilter(userTimeZone?: string, now = DateTime.now()) {
  return getDashboardDateTime(userTimeZone, now).toFormat('yyyy-MM-dd');
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
