import { DateTime, Settings } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  getDashboardDateFilter,
  getDashboardDateRange,
  getDashboardDateRefreshKey,
  getHoursSinceDayStart,
  getMillisecondsUntilNextDashboardHour
} from '@/utils/dashboardDate';

describe('getDashboardDateFilter', () => {
  it('uses the user profile timezone instead of the browser-local day', () => {
    const browserLocalNow = DateTime.fromISO('2026-06-27T03:57:54+05:30');

    expect(getDashboardDateFilter('America/New_York', browserLocalNow)).toBe('2026-06-26');
  });
});

describe('getDashboardDateRange', () => {
  it('uses the selected timezone when the ambient default zone is on another calendar day', () => {
    const originalZone = Settings.defaultZone;
    Settings.defaultZone = 'Asia/Kolkata';

    try {
      const sameInstant = DateTime.fromISO('2026-07-04T02:00:00Z');

      expect(getDashboardDateRange('America/Los_Angeles', sameInstant)).toEqual({
        dateFilter: '2026-07-03',
        startOfDayStr: '2026-07-03 00:00:00',
        endOfDayStr: '2026-07-04 00:00:00'
      });
    } finally {
      Settings.defaultZone = originalZone;
    }
  });

  it.each([
    ['spring-forward', '2026-03-08T12:00:00Z', '2026-03-08', '2026-03-09', 23],
    ['fall-back', '2026-11-01T12:00:00Z', '2026-11-01', '2026-11-02', 25]
  ])('uses calendar-day bounds across the New York %s boundary', (_label, instant, fromDate, thruDate, durationHours) => {
    const range = getDashboardDateRange('America/New_York', DateTime.fromISO(instant));
    const start = DateTime.fromFormat(range.startOfDayStr, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/New_York' });
    const end = DateTime.fromFormat(range.endOfDayStr, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/New_York' });

    expect(range).toEqual({
      dateFilter: fromDate,
      startOfDayStr: `${fromDate} 00:00:00`,
      endOfDayStr: `${thruDate} 00:00:00`
    });
    expect(end.diff(start, 'hours').hours).toBe(durationHours);
  });
});

describe('getHoursSinceDayStart', () => {
  it('uses the selected user timezone for the same instant', () => {
    const now = DateTime.fromISO('2026-07-29T08:15:00Z');

    expect(getHoursSinceDayStart('America/Los_Angeles', now)).toBe(1);
    expect(getHoursSinceDayStart('Asia/Kolkata', now)).toBe(13);
  });

  it('returns zero at midnight in the selected user timezone', () => {
    const now = DateTime.fromISO('2026-07-29T07:00:00Z');

    expect(getHoursSinceDayStart('America/Los_Angeles', now)).toBe(0);
  });

  it('falls back to the supplied clock zone when the user timezone is missing or invalid', () => {
    const now = DateTime.fromISO('2026-07-29T13:46:00+05:30', { setZone: true });

    expect(getHoursSinceDayStart(undefined, now)).toBe(13);
    expect(getHoursSinceDayStart('Not/A_Timezone', now)).toBe(13);
  });

  it('calculates the next selected-timezone hour boundary', () => {
    const now = DateTime.fromISO('2026-07-29T07:59:30Z');

    expect(getMillisecondsUntilNextDashboardHour('America/Los_Angeles', now)).toBe(30_000);
  });

  it('changes the dashboard refresh key at selected-timezone midnight', () => {
    const beforeMidnight = DateTime.fromISO('2026-07-29T06:59:59.999Z');
    const midnight = beforeMidnight.plus({ milliseconds: 1 });

    expect(getDashboardDateRefreshKey('America/Los_Angeles', beforeMidnight))
      .toBe('America/Los_Angeles|2026-07-28');
    expect(getDashboardDateRefreshKey('America/Los_Angeles', midnight))
      .toBe('America/Los_Angeles|2026-07-29');
  });

  it('changes the dashboard refresh key when the selected timezone changes on the same date', () => {
    const now = DateTime.fromISO('2026-07-29T18:00:00Z');

    expect(getDashboardDateRefreshKey('America/Los_Angeles', now))
      .not.toBe(getDashboardDateRefreshKey('America/New_York', now));
  });
});
