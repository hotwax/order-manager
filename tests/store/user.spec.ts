import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProductStore } from '@/store/productStore';
import { api } from '@common';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    getMaargURL: () => 'https://maarg.example/rest/s1/',
    getOmsURL: () => 'https://oms.example/api/',
    hasError: () => false,
    showToast: vi.fn(),
  },
  logger: {
    error: vi.fn(),
  },
  translate: (message: string) => message,
}));

vi.mock('@common/composables/useAuth', () => ({
  useAuth: () => ({
    updateUserId: vi.fn(),
    clearAuth: vi.fn(),
  }),
}));

describe('product store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockReset();
  });

  it('loads product stores and selects the first store by default', async () => {
    vi.mocked(api).mockResolvedValue({
      data: [
        { productStoreId: 'STORE_A', storeName: 'Store A' },
        { productStoreId: 'STORE_B', storeName: 'Store B' },
      ],
    });

    const productStore = useProductStore();
    await productStore.fetchProductStores();

    expect(api).toHaveBeenCalledWith(expect.objectContaining({
      url: '/admin/productStores',
      method: 'GET',
    }));
    expect(productStore.getProductStores).toEqual([
      { productStoreId: 'STORE_A', storeName: 'Store A' },
      { productStoreId: 'STORE_B', storeName: 'Store B' },
    ]);
  });

  it('reconciles persisted selected store metadata with the refreshed catalog', async () => {
    vi.mocked(api).mockResolvedValue({
      data: [{ productStoreId: 'STORE', storeName: 'Demo Store' }],
    });

    const productStore = useProductStore();
    productStore.currentProductStore = { productStoreId: 'STORE', storeName: 'gorjana' };
    productStore.productStores = [{ productStoreId: 'STORE', storeName: 'gorjana' }];

    await productStore.fetchProductStores();

    expect(productStore.getCurrentProductStore).toEqual({
      productStoreId: 'STORE',
      storeName: 'Demo Store',
    });
  });

  it('preserves a usable persisted selection when the catalog refresh fails', async () => {
    vi.mocked(api).mockRejectedValue(new Error('catalog unavailable'));

    const productStore = useProductStore();
    const persistedStore = { productStoreId: 'STORE', storeName: 'Demo Store' };
    productStore.currentProductStore = persistedStore;
    productStore.productStores = [persistedStore];

    await productStore.fetchProductStores();

    expect(productStore.getProductStores).toEqual([persistedStore]);
    expect(productStore.getCurrentProductStore).toEqual(persistedStore);
  });

  it('preserves a usable persisted selection when its cached catalog is unavailable', async () => {
    vi.mocked(api).mockRejectedValue(new Error('catalog unavailable'));

    const productStore = useProductStore();
    const persistedStore = { productStoreId: 'STORE', storeName: 'Demo Store' };
    productStore.currentProductStore = persistedStore;
    productStore.productStores = [];

    await productStore.fetchProductStores();

    expect(productStore.getCurrentProductStore).toEqual(persistedStore);
  });

  it('falls back to the first current catalog store when the saved preference is invalid', async () => {
    vi.mocked(api).mockResolvedValue({
      data: [{ preferenceValue: 'REMOVED_STORE' }],
    });

    const productStore = useProductStore();
    productStore.productStores = [
      { productStoreId: 'STORE_A', storeName: 'Store A' },
      { productStoreId: 'STORE_B', storeName: 'Store B' },
    ];
    productStore.currentProductStore = { productStoreId: 'REMOVED_STORE', storeName: 'Removed Store' };

    await productStore.fetchProductStorePreference();

    expect(productStore.getCurrentProductStore).toEqual({
      productStoreId: 'STORE_A',
      storeName: 'Store A',
    });
  });

  it('clears a persisted selection after a successful empty catalog refresh', async () => {
    vi.mocked(api).mockResolvedValue({ data: [] });

    const productStore = useProductStore();
    productStore.productStores = [{ productStoreId: 'REMOVED_STORE', storeName: 'Removed Store' }];
    productStore.currentProductStore = { productStoreId: 'REMOVED_STORE', storeName: 'Removed Store' };

    await productStore.fetchProductStores();

    expect(productStore.getProductStores).toEqual([]);
    expect(productStore.getCurrentProductStore).toEqual({});
  });
});
