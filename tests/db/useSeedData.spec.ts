import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseDB, commonSchema, dbClient } from '@common/db';
import { setOmsInstanceResolver } from '@/db/orderManagerDb';

let oms = '';
let n = 0;

// Only getStatusColor is still needed from @common; the OMS instance arrives via the
// resolver the app registers at boot.
vi.mock('@common', () => ({
  commonUtil: { getStatusColor: () => 'medium' },
}));

async function seedDb(): Promise<void> {
  oms = `useSeedDataTest-${n++}`;
  setOmsInstanceResolver(() => oms);
  const db = new BaseDB(`${oms}-OrderManagerDB`, commonSchema.stores);
  await db.open();
  const c = dbClient(db);
  await c.entity('statuses').bulkPut([
    { statusId: 'ORDER_APPROVED', statusTypeId: 'ORDER_STATUS', description: 'Approved', statusAge: 5, syncedAt: 1 },
    { statusId: 'ORDER_CREATED', statusTypeId: 'ORDER_STATUS', description: 'Created', syncedAt: 1 },
    { statusId: 'RETURN_ACCEPTED', statusTypeId: 'RETURN_STATUS', description: 'Accepted', syncedAt: 1 },
  ]);
  await c.entity('enums').bulkPut([
    { enumId: 'WEB_CHANNEL', enumTypeId: 'ORDER_SALES_CHANNEL', description: 'Web', syncedAt: 1 },
    { enumId: 'POS', enumTypeId: 'ORDER_SALES_CHANNEL', description: 'Point of sale', syncedAt: 1 },
    { enumId: 'WE_PICK', enumTypeId: 'WePurposeChild', description: 'Picking', syncedAt: 1 },
    { enumId: 'ID_SHOPIFY', enumTypeId: 'ORDER_IDENTITY', description: 'Shopify order', syncedAt: 1 },
  ]);
  await c.entity('enumTypes').bulkPut([{ enumTypeId: 'WePurposeChild', parentTypeId: 'WorkEffortPurposeType', syncedAt: 1 }]);
  await c.entity('facilities').bulkPut([{ facilityId: 'F1', facilityName: 'Main Warehouse', facilityTypeId: 'WAREHOUSE', syncedAt: 1 }]);
  await c.entity('facilityTypes').bulkPut([{ facilityTypeId: 'WAREHOUSE', parentTypeId: 'PHYSICAL', syncedAt: 1 }]);
  await c.entity('geos').bulkPut([
    { geoId: 'USA', geoName: 'United States', geoCodeAlpha2: 'US', geoTypeEnumId: 'GEOT_COUNTRY', syncedAt: 1 },
    { geoId: 'IND', geoName: 'India', geoCodeAlpha2: 'IN', geoTypeEnumId: 'GEOT_COUNTRY', syncedAt: 1 },
    { geoId: 'USA_CA', geoName: 'California', geoCode: 'CA', geoTypeEnumId: 'GEOT_STATE', syncedAt: 1 },
    { geoId: 'USA_AL', geoName: 'Alabama', geoCode: 'AL', geoTypeEnumId: 'GEOT_STATE', syncedAt: 1 },
  ]);
  await c.entity('geoAssocs').bulkPut([
    { geoAssocKey: 'USA|USA_CA', geoId: 'USA', toGeoId: 'USA_CA', syncedAt: 1 },
    { geoAssocKey: 'USA|USA_AL', geoId: 'USA', toGeoId: 'USA_AL', syncedAt: 1 },
  ]);
  await c.entity('carriers').bulkPut([
    { partyId: 'UPS', groupName: 'UPS', syncedAt: 1 },
    { partyId: 'P1', firstName: 'Ada', lastName: 'Lovelace', syncedAt: 1 },
  ]);
  await c.entity('shipmentMethodTypes').bulkPut([{ shipmentMethodTypeId: 'GROUND', description: 'Ground', syncedAt: 1 }]);
  await c.entity('carrierShipmentMethods').bulkPut([
    { carrierShipmentMethodKey: 'UPS|GROUND', partyId: 'UPS', shipmentMethodTypeId: 'GROUND', syncedAt: 1 },
    { carrierShipmentMethodKey: 'FDX|AIR', partyId: 'FDX', shipmentMethodTypeId: 'AIR', syncedAt: 1 },
  ]);
  await c.entity('statusFlowTransitions').bulkPut([
    { statusFlowId: 'DEFAULT', statusId: 'ORDER_CREATED', toStatusId: 'ORDER_APPROVED', transitionSequence: 2, syncedAt: 1 },
    { statusFlowId: 'DEFAULT', statusId: 'ORDER_CREATED', toStatusId: 'RETURN_ACCEPTED', transitionSequence: 1, syncedAt: 1 },
  ]);
  await c.entity('productStores').bulkPut([{ productStoreId: 'STORE', storeName: 'Demo store', syncedAt: 1 }]);
  await c.entity('productStoreFacilities').bulkPut([
    { storeFacilityKey: 'STORE|F1', productStoreId: 'STORE', facilityId: 'F1', syncedAt: 1 },
    { storeFacilityKey: 'OTHER|F2', productStoreId: 'OTHER', facilityId: 'F2', syncedAt: 1 },
  ]);
}

let seed: ReturnType<typeof import('@common/db').useSeedData>;

