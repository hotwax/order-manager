import { readFileSync } from 'fs';
import { resolve } from 'path';
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

describe('menu footer layout', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');

  it('delegates the whole footer to the shared accxui component', () => {
    // The instance/store/timezone footer is identical across apps, so it lives in
    // common/components/DxpOmsInstanceFooter.vue rather than being rewritten per app.
    expect(source).toContain('<DxpOmsInstanceFooter');
    expect(source).toContain("import { commonUtil, DxpOmsInstanceFooter, translate } from '@common';");
    // None of the hand-rolled footer markup should survive here.
    expect(source).not.toContain('<ion-footer');
    expect(source).not.toContain('<ion-select');
    expect(source).not.toContain('translate("Product Store")');
  });

  it('feeds the component this app\'s own instance and store state', () => {
    expect(source).toContain(':instance-label="omsInstanceLabel()"');
    expect(source).toContain(':product-stores="productStores"');
    expect(source).toContain(':current-product-store-id="currentProductStore?.productStoreId"');
    // Timezone, browser mismatch, and clock are internalized in DxpOmsInstanceFooter
    expect(source).not.toContain(':time-zone=');
    expect(source).not.toContain(':time-zone-mismatched=');
    expect(source).not.toContain(':zone-time=');
  });

  it('takes the selected store id from the event, not a raw CustomEvent', () => {
    // The shared component emits the id itself, so the handler no longer digs into event.detail.
    expect(source).toContain('@update:product-store="setCurrentProductStore"');
    expect(source).toContain('function setCurrentProductStore(productStoreId: string) {');
    expect(source).not.toContain('event.detail.value');
  });

  it('drops the Ionic imports the footer used to need', () => {
    const ionicImport = source.slice(source.indexOf("from '@ionic/vue'") - 400, source.indexOf("from '@ionic/vue'"));
    // IonToolbar stays — the menu header still uses it.
    ['IonFooter', 'IonNote', 'IonSelect', 'IonSelectOption'].forEach((name) => {
      expect(ionicImport).not.toContain(name);
    });
    expect(ionicImport).toContain('IonToolbar');
  });
});
