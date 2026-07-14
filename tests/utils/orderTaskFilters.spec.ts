import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { buildTaskQueueRequest } from '@/utils/orderTaskFilters';
import {
  COMMON_TASK_SORT_OPTIONS,
  FRAUD_TASK_SORT_OPTIONS,
  TASK_SORT_ORDER_BY,
  defaultOrderTaskFilters,
} from '@/types/orderTaskFilters';

describe('order task filter request mapping', () => {
  it('maps the common filters and inclusive date boundaries', () => {
    const filters = defaultOrderTaskFilters();
    Object.assign(filters, {
      query: '1001',
      salesChannelEnumId: 'WEB_CHANNEL',
      orderDateFrom: '2026-07-01',
      orderDateThru: '2026-07-02',
      taskCreatedFrom: '2026-07-03',
      taskCreatedThru: '2026-07-04',
      facilityId: 'FACILITY_1',
      shipmentMethodTypeId: 'STANDARD',
      sort: 'newestTask',
    });

    expect(buildTaskQueueRequest('swap', filters, 20, 0)).toEqual({
      pageSize: 20,
      pageIndex: 0,
      orderByField: '-workEffortCreatedDate,-workEffortId',
      orderName: '1001',
      orderName_op: 'contains',
      salesChannelEnumId: 'WEB_CHANNEL',
      orderDate_from: DateTime.fromISO('2026-07-01').startOf('day').toMillis(),
      orderDate_thru: DateTime.fromISO('2026-07-02').endOf('day').toMillis(),
      workEffortCreatedDate_from: DateTime.fromISO('2026-07-03').startOf('day').toMillis(),
      workEffortCreatedDate_thru: DateTime.fromISO('2026-07-04').endOf('day').toMillis(),
      facilityId: 'FACILITY_1',
      shipmentMethodTypeId: 'STANDARD',
    });
  });

  it('sends only Fraud-specific filters on the risk queue', () => {
    const filters = defaultOrderTaskFilters();
    Object.assign(filters, {
      facilityId: 'IGNORED',
      shipmentMethodTypeId: 'IGNORED',
      orderStatusId: 'ORDER_APPROVED',
      riskRecommendationEnumId: 'ORREC_CANCEL',
      riskLevelEnumId: 'ORLVL_HIGH',
      sort: 'highestRisk',
    });

    expect(buildTaskQueueRequest('fraud', filters, 20, 1)).toEqual({
      pageSize: 20,
      pageIndex: 1,
      orderByField: 'riskLevelSortRank,workEffortId',
      orderStatusId: 'ORDER_APPROVED',
      riskRecommendationEnumId: 'ORREC_CANCEL',
      riskLevelEnumId: 'ORLVL_HIGH',
    });
  });

  it('keeps six common sorts first and appends four Fraud sorts', () => {
    expect(COMMON_TASK_SORT_OPTIONS).toHaveLength(6);
    expect(FRAUD_TASK_SORT_OPTIONS.slice(0, 6)).toEqual(COMMON_TASK_SORT_OPTIONS);
    expect(FRAUD_TASK_SORT_OPTIONS).toHaveLength(10);
    expect(TASK_SORT_ORDER_BY.recommendationAsc).toBe('riskRecommendationSortValue,workEffortId');
  });
});