describe('useSeedData', () => {
  beforeEach(async () => {
    await seedDb();
    seed = (await import('@common/db')).useSeedData();
  });
  afterEach(() => { oms = ''; });

  it('resolves single labels and falls back to the raw id', async () => {
    expect(await seed.getStatusDescription('ORDER_APPROVED')).toBe('Approved');
    expect(await seed.getStatusDescription('NOPE')).toBe('NOPE');
    expect(await seed.getStatusDescription('')).toBe('');
    expect(await seed.getFacilityName('F1')).toBe('Main Warehouse');
    expect(await seed.getEnumDescription('WEB_CHANNEL')).toBe('Web');
    expect(await seed.getProductStoreName('STORE')).toBe('Demo store');
  });

  it('resolves many labels in one call, keeping unknown ids as themselves', async () => {
    expect(await seed.getStatusDescriptions(['ORDER_APPROVED', 'ORDER_CREATED', 'NOPE']))
      .toEqual({ ORDER_APPROVED: 'Approved', ORDER_CREATED: 'Created', NOPE: 'NOPE' });
    expect(await seed.getStatusDescriptions([])).toEqual({});
    expect(await seed.getFacilityNames(['F1', 'F1'])).toEqual({ F1: 'Main Warehouse' });
  });

  it('reads status ages, singly and in bulk', async () => {
    expect(await seed.getStatusAge('ORDER_APPROVED')).toBe(5);
    expect(await seed.getStatusAge('ORDER_CREATED')).toBe(0);
    expect(await seed.getStatusAges(['ORDER_APPROVED', 'ORDER_CREATED']))
      .toEqual({ ORDER_APPROVED: 5, ORDER_CREATED: 0 });
  });

  it('filters by type', async () => {
    expect(await seed.getStatusItemsByType('ORDER_STATUS')).toHaveLength(2);
    expect(await seed.getEnumsByType('ORDER_SALES_CHANNEL')).toHaveLength(2);
    expect(await seed.getEnumsByType('MISSING')).toEqual([]);
  });

  it('joins enumTypes to enums for a parent type', async () => {
    expect((await seed.getEnumsByParentType('WorkEffortPurposeType')).map((e) => e.enumId)).toEqual(['WE_PICK']);
    expect(await seed.getEnumsByParentType('Unknown')).toEqual([]);
  });

  it('builds carrier names from either name shape', async () => {
    expect(await seed.getCarrierName('UPS')).toBe('UPS');
    expect(await seed.getCarrierName('P1')).toBe('Ada Lovelace');
    expect(await seed.getCarrierName('ZZZ')).toBe('ZZZ');
  });

  it('scopes shipping methods to a carrier', async () => {
    expect(await seed.getShippingMethodsByCarrier('UPS')).toHaveLength(1);
    expect(await seed.getShippingMethodsByCarrier('')).toEqual([]);
  });

  it('scopes store facilities to a product store', async () => {
    expect((await seed.getProductStoreFacilities('STORE')).map((f) => f.facilityId)).toEqual(['F1']);
    expect(await seed.getProductStoreFacilities('')).toEqual([]);
  });

  it('sorts geography and joins geoAssocs for a country', async () => {
    expect((await seed.getCountries()).map((g) => g.geoId)).toEqual(['IND', 'USA']);
    expect((await seed.getStates()).map((g) => g.geoId)).toEqual(['USA_AL', 'USA_CA']);
    expect((await seed.getStatesForCountry('USA')).map((g) => g.geoId)).toEqual(['USA_AL', 'USA_CA']);
    expect(await seed.getStatesForCountry('IND')).toEqual([]);
    expect(await seed.getStatesForCountry('')).toEqual([]);
    expect(await seed.getGeoIdByCode('US')).toBe('USA');
    expect(await seed.getGeoIdByCode('XX')).toBe('');
    expect(await seed.getGeoIdsByCode(['US', 'CA'])).toEqual({ US: 'USA', CA: 'USA_CA' });
  });

  it('orders transitions by sequence and joins the destination status', async () => {
    const transitions = await seed.getAllowedTransitions('ORDER_CREATED');
    expect(transitions.map((t) => t.toStatusId)).toEqual(['RETURN_ACCEPTED', 'ORDER_APPROVED']);
    expect(transitions[0].toStatusDescription).toBe('Accepted');
    expect(transitions[0].toStatusColor).toBe('medium');
    expect(await seed.getAllowedTransitions('ORDER_APPROVED')).toEqual([]);
    expect(await seed.getAllowedTransitions('')).toEqual([]);
  });

  it('resolves facility parent types for the virtual-facility checks', async () => {
    expect(await seed.getFacilityParentTypeId('WAREHOUSE')).toBe('PHYSICAL');
    expect(await seed.getFacilityParentTypeId('NOPE')).toBe('');
    expect(await seed.getFacilityParentTypeIds(['WAREHOUSE'])).toEqual({ WAREHOUSE: 'PHYSICAL' });
  });

  it('builds option lists', async () => {
    expect(await seed.getShipmentMethodOptions()).toEqual([{ id: 'GROUND', label: 'Ground' }]);
    expect(await seed.getOrderIdentificationTypeOptions())
      .toEqual([{ enumId: 'ID_SHOPIFY', description: 'Shopify order' }]);
  });

  it('degrades to raw ids when no database can be opened', async () => {
    oms = '';

    expect(await seed.getFacilityName('F1')).toBe('F1');
    expect(await seed.getCountries()).toEqual([]);
    expect(await seed.getStatusDescriptions(['ORDER_APPROVED'])).toEqual({ ORDER_APPROVED: 'ORDER_APPROVED' });
  });
});
