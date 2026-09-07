import { describe, expect, it } from 'vitest';
import * as L from '@/db/seedLookups';

const statuses = [
  { statusId: 'ORDER_APPROVED', statusTypeId: 'ORDER_STATUS', description: 'Approved', statusAge: 5 },
  { statusId: 'ORDER_CREATED', statusTypeId: 'ORDER_STATUS', description: 'Created' },
  { statusId: 'RETURN_ACCEPTED', statusTypeId: 'RETURN_STATUS', description: 'Accepted' },
];
const enums = [
  { enumId: 'WEB_CHANNEL', enumTypeId: 'ORDER_SALES_CHANNEL', description: 'Web' },
  { enumId: 'POS', enumTypeId: 'ORDER_SALES_CHANNEL', description: 'Point of sale' },
  { enumId: 'WE_PICK', enumTypeId: 'WePurposeChild', description: 'Picking' },
];
const enumTypes = [{ enumTypeId: 'WePurposeChild', parentTypeId: 'WorkEffortPurposeType' }];
const facilities = [{ facilityId: 'F1', facilityName: 'Main Warehouse', facilityTypeId: 'WAREHOUSE' }];
const geos = [
  { geoId: 'USA', geoName: 'United States', geoCodeAlpha2: 'US', geoTypeEnumId: 'GEOT_COUNTRY' },
  { geoId: 'IND', geoName: 'India', geoCodeAlpha2: 'IN', geoTypeEnumId: 'GEOT_COUNTRY' },
  { geoId: 'USA_CA', geoName: 'California', geoCode: 'CA', geoTypeEnumId: 'GEOT_STATE' },
  { geoId: 'USA_AL', geoName: 'Alabama', geoCode: 'AL', geoTypeEnumId: 'GEOT_STATE' },
];
const geoAssocs = [
  { geoId: 'USA', toGeoId: 'USA_CA' },
  { geoId: 'USA', toGeoId: 'USA_AL' },
];
const carriers = [
  { partyId: 'UPS', groupName: 'UPS' },
  { partyId: 'P1', firstName: 'Ada', lastName: 'Lovelace' },
];
const transitions = [
  { statusId: 'ORDER_CREATED', toStatusId: 'ORDER_APPROVED', transitionSequence: 2 },
  { statusId: 'ORDER_CREATED', toStatusId: 'RETURN_ACCEPTED', transitionSequence: 1 },
];

describe('seedLookups', () => {
  it('resolves labels and falls back to the raw id', () => {
    expect(L.statusDescription(statuses, 'ORDER_APPROVED')).toBe('Approved');
    expect(L.statusDescription(statuses, 'NOPE')).toBe('NOPE');
    expect(L.statusDescription([], 'ORDER_APPROVED')).toBe('ORDER_APPROVED');
    expect(L.facilityName(facilities, 'F1')).toBe('Main Warehouse');
    expect(L.facilityName(facilities, 'F9')).toBe('F9');
    expect(L.enumDescription(enums, 'WEB_CHANNEL')).toBe('Web');
    expect(L.statusDescription(statuses, '')).toBe('');
  });

  it('reads statusAge, defaulting to zero', () => {
    expect(L.statusAge(statuses, 'ORDER_APPROVED')).toBe(5);
    expect(L.statusAge(statuses, 'ORDER_CREATED')).toBe(0);
    expect(L.statusAge([], 'ORDER_APPROVED')).toBe(0);
  });

  it('filters by type', () => {
    expect(L.getStatusItemsByType(statuses, 'ORDER_STATUS')).toHaveLength(2);
    expect(L.getEnumsByType(enums, 'ORDER_SALES_CHANNEL')).toHaveLength(2);
    expect(L.getEnumsByType(enums, 'MISSING')).toEqual([]);
  });

  it('resolves enums through their parent type', () => {
    expect(L.getEnumsByParentType(enums, enumTypes, 'WorkEffortPurposeType').map((e) => e.enumId))
      .toEqual(['WE_PICK']);
    expect(L.getEnumsByParentType(enums, enumTypes, 'Unknown')).toEqual([]);
  });

  it('builds carrier names from either shape', () => {
    expect(L.carrierName(carriers, 'UPS')).toBe('UPS');
    expect(L.carrierName(carriers, 'P1')).toBe('Ada Lovelace');
    expect(L.carrierName(carriers, 'ZZZ')).toBe('ZZZ');
  });

  it('sorts geography by name and scopes states to their country', () => {
    expect(L.getCountries(geos).map((g) => g.geoId)).toEqual(['IND', 'USA']);
    expect(L.getStates(geos).map((g) => g.geoId)).toEqual(['USA_AL', 'USA_CA']);
    expect(L.getStatesForCountry(geos, geoAssocs, 'USA').map((g) => g.geoId)).toEqual(['USA_AL', 'USA_CA']);
    expect(L.getStatesForCountry(geos, geoAssocs, 'IND')).toEqual([]);
    expect(L.getStatesForCountry(geos, geoAssocs, '')).toEqual([]);
    expect(L.getGeoIdByCode(geos, 'US')).toBe('USA');
    expect(L.getGeoIdByCode(geos, 'CA')).toBe('USA_CA');
    expect(L.getGeoIdByCode(geos, '')).toBe('');
    expect(L.getGeoIdByCode(geos, 'XX')).toBe('');
  });

  it('orders transitions by sequence and decorates them', () => {
    const result = L.allowedTransitions(transitions, statuses, 'ORDER_CREATED', () => 'medium');
    expect(result.map((t) => t.toStatusId)).toEqual(['RETURN_ACCEPTED', 'ORDER_APPROVED']);
    expect(result[0].toStatusDescription).toBe('Accepted');
    expect(result[0].toStatusColor).toBe('medium');
    expect(L.allowedTransitions(transitions, statuses, 'ORDER_APPROVED', () => 'medium')).toEqual([]);
  });

  it('scopes shipping methods to a carrier', () => {
    const methods = [{ partyId: 'UPS', shipmentMethodTypeId: 'GROUND' }, { partyId: 'FDX', shipmentMethodTypeId: 'AIR' }];
    expect(L.shippingMethodsByCarrier(methods, 'UPS')).toHaveLength(1);
    expect(L.shippingMethodsByCarrier(methods, '')).toEqual([]);
  });
});
