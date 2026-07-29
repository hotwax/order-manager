import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { fetchUnfillableHourlyCounts } from '@/services/funnelDashboard';
import { getActivePhysicalFacilityOrderVolume, searchOrders } from '@/services/order';
import { useCustomerServiceStore } from '@/store/customerService';
import { Settings } from 'luxon';

const mockUserStore = vi.hoisted(() => ({
  current: { timeZone: 'UTC' }
}));

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
  useUserStore: vi.fn(() => mockUserStore),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('customer service funnel facility metrics', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));
    mockUserStore.current.timeZone = 'UTC';
    vi.mocked(api).mockReset();
    vi.mocked(getActivePhysicalFacilityOrderVolume).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    Settings.defaultZone = 'system';
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

  it('uses the restored user timezone on the first rejection request when the browser zone differs', async () => {
    Settings.defaultZone = 'Asia/Kolkata';
    vi.setSystemTime(new Date('2026-07-04T02:00:00Z'));
    mockUserStore.current.timeZone = 'America/Los_Angeles';
    vi.mocked(getActivePhysicalFacilityOrderVolume).mockResolvedValueOnce([]);
    vi.mocked(api).mockResolvedValueOnce({ data: { entityValueList: [] } });

    const store = useCustomerServiceStore();
    await store.fetchFacilityRejections('STORE');

    expect(api).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customParametersMap: expect.objectContaining({
          changeDatetime_from: '2026-07-03 00:00:00',
          changeDatetime_thru: '2026-07-04 00:00:00'
        })
      })
    }));
  });

  it('uses the persisted timezone range for facility progress on a DST boundary', async () => {
    Settings.defaultZone = 'Asia/Kolkata';
    vi.setSystemTime(new Date('2026-03-08T12:00:00Z'));
    mockUserStore.current.timeZone = 'America/New_York';
    vi.mocked(api)
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { entityValueList: [] } })
      .mockResolvedValueOnce({ data: {} });

    const store = useCustomerServiceStore();
    await store.fetchFacilityFulfillmentProgress('BROADWAY', 'STORE');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/facilities/BROADWAY/facilityRejections',
      method: 'GET',
      params: {
        productStoreId: 'STORE',
        changeDatetime_from: '2026-03-08 00:00:00',
        changeDatetime_thru: '2026-03-09 00:00:00'
      }
    });
    expect(api).toHaveBeenCalledWith({
      url: 'oms/facilities/facilityOrderCounts',
      method: 'GET',
      params: {
        facilityId: 'BROADWAY',
        entryDate: '2026-03-08'
      }
    });
  });
});

describe('customer service Unfillable Funnel metrics', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockUserStore.current.timeZone = 'UTC';
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

  it('ignores an older trend response that resolves after a newer store response', async () => {
    const storeATrend = deferred<Awaited<ReturnType<typeof fetchUnfillableHourlyCounts>>>();
    const storeBTrend = deferred<Awaited<ReturnType<typeof fetchUnfillableHourlyCounts>>>();
    const storeABuckets = Array.from({ length: 24 }, (_, hourOfDay) => ({
      hourOfDay,
      orderCount: hourOfDay === 4 ? 9 : 0
    }));
    const storeBBuckets = Array.from({ length: 24 }, (_, hourOfDay) => ({
      hourOfDay,
      orderCount: hourOfDay === 16 ? 3 : 0
    }));
    vi.mocked(fetchUnfillableHourlyCounts)
      .mockImplementationOnce(() => storeATrend.promise)
      .mockImplementationOnce(() => storeBTrend.promise);

    const store = useCustomerServiceStore();
    const storeARequest = store.fetchUnfillableTrend('STORE_A');
    const storeBRequest = store.fetchUnfillableTrend('STORE_B');

    storeBTrend.resolve(storeBBuckets);
    await storeBRequest;
    storeATrend.resolve(storeABuckets);
    await storeARequest;

    expect(store.getUnfillable.unfillableHourlyCounts).toEqual(storeBBuckets);
    expect(store.unfillableTrend[16]).toBe(3);
    expect(store.unfillableTrend[4]).toBe(0);
    expect(store.getDashboardStatus('unfillableTrend')).toBe('success');
  });

  it('ignores an older backlog response that resolves after a newer store response', async () => {
    const storeABacklog = deferred<Awaited<ReturnType<typeof searchOrders>>>();
    const storeBBacklog = deferred<Awaited<ReturnType<typeof searchOrders>>>();
    vi.mocked(searchOrders)
      .mockImplementationOnce(() => storeABacklog.promise)
      .mockImplementationOnce(() => storeBBacklog.promise);

    const store = useCustomerServiceStore();
    const storeARequest = store.fetchUnfillableBacklog('STORE_A');
    const storeBRequest = store.fetchUnfillableBacklog('STORE_B');

    storeBBacklog.resolve({ docs: [], total: 22 });
    await storeBRequest;
    storeABacklog.resolve({ docs: [], total: 11 });
    await storeARequest;

    expect(store.getUnfillable.totalCount).toBe(22);
    expect(store.getDashboardStatus('unfillable')).toBe('success');
  });

  it('keeps current requests loading when stale trend and backlog failures settle first', async () => {
    const staleTrend = deferred<Awaited<ReturnType<typeof fetchUnfillableHourlyCounts>>>();
    const currentTrend = deferred<Awaited<ReturnType<typeof fetchUnfillableHourlyCounts>>>();
    const staleBacklog = deferred<Awaited<ReturnType<typeof searchOrders>>>();
    const currentBacklog = deferred<Awaited<ReturnType<typeof searchOrders>>>();
    const currentBuckets = Array.from({ length: 24 }, (_, hourOfDay) => ({
      hourOfDay,
      orderCount: hourOfDay === 12 ? 6 : 0
    }));
    vi.mocked(fetchUnfillableHourlyCounts)
      .mockImplementationOnce(() => staleTrend.promise)
      .mockImplementationOnce(() => currentTrend.promise);
    vi.mocked(searchOrders)
      .mockImplementationOnce(() => staleBacklog.promise)
      .mockImplementationOnce(() => currentBacklog.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const store = useCustomerServiceStore();
    const staleTrendRequest = store.fetchUnfillableTrend('STORE_A');
    const currentTrendRequest = store.fetchUnfillableTrend('STORE_B');
    const staleBacklogRequest = store.fetchUnfillableBacklog('STORE_A');
    const currentBacklogRequest = store.fetchUnfillableBacklog('STORE_B');

    staleTrend.reject(new Error('stale trend failure'));
    staleBacklog.reject(new Error('stale backlog failure'));
    await Promise.all([staleTrendRequest, staleBacklogRequest]);

    expect(store.getDashboardStatus('unfillableTrend')).toBe('loading');
    expect(store.getDashboardStatus('unfillable')).toBe('loading');
    expect(errorSpy).not.toHaveBeenCalled();

    currentTrend.resolve(currentBuckets);
    currentBacklog.resolve({ docs: [], total: 44 });
    await Promise.all([currentTrendRequest, currentBacklogRequest]);

    expect(store.getUnfillable.unfillableHourlyCounts).toEqual(currentBuckets);
    expect(store.getUnfillable.totalCount).toBe(44);
    expect(store.getDashboardStatus('unfillableTrend')).toBe('success');
    expect(store.getDashboardStatus('unfillable')).toBe('success');
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
