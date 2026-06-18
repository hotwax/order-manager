import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { useOrderTaskStore } from '@/store/orderTask';

vi.mock('@common', () => ({
  api: vi.fn(),
}));

vi.mock('@/store/productStore', () => ({
  useProductStore: vi.fn(() => ({})),
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
});
