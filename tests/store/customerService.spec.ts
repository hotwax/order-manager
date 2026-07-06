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
