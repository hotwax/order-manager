import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { getDashboardBusinessDayRange } from '@/utils/dashboardBusinessDay';

describe('getDashboardBusinessDayRange', () => {
  it('returns explicit inclusive/exclusive bounds for the user profile timezone', () => {
    const now = DateTime.fromISO('2026-07-04T01:15:00Z');

    expect(getDashboardBusinessDayRange('America/New_York', now)).toEqual({
      dateFilter: '2026-07-03',
      fromDate: '2026-07-03T04:00:00.000Z',
      thruDate: '2026-07-04T04:00:00.000Z',
      timeZoneId: 'America/New_York'
    });
  });

  it('uses the next local midnight as the exclusive bound across daylight-saving changes', () => {
    const now = DateTime.fromISO('2026-03-08T12:00:00Z');

    expect(getDashboardBusinessDayRange('America/New_York', now)).toEqual({
      dateFilter: '2026-03-08',
      fromDate: '2026-03-08T05:00:00.000Z',
      thruDate: '2026-03-09T04:00:00.000Z',
      timeZoneId: 'America/New_York'
    });
  });

  it('uses a 25-hour UTC range for the fall-back business day while retaining one local day', () => {
    const now = DateTime.fromISO('2026-11-01T12:00:00Z');

    expect(getDashboardBusinessDayRange('America/New_York', now)).toEqual({
      dateFilter: '2026-11-01',
      fromDate: '2026-11-01T04:00:00.000Z',
      thruDate: '2026-11-02T05:00:00.000Z',
      timeZoneId: 'America/New_York'
    });
  });
});
