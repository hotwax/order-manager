import { describe, expect, it } from 'vitest';
import { shopifyAdminOrderUrl, shopifyStoreHandle } from '@/utils/shopifyAdmin';

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
