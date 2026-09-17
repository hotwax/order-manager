import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSyncRegistry, commonDomains, getAllSyncDomains, registerDomains } from '@common/db';
import { orderManagerDb } from '@/db/orderManagerDb';

vi.mock('@common', () => ({
  api: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  commonUtil: { getMaargURL: () => 'http://localhost:8080/rest/s1', getStatusColor: () => 'medium' },
}));

/**
 * Replaces the intent of the deleted tests/store/seed.spec.ts: seed data comes from bounded
 * REST endpoints, never a generic entity endpoint. Those URLs now live in the sync domain
 * registry rather than in a Pinia store's loaders.
 */
describe('seed sync domains', () => {
  beforeEach(() => {
    clearSyncRegistry();
    registerDomains(Object.values(commonDomains));
  });

  const domains = () => getAllSyncDomains();
  const names = () => domains().map((d) => d.name);

  it('registers a domain for every seed dataset the app reads', () => {
    expect(names()).toEqual(
      expect.arrayContaining([
        'productStore', 'status', 'enum', 'enumType', 'facility', 'facilityType',
        'geo', 'geoAssoc', 'carrier', 'shipmentMethodType', 'carrierShipmentMethod',
        'statusFlowTransition', 'shopifyShop', 'shopifyShopLocation',
      ]),
    );
  });

  it('never fetches seed data through a generic entity endpoint', () => {
    const serialized = JSON.stringify(domains(), (_k, v) => (typeof v === 'function' ? v.toString() : v));
    expect(serialized).not.toContain('oms/entityData');
    expect(serialized).not.toContain('oms/dataDocumentView');
  });
});
