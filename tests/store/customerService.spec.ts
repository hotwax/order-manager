import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { fetchPhysicalFacilityCatalog } from '@/services/facility';
import { fetchUnfillableHourlyCounts } from '@/services/funnelDashboard';
import { getPickProfileGroups } from '@/services/fulfillmentSync';
import {
  fetchVirtualLocationOrderCounts,
  getActivePhysicalFacilityOrderVolume,
  searchOrders
} from '@/services/order';
import { useCustomerServiceStore } from '@/store/customerService';
import { Settings } from 'luxon';

const mockUserStore = vi.hoisted(() => ({
  current: { timeZone: 'UTC' }
}));

const mockOrderStore = vi.hoisted(() => ({
  workflowOrders: { open: [], inflight: [], packed: [] },
  workflowOrdersTotal: { open: 0, inflight: 0, packed: 0 },
  setNavCount: vi.fn(),
  clearNavCounts: vi.fn(),
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: { hasError: vi.fn() },
  logger: mockLogger,
  translate: (value: string) => value,
}));

vi.mock('@/services/order', () => ({
  fetchVirtualLocationOrderCounts: vi.fn(),
  getActivePhysicalFacilityOrderVolume: vi.fn(),
  searchOrders: vi.fn(),
}));

vi.mock('@/services/facility', () => ({
  fetchPhysicalFacilityCatalog: vi.fn(),
}));

vi.mock('@/services/funnelDashboard', () => ({
  fetchUnfillableHourlyCounts: vi.fn(),
}));

vi.mock('@/services/fulfillmentSync', () => ({
  getPickProfileGroups: vi.fn(),
}));

