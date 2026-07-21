import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { useCustomerServiceStore } from '@/store/customerService';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: { hasError: vi.fn() },
  logger: { error: vi.fn() },
  translate: (value: string) => value,
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

vi.mock('@/services/fulfillmentSync', () => ({
  getPickProfileGroups: vi.fn(),
}));

vi.mock('@/services/order', () => ({
  fetchVirtualLocationOrderCounts: vi.fn(),
}));

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
