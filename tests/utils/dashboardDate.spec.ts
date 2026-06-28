import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { getDashboardDateFilter } from '@/utils/dashboardDate';

describe('getDashboardDateFilter', () => {
  it('uses the user profile timezone instead of the browser-local day', () => {
    const browserLocalNow = DateTime.fromISO('2026-06-27T03:57:54+05:30');

    expect(getDashboardDateFilter('America/New_York', browserLocalNow)).toBe('2026-06-26');
  });
});
