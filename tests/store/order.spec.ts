import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { useOrderStore } from '@/store/order';

vi.mock('@common', () => ({
  api: vi.fn(),
  cookieHelper: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  })),
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: vi.fn(() => ({
    productStores: { byId: {} },
    shipmentMethodTypes: { byId: {} },
  })),
}));

describe('order workflow store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ data: {} });
  });

  it('ships selected packed workflow shipments through Poorti bulk ship', async () => {
    const store = useOrderStore();
    store.workflowOrders.packed = [
      { orderId: 'M100001', shipmentId: 'S100001' },
      { orderId: 'M100002', shipmentId: 'S100002' },
      { orderId: 'M100001', shipmentId: 'S100001' },
    ] as any;

    await store.shipPackedWorkflowOrders(['M100001']);

    expect(api).toHaveBeenCalledWith({
      url: 'poorti/shipments/bulkShip',
      method: 'POST',
      data: { shipmentIds: ['S100001'] },
    });
  });

  it('fails before calling the API when selected packed orders have no shipment ids', async () => {
    const store = useOrderStore();
    store.workflowOrders.packed = [{ orderId: 'M100001' }] as any;

    await expect(store.shipPackedWorkflowOrders(['M100001'])).rejects.toThrow('No packed shipments found');
    expect(api).not.toHaveBeenCalled();
  });
});
