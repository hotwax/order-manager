import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProductMaster } from '@/composables/useProductMaster';
import { useProductStore } from '@/store/productStore';

// The real getProductIdentificationValue reads the named field off the product and throws on
// undefined — the throw is the behaviour the helper exists to absorb, so it is reproduced here.
vi.mock('@common', () => ({
  api: vi.fn(),
  logger: { error: vi.fn(), info: vi.fn() },
  useSolrSearch: () => ({ runSolrQuery: vi.fn() }),
  commonUtil: {
    getProductIdentificationValue: (idKey: string, product: any) => {
      if (product === undefined || product === null) throw new TypeError('Cannot convert undefined to object');
      // mirrors commonUtil: a goodIdentifications entry for the key wins over the static field
      const identification = product.goodIdentifications?.find((entry: any) =>
        typeof entry === 'string' ? entry.startsWith(idKey + '/') : entry?.type === idKey);
      if (identification) {
        return typeof identification === 'string' ? identification.split('/')[1] : identification.value;
      }
      return product[idKey] || '';
    }
  }
}));

describe('product identity honours the operator preference', () => {
  const { primaryId, secondaryId } = useProductMaster();

  // The pref lives at settings.productIdentifier.productIdentificationPref; the getter the
  // helper reads is a view onto it, so the test sets the state the app actually persists.
  const setPref = (primary: string, secondary: string) => {
    (useProductStore() as any).settings.productIdentifier.productIdentificationPref =
      { primaryId: primary, secondaryId: secondary };
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    setPref('internalName', 'sku');
  });

  it('reads the configured identifier rather than a hardcoded field', () => {
    const product = { productId: '123', productName: 'Giovanna Top', internalName: 'GIO-TOP-BLK', sku: '853D-362E' };
    expect(primaryId(product)).toBe('GIO-TOP-BLK');
    expect(secondaryId(product)).toBe('853D-362E');
  });

  it('follows the store when the store changes its mind', () => {
    setPref('parentProductName', 'productId');
    const product = { productId: '123', parentProductName: 'Giovanna Top', internalName: 'GIO-TOP-BLK' };
    expect(primaryId(product)).toBe('Giovanna Top');
    expect(secondaryId(product)).toBe('123');
  });

  // Settings offers more than internalName/SKU: the other static options, and the fetched
  // good-identification types. A product shape missing any of them reads as "no value" and
  // silently falls through to the call site's fallback.
  it('resolves every static option the operator can pick', () => {
    const product = {
      productId: '123',
      groupId: 'GRP-9',
      groupName: 'Giovanna',
      primaryProductCategoryName: 'Tops',
      title: 'Giovanna Top - Black'
    };
    (['groupId', 'groupName', 'primaryProductCategoryName', 'title'] as const).forEach((option) => {
      setPref(option, 'productId');
      expect(primaryId(product, ['fallback'])).toBe((product as any)[option]);
    });
  });

  it('resolves a fetched good-identification type such as UPC', () => {
    setPref('UPCA', 'productId');
    const product = { productId: '123', goodIdentifications: ['UPCA/012345678905'] };
    expect(primaryId(product, ['fallback'])).toBe('012345678905');
  });

  // A row can reach these helpers before the product cache has warmed, and a custom line item
  // never has a catalog product at all.
  it('falls back in the order the call site gave, only when the preference has no value', () => {
    const uncached = { productId: '123', productName: 'Giovanna Top' };
    expect(primaryId(uncached, ['Shopify line title', 'Item'])).toBe('Shopify line title');
    expect(primaryId(uncached, [undefined, '', 'Item'])).toBe('Item');
  });

  it('does not let a fallback win while the preferred identifier has a value', () => {
    const product = { productId: '123', internalName: 'GIO-TOP-BLK' };
    expect(primaryId(product, ['Shopify line title'])).toBe('GIO-TOP-BLK');
  });

  it('survives no product at all instead of throwing', () => {
    expect(() => primaryId(undefined)).not.toThrow();
    expect(primaryId(undefined, ['Return item'])).toBe('Return item');
    expect(primaryId(null)).toBe('');
    expect(secondaryId(undefined)).toBe('');
  });
});
