import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, commonUtil } from '@common';
import {
  buildUnfillableHourlyCountsRequest,
  fetchUnfillableHourlyCounts,
  parseUnfillableHourlyCounts
} from '@/services/funnelDashboard';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: vi.fn()
  }
}));

describe('Unfillable Funnel dashboard service', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(commonUtil.hasError).mockReset();
    vi.mocked(commonUtil.hasError).mockReturnValue(false);
  });

  it('sends the selected store, timezone, and exact business-day instant bounds', () => {
    const now = DateTime.fromISO('2026-07-04T01:15:00Z');

    expect(buildUnfillableHourlyCountsRequest('STORE_1', 'America/New_York', now)).toEqual({
      url: 'oms/orders/funnelDashboard/unfillable',
      method: 'GET',
      params: {
        productStoreId: 'STORE_1',
        fromDate: '2026-07-03T04:00:00.000Z',
        thruDate: '2026-07-04T04:00:00.000Z',
        timeZoneId: 'America/New_York'
      }
    });
  });

  it('maps the backend response to 24 ascending buckets and preserves a nonzero hour', async () => {
    const backendBuckets = Array.from({ length: 24 }, (_, hourOfDay) => ({
      hourOfDay,
      orderCount: hourOfDay === 13 ? 7 : 0
    }));
    vi.mocked(api).mockResolvedValueOnce({
      data: { unfillableHourlyCounts: backendBuckets }
    });

    const result = await fetchUnfillableHourlyCounts('STORE_1', 'UTC');

    expect(api).toHaveBeenCalledOnce();
    expect(result).toHaveLength(24);
    expect(result.map(({ hourOfDay }) => hourOfDay)).toEqual(Array.from({ length: 24 }, (_, hour) => hour));
    expect(result[13]).toEqual({ hourOfDay: 13, orderCount: 7 });
  });

  it('rejects a malformed current-contract response instead of inventing flat zero buckets', () => {
    const malformedBuckets = Array.from({ length: 24 }, (_, hourOfDay) => ({
      hourOfDay,
      orderCount: hourOfDay === 8 ? undefined : 0
    }));

    expect(() => parseUnfillableHourlyCounts(malformedBuckets))
      .toThrow('invalid bucket at hour 8');
    expect(() => parseUnfillableHourlyCounts([]))
      .toThrow('exactly 24 hourly buckets');
  });

  it('rejects a Moqui error envelope even when it contains bucket-like data', async () => {
    vi.mocked(commonUtil.hasError).mockReturnValueOnce(true);
    vi.mocked(api).mockResolvedValueOnce({
      data: {
        _ERROR_MESSAGE_: 'validation failed',
        unfillableHourlyCounts: Array.from({ length: 24 }, (_, hourOfDay) => ({
          hourOfDay,
          orderCount: 0
        }))
      }
    });

    await expect(fetchUnfillableHourlyCounts('STORE_1', 'UTC'))
      .rejects.toThrow('OMS returned an error');
  });
});
