import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { fetchUnfillableHourlyCounts } from '@/services/funnelDashboard';
import { getActivePhysicalFacilityOrderVolume, searchOrders } from '@/services/order';
import { useCustomerServiceStore } from '@/store/customerService';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: { hasError: vi.fn() },
  logger: { error: vi.fn() },
  translate: (value: string) => value,
}));

vi.mock('@/services/order', () => ({
  fetchVirtualLocationOrderCounts: vi.fn(),
  getActivePhysicalFacilityOrderVolume: vi.fn(),
  searchOrders: vi.fn(),
}));

vi.mock('@/services/funnelDashboard', () => ({
  fetchUnfillableHourlyCounts: vi.fn(),
}));

vi.mock('@/services/fulfillmentSync', () => ({
  getPickProfileGroups: vi.fn(),
}));

vi.mock('@/store/order', () => ({
  useOrderStore: vi.fn(() => ({
    workflowOrders: { open: [], inflight: [], packed: [] },
    workflowOrdersTotal: { open: 0, inflight: 0, packed: 0 },
    setNavCount: vi.fn(),
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

describe('customer service Unfillable Funnel metrics', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(fetchUnfillableHourlyCounts).mockReset();
    vi.mocked(searchOrders).mockReset();
  });

  it('keeps the current backlog total separate from the nonzero today-entry sparkline', async () => {
    vi.mocked(fetchUnfillableHourlyCounts).mockResolvedValueOnce(
      Array.from({ length: 24 }, (_, hourOfDay) => ({
        hourOfDay,
        orderCount: hourOfDay === 9 ? 4 : 0
      }))
    );
    vi.mocked(searchOrders).mockResolvedValueOnce({
      docs: [],
      total: 358
    } as any);

    const store = useCustomerServiceStore();
    await store.fetchUnfillable('STORE_1');

    expect(fetchUnfillableHourlyCounts).toHaveBeenCalledWith('STORE_1', 'UTC');
    expect(searchOrders).toHaveBeenCalledWith({
      facilityIds: ['UNFILLABLE_PARKING'],
      status: ['ORDER_CREATED', 'ORDER_APPROVED', 'ORDER_HOLD'],
      pageSize: 0,
      productStoreId: 'STORE_1'
    });
    expect(store.getUnfillable.totalCount).toBe(358);
    expect(store.unfillableTrend).toHaveLength(24);
    expect(store.unfillableTrend[9]).toBe(4);
    expect(store.unfillableTrend.reduce((sum, count) => sum + count, 0)).toBe(4);
    expect(store.getDashboardStatus('unfillable')).toBe('success');
    expect(store.getDashboardStatus('unfillableTrend')).toBe('success');
  });

  it('keeps the backlog and nav-count source available when only the trend request fails', async () => {
    const trendError = new Error('new OMS contract unavailable');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(fetchUnfillableHourlyCounts).mockRejectedValueOnce(trendError);
    vi.mocked(searchOrders).mockResolvedValueOnce({
      docs: [],
      total: 358
    } as any);

    const store = useCustomerServiceStore();
    store.unfillable.unfillableHourlyCounts = Array.from({ length: 24 }, (_, hourOfDay) => ({
      hourOfDay,
      orderCount: hourOfDay === 3 ? 7 : 0
    }));
    await store.fetchUnfillable('STORE_1');

    expect(store.getUnfillable.totalCount).toBe(358);
    expect(store.getUnfillable.unfillableHourlyCounts).toEqual([]);
    expect(store.getDashboardStatus('unfillable')).toBe('success');
    expect(store.getDashboardStatus('unfillableTrend')).toBe('error');
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch Unfillable trend', trendError);
    errorSpy.mockRestore();
  });
});

describe('customer service hold task counts', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ headers: {}, data: [] });
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

  it('marks the hold task section as errored without clearing the previous counts', async () => {
    const error = new Error('network failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch hold task counts', error);
    errorSpy.mockRestore();
  });
});
