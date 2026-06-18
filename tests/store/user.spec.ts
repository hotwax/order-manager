import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@/store/user';
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

describe('user store', () => {
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

    const userStore = useUserStore();
    await userStore.fetchProductStores();

    expect(api).toHaveBeenCalledWith({
      url: 'admin/productStores',
      method: 'get',
      baseURL: 'https://maarg.example/rest/s1/',
    });
    expect(userStore.current.stores).toEqual([
      { productStoreId: 'STORE_A', storeName: 'Store A' },
      { productStoreId: 'STORE_B', storeName: 'Store B' },
      { productStoreId: '', storeName: 'None' },
    ]);
    expect(userStore.currentProductStore).toEqual({ productStoreId: 'STORE_A', storeName: 'Store A' });
  });
});
