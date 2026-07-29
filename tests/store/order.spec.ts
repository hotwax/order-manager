import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api } from '@common';
import { useOrderStore } from '@/store/order';
import { fetchOrderRowEnrichment } from '@/services/order';

const mocks = vi.hoisted(() => ({
  fetchBrokeringCount: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@common', () => ({
  api: vi.fn(),
  cookieHelper: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  })),
  logger: { error: mocks.loggerError },
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: vi.fn(() => ({
    productStores: { byId: {} },
    shipmentMethodTypes: { byId: {} },
  })),
}));

vi.mock('@/store/productStore', () => ({
  useProductStore: vi.fn(() => ({
    currentProductStore: {},
  })),
}));

vi.mock('@/services/order', () => ({
  searchOrders: vi.fn(),
  fetchOrderRowEnrichment: vi.fn(),
}));

vi.mock('@/services/navCounts', () => ({
  queueCountFetchers: {
    brokering: mocks.fetchBrokeringCount,
  },
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('order workflow store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ data: {} });
    vi.mocked(fetchOrderRowEnrichment).mockReset();
    vi.mocked(fetchOrderRowEnrichment).mockResolvedValue({});
    mocks.fetchBrokeringCount.mockReset();
    mocks.loggerError.mockReset();
  });

  it('keeps only the latest store-scoped navigation count when priming overlaps', async () => {
    const storeA = deferred<number>();
    const storeB = deferred<number>();
    mocks.fetchBrokeringCount
      .mockImplementationOnce(() => storeA.promise)
      .mockImplementationOnce(() => storeB.promise);

    const store = useOrderStore();
    store.navCounts.brokering = 99;
    const storeARequest = store.primeNavCounts('STORE_A');
    expect(store.navCounts.brokering).toBeUndefined();
    const storeBRequest = store.primeNavCounts('STORE_B');

    storeB.resolve(4);
    await storeBRequest;
    storeA.resolve(40);
    await storeARequest;

    expect(mocks.fetchBrokeringCount.mock.calls).toEqual([['STORE_A'], ['STORE_B']]);
    expect(store.navCounts.brokering).toBe(4);
  });

  it('invalidates an in-flight navigation count when the store scope is cleared', async () => {
    const staleRequest = deferred<number>();
    mocks.fetchBrokeringCount.mockImplementationOnce(() => staleRequest.promise);

    const store = useOrderStore();
    const stalePrime = store.primeNavCounts('STORE_A');
    store.clearPrimedNavCounts();
    staleRequest.resolve(12);
    await stalePrime;

    expect(store.navCounts.brokering).toBeUndefined();
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('ignores a stale navigation failure and still reports the latest failure', async () => {
    const staleRequest = deferred<number>();
    const currentRequest = deferred<number>();
    mocks.fetchBrokeringCount
      .mockImplementationOnce(() => staleRequest.promise)
      .mockImplementationOnce(() => currentRequest.promise);

    const store = useOrderStore();
    const stalePrime = store.primeNavCounts('STORE_A');
    const currentPrime = store.primeNavCounts('STORE_B');

    staleRequest.reject(new Error('stale nav failure'));
    await stalePrime;
    expect(mocks.loggerError).not.toHaveBeenCalled();

    const currentError = new Error('current nav failure');
    currentRequest.reject(currentError);
    await currentPrime;
    expect(mocks.loggerError).toHaveBeenCalledOnce();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to prime the brokering nav count',
      currentError
    );
    expect(store.navCounts.brokering).toBeUndefined();
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
