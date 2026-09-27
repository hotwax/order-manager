import { describe, expect, it, vi } from 'vitest';
import { useProductIdentity } from '@/composables/useProductIdentity';

const { products } = vi.hoisted(() => ({
  products: { SHIRT: { sku: 'SHIRT-M', productName: 'M', mainImageUrl: 'shirt.jpg' } } as Record<string, any>,
}));

vi.mock('@common', () => ({
  commonUtil: { getProductIdentificationValue: (prefId: string, product: any) => product[prefId] },
}));
vi.mock('@/store/productCache', () => ({ useProductCacheStore: () => ({ getProduct: (productId: string) => products[productId] }) }));
vi.mock('@/store/productStore', () => ({
  useProductStore: () => ({ getProductIdentificationPref: { primaryId: 'sku', secondaryId: 'productName' } }),
}));

describe('image preview', () => {
  it('titles the image by the primary identifier, not the product name', () => {
    expect(useProductIdentity().imagePreview('SHIRT')).toEqual({ mainImageUrl: 'shirt.jpg', productName: 'SHIRT-M' });
  });

  it('falls back to the product id while the product is not cached', () => {
    expect(useProductIdentity().imagePreview('PANTS')).toEqual({ mainImageUrl: undefined, productName: 'PANTS' });
  });
});
