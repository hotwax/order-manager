import { describe, expect, it } from 'vitest';
import { buildSeedLookup, readSeedLookupRows, SEED_LOOKUP_TABLES } from '@/utils/seedLookup';

const rows = {
  facilities: [{ facilityId: 'WH', facilityName: 'Main Warehouse', facilityTypeId: 'WAREHOUSE' }, { facilityId: 'BARE' }],
  facilityTypes: [{ facilityTypeId: 'WAREHOUSE', parentTypeId: 'DISTRIBUTION_CENTER' }],
  statuses: [{ statusId: 'ORDER_APPROVED', description: 'Approved' }, { statusId: 'ORDER_COMPLETED', description: 'Completed' }],
  enums: [{ enumId: 'SALES_CHANNEL_WEB', description: 'Web' }, { enumId: 'NAMED_ONLY', enumName: 'Named' }],
  geos: [
    { geoId: 'USA', geoName: 'United States', geoTypeEnumId: 'GEOT_COUNTRY' },
    { geoId: 'CAN', geoName: 'Canada', geoTypeEnumId: 'GEOT_COUNTRY' },
    { geoId: 'CA', geoName: 'California', geoTypeEnumId: 'GEOT_STATE' },
    { geoId: 'ON', geoName: 'Ontario', geoTypeEnumId: 'GEOT_PROVINCE' },
  ],
  shipmentMethodTypes: [{ shipmentMethodTypeId: 'STANDARD', description: 'Standard' }],
  carrierShipmentMethods: [{ partyId: 'UPS', shipmentMethodTypeId: 'STANDARD' }, { partyId: 'FEDEX', shipmentMethodTypeId: 'STANDARD' }],
  productStores: [{ productStoreId: 'STORE', storeName: 'Demo Store' }],
  orderAdjustmentTypes: [{ orderAdjustmentTypeId: 'SALES_TAX', description: 'Sales Tax' }],
  returnReasons: [{ returnReasonId: 'RTN_DEFECTIVE', description: 'Defective' }],
  statusFlowTransitions: [
    { statusId: 'ORDER_CREATED', toStatusId: 'ORDER_COMPLETED', transitionSequence: 2 },
    { statusId: 'ORDER_CREATED', toStatusId: 'ORDER_APPROVED', transitionSequence: 1 },
    { statusId: 'ORDER_APPROVED', toStatusId: 'ORDER_COMPLETED' },
  ],
};

describe('seed lookup', () => {
  const seed = buildSeedLookup(rows, true);

  it('labels rows by their table, falling back to the raw id', () => {
    expect(seed.facilityName('WH')).toBe('Main Warehouse');
    expect(seed.facilityName('BARE')).toBe('BARE');
    expect(seed.facilityName('MISSING')).toBe('MISSING');
    expect(seed.statusDescription('ORDER_APPROVED')).toBe('Approved');
    expect(seed.enumDescription('NAMED_ONLY')).toBe('Named');
    expect(seed.shipmentMethodDescription('STANDARD')).toBe('Standard');
    expect(seed.productStoreName('STORE')).toBe('Demo Store');
    expect(seed.orderAdjustmentTypeDescription('SALES_TAX')).toBe('Sales Tax');
    expect(seed.geoName('CA')).toBe('California');
    expect(seed.facilityName('')).toBe('');
  });

  it('joins a facility to its type', () => {
    expect(seed.facilityType(seed.facility('WH')!.facilityTypeId)?.parentTypeId).toBe('DISTRIBUTION_CENTER');
  });

  it('describes an id from whichever table knows it', () => {
    expect(seed.describe('ORDER_COMPLETED')).toBe('Completed');
    expect(seed.describe('SALES_CHANNEL_WEB')).toBe('Web');
    expect(seed.describe('RTN_DEFECTIVE')).toBe('Defective');
    expect(seed.describe('UNKNOWN')).toBe('UNKNOWN');
  });

  it('lists countries and states by name', () => {
    expect(seed.countries.map((geo) => geo.geoId)).toEqual(['CAN', 'USA']);
    expect(seed.states.map((geo) => geo.geoId)).toEqual(['CA', 'ON']);
  });

  it('orders the transitions out of a status by their sequence, with descriptions', () => {
    expect(seed.allowedTransitions('ORDER_CREATED').map((transition) => [transition.toStatusId, transition.toStatusDescription]))
      .toEqual([['ORDER_APPROVED', 'Approved'], ['ORDER_COMPLETED', 'Completed']]);
    expect(seed.allowedTransitions('NONE')).toEqual([]);
  });

  it('filters shipping methods by carrier', () => {
    expect(seed.shippingMethodsByCarrier('UPS')).toEqual([{ partyId: 'UPS', shipmentMethodTypeId: 'STANDARD' }]);
    expect(seed.shippingMethodsByCarrier('')).toEqual([]);
  });

  it('is not ready and answers raw ids before any rows are read', () => {
    const empty = buildSeedLookup();
    expect(empty.ready).toBe(false);
    expect(empty.statusDescription('ORDER_APPROVED')).toBe('ORDER_APPROVED');
    expect(empty.countries).toEqual([]);
  });

  it('reads every table, leaving one that fails empty', async () => {
    const read = await readSeedLookupRows(async (table) => {
      if (table === 'geos') throw new Error('boom');
      return [{ table }];
    });
    expect(Object.keys(read)).toEqual([...SEED_LOOKUP_TABLES]);
    expect(read.geos).toEqual([]);
    expect(read.statuses).toEqual([{ table: 'statuses' }]);
  });
});
