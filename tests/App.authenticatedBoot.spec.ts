import { readFileSync } from 'fs';
import { resolve } from 'path';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App.vue';

const mocks = vi.hoisted(() => ({
  authenticated: true,
  createLoader: vi.fn(),
  fetchPermissions: vi.fn(),
  initializeProductStoreSelection: vi.fn(),
  loadInitialSeedData: vi.fn(),
  loaderDismiss: vi.fn(),
  loaderPresent: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@ionic/vue', () => {
  return {
    IonApp: { template: '<main><slot /></main>' },
    IonProgressBar: { template: '<div data-testid="bootstrap-progress" />' },
    IonRouterOutlet: { template: '<div data-testid="router-outlet" />' },
    IonSplitPane: { template: '<div><slot /></div>' },
    loadingController: {
      create: mocks.createLoader,
    },
  };
});

vi.mock('@common', () => ({
  emitter: {
    on: vi.fn(),
    off: vi.fn(),
  },
  FastTravel: { template: '<div />' },
  logger: {
    warn: mocks.loggerWarn,
  },
  translate: (message: string) => message,
}));

vi.mock('@common/composables/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: {
      get value() {
        return mocks.authenticated;
      },
    },
  }),
}));

vi.mock('@/router', () => ({
  default: {
    currentRoute: {
      value: {
        name: 'Funnel',
      },
    },
  },
}));

vi.mock('@/store/productStore', () => ({
  useProductStore: () => ({
    initializeProductStoreSelection: mocks.initializeProductStoreSelection,
  }),
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: () => ({
    loadInitialSeedData: mocks.loadInitialSeedData,
  }),
}));

vi.mock('@/store/user', () => ({
  useUserStore: () => ({
    current: {
      stores: [],
    },
    fetchPermissions: mocks.fetchPermissions,
    getUserProfile: {},
  }),
}));

describe('authenticated app boot', () => {
  beforeEach(() => {
    mocks.authenticated = true;
    mocks.fetchPermissions.mockReset().mockResolvedValue(undefined);
    mocks.initializeProductStoreSelection.mockReset().mockResolvedValue(undefined);
    mocks.loadInitialSeedData.mockReset().mockResolvedValue(undefined);
    mocks.loggerWarn.mockReset();
    mocks.loaderDismiss.mockReset();
    mocks.loaderPresent.mockReset().mockResolvedValue(undefined);
    mocks.createLoader.mockReset().mockResolvedValue({
      dismiss: mocks.loaderDismiss,
      present: mocks.loaderPresent,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts the app before restored-session product-store initialization', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8');
    const mainSource = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
    const menuSource = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');

    expect(appSource).toContain('productStore.initializeProductStoreSelection()');
    expect(mainSource).not.toContain('initializeProductStoreSelection');
    expect(menuSource).not.toContain('productStore.fetchProductStores()');
    expect(menuSource).not.toContain('productStore.fetchProductStorePreference()');
  });

  it('shows a bootstrap state instead of mounting authenticated routes while initialization is pending', async () => {
    let resolveInitialization: () => void = () => undefined;
    mocks.initializeProductStoreSelection.mockImplementation(() => new Promise<void>((resolve) => {
      resolveInitialization = resolve;
    }));

    const wrapper = mount(App, {
      global: {
        stubs: {
          Menu: true,
        },
      },
    });
    await flushPromises();

    expect(mocks.initializeProductStoreSelection).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="product-store-bootstrap"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="bootstrap-progress"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="router-outlet"]').exists()).toBe(false);

    resolveInitialization();
    await flushPromises();

    await vi.waitFor(() => {
      expect((wrapper.vm as any).productStoreBootstrapPending).toBe(false);
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="product-store-bootstrap"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="router-outlet"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('fails open to authenticated routes after a bounded visible bootstrap wait', async () => {
    vi.useFakeTimers();
    mocks.initializeProductStoreSelection.mockReturnValue(new Promise(() => undefined));

    const wrapper = mount(App, {
      global: {
        stubs: {
          Menu: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="product-store-bootstrap"]').exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="product-store-bootstrap"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="router-outlet"]').exists()).toBe(true);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Product store initialization is still pending after 10000ms'
    );
    wrapper.unmount();
  });
});
