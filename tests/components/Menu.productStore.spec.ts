import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, shallowMount } from '@vue/test-utils';
import Menu from '@/components/layout/Menu.vue';
import { useProductStore } from '@/store/productStore';
import { api } from '@common';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    getCurrentTime: () => '6:00 AM',
    getOmsURL: () => 'https://rails-oms.hotwax.io/api/',
    hasError: () => false,
  },
  logger: {
    error: vi.fn(),
  },
  translate: (message: string) => message,
  useEmbeddedAppStore: () => ({}),
  useSolrSearch: () => ({}),
}));

vi.mock('@common/composables/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: { value: true } }),
}));

vi.mock('@/router', () => ({
  default: { currentRoute: { value: { path: '/funnel' } } },
}));

vi.mock('@/store/order', () => ({
  useOrderStore: () => ({ navCounts: {} }),
}));

vi.mock('@/store/user', () => ({
  useUserStore: () => ({
    current: { userId: 'USER' },
    getUserProfile: {},
    getUserTimeZone: 'America/Los_Angeles',
    hasPermission: () => false,
  }),
}));

describe('menu product-store refresh', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api).mockImplementation((request: any) => {
      if (request.url === '/admin/productStores') {
        return Promise.resolve({ data: [{ productStoreId: 'STORE', storeName: 'Demo Store' }] });
      }
      if (request.url === 'admin/user/preferences') {
        return Promise.resolve({ data: [{ preferenceValue: 'STORE' }] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes a persisted catalog and publishes current metadata on authenticated mount', async () => {
    const productStore = useProductStore();
    productStore.productStores = [{ productStoreId: 'STORE', storeName: 'gorjana' }];
    productStore.currentProductStore = { productStoreId: 'STORE', storeName: 'gorjana' };

    const wrapper = shallowMount(Menu);
    await flushPromises();

    expect(productStore.getCurrentProductStore).toEqual({
      productStoreId: 'STORE',
      storeName: 'Demo Store',
    });

    wrapper.unmount();
  });
});