vi.mock('@/store/order', () => ({
  useOrderStore: vi.fn(() => mockOrderStore),
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

describe('customer service Funnel request scope', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T23:59:00Z'));
    mockUserStore.current.timeZone = 'UTC';
    mockOrderStore.setNavCount.mockReset();
    mockOrderStore.clearNavCounts.mockReset();
    vi.mocked(api).mockReset();
    vi.mocked(getPickProfileGroups).mockReset();
    vi.mocked(fetchVirtualLocationOrderCounts).mockReset();
    vi.mocked(getActivePhysicalFacilityOrderVolume).mockReset();
    vi.mocked(fetchPhysicalFacilityCatalog).mockReset();
    mockLogger.error.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the newer store hold metrics and publishes only their navigation counts', async () => {
    const storeA = deferred<any>();
    const storeB = deferred<any>();
    vi.mocked(api)
      .mockImplementationOnce(() => storeA.promise)
      .mockImplementationOnce(() => storeB.promise);

    const store = useCustomerServiceStore();
    const storeARequest = store.fetchHoldTasks('STORE_A');
    const storeBRequest = store.fetchHoldTasks('STORE_B');

    storeB.resolve({
      data: {
        holdTasksTotalCount: 3,
        holdTaskCounts: [{
          workEffortPurposeTypeId: 'INVALID_ADDRESS',
          description: 'Invalid address',
          taskCount: 3
        }]
      }
    });
    await storeBRequest;
    storeA.resolve({
      data: {
        holdTasksTotalCount: 30,
        holdTaskCounts: [{
          workEffortPurposeTypeId: 'INVALID_ADDRESS',
          description: 'Invalid address',
          taskCount: 30
        }]
      }
    });
    await storeARequest;

    expect(store.holdTasks.holdTasksTotalCount).toBe(3);
    expect(store.getDashboardStatus('holdTasks')).toBe('success');
    expect(mockOrderStore.setNavCount.mock.calls).toEqual([['badAddress', 3]]);
  });

  it('invalidates store-scoped work when the selected store is cleared', async () => {
    const staleStore = deferred<any>();
    vi.mocked(api).mockImplementationOnce(() => staleStore.promise);

    const store = useCustomerServiceStore();
    const staleStoreRequest = store.fetchHoldTasks('STORE_A');
    store.clearStoreDashboardData();

    staleStore.resolve({
      data: {
        holdTasksTotalCount: 12,
        holdTaskCounts: [{
          workEffortPurposeTypeId: 'INVALID_ADDRESS',
          description: 'Invalid address',
          taskCount: 12
        }]
      }
    });
    await staleStoreRequest;

    expect(store.holdTasks).toEqual({
      holdTasksTotalCount: 0,
      holdTaskCounts: []
    });
    expect(store.getDashboardStatus('holdTasks')).toBe('idle');
    expect(mockOrderStore.setNavCount).not.toHaveBeenCalled();
  });

  it('keeps a post-midnight request loading after a stale failure and surfaces its own failure', async () => {
    const staleDay = deferred<any>();
    const currentDay = deferred<any>();
    vi.mocked(api)
      .mockImplementationOnce(() => staleDay.promise)
      .mockImplementationOnce(() => currentDay.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const store = useCustomerServiceStore();
    const staleDayRequest = store.fetchFulfillmentProgress('STORE');
    vi.setSystemTime(new Date('2026-07-05T00:01:00Z'));
    const currentDayRequest = store.fetchFulfillmentProgress('STORE');

    expect(vi.mocked(api).mock.calls[0][0]).toEqual(expect.objectContaining({
      params: expect.objectContaining({ dateFilter: '2026-07-04' })
    }));
    expect(vi.mocked(api).mock.calls[1][0]).toEqual(expect.objectContaining({
      params: expect.objectContaining({ dateFilter: '2026-07-05' })
    }));

    staleDay.reject(new Error('stale pre-midnight failure'));
    await staleDayRequest;
    expect(store.getDashboardStatus('fulfillmentProgress')).toBe('loading');
    expect(errorSpy).not.toHaveBeenCalled();

    const currentError = new Error('current-day failure');
    currentDay.reject(currentError);
    await currentDayRequest;
    expect(store.getDashboardStatus('fulfillmentProgress')).toBe('error');
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch fulfillment progress', currentError);
    errorSpy.mockRestore();
  });

  it('keeps the newer facility metrics when an older facility succeeds last', async () => {
    const facilityAResponse = deferred<any>();
    const facilityBResponse = deferred<any>();
    vi.mocked(getActivePhysicalFacilityOrderVolume)
      .mockResolvedValueOnce([{
        facilityId: 'FACILITY_A',
        facilityName: 'Facility A',
        lastOrderCount: 11,
        assignedItemQuantity: 11
      }])
      .mockResolvedValueOnce([{
        facilityId: 'FACILITY_B',
        facilityName: 'Facility B',
        lastOrderCount: 4,
        assignedItemQuantity: 4
      }]);
    vi.mocked(api)
      .mockImplementationOnce(() => facilityAResponse.promise)
      .mockImplementationOnce(() => facilityBResponse.promise);

    const store = useCustomerServiceStore();
    const facilityARequest = store.fetchFacilityRejections('STORE_A');
    const facilityBRequest = store.fetchFacilityRejections('STORE_B');

    facilityBResponse.resolve({
      data: {
        entityValueList: [{
          fromFacilityId: 'FACILITY_B',
          orderId: 'ORDER_B',
          shipGroupSeqId: '00001'
        }]
      }
    });
    await facilityBRequest;
    facilityAResponse.resolve({
      data: {
        entityValueList: [{
          fromFacilityId: 'FACILITY_A',
          orderId: 'ORDER_A',
          shipGroupSeqId: '00001'
        }]
      }
    });
    await facilityARequest;

    expect(store.getFacilityRejections).toEqual([{
      facilityId: 'FACILITY_B',
      facilityName: 'Facility B',
      lastOrderCount: 4,
      assignedItemQuantity: 4,
      rejectedShipGroupCount: 1
    }]);
    expect(store.getDashboardStatus('facilityRejections')).toBe('success');
  });

  it('enriches a valid today-volume row with one bounded facility source while preserving its count', async () => {
    vi.mocked(api).mockResolvedValueOnce({
      data: {
        facilities: [{
          facilityId: 'M100051',
          lastOrderCount: 151
        }, {
          facilityId: 'NAMED_FACILITY',
          facilityName: 'Metric Facility Name',
          lastOrderCount: 7
        }]
      }
    });
    vi.mocked(fetchPhysicalFacilityCatalog).mockResolvedValueOnce([{
      facilityId: 'M100051',
      facilityName: '2301 E. 51st St.',
    }, {
      facilityId: 'NAMED_FACILITY',
      facilityName: 'Different Catalog Name',
    }]);

    const store = useCustomerServiceStore();
    await store.fetchFacilityOrderVolume('STORE');

    expect(fetchPhysicalFacilityCatalog).toHaveBeenCalledOnce();
    expect(store.getFacilityOrderVolume).toEqual([{
      facilityId: 'M100051',
      facilityName: '2301 E. 51st St.',
      lastOrderCount: 151
    }, {
      facilityId: 'NAMED_FACILITY',
      facilityName: 'Metric Facility Name',
      lastOrderCount: 7
    }]);
    expect(store.getDashboardStatus('facilityOrderVolume')).toBe('success');
  });

  it('keeps valid today-volume rows available with their ID fallback when name enrichment fails', async () => {
    const enrichmentError = new Error('facility catalog unavailable');
    vi.mocked(api).mockResolvedValueOnce({
      data: {
        facilities: [{
          facilityId: 'M100051',
          lastOrderCount: 151
        }]
      }
    });
    vi.mocked(fetchPhysicalFacilityCatalog).mockRejectedValueOnce(enrichmentError);

    const store = useCustomerServiceStore();
    await store.fetchFacilityOrderVolume('STORE');

    expect(store.getFacilityOrderVolume).toEqual([{
      facilityId: 'M100051',
      lastOrderCount: 151
    }]);
    expect(store.getDashboardStatus('facilityOrderVolume')).toBe('success');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to enrich facility order volume names from the facility catalog',
      enrichmentError
    );
  });

  it('does not let an older facility-name enrichment replace a newer store scope', async () => {
    const staleNames = deferred<any[]>();
    const currentNames = deferred<any[]>();
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: {
          facilities: [{
            facilityId: 'FACILITY_A',
            lastOrderCount: 151
          }]
        }
      })
      .mockResolvedValueOnce({
        data: {
          facilities: [{
            facilityId: 'FACILITY_B',
            lastOrderCount: 5
          }]
        }
      });
    vi.mocked(fetchPhysicalFacilityCatalog)
      .mockImplementationOnce(() => staleNames.promise)
      .mockImplementationOnce(() => currentNames.promise);

    const store = useCustomerServiceStore();
    const staleRequest = store.fetchFacilityOrderVolume('STORE_A');
    await vi.waitFor(() => {
      expect(fetchPhysicalFacilityCatalog).toHaveBeenCalledTimes(1);
    });
    const currentRequest = store.fetchFacilityOrderVolume('STORE_B');
    await vi.waitFor(() => {
      expect(fetchPhysicalFacilityCatalog).toHaveBeenCalledTimes(2);
    });

    currentNames.resolve([{
      facilityId: 'FACILITY_B',
      facilityName: 'Current Facility',
    }]);
    await currentRequest;
    staleNames.resolve([{
      facilityId: 'FACILITY_A',
      facilityName: 'Stale Facility',
    }]);
    await staleRequest;

    expect(store.getFacilityOrderVolume).toEqual([{
      facilityId: 'FACILITY_B',
      facilityName: 'Current Facility',
      lastOrderCount: 5
    }]);
    expect(store.getDashboardStatus('facilityOrderVolume')).toBe('success');
  });

  it('does not let an older active-facility fallback replace newer store rows', async () => {
    const staleFallback = deferred<any[]>();
    vi.mocked(api)
      .mockResolvedValueOnce({ data: { facilities: [] } })
      .mockResolvedValueOnce({
        data: {
          facilities: [{
            facilityId: 'FACILITY_B',
            facilityName: 'Facility B',
            lastOrderCount: 5
          }]
        }
      });
    vi.mocked(getActivePhysicalFacilityOrderVolume)
      .mockImplementationOnce(() => staleFallback.promise);

    const store = useCustomerServiceStore();
    const storeARequest = store.fetchFacilityOrderVolume('STORE_A');
    await vi.waitFor(() => {
      expect(getActivePhysicalFacilityOrderVolume).toHaveBeenCalledWith({ productStoreId: 'STORE_A' });
    });

    const storeBRequest = store.fetchFacilityOrderVolume('STORE_B');
    await storeBRequest;
    staleFallback.resolve([{
      facilityId: 'FACILITY_A',
      facilityName: 'Facility A',
      lastOrderCount: 50,
      assignedItemQuantity: 50
    }]);
    await storeARequest;

    expect(store.getFacilityOrderVolume).toEqual([{
      facilityId: 'FACILITY_B',
      facilityName: 'Facility B',
      lastOrderCount: 5
    }]);
    expect(store.getDashboardStatus('facilityOrderVolume')).toBe('success');
  });

  it('ignores stale virtual-location count failures after the facility-discovery stage', async () => {
    const staleOtherCounts = deferred<any[]>();
    const staleUnfillableCounts = deferred<any[]>();
    vi.mocked(api)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });
    vi.mocked(fetchVirtualLocationOrderCounts)
      .mockImplementationOnce(() => staleOtherCounts.promise)
      .mockImplementationOnce(() => staleUnfillableCounts.promise)
      .mockResolvedValueOnce([{ facilityId: '_NA_', count: 4 }])
      .mockResolvedValueOnce([{ facilityId: 'UNFILLABLE_PARKING', count: 2 }]);

    const store = useCustomerServiceStore();
    const storeARequest = store.fetchVirtualLocationCounts('STORE_A');
    await vi.waitFor(() => {
      expect(fetchVirtualLocationOrderCounts).toHaveBeenCalledTimes(2);
    });

    const storeBRequest = store.fetchVirtualLocationCounts('STORE_B');
    await storeBRequest;
    staleOtherCounts.reject(new Error('stale virtual-location failure'));
    staleUnfillableCounts.resolve([]);
    await storeARequest;

    expect(store.getVirtualLocationCounts.map(({ id, count }) => ({ id, count }))).toEqual([
      { id: 'brokering', count: 4 },
      { id: 'rejected', count: 0 },
      { id: 'unfillable', count: 2 }
    ]);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('keeps the current facility request loading after a stale failure and surfaces its own failure', async () => {
    const staleFacility = deferred<any>();
    const currentFacility = deferred<any>();
    vi.mocked(getActivePhysicalFacilityOrderVolume).mockResolvedValue([]);
    vi.mocked(api)
      .mockImplementationOnce(() => staleFacility.promise)
      .mockImplementationOnce(() => currentFacility.promise);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const store = useCustomerServiceStore();
    const staleFacilityRequest = store.fetchFacilityRejections('STORE_A');
    const currentFacilityRequest = store.fetchFacilityRejections('STORE_B');

    staleFacility.reject(new Error('stale facility failure'));
    await staleFacilityRequest;
    expect(store.getDashboardStatus('facilityRejections')).toBe('loading');
    expect(errorSpy).not.toHaveBeenCalled();

    const currentError = new Error('current facility failure');
    currentFacility.reject(currentError);
    await currentFacilityRequest;
    expect(store.getDashboardStatus('facilityRejections')).toBe('error');
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch facility rejections', currentError);
    errorSpy.mockRestore();
  });

  it('ignores a stale sync-group failure and logs only the latest swallowed failure', async () => {
    const staleFacility = deferred<any[]>();
    const currentFacility = deferred<any[]>();
    vi.mocked(getPickProfileGroups)
      .mockImplementationOnce((_params, onError) => staleFacility.promise.catch((error) => {
        onError?.(error);
        return [];
      }))
      .mockImplementationOnce((_params, onError) => currentFacility.promise.catch((error) => {
        onError?.(error);
        return [];
      }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const store = useCustomerServiceStore();
    store.fulfillmentSyncData = { settings: { pendingSyncCount: 99 } };
    const staleFacilityRequest = store.fetchFulfillmentSyncData('FACILITY_A', 'STORE_A');
    const currentFacilityRequest = store.fetchFulfillmentSyncData('FACILITY_B', 'STORE_B');

    expect(store.getFulfillmentSyncData).toBeNull();
    staleFacility.reject(new Error('stale sync failure'));
    await staleFacilityRequest;
    expect(store.getDashboardStatus('fulfillmentSyncData')).toBe('loading');
    expect(errorSpy).not.toHaveBeenCalled();

    const currentError = new Error('current sync failure');
    currentFacility.reject(currentError);
    await currentFacilityRequest;
    expect(store.getDashboardStatus('fulfillmentSyncData')).toBe('success');
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith('Failed to get pick profile groups from server', currentError);
    errorSpy.mockRestore();
  });

  it('invalidates facility progress and sync work when the facility scope is cleared', async () => {
    const progressResponses = Array.from({ length: 4 }, () => deferred<any>());
    const syncResponse = deferred<any[]>();
    progressResponses.forEach((response) => {
      vi.mocked(api).mockImplementationOnce(() => response.promise);
    });
    vi.mocked(getPickProfileGroups).mockImplementationOnce(() => syncResponse.promise);

    const store = useCustomerServiceStore();
    const progressRequest = store.fetchFacilityFulfillmentProgress('FACILITY_A', 'STORE_A');
    const syncRequest = store.fetchFulfillmentSyncData('FACILITY_A', 'STORE_A');
    store.clearFacilityDashboardData();

    progressResponses.forEach((response) => response.resolve({ data: {} }));
    syncResponse.resolve([]);
    await Promise.all([progressRequest, syncRequest]);

    expect(store.getFacilityFulfillmentProgress).toBeNull();
    expect(store.getFulfillmentSyncData).toBeNull();
    expect(store.getDashboardStatus('facilityFulfillmentProgress')).toBe('idle');
    expect(store.getDashboardStatus('fulfillmentSyncData')).toBe('idle');
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
