import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { getActivePhysicalFacilityOrderVolume } from '@/services/order';
import { useCustomerServiceStore } from '@/store/customerService';
import { DateTime } from 'luxon';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: { hasError: vi.fn() },
  logger: { error: vi.fn() },
  translate: (value: string) => value,
}));

vi.mock('@/services/order', () => ({
  fetchVirtualLocationOrderCounts: vi.fn(),
  getActivePhysicalFacilityOrderVolume: vi.fn(),
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
  });

  it('fetches hold task counts from the matching task queues', async () => {
    const axiosHeaders = {
      get: vi.fn((name: string) => name === 'x-total-count' ? '3' : undefined)
    };
    vi.mocked(api)
      .mockResolvedValueOnce({ headers: { 'x-total-count': '12' }, data: [{}] })
      .mockResolvedValueOnce({ headers: {}, data: [{}, {}] })
      .mockResolvedValueOnce({ headers: axiosHeaders, data: [] });

    const store = useCustomerServiceStore();

    await store.fetchHoldTasks('STORE_1');

    expect(api).toHaveBeenNthCalledWith(1, {
      url: 'oms/orders/tasks/shipGroupTasks',
      method: 'GET',
      params: {
        statusId: 'TASK_CREATED',
        workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
        workEffortPurposeTypeId: 'NEG_RES_REVIEW',
        productStoreId: 'STORE_1',
        pageSize: 10000,
      }
    });
    expect(api).toHaveBeenNthCalledWith(2, {
      url: 'oms/orders/tasks/shipGroupTasks',
      method: 'GET',
      params: {
        statusId: 'TASK_CREATED',
        workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
        workEffortPurposeTypeId: 'INVALID_ADDRESS',
        productStoreId: 'STORE_1',
        pageSize: 10000,
      }
    });
    expect(api).toHaveBeenNthCalledWith(3, {
      url: 'oms/orders/tasks',
      method: 'GET',
      params: {
        statusId: 'TASK_CREATED',
        workEffortTypeId: 'REVIEW_RISK_ORDER',
        productStoreId: 'STORE_1',
        pageSize: 10000,
      }
    });
    expect(axiosHeaders.get).toHaveBeenCalledWith('x-total-count');
    expect(store.holdTasks).toEqual({
      holdSubstituteCount: 12,
      holdBadAddressCount: 2,
      holdFraudRiskCount: 3,
      holdTasksTotalCount: 17,
    });
    expect(store.dashboardStatus.holdTasks).toBe('success');
  });

  it('marks the hold task section as errored without clearing the previous counts', async () => {
    const error = new Error('network failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(api).mockRejectedValueOnce(error);

    const store = useCustomerServiceStore();
    store.holdTasks = {
      holdSubstituteCount: 1,
      holdBadAddressCount: 2,
      holdFraudRiskCount: 3,
      holdTasksTotalCount: 6,
    };

    await store.fetchHoldTasks('STORE_1');

    expect(store.holdTasks).toEqual({
      holdSubstituteCount: 1,
      holdBadAddressCount: 2,
      holdFraudRiskCount: 3,
      holdTasksTotalCount: 6,
    });
    expect(store.dashboardStatus.holdTasks).toBe('error');
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch hold task counts', error);
    errorSpy.mockRestore();
  });
});
