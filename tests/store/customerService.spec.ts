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

  it('falls back to active physical facilities when daily order volume rows are empty', async () => {
    vi.mocked(api).mockResolvedValueOnce({ data: { facilities: [] } });
    vi.mocked(getActivePhysicalFacilityOrderVolume).mockResolvedValueOnce([{
      facilityId: 'BROADWAY',
      facilityName: 'Broadway',
      lastOrderCount: 4,
      assignedItemQuantity: 7,
    }]);

    const store = useCustomerServiceStore();
    await store.fetchFacilityOrderVolume('STORE');

    expect(getActivePhysicalFacilityOrderVolume).toHaveBeenCalledWith({ productStoreId: 'STORE' });
    expect(store.getFacilityOrderVolume).toEqual([{
      facilityId: 'BROADWAY',
      facilityName: 'Broadway',
      lastOrderCount: 4,
      assignedItemQuantity: 7,
    }]);
    expect(store.getDashboardStatus('facilityOrderVolume')).toBe('success');
  });

  it('keeps the reported daily order volume rows when they carry counts', async () => {
    vi.mocked(api).mockResolvedValueOnce({
      data: { facilities: [{ facilityId: 'GARDEN_CITY', facilityName: 'Garden City', lastOrderCount: 8 }] },
    });

    const store = useCustomerServiceStore();
    await store.fetchFacilityOrderVolume('STORE');

    expect(getActivePhysicalFacilityOrderVolume).not.toHaveBeenCalled();
    expect(store.getFacilityOrderVolume).toEqual([
      { facilityId: 'GARDEN_CITY', facilityName: 'Garden City', lastOrderCount: 8 },
    ]);
    expect(store.getDashboardStatus('facilityOrderVolume')).toBe('success');
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
