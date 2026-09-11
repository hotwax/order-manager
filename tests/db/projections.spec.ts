import { describe, expect, it } from 'vitest';
import { commonSchema } from '@common/db';

const geoFields = commonSchema.entities.geos.fields;
const shopifyShopFields = commonSchema.entities.shopifyShops.fields;

describe('seed projections', () => {
  it('projects the shopify fields OrderDetail reads for the admin link', () => {
    expect(Object.keys(shopifyShopFields)).toEqual(
      expect.arrayContaining(['shopId', 'productStoreId', 'name', 'myshopifyDomain', 'domain']),
    );
  });

  it('does not project geo polygon geometry', () => {
    expect(Object.keys(geoFields)).not.toContain('wellKnownText');
  });

  it('projects every geo field the seed getters read', () => {
    expect(Object.keys(geoFields)).toEqual(
      expect.arrayContaining(['geoId', 'geoName', 'geoCode', 'geoCodeAlpha2', 'geoTypeEnumId']),
    );
  });
});
