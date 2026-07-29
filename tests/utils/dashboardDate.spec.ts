import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  getDashboardDateFilter,
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
