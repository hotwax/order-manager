import { api } from "@common";
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const calls = vi.hoisted(() => [] as string[]);
const clearAuth = vi.hoisted(() => vi.fn());

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: { hasError: () => false, showToast: vi.fn(), getMaargURL: () => "https://maarg.test/rest/s1/" },
  cookieHelper: () => ({ get: () => '' }),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  translate: (message: string) => message,
}));
vi.mock("@common/composables/useAuth", () => ({ useAuth: () => ({ clearAuth, updateUserId: vi.fn() }) }));
vi.mock('@/utils', () => ({ showToast: vi.fn() }));
vi.mock('@/store/orderDetail', () => ({ useOrderDetailStore: () => ({ reset: vi.fn() }) }));
vi.mock('@/store/productCache', () => ({ useProductCacheStore: () => ({ reset: vi.fn() }) }));
vi.mock('@/store/productStore', () => ({
  useProductStore: () => ({
    fetchProductStores: async () => { calls.push('productStores'); },
    fetchProductStorePreference: async () => { calls.push('storePreference'); },
  }),
}));
vi.mock('@/services/appDbSync', () => ({
  stopAppDbSync: vi.fn(async () => { calls.push('wipe'); }),
  startAppDbSync: vi.fn(async () => { calls.push('start'); }),
}));

import { useUserStore } from '@/store/user';

/**
 * A session that expires while nothing is requesting never reaches `postLogout`, so the local
 * database survives into the next login. `postLogin` therefore wipes it before anything reads it,
 * and only then starts the sync.
 */
describe('postLogin', () => {
  beforeEach(() => {
    calls.length = 0;
    clearAuth.mockClear();
    setActivePinia(createPinia());
  });

  it.each([new Error("Network Error"), { response: { status: 500 } }])("rejects a profile failure without clearing shared auth", async error => {
    vi.mocked(api).mockRejectedValueOnce(error);
    const store = useUserStore();
    await expect(store.fetchUserProfile()).rejects.toBe(error);
    expect(store.fetchStatus.profile).toBe("error");
    expect(clearAuth).not.toHaveBeenCalled();
  });

  it('wipes the local database before anything reads it, then starts the sync', async () => {
    const store = useUserStore();
    store.fetchUserProfile = vi.fn(async () => { calls.push('profile'); }) as any;
    store.fetchPermissions = vi.fn(async () => { calls.push('permissions'); }) as any;

    await store.postLogin();

    expect(calls).toEqual(['wipe', 'profile', 'permissions', 'productStores', 'storePreference', 'start']);
  });
});
