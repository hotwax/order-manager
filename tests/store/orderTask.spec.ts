import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { useOrderTaskStore } from '@/store/orderTask';

vi.mock('@common', () => ({
  api: vi.fn(),
}));

vi.mock('@/store/productStore', () => ({
  useProductStore: vi.fn(() => ({
    getCurrentProductStore: {
      productStoreId: 'STORE',
    },
  })),
}));

vi.mock('@/composables/useProductMaster', () => ({
  useProductMaster: vi.fn(() => ({
    init: vi.fn(),
    prefetch: vi.fn(),
  })),
}));

vi.mock('@/store/stock', () => ({
  useStockStore: vi.fn(() => ({
    fetchStock: vi.fn(),
  })),
}));

describe('order task store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ data: {} });
  });

  it('sends hold resolution comments with task status updates', async () => {
    const store = useOrderTaskStore();

    await store.changeTaskStatus('TASK_1', 'TASK_COMPLETED', { content: '  Ready to release  ' });

    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/tasks/TASK_1/status',
      method: 'POST',
      data: {
        statusId: 'TASK_COMPLETED',
        content: 'Ready to release',
        communicationEventTypeId: 'ORDER_NOTE',
        subject: 'NA',
      },
    });
  });

  it('keeps status-only updates unchanged when no comment is present', async () => {
    const store = useOrderTaskStore();

    await store.changeTaskStatus('TASK_2', 'TASK_COMPLETED', { content: '   ' });

    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/tasks/TASK_2/status',
      method: 'POST',
      data: {
        statusId: 'TASK_COMPLETED',
      },
    });
  });

  it('rejects when cancelling order items fails', async () => {
    const store = useOrderTaskStore();
    const error = new Error('Request failed with status code 400');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(api).mockRejectedValueOnce(error);

    await expect(store.cancelOrder('M104032', [{
      orderItemSeqId: '01',
      shipGroupSeqId: '00004',
      reason: 'NO_VARIANCE_LOG',
      comment: '',
    }])).rejects.toThrow('Request failed with status code 400');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/M104032/items/cancel',
      method: 'POST',
      data: {
        items: [{
          orderItemSeqId: '01',
          shipGroupSeqId: '00004',
          reason: 'NO_VARIANCE_LOG',
          comment: '',
        }],
      },
    });
    expect(errorSpy).toHaveBeenCalledWith('Failed to cancel the order', error);
    errorSpy.mockRestore();
  });

  it('fetches fraud queue tasks as hold tasks with the risk review purpose', async () => {
    const store = useOrderTaskStore();
    vi.mocked(api).mockResolvedValueOnce({ data: [] });

    await store.fetchFraudTasks({ pageSize: 20, pageIndex: 0, riskLevelEnumId: 'RISK_HIGH' });

    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/tasks',
      method: 'GET',
      params: {
        pageSize: 20,
        pageIndex: 0,
        riskLevelEnumId: 'RISK_HIGH',
        taskStatusId: 'TASK_CREATED',
        workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
        workEffortPurposeTypeId: 'REVIEW_RISK_ORDER',
        productStoreId: 'STORE',
      },
    });
  });

  it('fetches order fraud tasks with the hold type and risk review purpose', async () => {
    const store = useOrderTaskStore();
    vi.mocked(api).mockResolvedValue({ data: [] });

    await store.fetchOrderHoldTasks('ORDER_1');

    expect(vi.mocked(api).mock.calls).toEqual(expect.arrayContaining([
      [{
        url: 'oms/orders/tasks',
        method: 'GET',
        params: {
          orderId: 'ORDER_1',
          taskStatusId: 'TASK_CREATED',
          workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
          workEffortPurposeTypeId: 'REVIEW_RISK_ORDER',
          productStoreId: 'STORE',
        },
      }],
    ]));
  });
});
