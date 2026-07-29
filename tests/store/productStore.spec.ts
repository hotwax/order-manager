import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api, logger } from '@common';
import { useProductStore } from '@/store/productStore';

const { loadProductStoreSeedData } = vi.hoisted(() => ({
  loadProductStoreSeedData: vi.fn(),
}));
const user = vi.hoisted(() => ({
  userId: 'USER',
}));

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: vi.fn(() => false),
    showToast: vi.fn(),
  },
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  translate: (message: string) => message,
  useEmbeddedAppStore: vi.fn(),
  useSolrSearch: () => ({
    searchProducts: vi.fn(),
  }),
}));

vi.mock('@/store/user', () => ({
  useUserStore: () => ({
    current: {
      get userId() {
        return user.userId;
      },
    },
  }),
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: () => ({
    loadProductStoreSeedData,
  }),
}));

describe('product store selection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
    vi.mocked(logger.error).mockReset();
    vi.mocked(logger.warn).mockReset();
    loadProductStoreSeedData.mockReset();
    user.userId = 'USER';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders canonical metadata for a persisted selected store ID', () => {
    const store = useProductStore();
    store.currentProductStore = {
      productStoreId: 'STORE',
      storeName: 'gorjana',
    };
    store.productStores = [{
      productStoreId: 'STORE',
      storeName: 'Demo Store',
    }];

    expect(store.getCurrentProductStore).toEqual({
      productStoreId: 'STORE',
      storeName: 'Demo Store',
    });
  });

  it('reconciles persisted selected-store metadata after refreshing the catalog', async () => {
    vi.mocked(api).mockResolvedValue({
      data: [{
        productStoreId: 'STORE',
        storeName: 'Demo Store',
      }],
    });

    const store = useProductStore();
    store.currentProductStore = {
      productStoreId: 'STORE',
      storeName: 'gorjana',
    };
    store.productStores = [{
      productStoreId: 'STORE',
      storeName: 'gorjana',
    }];

    await store.fetchProductStores();

    expect(store.currentProductStore).toEqual({
      productStoreId: 'STORE',
      storeName: 'Demo Store',
    });
    expect(store.getCurrentProductStore).toBe(store.productStores[0]);
  });

  it('uses a deterministic canonical fallback for an invalid preference', async () => {
    vi.mocked(api).mockResolvedValue({
      data: [{
        preferenceValue: 'MISSING_STORE',
      }],
    });

    const store = useProductStore();
    store.currentProductStore = {
      productStoreId: 'STALE_STORE',
      storeName: 'Stale Store',
    };
    store.productStores = [
      { productStoreId: 'STORE_A', storeName: 'Store A' },
      { productStoreId: 'STORE_B', storeName: 'Store B' },
    ];

    await store.fetchProductStorePreference();

    expect(store.currentProductStore).toBe(store.productStores[0]);
  });

  it('preserves a usable persisted selection when the catalog refresh fails', async () => {
    const error = new Error('catalog unavailable');
    vi.mocked(api).mockRejectedValue(error);

    const store = useProductStore();
    store.currentProductStore = {
      productStoreId: 'STORE',
      storeName: 'Persisted Store',
    };
    store.productStores = [{
      productStoreId: 'STORE',
      storeName: 'Persisted Store',
    }];

    await store.fetchProductStores();

    expect(store.currentProductStore).toEqual({
      productStoreId: 'STORE',
      storeName: 'Persisted Store',
    });
    expect(store.productStores).toEqual([{
      productStoreId: 'STORE',
      storeName: 'Persisted Store',
    }]);
    expect(logger.error).toHaveBeenCalledWith('Failed to fetch product stores', error);
  });

  it('clears an invalid persisted selection when the refreshed catalog is empty', async () => {
    vi.mocked(api).mockResolvedValue({ data: [] });

    const store = useProductStore();
    store.currentProductStore = {
      productStoreId: 'REMOVED_STORE',
      storeName: 'Removed Store',
    };
    store.productStores = [{
      productStoreId: 'REMOVED_STORE',
      storeName: 'Removed Store',
    }];

    await store.fetchProductStores();

    expect(store.productStores).toEqual([]);
    expect(store.currentProductStore).toEqual({});
    expect(store.getCurrentProductStore).toEqual({});
  });

  it('publishes the refreshed catalog and preference as one selection update', async () => {
    let resolvePreference: (value: any) => void = () => undefined;
    const preferenceResponse = new Promise((resolve) => {
      resolvePreference = resolve;
    });

    vi.mocked(api).mockImplementation((request: any) => {
      if (request.url === '/admin/productStores') {
        return Promise.resolve({
          data: [
            { productStoreId: 'STORE_A', storeName: 'Store A' },
            { productStoreId: 'STORE_B', storeName: 'Store B' },
          ],
        });
      }
      return preferenceResponse;
    });

    const store = useProductStore();
    const persistedStore = {
      productStoreId: 'PERSISTED_STORE',
      storeName: 'Persisted Store',
    };
    store.currentProductStore = persistedStore;
    store.productStores = [persistedStore];

    const initialization = store.initializeProductStoreSelection();
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));

    expect(store.currentProductStore).toEqual(persistedStore);
    expect(store.productStores).toEqual([persistedStore]);

    resolvePreference({
      data: [{
        preferenceValue: 'STORE_B',
      }],
    });
    await initialization;

    expect(store.currentProductStore).toEqual(store.productStores[1]);
    expect(store.getCurrentProductStore).toEqual({
      productStoreId: 'STORE_B',
      storeName: 'Store B',
    });
  });

  it('applies the canonical selection when initialization resolves after the UI wait times out', async () => {
    vi.useFakeTimers();
    let resolveProductStores: (value: any) => void = () => undefined;
    const productStoresResponse = new Promise((resolve) => {
      resolveProductStores = resolve;
    });

    vi.mocked(api).mockImplementation((request: any) => {
      if (request.url === '/admin/productStores') return productStoresResponse;
      return Promise.resolve({
        data: [{
          preferenceValue: 'STORE_B',
        }],
      });
    });

    const store = useProductStore();
    const persistedStore = {
      productStoreId: 'PERSISTED_STORE',
      storeName: 'Persisted Store',
    };
    store.currentProductStore = persistedStore;
    store.productStores = [persistedStore];

    const initialization = store.initializeProductStoreSelection();
    const uiWait = Promise.race([
      initialization.then(() => 'initialized'),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 50)),
    ]);
    await vi.advanceTimersByTimeAsync(50);

    await expect(uiWait).resolves.toBe('timeout');
    expect(store.currentProductStore).toEqual(persistedStore);
    expect(store.productStores).toEqual([persistedStore]);

    resolveProductStores({
      data: [
        { productStoreId: 'STORE_A', storeName: 'Store A' },
        { productStoreId: 'STORE_B', storeName: 'Store B' },
      ],
    });
    await initialization;

    expect(store.currentProductStore).toEqual(store.productStores[1]);
    expect(store.currentProductStore).toEqual({
      productStoreId: 'STORE_B',
      storeName: 'Store B',
    });
  });

  it('does not let late initialization overwrite a selection made after the UI wait times out', async () => {
    vi.useFakeTimers();
    let resolveProductStores: (value: any) => void = () => undefined;
    const productStoresResponse = new Promise((resolve) => {
      resolveProductStores = resolve;
    });

    vi.mocked(api).mockImplementation((request: any) => {
      if (request.url === '/admin/productStores') return productStoresResponse;
      if (request.method === 'PUT') return Promise.resolve({ data: {} });
      return Promise.resolve({
        data: [{
          preferenceValue: 'STORE_A',
        }],
      });
    });

    const store = useProductStore();
    store.productStores = [
      { productStoreId: 'STORE_A', storeName: 'Store A' },
      { productStoreId: 'STORE_B', storeName: 'Store B' },
    ];
    store.currentProductStore = store.productStores[0];

    const initialization = store.initializeProductStoreSelection();
    const uiWait = Promise.race([
      initialization.then(() => 'initialized'),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 50)),
    ]);
    await vi.advanceTimersByTimeAsync(50);
    await expect(uiWait).resolves.toBe('timeout');

    await store.setProductStorePreference(store.productStores[1]);
    expect(store.currentProductStore).toBe(store.productStores[1]);

    resolveProductStores({
      data: [
        { productStoreId: 'STORE_A', storeName: 'Updated Store A' },
        { productStoreId: 'STORE_B', storeName: 'Updated Store B' },
      ],
    });
    await initialization;

    expect(store.currentProductStore).toBe(store.productStores[1]);
    expect(store.currentProductStore).toEqual({
      productStoreId: 'STORE_B',
      storeName: 'Store B',
    });
  });

  it('keeps the latest result when same-user initializations resolve out of order', async () => {
    let resolveFirstStores: (value: any) => void = () => undefined;
    let resolveFirstPreference: (value: any) => void = () => undefined;
    let resolveLatestStores: (value: any) => void = () => undefined;
    let resolveLatestPreference: (value: any) => void = () => undefined;
    const responses = [
      new Promise((resolve) => { resolveFirstStores = resolve; }),
      new Promise((resolve) => { resolveFirstPreference = resolve; }),
      new Promise((resolve) => { resolveLatestStores = resolve; }),
      new Promise((resolve) => { resolveLatestPreference = resolve; }),
    ];
    vi.mocked(api).mockImplementation(() => responses.shift() as Promise<any>);

    const store = useProductStore();
    const firstInitialization = store.initializeProductStoreSelection();
    const latestInitialization = store.initializeProductStoreSelection();

    resolveLatestStores({
      data: [{ productStoreId: 'STORE_B', storeName: 'Store B' }],
    });
    resolveLatestPreference({
      data: [{ preferenceValue: 'STORE_B' }],
    });
    await latestInitialization;

    expect(store.currentProductStore).toEqual({
      productStoreId: 'STORE_B',
      storeName: 'Store B',
    });

    resolveFirstStores({
      data: [{ productStoreId: 'STORE_A', storeName: 'Store A' }],
    });
    resolveFirstPreference({
      data: [{ preferenceValue: 'STORE_A' }],
    });
    await firstInitialization;

    expect(store.productStores).toEqual([
      { productStoreId: 'STORE_B', storeName: 'Store B' },
    ]);
    expect(store.currentProductStore).toEqual({
      productStoreId: 'STORE_B',
      storeName: 'Store B',
    });
  });

  it('preserves a usable persisted selection when initialization is unreachable', async () => {
    const error = new Error('catalog unavailable');
    vi.mocked(api).mockImplementation((request: any) => {
      if (request.url === '/admin/productStores') return Promise.reject(error);
      return Promise.resolve({ data: [] });
    });

    const store = useProductStore();
    const persistedStore = {
      productStoreId: 'STORE',
      storeName: 'Persisted Store',
    };
    store.currentProductStore = persistedStore;
    store.productStores = [persistedStore];

    await expect(store.initializeProductStoreSelection()).resolves.toEqual(persistedStore);
    expect(store.currentProductStore).toEqual(persistedStore);
    expect(store.productStores).toEqual([persistedStore]);
    expect(logger.error).toHaveBeenCalledWith('Failed to fetch product stores', error);
  });

  it('canonicalizes store metadata when switching the selected store', async () => {
    vi.mocked(api).mockResolvedValue({ data: {} });

    const store = useProductStore();
    store.productStores = [
      { productStoreId: 'STORE_A', storeName: 'Store A' },
      { productStoreId: 'STORE_B', storeName: 'Store B' },
    ];
    store.currentProductStore = store.productStores[0];

    await store.setProductStorePreference({
      productStoreId: 'STORE_B',
      storeName: 'Stale Store B',
    });

    expect(api).toHaveBeenCalledWith({
      url: 'admin/user/preferences',
      method: 'PUT',
      data: {
        userId: 'USER',
        preferenceKey: 'SELECTED_BRAND',
        preferenceValue: 'STORE_B',
      },
    });
    expect(store.currentProductStore).toBe(store.productStores[1]);
    expect(loadProductStoreSeedData).toHaveBeenCalledWith('STORE_B');
  });

  it('serializes rapid preference writes so the latest user choice remains local and remote', async () => {
    let resolveFirstWrite: (value: any) => void = () => undefined;
    const firstWriteResponse = new Promise((resolve) => {
      resolveFirstWrite = resolve;
    });

    vi.mocked(api).mockImplementation((request: any) => {
      if (request.data.preferenceValue === 'STORE_A') return firstWriteResponse;
      return Promise.resolve({ data: {} });
    });

    const store = useProductStore();
    store.productStores = [
      { productStoreId: 'STORE_A', storeName: 'Store A' },
      { productStoreId: 'STORE_B', storeName: 'Store B' },
    ];

    const firstSelection = store.setProductStorePreference({
      productStoreId: 'STORE_A',
      storeName: 'Stale Store A',
    });
    const latestSelection = store.setProductStorePreference({
      productStoreId: 'STORE_B',
      storeName: 'Stale Store B',
    });

    expect(store.currentProductStore).toBe(store.productStores[1]);
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api).mock.calls[0][0].data.preferenceValue).toBe('STORE_A');

    resolveFirstWrite({ data: {} });
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api).mock.calls[1][0].data.preferenceValue).toBe('STORE_B');

    await Promise.all([firstSelection, latestSelection]);

    expect(store.currentProductStore).toBe(store.productStores[1]);
    expect(loadProductStoreSeedData).toHaveBeenCalledTimes(1);
    expect(loadProductStoreSeedData).toHaveBeenCalledWith('STORE_B');
  });

  it('continues after a stalled write and corrects a late stale success for the captured user', async () => {
    vi.useFakeTimers();
    let resolveFirstWrite: (value: any) => void = () => undefined;
    const firstWriteResponse = new Promise((resolve) => {
      resolveFirstWrite = resolve;
    });

    vi.mocked(api).mockImplementation((request: any) => {
      if (vi.mocked(api).mock.calls.length === 1) return firstWriteResponse;
      return Promise.resolve({ data: {} });
    });

    const store = useProductStore();
    store.productStores = [
      { productStoreId: 'STORE_A', storeName: 'Store A' },
      { productStoreId: 'STORE_B', storeName: 'Store B' },
    ];

    const firstSelection = store.setProductStorePreference(store.productStores[0]);
    const latestSelection = store.setProductStorePreference(store.productStores[1]);
    user.userId = 'NEW_USER';

    await Promise.resolve();
    expect(store.currentProductStore).toBe(store.productStores[1]);
    expect(loadProductStoreSeedData).toHaveBeenCalledTimes(1);
    expect(loadProductStoreSeedData).toHaveBeenCalledWith('STORE_B');
    expect(api).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.resolve();

    expect(api).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api).mock.calls[1][0].data).toMatchObject({
      userId: 'USER',
      preferenceValue: 'STORE_B',
    });
    await Promise.all([firstSelection, latestSelection]);

    resolveFirstWrite({ data: {} });
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(3));

    expect(vi.mocked(api).mock.calls[2][0].data).toMatchObject({
      userId: 'USER',
      preferenceValue: 'STORE_B',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Product store preference update timed out after 10000ms'
    );
  });
});
