import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { useOrderStore } from '@/store/order';
import { fetchOrderRowEnrichment } from '@/services/order';

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

vi.mock('@/services/order', () => ({
  searchOrders: vi.fn(),
  fetchOrderRowEnrichment: vi.fn(),
}));

describe('order workflow store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ data: {} });
    vi.mocked(fetchOrderRowEnrichment).mockReset();
    vi.mocked(fetchOrderRowEnrichment).mockResolvedValue({});
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

  it('builds order-search params from the active search and filters', () => {
    const store = useOrderStore();
    store.searchQuery = 'HC#2601';
    store.searchFilters = {
      status: ['ORDER_APPROVED'],
      channel: 'WEB_SALES_CHANNEL',
      productStoreId: 'STORE',
      dateFrom: '2026-06-01',
      dateThru: '2026-06-28',
      hasVirtualFacilityItems: true,
      archivedOnly: false,
    };
    store.searchSort = 'orderDate asc';

    expect(store.toSearchParams(2)).toEqual({
      queryString: 'HC#2601',
      status: ['ORDER_APPROVED'],
      channel: 'WEB_SALES_CHANNEL',
      productStoreId: 'STORE',
      dateFrom: '2026-06-01',
      dateThru: '2026-06-28',
      hasVirtualFacilityItems: true,
      archivedOnly: false,
      sort: 'orderDate asc',
      pageSize: 50,
      pageIndex: 2,
    });
  });

  it('makes one batched enrichment request for each workflow result page', async () => {
    const store = useOrderStore();
    const filters = {
      query: '', customerName: '', productStoreId: 'All', salesChannelEnumId: 'All',
      facilityId: 'All', shipmentMethodTypeId: 'All', priority: null, dateFrom: '', dateThru: ''
    } as const;
    vi.mocked(api)
      .mockResolvedValueOnce({
        data: {
          ordersCount: 3,
          orders: [{ orderId: 'M100001' }, { orderId: 'M100002' }]
        }
      })
      .mockResolvedValueOnce({
        data: {
          ordersCount: 3,
          orders: [{ orderId: 'M100003' }]
        }
      });
    vi.mocked(fetchOrderRowEnrichment)
      .mockResolvedValueOnce({ M100001: { orderId: 'M100001', itemDocuments: [] } })
      .mockResolvedValueOnce({ M100003: { orderId: 'M100003', itemDocuments: [] } });

    await store.fetchWorkflowOrders('open', filters as any);
    await store.loadMoreWorkflowOrders('open', filters as any);

    expect(fetchOrderRowEnrichment).toHaveBeenNthCalledWith(1, ['M100001', 'M100002']);
    expect(fetchOrderRowEnrichment).toHaveBeenNthCalledWith(2, ['M100003']);
    expect(store.workflowOrderEnrichment.open).toEqual({
      M100001: { orderId: 'M100001', itemDocuments: [] },
      M100003: { orderId: 'M100003', itemDocuments: [] }
    });
  });

  it('clears workflow enrichment when filters replace the result set', async () => {
    const store = useOrderStore();
    store.workflowOrderEnrichment.open = {
      OLD: { orderId: 'OLD', itemDocuments: [] }
    };
    vi.mocked(api).mockResolvedValueOnce({ data: { ordersCount: 0, orders: [] } });

    await store.fetchWorkflowOrders('open', {
      query: 'new', customerName: '', productStoreId: 'All', salesChannelEnumId: 'All',
      facilityId: 'All', shipmentMethodTypeId: 'All', priority: null, dateFrom: '', dateThru: ''
    });

    expect(store.workflowOrderEnrichment.open).toEqual({});
    expect(fetchOrderRowEnrichment).not.toHaveBeenCalled();
  });
});
