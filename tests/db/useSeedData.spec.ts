import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';
import { BaseDB, commonSchema, dbClient, ensureDbReady } from '@common/db';
import { setOmsInstanceResolver } from '@/db/orderManagerDb';

let oms = '';
let n = 0;

async function seedDb(): Promise<void> {
  oms = `useSeedDataTest-${n++}`;
  setOmsInstanceResolver(() => oms);
  const db = new BaseDB(`${oms}-OrderManagerDB`, commonSchema.stores);
  // Record the declared version before seeding, as the app does on first use. A database with no
  // recorded version is treated as built by another build and is rebuilt on first read.
  await ensureDbReady(db);
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
    { geoId: 'DBIC', geoName: 'Doing business in countries', geoTypeEnumId: 'GEOT_GROUP', syncedAt: 1 },
  ]);
  await c.entity('geoAssocs').bulkPut([
    { geoAssocKey: 'USA|USA_CA', geoId: 'USA', toGeoId: 'USA_CA', geoAssocTypeEnumId: 'GAT_REGIONS', syncedAt: 1 },
    { geoAssocKey: 'USA|USA_AL', geoId: 'USA', toGeoId: 'USA_AL', geoAssocTypeEnumId: 'GAT_REGIONS', syncedAt: 1 },
    // A group membership, not a region: must never show up as one of USA's states.
    { geoAssocKey: 'USA|DBIC', geoId: 'USA', toGeoId: 'DBIC', geoAssocTypeEnumId: 'GAT_GROUP_MEMBER', syncedAt: 1 },
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
let __seedTableCount: () => number;

/** Reactive getters answer from the table's ref, so wait for the read to land. */
const eventually = (check: () => void) => vi.waitFor(check, { timeout: 2000, interval: 5 });

describe('useSeedData', () => {
  beforeEach(async () => {
    await seedDb();
    ({ __seedTableCount } = await import('@common/db'));
    seed = (await import('@common/db')).useSeedData();
  });
  afterEach(async () => {
    (await import('@common/db')).clearSeedTables();
    oms = '';
  });

  it('answers a cold table with the raw id, then the label once the read lands', async () => {
    expect(seed.statusDescription('ORDER_APPROVED')).toBe('ORDER_APPROVED');
    await eventually(() => expect(seed.statusDescription('ORDER_APPROVED')).toBe('Approved'));
    expect(seed.statusDescription('NOPE')).toBe('NOPE');
    expect(seed.statusDescription('')).toBe('');
  });

  it('re-runs a computed when its table loads', async () => {
    const label = computed(() => seed.facilityName('F1'));
    expect(label.value).toBe('F1');
    await eventually(() => expect(label.value).toBe('Main Warehouse'));
  });

  it('resolves labels by table', async () => {
    await eventually(() => {
      expect(seed.enumDescription('WEB_CHANNEL')).toBe('Web');
      expect(seed.shipmentMethodDescription('GROUND')).toBe('Ground');
    });
  });

  it('filters by type', async () => {
    await eventually(() => {
      expect(seed.statusItemsByType('ORDER_STATUS')).toHaveLength(2);
      expect(seed.enumsByType('ORDER_SALES_CHANNEL')).toHaveLength(2);
    });
    expect(seed.enumsByType('MISSING')).toEqual([]);
  });

  it('joins enumTypes to enums for a parent type', async () => {
    await eventually(() => expect(seed.enumsByParentType('WorkEffortPurposeType').map((e) => e.enumId)).toEqual(['WE_PICK']));
    expect(seed.enumsByParentType('Unknown')).toEqual([]);
  });

  it('builds carrier names from either name shape', async () => {
    await eventually(() => {
      expect(seed.carrierName('UPS')).toBe('UPS');
      expect(seed.carrierName('P1')).toBe('Ada Lovelace');
    });
    expect(seed.carrierName('ZZZ')).toBe('ZZZ');
  });

  it('scopes store facilities to a product store', async () => {
    await eventually(() => expect(seed.productStoreFacilities('STORE').map((f) => f.facilityId)).toEqual(['F1']));
    expect(seed.productStoreFacilities('')).toEqual([]);
    expect((await seed.getProductStoreFacilities('STORE')).map((f) => f.facilityId)).toEqual(['F1']);
    expect(await seed.getProductStoreFacilities('')).toEqual([]);
  });

  it('sorts geography and joins geoAssocs for a country', async () => {
    await eventually(() => {
      expect(seed.countries().map((g) => g.geoId)).toEqual(['IND', 'USA']);
      expect(seed.states().map((g) => g.geoId)).toEqual(['USA_AL', 'USA_CA']);
      expect(seed.statesForCountry('USA').map((g) => g.geoId)).toEqual(['USA_AL', 'USA_CA']);
    });
    expect(seed.statesForCountry('IND')).toEqual([]);
    expect(seed.dbicCountries().map((g) => g.geoId)).toEqual(['USA']);
    expect(seed.statesForCountry('')).toEqual([]);
    expect((await seed.getStatesForCountry('USA')).map((g) => g.geoId)).toEqual(['USA_AL', 'USA_CA']);
  });

  it('serves whole tables and their async forms', async () => {
    await eventually(() => {
      expect(seed.statuses()).toHaveLength(3);
      expect(seed.enums()).toHaveLength(4);
      expect(seed.enumTypes()).toHaveLength(1);
      expect(seed.shipmentMethodTypes().map((m) => m.shipmentMethodTypeId)).toEqual(['GROUND']);
    });
    expect((await seed.getEnumsByType('ORDER_SALES_CHANNEL')).map((e) => e.enumId).sort()).toEqual(['POS', 'WEB_CHANNEL']);
    expect(await seed.getPaymentMethodTypes()).toEqual([]);
  });

  it('builds option lists', async () => {
    await eventually(() => {
      expect(seed.shipmentMethodOptions()).toEqual([{ id: 'GROUND', label: 'Ground' }]);
      expect(seed.orderIdentificationTypeOptions()).toEqual([{ enumId: 'ID_SHOPIFY', description: 'Shopify order' }]);
    });
  });

  it('waits for the rows in the async getters', async () => {
    expect((await seed.getFacilities()).map((f) => f.facilityId)).toEqual(['F1']);
    expect((await seed.getProductStores()).map((s) => s.productStoreId)).toEqual(['STORE']);
    expect(await seed.getGeos()).toHaveLength(5);
    expect(await seed.getFacilityParentTypeIds(['WAREHOUSE', 'NOPE'])).toEqual({ WAREHOUSE: 'PHYSICAL', NOPE: '' });
  });

  it('serves a loaded table to the reactive getters without another read', async () => {
    await seed.getFacilities();
    expect(seed.facilityName('F1')).toBe('Main Warehouse');
  });

  /** A second connection to the same database, as the sync worker writes through its own. */
  const otherConnection = () => dbClient(new BaseDB(`${oms}-OrderManagerDB`, commonSchema.stores));

  it('picks up rows written after the first read, as the login sync fills an empty table', async () => {
    const label = computed(() => seed.returnReasonDescription('RTN_DAMAGED'));
    expect(label.value).toBe('RTN_DAMAGED');
    expect(__seedTableCount()).toBe(1);
    // Let the empty table's first read land, as it would before the sync reaches it.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(label.value).toBe('RTN_DAMAGED');

    await otherConnection().entity('returnReasons').put({ returnReasonId: 'RTN_DAMAGED', description: 'Damaged', syncedAt: 2 });
    await eventually(() => expect(label.value).toBe('Damaged'));
  });

  it('updates in place when a row changes, and the async getters return the current rows', async () => {
    const label = computed(() => seed.facilityName('F1'));
    await eventually(() => expect(label.value).toBe('Main Warehouse'));

    await otherConnection().entity('facilities').put({ facilityId: 'F1', facilityName: 'Renamed', facilityTypeId: 'WAREHOUSE', syncedAt: 2 });
    await eventually(() => expect(label.value).toBe('Renamed'));
    expect((await seed.getFacilities())[0].facilityName).toBe('Renamed');
  });

  it('keeps one live table per seed table however often it is read', async () => {
    for (let i = 0; i < 50; i++) {
      computed(() => seed.facilityName('F1')).value;
      seed.statusDescription('ORDER_APPROVED');
      seed.countries();
      seed.statesForCountry('USA');
    }
    await seed.getFacilities();
    // facilities, statuses, geos, geoAssocs
    expect(__seedTableCount()).toBe(4);

    // Writing a table nobody reads opens nothing.
    await otherConnection().entity('carriers').put({ partyId: 'DHL', groupName: 'DHL', syncedAt: 2 });
    await eventually(() => expect(seed.facilityName('F1')).toBe('Main Warehouse'));
    expect(__seedTableCount()).toBe(4);
  });

  it('closes every live table on logout, and the next use opens a fresh one', async () => {
    const { clearSeedTables } = await import('@common/db');
    await seed.getFacilities();
    seed.statusDescription('ORDER_APPROVED');
    expect(__seedTableCount()).toBe(2);

    clearSeedTables();
    expect(__seedTableCount()).toBe(0);

    expect((await seed.getFacilities()).map((f) => f.facilityId)).toEqual(['F1']);
    expect(__seedTableCount()).toBe(1);
  });

  it('degrades to raw ids when no database can be opened', async () => {
    oms = '';

    expect(seed.facilityName('F1')).toBe('F1');
    expect(seed.countries()).toEqual([]);
    expect(await seed.getFacilities()).toEqual([]);
  });
});
