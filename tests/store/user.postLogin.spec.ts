import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@/store/user';

const mocks = vi.hoisted(() => ({
  initializeProductStoreSelection: vi.fn(),
  isProductStoreSessionActive: vi.fn(),
  loadInitialSeedData: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  productStoreSessionVersion: 0,
  resetProductStoreSession: vi.fn(),
  startProductStoreSession: vi.fn(),
  productStore: {
    getProductStores: [
      { productStoreId: 'STORE_A', storeName: 'Store A' },
      { productStoreId: 'STORE_B', storeName: 'Store B' },
    ],
  } as any,
}));

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: {
    getMaargURL: () => 'https://maarg.example/rest/s1/',
    hasError: () => false,
  },
  cookieHelper: () => ({
    get: () => 'demo-oms',
  }),
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
  translate: (message: string) => message,
}));

vi.mock('@common/composables/useAuth', () => ({
  useAuth: () => ({
    updateUserId: vi.fn(),
    clearAuth: vi.fn(),
  }),
}));

vi.mock('@/utils', () => ({
  showToast: vi.fn(),
}));

vi.mock('@/store/productStore', () => ({
  useProductStore: () => ({
    ...mocks.productStore,
    initializeProductStoreSelection: mocks.initializeProductStoreSelection,
    isProductStoreSessionActive: mocks.isProductStoreSessionActive,
    resetProductStoreSession: mocks.resetProductStoreSession,
    startProductStoreSession: mocks.startProductStoreSession,
  }),
}));

vi.mock('@/store/seed', () => ({
  useSeedStore: () => ({
    loadInitialSeedData: mocks.loadInitialSeedData,
    resetSeedData: vi.fn(),
  }),
}));

vi.mock('@/store/orderDetail', () => ({
  useOrderDetailStore: () => ({
    reset: vi.fn(),
  }),
}));

vi.mock('@/store/productCache', () => ({
  useProductCacheStore: () => ({
    reset: vi.fn(),
  }),
}));

describe('fresh-login product store bootstrap', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    mocks.initializeProductStoreSelection.mockReset();
    mocks.isProductStoreSessionActive.mockReset().mockImplementation(
      (_userId: string, _oms: string, sessionVersion: number) => (
        sessionVersion === mocks.productStoreSessionVersion
      )
    );
    mocks.loadInitialSeedData.mockReset().mockResolvedValue(undefined);
    mocks.loggerError.mockReset();
    mocks.loggerWarn.mockReset();
    mocks.productStoreSessionVersion = 0;
    mocks.resetProductStoreSession.mockReset().mockImplementation(() => {
      mocks.productStoreSessionVersion += 1;
    });
    mocks.startProductStoreSession.mockReset().mockImplementation(() => {
      mocks.productStoreSessionVersion += 1;
      return mocks.productStoreSessionVersion;
    });
  });

  it('fails open after ten seconds and loads seed data when late initialization finishes', async () => {
    let resolveInitialization: () => void = () => undefined;
    mocks.initializeProductStoreSelection.mockImplementation(() => new Promise<void>((resolve) => {
      resolveInitialization = resolve;
    }));

    const userStore = useUserStore();
    vi.spyOn(userStore, 'fetchUserProfile').mockImplementation(async () => {
      userStore.current = { userId: 'USER' };
    });
    vi.spyOn(userStore, 'fetchPermissions').mockResolvedValue(undefined);

    let postLoginSettled = false;
    const postLogin = userStore.postLogin().then(() => {
      postLoginSettled = true;
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.initializeProductStoreSelection).toHaveBeenCalledOnce();
    expect(mocks.startProductStoreSession).toHaveBeenCalledWith('USER', 'demo-oms');
    expect(mocks.startProductStoreSession.mock.invocationCallOrder[0]).toBeLessThan(
      (userStore.fetchPermissions as any).mock.invocationCallOrder[0]
    );
    await vi.advanceTimersByTimeAsync(9_999);
    expect(postLoginSettled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await postLogin;

    expect(postLoginSettled).toBe(true);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Product store initialization is still pending after 10000ms'
    );
    expect(mocks.loadInitialSeedData).not.toHaveBeenCalled();

    resolveInitialization();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.loadInitialSeedData).toHaveBeenCalledWith(['STORE_A', 'STORE_B']);
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });

  it('invalidates persisted product-store state during logout', async () => {
    const userStore = useUserStore();

    await userStore.postLogout();

    expect(mocks.resetProductStoreSession).toHaveBeenCalledOnce();
  });

  it('invalidates product-store writes before the remote logout request begins', async () => {
    const userStore = useUserStore();

    await userStore.preLogout();

    expect(mocks.resetProductStoreSession).toHaveBeenCalledOnce();
  });

  it('does not load late seed data into another OMS session', async () => {
    let resolveInitialization: () => void = () => undefined;
    mocks.initializeProductStoreSelection.mockImplementation(() => new Promise<void>((resolve) => {
      resolveInitialization = resolve;
    }));

    const userStore = useUserStore();
    vi.spyOn(userStore, 'fetchUserProfile').mockImplementation(async () => {
      userStore.current = { userId: 'USER' };
    });
    vi.spyOn(userStore, 'fetchPermissions').mockResolvedValue(undefined);

    const postLogin = userStore.postLogin();
    await vi.advanceTimersByTimeAsync(10_000);
    await postLogin;

    userStore.oms = 'other-oms';
    resolveInitialization();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.loadInitialSeedData).not.toHaveBeenCalled();
  });

  it('does not let a timed-out login load seed data after same-user same-OMS reauthentication', async () => {
    let resolveFirstInitialization: () => void = () => undefined;
    mocks.initializeProductStoreSelection
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resolveFirstInitialization = resolve;
      }))
      .mockResolvedValueOnce(undefined);

    const userStore = useUserStore();
    vi.spyOn(userStore, 'fetchUserProfile').mockImplementation(async () => {
      userStore.current = { userId: 'USER' };
    });
    vi.spyOn(userStore, 'fetchPermissions').mockResolvedValue(undefined);

    const firstLogin = userStore.postLogin();
    await vi.advanceTimersByTimeAsync(10_000);
    await firstLogin;
    expect(mocks.loadInitialSeedData).not.toHaveBeenCalled();

    await userStore.preLogout();
    await userStore.postLogout();
    await userStore.postLogin();

    expect(mocks.loadInitialSeedData).toHaveBeenCalledTimes(1);
    expect(mocks.loadInitialSeedData).toHaveBeenCalledWith(['STORE_A', 'STORE_B']);

    resolveFirstInitialization();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.loadInitialSeedData).toHaveBeenCalledTimes(1);
  });
});
