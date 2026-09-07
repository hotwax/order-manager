import { describe, expect, it } from 'vitest';
import { ORDER_MANAGER_SYNC_CATALOG } from '@/config/appSyncConfig';
import { COMMON_DB_SCHEMA, geoProjection, shopifyShopProjection } from '@common/db';

describe('seed projections', () => {
  it('projects the shopify fields OrderDetail reads for the admin link', () => {
    expect(Object.keys(shopifyShopProjection.fields)).toEqual(
      expect.arrayContaining(['shopId', 'productStoreId', 'name', 'myshopifyDomain', 'domain']),
    );
  });

  it('does not project geo polygon geometry', () => {
    expect(Object.keys(geoProjection.fields)).not.toContain('wellKnownText');
  });

  it('projects every geo field the seed getters read', () => {
    expect(Object.keys(geoProjection.fields)).toEqual(
      expect.arrayContaining(['geoId', 'geoName', 'geoCode', 'geoCodeAlpha2', 'geoTypeEnumId']),
    );
  });

  it('every catalog table exists in the schema', () => {
    for (const entry of ORDER_MANAGER_SYNC_CATALOG) {
      expect(COMMON_DB_SCHEMA[entry.table], `missing schema for ${entry.table}`).toBeDefined();
    }
  });
});
