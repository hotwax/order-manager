import { describe, expect, it } from 'vitest';
import { isSameProduct } from '@/utils/productIdentity';

describe('isSameProduct', () => {
  const source = {
    productId: 'SKU-21822',
    sku: '21822',
    internalName: 'Gold-Plated',
  };

  it('matches the source product by product ID', () => {
    expect(isSameProduct(source, { productId: 'sku-21822' })).toBe(true);
  });

  it('matches an internal search result by source SKU', () => {
    expect(isSameProduct(source, { productId: '45080013701164', sku: '21822' })).toBe(true);
  });

  it('matches by normalized internal name', () => {
    expect(isSameProduct(source, { productId: '45080013701164', internalName: ' gold-plated ' })).toBe(true);
  });

  it('does not match a different product', () => {
    expect(isSameProduct(source, { productId: '45080013701165', sku: '21823' })).toBe(false);
  });
});
