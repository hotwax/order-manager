import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api, logger } from '@common';
import {
  fetchUnfillableTrend,
  fetchVirtualLocationOrderCounts,
  getActivePhysicalFacilityOrderVolume,
  searchOrders
} from '@/services/order';
import { useCustomerServiceStore } from '@/store/customerService';
import { useOrderStore } from '@/store/order';
vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: { hasError: vi.fn() },
  logger: { error: vi.fn() },
  translate: (value: string) => value,
}));

vi.mock('@/services/order', () => ({
  EMPTY_UNFILLABLE_TREND: { points: [], days: [], totalOrders: 0 },
  fetchUnfillableTrend: vi.fn(),
  fetchVirtualLocationOrderCounts: vi.fn(),
  getActivePhysicalFacilityOrderVolume: vi.fn(),
  searchOrders: vi.fn(),
  UNFILLABLE_QUEUE_ORDER_STATUSES: ['ORDER_CREATED', 'ORDER_APPROVED', 'ORDER_HOLD'],
}));

vi.mock('@/services/fulfillmentSync', () => ({
  getPickProfileGroups: vi.fn(),
}));

vi.mock('@/store/order', () => ({
  useOrderStore: vi.fn(() => ({
    workflowOrders: { open: [], inflight: [], packed: [] },
    workflowOrdersTotal: { open: 0, inflight: 0, packed: 0 },
  })),
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: vi.fn(() => ({
    productStores: { byId: {} },
    shipmentMethodTypes: { byId: {} },
    getEnumsByType: vi.fn(() => []),
  })),
}));

vi.mock('@/store/orderDetail', () => ({
  useOrderDetailStore: vi.fn(() => ({})),
}));

vi.mock('@/store/user', () => ({
  useUserStore: vi.fn(() => ({
    current: { timeZone: 'UTC' },
  })),
}));

vi.mock('@/utils/dashboardDate', () => ({
  getDashboardDateFilter: vi.fn(() => '2026-07-04'),
}));

