import { DateTime } from 'luxon';
import { api, commonUtil } from '@common';
import type { UnfillableHourlyCount } from '@/types/customerService';
import { getDashboardBusinessDayRange } from '@/utils/dashboardBusinessDay';

const UNFILLABLE_HOURS_PER_DAY = 24;

// This parser intentionally rejects the pre-#875 row shape. The legacy endpoint
// groups current Unfillable backlog by order entry time, which is not the
// transition-based business truth represented by this sparkline.
export function parseUnfillableHourlyCounts(value: unknown): UnfillableHourlyCount[] {
  if (!Array.isArray(value) || value.length !== UNFILLABLE_HOURS_PER_DAY) {
    throw new Error('Unfillable trend response must contain exactly 24 hourly buckets.');
  }

  return value.map((row: any, expectedHour) => {
    const hourOfDay = row?.hourOfDay;
    const orderCount = row?.orderCount;

    if (
      typeof hourOfDay !== 'number'
      || typeof orderCount !== 'number'
      || hourOfDay !== expectedHour
      || !Number.isInteger(hourOfDay)
      || !Number.isInteger(orderCount)
      || orderCount < 0
    ) {
      throw new Error(`Unfillable trend response contains an invalid bucket at hour ${expectedHour}.`);
    }

    return { hourOfDay, orderCount };
  });
}

export function buildUnfillableHourlyCountsRequest(
  productStoreId: string,
  userTimeZone?: string,
  now = DateTime.now()
) {
  const { fromDate, thruDate, timeZoneId } = getDashboardBusinessDayRange(userTimeZone, now);

  return {
    url: 'oms/orders/funnelDashboard/unfillable',
    method: 'GET',
    params: {
      productStoreId,
      fromDate,
      thruDate,
      timeZoneId
    }
  };
}

export async function fetchUnfillableHourlyCounts(
  productStoreId: string,
  userTimeZone?: string
): Promise<UnfillableHourlyCount[]> {
  const request = buildUnfillableHourlyCountsRequest(productStoreId, userTimeZone);
  const response = await api(request);
  if (commonUtil.hasError(response)) {
    throw new Error('OMS returned an error while loading the Unfillable trend.');
  }

  return parseUnfillableHourlyCounts(response.data?.unfillableHourlyCounts);
}
