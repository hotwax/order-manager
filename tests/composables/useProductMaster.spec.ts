import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runSolrQuery = vi.hoisted(() => vi.fn());
const cacheStore = vi.hoisted(() => ({
  ensureHydrated: vi.fn(),
  getProduct: vi.fn(),
  upsert: vi.fn()
}));

vi.mock('@common', () => ({
  commonUtil: {
    hasError: vi.fn(() => false)
  },
  logger: {
    error: vi.fn()
  },
  useSolrSearch: () => ({
    runSolrQuery
  })
}));

vi.mock('@/store/productCache', () => ({
  useProductCacheStore: () => cacheStore
}));

import { useProductMaster } from '@/composables/useProductMaster';

const now = Date.UTC(2026, 5, 29, 0, 0, 0);
const oneDay = 24 * 60 * 60 * 1000;

function cachedProduct(productId: string, updatedAt: number) {
  return {
    productId,
    productName: productId,
    sku: productId,
    parentProductName: '',
    internalName: productId,
    mainImageUrl: '',
    goodIdentifications: [],
    updatedAt
  };
}

function mockProductResponse(productIds: string[]) {
  runSolrQuery.mockResolvedValue({
    data: {
      response: {
        docs: productIds.map((productId) => ({
          productId,
          productName: `${productId} name`,
          goodIdentifications: []
        }))
      }
    }
  });
}

describe('useProductMaster cache freshness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    runSolrQuery.mockReset();
    cacheStore.ensureHydrated.mockResolvedValue(undefined);
    cacheStore.getProduct.mockReset();
    cacheStore.upsert.mockResolvedValue(undefined);
    useProductMaster().init({ staleMs: oneDay });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefetches stale cached products and skips fresh cached products', async () => {
    cacheStore.getProduct.mockImplementation((productId: string) => {
      if (productId === 'fresh') return cachedProduct(productId, now - 1000);
      if (productId === 'stale') return cachedProduct(productId, now - oneDay - 1000);
      return undefined;
    });
    mockProductResponse(['stale']);

    await useProductMaster().prefetch(['fresh', 'stale']);

    expect(runSolrQuery).toHaveBeenCalledTimes(1);
    expect(runSolrQuery.mock.calls[0][0].json.filter).toContain('productId:(stale)');
    expect(cacheStore.upsert).toHaveBeenCalledWith([
      expect.objectContaining({ productId: 'stale', updatedAt: now })
    ]);
  });

  it('returns fresh cached products without querying Solr', async () => {
    const product = cachedProduct('fresh', now - 1000);
    cacheStore.getProduct.mockReturnValue(product);

    const result = await useProductMaster().getById('fresh');

    expect(result).toEqual({ product, status: 'hit' });
    expect(runSolrQuery).not.toHaveBeenCalled();
  });

  it('refreshes stale cached products on single lookup', async () => {
    cacheStore.getProduct
      .mockReturnValueOnce(cachedProduct('stale', now - oneDay - 1000))
      .mockReturnValueOnce(cachedProduct('stale', now));
    mockProductResponse(['stale']);

    const result = await useProductMaster().getById('stale');

    expect(runSolrQuery).toHaveBeenCalledTimes(1);
    expect(cacheStore.upsert).toHaveBeenCalledWith([
      expect.objectContaining({ productId: 'stale', updatedAt: now })
    ]);
    expect(result).toEqual({
      product: expect.objectContaining({ productId: 'stale', updatedAt: now }),
      status: 'refreshed'
    });
  });
});
