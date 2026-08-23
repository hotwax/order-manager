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
});