describe('customer service funnel facility metrics', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
    vi.mocked(getActivePhysicalFacilityOrderVolume).mockReset();
  });

  it('falls back to active physical facilities when velocity rows are empty', async () => {
    vi.mocked(api).mockResolvedValueOnce({ data: { facilities: [] } });
    vi.mocked(getActivePhysicalFacilityOrderVolume).mockResolvedValueOnce([{
      facilityId: 'BROADWAY',
      facilityName: 'Broadway',
      lastOrderCount: 4,
      assignedItemQuantity: 7,
    }]);

    const store = useCustomerServiceStore();
    await store.fetchFacilityFulfillmentVelocity('STORE');

    expect(getActivePhysicalFacilityOrderVolume).toHaveBeenCalledWith({ productStoreId: 'STORE' });
    expect(store.getFacilityFulfillmentVelocity).toEqual([{
      facilityId: 'BROADWAY',
      facilityName: 'Broadway',
      lastOrderCount: 4,
      assignedItemQuantity: 7,
      activeFacilityFallback: true,
      fulfillmentVelocity: null,
      shipGroupCount: 0,
    }]);
    expect(store.getDashboardStatus('facilityFulfillmentVelocity')).toBe('success');
  });

  it('enriches active facilities with selected-date rejection counts without reordering by rejections', async () => {
    vi.mocked(getActivePhysicalFacilityOrderVolume).mockResolvedValueOnce([{
      facilityId: 'GARDEN_CITY',
      facilityName: 'Garden City',
      lastOrderCount: 8,
      assignedItemQuantity: 12,
    }, {
      facilityId: 'BROADWAY',
      facilityName: 'Broadway',
      lastOrderCount: 4,
      assignedItemQuantity: 7,
    }, {
      facilityId: 'STATEN_ISLAND',
      facilityName: 'Staten Island',
      lastOrderCount: 2,
      assignedItemQuantity: 3,
    }]);
    vi.mocked(api).mockResolvedValueOnce({
      data: {
        entityValueList: [
          { fromFacilityId: 'BROADWAY', orderId: 'O1', shipGroupSeqId: '00001' },
          { fromFacilityId: 'BROADWAY', orderId: 'O1', shipGroupSeqId: '00001' },
          { fromFacilityId: 'BROADWAY', orderId: 'O2', shipGroupSeqId: '00002' },
          { fromFacilityId: 'STATEN_ISLAND', orderId: 'O3', shipGroupSeqId: '00001' },
          { fromFacilityId: '_NA_', orderId: 'O4', shipGroupSeqId: '00001' },
        ],
      },
    });

    const store = useCustomerServiceStore();
    await store.fetchFacilityRejections('STORE');

    expect(getActivePhysicalFacilityOrderVolume).toHaveBeenCalledWith({ productStoreId: 'STORE' });
    expect(api).toHaveBeenCalledWith({
      url: 'oms/dataDocumentView',
      method: 'POST',
      data: {
        dataDocumentId: 'ORDER_FACILITY_CHANGE',
        customParametersMap: {
          facilityId: 'REJECTED_ITM_PARKING',
          pageNoLimit: true,
          changeDatetime_from: '2026-07-04 00:00:00',
          changeDatetime_thru: '2026-07-05 00:00:00',
          productStoreId: 'STORE',
        },
        fieldsToSelect: 'fromFacilityId,orderId,shipGroupSeqId',
        distinct: true,
      },
    });
    expect(store.getFacilityRejections).toEqual([
      {
        facilityId: 'GARDEN_CITY',
        facilityName: 'Garden City',
        lastOrderCount: 8,
        assignedItemQuantity: 12,
        rejectedShipGroupCount: 0,
      },
      {
        facilityId: 'BROADWAY',
        facilityName: 'Broadway',
        lastOrderCount: 4,
        assignedItemQuantity: 7,
        rejectedShipGroupCount: 2,
      },
      {
        facilityId: 'STATEN_ISLAND',
        facilityName: 'Staten Island',
        lastOrderCount: 2,
        assignedItemQuantity: 3,
        rejectedShipGroupCount: 1,
      },
    ]);
    expect(store.getDashboardStatus('facilityRejections')).toBe('success');
  });
});

