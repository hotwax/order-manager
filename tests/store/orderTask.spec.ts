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
        taskStatusId: 'TASK_CREATED,TASK_IN_PROGRESS,TASK_ON_HOLD',
        taskStatusId_op: 'in',
        workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
        workEffortPurposeTypeId: 'REVIEW_RISK_ORDER',
        productStoreId: 'STORE',
      },
    });
  });

  it('captures queue totals and preserves stable sort parameters', async () => {
    const store = useOrderTaskStore();
    vi.mocked(api).mockResolvedValueOnce({
      data: [],
      headers: { 'x-total-count': '42' },
    });

    await store.fetchSwapTasks({
      pageSize: 20,
      pageIndex: 0,
      orderByField: 'workEffortCreatedDate,workEffortId',
      orderName: '1001',
      orderName_op: 'contains',
    });

    expect(store.getSwapTotal).toBe(42);
    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/tasks',
      method: 'GET',
      params: {
        pageSize: 20,
        pageIndex: 0,
        orderByField: 'workEffortCreatedDate,workEffortId',
        orderName: '1001',
        orderName_op: 'contains',
        taskStatusId: 'TASK_CREATED,TASK_IN_PROGRESS,TASK_ON_HOLD',
        taskStatusId_op: 'in',
        workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
        workEffortPurposeTypeId: 'NEG_RES_REVIEW',
        productStoreId: 'STORE',
      },
    });
  });

  it('preserves the list task creation date when ship-group enrichment has its own created date', async () => {
    const store = useOrderTaskStore();
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: [{
          workEffortId: 'TASK_1',
          orderId: 'ORDER_1',
          shipGroupSeqId: '00001',
          workEffortCreatedDate: 1784023200000,
          items: [],
        }],
      })
      .mockResolvedValueOnce({
        data: {
          shipGroup: {
            createdDate: 1783936800000,
            items: [],
          },
        },
      });

    await store.fetchSwapTasks({ pageSize: 20, pageIndex: 0 });

    expect(store.getSwapTasks[0].workEffortCreatedDate).toBe(1784023200000);
    expect(store.getSwapTasks[0].createdDate).toBe(1783936800000);
  });

  it('uses the fraud task creation timestamp returned by the queue API', async () => {
    const store = useOrderTaskStore();
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: [{
          workEffortId: 'TASK_1',
          orderId: 'ORDER_1',
          workEffortCreatedDate: 1784023200000,
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          orderId: 'ORDER_1',
          roles: [],
          contactMechs: [],
          paymentPreferences: [],
          shipGroups: [],
        }],
      })
      .mockResolvedValueOnce({ data: [] });

    await store.fetchFraudTasks({ pageSize: 20, pageIndex: 0 });

    expect(store.getFraudTasks[0].workEffortCreatedDate).toBe(1784023200000);
  });

  it('preserves null fraud scope while retaining each item ship group', async () => {
    const store = useOrderTaskStore();
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: [{
          workEffortId: 'TASK_1',
          orderId: 'ORDER_1',
          shipGroupSeqId: null,
          workEffortCreatedDate: 1784023200000,
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          orderId: 'ORDER_1',
          roles: [],
          contactMechs: [],
          paymentPreferences: [],
          shipGroups: [
            {
              shipGroupSeqId: '00001',
              items: [{ orderItemSeqId: '01', productId: 'PRODUCT_1' }],
            },
            {
              shipGroupSeqId: '00002',
              items: [{ orderItemSeqId: '02', productId: 'PRODUCT_2' }],
            },
          ],
        }],
      })
      .mockResolvedValueOnce({ data: [] });

    await store.fetchFraudTasks({ pageSize: 20, pageIndex: 0 });

    expect(store.getFraudTasks[0].shipGroupSeqId).toBeNull();
    expect(store.getFraudTasks[0].items).toEqual([
      expect.objectContaining({ orderItemSeqId: '01', shipGroupSeqId: '00001' }),
      expect.objectContaining({ orderItemSeqId: '02', shipGroupSeqId: '00002' }),
    ]);
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
          taskStatusId: 'TASK_CREATED,TASK_IN_PROGRESS,TASK_ON_HOLD',
          taskStatusId_op: 'in',
          workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
          workEffortPurposeTypeId: 'ORD_HOLD_MANUAL,ORD_HOLD_CUST_REQ',
          workEffortPurposeTypeId_op: 'in',
          productStoreId: 'STORE',
        },
      }],
      [{
        url: 'oms/orders/tasks',
        method: 'GET',
        params: {
          orderId: 'ORDER_1',
          taskStatusId: 'TASK_CREATED,TASK_IN_PROGRESS,TASK_ON_HOLD',
          taskStatusId_op: 'in',
          workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
          workEffortPurposeTypeId: 'REVIEW_RISK_ORDER',
          productStoreId: 'STORE',
        },
      }],
    ]));
    expect(vi.mocked(api).mock.calls).toHaveLength(4);
    expect(vi.mocked(api).mock.calls.every(([request]) => request.url === 'oms/orders/tasks')).toBe(true);
  });

  it('keeps ship-group and order-level operator holds visible through every blocking status', async () => {
    const store = useOrderTaskStore();
    vi.mocked(api).mockResolvedValueOnce({ data: [] });

    await store.fetchHoldTasks({ pageSize: 20, pageIndex: 0 });

    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/tasks',
      method: 'GET',
      params: {
        pageSize: 20,
        pageIndex: 0,
        taskStatusId: 'TASK_CREATED,TASK_IN_PROGRESS,TASK_ON_HOLD',
        taskStatusId_op: 'in',
        workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
        workEffortPurposeTypeId: 'ORD_HOLD_MANUAL,ORD_HOLD_CUST_REQ',
        workEffortPurposeTypeId_op: 'in',
        productStoreId: 'STORE',
      },
    });
  });

  it('filters the Hold queue to one purpose when the route supplies a purpose', async () => {
    const store = useOrderTaskStore();
    vi.mocked(api).mockResolvedValueOnce({ data: [] });

    await store.fetchHoldTasks({ pageSize: 20, pageIndex: 0 }, 'FUTURE_HOLD');

    expect(api).toHaveBeenCalledWith({
      url: 'oms/orders/tasks',
      method: 'GET',
      params: {
        pageSize: 20,
        pageIndex: 0,
        taskStatusId: 'TASK_CREATED,TASK_IN_PROGRESS,TASK_ON_HOLD',
        taskStatusId_op: 'in',
        workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
        workEffortPurposeTypeId: 'FUTURE_HOLD',
        productStoreId: 'STORE',
      },
    });
  });

  it('keeps repeated tasks as separate rows by workEffortId', async () => {
    const store = useOrderTaskStore();
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: [
          {
            workEffortId: 'TASK_1',
            orderId: 'ORDER_1',
            workEffortPurposeTypeId: 'ORD_HOLD_MANUAL',
          },
          {
            workEffortId: 'TASK_2',
            orderId: 'ORDER_1',
            workEffortPurposeTypeId: 'ORD_HOLD_MANUAL',
          },
        ],
      })
      .mockResolvedValueOnce({ data: { task: {} } })
      .mockResolvedValueOnce({ data: { task: {} } });

    await store.fetchHoldTasks({ pageSize: 20, pageIndex: 0 });

    expect(store.getHoldTasks.map((task) => task.workEffortId)).toEqual(['TASK_1', 'TASK_2']);
  });
});
