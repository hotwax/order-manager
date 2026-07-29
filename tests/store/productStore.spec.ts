import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api, logger } from '@common';
import { useProductStore } from '@/store/productStore';

const { loadProductStoreSeedData } = vi.hoisted(() => ({
  loadProductStoreSeedData: vi.fn(),
}));

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: vi.fn(() => false),
    showToast: vi.fn(),
  },
  logger: {
    error: vi.fn(),
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
      userId: 'USER',
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
    loadProductStoreSeedData.mockReset();
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
});
