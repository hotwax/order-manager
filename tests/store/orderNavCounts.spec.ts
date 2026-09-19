import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useOrderStore } from '@/store/order';

const { fetchBrokeringCount } = vi.hoisted(() => ({
  fetchBrokeringCount: vi.fn(),
}));

vi.mock('@/services/navCounts', () => ({
  queueCountFetchers: { brokering: fetchBrokeringCount },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('order nav-count request scope', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchBrokeringCount.mockReset();
  });

  it('does not let an older store count overwrite the newest badge', async () => {
    const older = deferred<number>();
    const newer = deferred<number>();
    fetchBrokeringCount
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const store = useOrderStore();
    const olderLoad = store.primeNavCounts('STORE_A');
    const newerLoad = store.primeNavCounts('STORE_B');

    newer.resolve(22);
    await newerLoad;
    older.resolve(11);
    await olderLoad;

    expect(store.navCounts.brokering).toBe(22);
  });
});
