import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import { useOrderDetail } from '@/composables/useOrderDetail';

vi.mock('@common', () => ({ api: vi.fn(), commonUtil: { hasError: () => false } }));

const task = {
  workEffortTypeId: 'RESOLVE_ONHOLD_ORDER',
  workEffortPurposeTypeId: 'ORD_HOLD_MANUAL',
  workEffortName: 'Manual review',
  description: 'Review before fulfillment'
};
const row = (orderId: string, shipGroupSeqId: string) => ({ orderId, shipGroupSeqId, ...task, statusId: 'TASK_CREATED' });

describe('order task requests', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset().mockResolvedValue({ data: {} });
  });

  it('creates one task on each chosen ship group of one order', async () => {
    await useOrderDetail().createOrderTasks('ORDER_1', ['00001', '00002'], task);

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith({ url: 'oms/orders/tasks', method: 'POST', data: [row('ORDER_1', '00001'), row('ORDER_1', '00002')] });
  });

  it('creates one task on every ship group of each selected order, in one request', async () => {
    vi.mocked(api)
      .mockResolvedValueOnce({ data: [{ shipGroupSeqId: '00001' }, { shipGroupSeqId: '00002' }] })
      .mockResolvedValueOnce({ data: [{ shipGroupSeqId: '00003' }] })
      .mockResolvedValueOnce({ data: {} });

    await useOrderDetail().bulkCreateOrderTasks(['ORDER_1', 'ORDER_2'], task);

    expect(api).toHaveBeenNthCalledWith(1, { url: 'oms/orders/ORDER_1/shipGroups', method: 'GET' });
    expect(api).toHaveBeenNthCalledWith(3, {
      url: 'oms/orders/tasks',
      method: 'POST',
      data: [row('ORDER_1', '00001'), row('ORDER_1', '00002'), row('ORDER_2', '00003')]
    });
  });
});