describe('customer service hold task counts', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ headers: {}, data: [] });
    vi.mocked(useOrderStore).mockReset().mockReturnValue({
      workflowOrders: { open: [], inflight: [], packed: [] },
      workflowOrdersTotal: { open: 0, inflight: 0, packed: 0 },
    } as any);
  });

  it('fetches canonical open hold counts from the OMS dashboard service', async () => {
    vi.mocked(api).mockResolvedValueOnce({
      data: {
        holdTasksTotalCount: '19',
        holdTaskCounts: [
          {
            workEffortPurposeTypeId: 'NEG_RES_REVIEW',
            description: 'Negative Reservation Review',
            sequenceNum: '10',
            taskCount: '12'
          },
          {
            workEffortPurposeTypeId: 'INVALID_ADDRESS',
            description: 'Invalid Address',
            sequenceNum: '20',
            taskCount: '7'
          },
          {
            workEffortPurposeTypeId: 'FUTURE_HOLD',
            description: 'Future Hold',
            sequenceNum: null,
            taskCount: '0'
          }
        ]
      }
    });

    const store = useCustomerServiceStore();

    await store.fetchHoldTasks('STORE_1');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/funnelDashboard/holdTasks',
      method: 'GET',
      params: { productStoreId: 'STORE_1' }
    });
    expect(store.holdTasks).toEqual({
      holdTasksTotalCount: 19,
      holdTaskCounts: [
        {
          workEffortPurposeTypeId: 'NEG_RES_REVIEW',
          description: 'Negative Reservation Review',
          sequenceNum: 10,
          taskCount: 12
        },
        {
          workEffortPurposeTypeId: 'INVALID_ADDRESS',
          description: 'Invalid Address',
          sequenceNum: 20,
          taskCount: 7
        },
        {
          workEffortPurposeTypeId: 'FUTURE_HOLD',
          description: 'Future Hold',
          sequenceNum: null,
          taskCount: 0
        }
      ],
    });
    expect(store.holdTasks.holdTaskCounts.reduce((total, count) => total + count.taskCount, 0))
      .toBe(store.holdTasks.holdTasksTotalCount);
    expect(store.dashboardStatus.holdTasks).toBe('success');
  });

  it('rolls every purpose without a dedicated queue page into the Hold badge', async () => {
    const setNavCount = vi.fn();
    vi.mocked(useOrderStore).mockReturnValue({ setNavCount } as any);
    vi.mocked(api).mockResolvedValueOnce({
      data: {
        holdTasksTotalCount: '21',
        holdTaskCounts: [
          { workEffortPurposeTypeId: 'NEG_RES_REVIEW', taskCount: '12' },
          { workEffortPurposeTypeId: 'INVALID_ADDRESS', taskCount: '4' },
          { workEffortPurposeTypeId: 'REVIEW_RISK_ORDER', taskCount: '1' },
          { workEffortPurposeTypeId: 'ORD_HOLD_MANUAL', taskCount: '2' },
          // Neither of these is mapped anywhere, and both must still be counted —
          // that is the whole point of the Hold queue being the complement.
          { workEffortPurposeTypeId: 'SHPFY_SYNC_ERR', taskCount: '1' },
          { workEffortPurposeTypeId: 'FUTURE_HOLD', taskCount: '1' }
        ]
      }
    });

    await useCustomerServiceStore().fetchHoldTasks('STORE_1');

    expect(setNavCount).toHaveBeenCalledWith('swap', 12);
    expect(setNavCount).toHaveBeenCalledWith('badAddress', 4);
    expect(setNavCount).toHaveBeenCalledWith('fraud', 1);
    // 2 manual + 1 Shopify sync error + 1 future hold
    expect(setNavCount).toHaveBeenCalledWith('hold', 4);
  });

  it('marks the hold task section as errored without clearing the previous counts', async () => {
    const error = new Error('network failed');
    vi.mocked(logger.error).mockClear();
    vi.mocked(api).mockRejectedValueOnce(error);

    const store = useCustomerServiceStore();
    store.holdTasks = {
      holdTasksTotalCount: 6,
      holdTaskCounts: [{
        workEffortPurposeTypeId: 'INVALID_ADDRESS',
        description: 'Invalid Address',
        sequenceNum: 20,
        taskCount: 6
      }]
    };

    await store.fetchHoldTasks('STORE_1');

    expect(store.holdTasks).toEqual({
      holdTasksTotalCount: 6,
      holdTaskCounts: [{
        workEffortPurposeTypeId: 'INVALID_ADDRESS',
        description: 'Invalid Address',
        sequenceNum: 20,
        taskCount: 6
      }]
    });
    expect(store.dashboardStatus.holdTasks).toBe('error');
    expect(logger.error).toHaveBeenCalledWith('Failed to fetch hold task counts', error);
  });
});

