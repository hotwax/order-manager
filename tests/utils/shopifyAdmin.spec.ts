import { describe, expect, it } from 'vitest';
import { shopifyAdminOrderUrl, shopifyStoreHandle, singleShopIdForProductStore } from '@/utils/shopifyAdmin';

describe('shopifyStoreHandle', () => {
  it('extracts the handle from a myshopify domain', () => {
    expect(shopifyStoreHandle('coolstore.myshopify.com')).toBe('coolstore');
  });

  it('strips protocol and trailing path, lowercases', () => {
    expect(shopifyStoreHandle('HTTPS://CoolStore.myshopify.com/admin')).toBe('coolstore');
  });

  it('returns a bare handle as-is when no myshopify suffix is present', () => {
    expect(shopifyStoreHandle('coolstore')).toBe('coolstore');
  });

  it('returns empty string for empty/nullish input', () => {
    expect(shopifyStoreHandle('')).toBe('');
    expect(shopifyStoreHandle(null)).toBe('');
    expect(shopifyStoreHandle(undefined)).toBe('');
  });
});

describe('shopifyAdminOrderUrl', () => {
  it('builds the unified admin order URL', () => {
    expect(shopifyAdminOrderUrl('coolstore.myshopify.com', '5432109876')).toBe(
      'https://admin.shopify.com/store/coolstore/orders/5432109876'
    );
  });

  it('encodes the order id', () => {
    expect(shopifyAdminOrderUrl('coolstore.myshopify.com', 'gid/123')).toBe(
      'https://admin.shopify.com/store/coolstore/orders/gid%2F123'
    );
  });

  it('returns empty string when the domain is missing', () => {
    expect(shopifyAdminOrderUrl('', '5432109876')).toBe('');
    expect(shopifyAdminOrderUrl(null, '5432109876')).toBe('');
  });

  it('returns empty string when the order id is missing', () => {
    expect(shopifyAdminOrderUrl('coolstore.myshopify.com', '')).toBe('');
    expect(shopifyAdminOrderUrl('coolstore.myshopify.com', null)).toBe('');
  });
});

describe('singleShopIdForProductStore (interim fallback)', () => {
  const shops = [
    { shopId: '10000', productStoreId: 'STORE_A' },
    { shopId: '10010', productStoreId: 'STORE_B' },
    { shopId: '10020', productStoreId: 'STORE_B' },
  ];

  it('returns the shopId when exactly one shop maps to the store', () => {
    expect(singleShopIdForProductStore(shops, 'STORE_A')).toBe('10000');
  });

  it('returns empty string when multiple shops map to the store (ambiguous)', () => {
    expect(singleShopIdForProductStore(shops, 'STORE_B')).toBe('');
  });

  it('returns empty string when no shop maps to the store', () => {
    expect(singleShopIdForProductStore(shops, 'STORE_Z')).toBe('');
  });

  it('returns empty string for a missing product store or shop list', () => {
    expect(singleShopIdForProductStore(shops, '')).toBe('');
    expect(singleShopIdForProductStore(shops, null)).toBe('');
    expect(singleShopIdForProductStore([], 'STORE_A')).toBe('');
  });

  it('ignores null/undefined entries in the shop list', () => {
    expect(singleShopIdForProductStore([null, undefined, { shopId: '10000', productStoreId: 'STORE_A' }], 'STORE_A')).toBe('10000');
  });
});