describe('unfillable queue trend', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(searchOrders).mockReset();
    vi.mocked(fetchUnfillableTrend).mockReset();
  });

  it('stores the order-date trend beside the queue total and exposes item counts to the sparkline', async () => {
    vi.mocked(searchOrders).mockResolvedValueOnce({ orders: [], total: 1204 } as any);
    vi.mocked(fetchUnfillableTrend).mockResolvedValueOnce({
      points: [
        { date: '2026-07-24', dayspan: 1, itemCount: 255 },
        { date: '2026-07-25', dayspan: 1, itemCount: 328 },
      ],
      days: [
        { date: '2026-07-24', orderCount: 120, itemCount: 255 },
        { date: '2026-07-25', orderCount: 140, itemCount: 328 },
      ],
      totalOrders: 260,
    });

    const store = useCustomerServiceStore();
    await store.fetchUnfillable('STORE_1');

    expect(store.unfillable.totalCount).toBe(1204);
    // The sparkline plots bare item counts, oldest order date first.
    expect(store.unfillableTrend).toEqual([255, 328]);
    expect(store.getUnfillableTrendPoints[0].date).toBe('2026-07-24');
    // The drilldown rows count orders, not items.
    expect(store.getUnfillableOrderDays).toEqual([
      { date: '2026-07-24', orderCount: 120, itemCount: 255 },
      { date: '2026-07-25', orderCount: 140, itemCount: 328 },
    ]);
    expect(store.getUnfillableTrendOrderTotal).toBe(260);
    expect(store.dashboardStatus.unfillable).toBe('success');
  });

  it('does not call the today-scoped funnelDashboard endpoint, which is empty for a backlog queue', async () => {
    vi.mocked(searchOrders).mockResolvedValueOnce({ orders: [], total: 3 } as any);
    vi.mocked(fetchUnfillableTrend).mockResolvedValueOnce({ points: [], days: [], totalOrders: 0 });

    await useCustomerServiceStore().fetchUnfillable('STORE_1');

    const calledUrls = vi.mocked(api).mock.calls.map(([config]: any[]) => config?.url);
    expect(calledUrls).not.toContain('oms/orders/funnelDashboard/unfillable');
  });

  it('marks the group as errored when the trend query fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(searchOrders).mockResolvedValueOnce({ orders: [], total: 3 } as any);
    vi.mocked(fetchUnfillableTrend).mockRejectedValueOnce(new Error('solr down'));

    const store = useCustomerServiceStore();
    await store.fetchUnfillable('STORE_1');

    expect(store.dashboardStatus.unfillable).toBe('error');
    expect(store.unfillableTrend).toEqual([]);
    expect(store.getUnfillableOrderDays).toEqual([]);
    errorSpy.mockRestore();
  });
  it('lists every virtual queue holding orders, unmerged and under its backend name', async () => {
    vi.mocked(api).mockResolvedValueOnce({
      data: [
        { facilityId: '_NA_', facilityName: 'Brokering Queue' },
        { facilityId: 'REJECTED_ITM_PARKING', facilityName: 'Rejected Item Parking' },
        { facilityId: 'UNFILLABLE_PARKING', facilityName: 'Unfillable Parking' },
        { facilityId: 'BACKORDER_PARKING', facilityName: 'Backorder Parking' },
        // no orders parked here, so it should not be listed at all
        { facilityId: 'CONFIGURATION', facilityName: 'Configuration Facility' },
        // an archive of completed/cancelled orders, never a work queue
        { facilityId: 'GENERAL_OPS_PARKING', facilityName: 'General Ops Parking' },
      ],
    });
    vi.mocked(fetchVirtualLocationOrderCounts)
      .mockResolvedValueOnce([
        { facilityId: '_NA_', count: 30 },
        { facilityId: 'REJECTED_ITM_PARKING', count: 2 },
        { facilityId: 'BACKORDER_PARKING', count: 5 },
        { facilityId: 'CONFIGURATION', count: 0 },
      ] as any)
      .mockResolvedValueOnce([{ facilityId: 'UNFILLABLE_PARKING', count: 7 }] as any);

    const store = useCustomerServiceStore();
    await store.fetchVirtualLocationCounts('STORE');

    // alphabetical by backend name, one row per facility, zero-count queues omitted
    expect(store.getVirtualLocationCounts).toEqual([
      { id: 'BACKORDER_PARKING', label: 'Backorder Parking', facilityIds: ['BACKORDER_PARKING'], count: 5 },
      { id: '_NA_', label: 'Brokering Queue', facilityIds: ['_NA_'], count: 30 },
      { id: 'REJECTED_ITM_PARKING', label: 'Rejected Item Parking', facilityIds: ['REJECTED_ITM_PARKING'], count: 2 },
      { id: 'UNFILLABLE_PARKING', label: 'Unfillable Parking', facilityIds: ['UNFILLABLE_PARKING'], count: 7 },
    ]);
    // the archive facility is never even queried
    const queriedIds = vi.mocked(fetchVirtualLocationOrderCounts).mock.calls.flatMap(([params]: any[]) => params.facilityIds);
    expect(queriedIds).not.toContain('GENERAL_OPS_PARKING');
  });
});
