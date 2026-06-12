import { describe, expect, it } from 'vitest';
import { filterFacilityRows, normalizeFacilityRows, sortFacilityRows } from './facilityInventory';

describe('facility inventory rows', () => {
  it('combines product inventory, fulfillment, and capacity details by facility', () => {
    const rows = normalizeFacilityRows({
      today: '2026-06-11',
      facilityName: (facilityId) => facilityId === 'STORE_A' ? 'Main Street' : facilityId,
      productFacilities: [
        { facilityId: 'STORE_A', lastInventoryCount: 8, minimumStock: 2, computedLastInventoryCount: 6, allowBrokering: 'N' },
        { facilityId: 'STORE_B', lastInventoryCount: 1, minimumStock: 3, allowBrokering: 'Y' },
        { facilityId: 'STORE_OUTSIDE', lastInventoryCount: 9, minimumStock: 0 }
      ],
      productStoreFacilities: [
        { facilityId: 'STORE_A', productStoreId: 'STORE', facilityName: 'Main Street', maximumOrderLimit: 10 },
        { facilityId: 'STORE_B', productStoreId: 'STORE', facilityName: 'Broadway' }
      ],
      facilityGroups: [
        { facilityGroupId: 'OMS_FULFILLMENT', facilityGroupTypeId: 'FULFILLMENT' }
      ],
      facilityGroupMembers: [
        { facilityGroupId: 'OMS_FULFILLMENT', facilityId: 'STORE_A' }
      ],
      inventoryItems: [
        { facilityId: 'STORE_A', availableToPromiseTotal: 8, quantityOnHandTotal: 13 },
        { facilityId: 'STORE_A', availableToPromiseTotal: 2, quantityOnHandTotal: 1 }
      ],
      facilityOrderCounts: [
        { facilityId: 'STORE_A', entryDate: '2026-06-11', lastOrderCount: 4 },
        { facilityId: 'STORE_A', entryDate: '2026-06-10', lastOrderCount: 7 }
      ]
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      facilityId: 'STORE_A',
      facilityName: 'Main Street',
      allowBrokering: 'N',
      omsFulfillment: 'Y',
      atp: 8,
      qoh: 14,
      safetyStock: 2,
      available: 6,
      orderLimit: 10,
      consumedToday: 4,
      remainingCapacity: 6
    });
    expect(rows[1]).toMatchObject({
      facilityId: 'STORE_B',
      facilityName: 'Broadway',
      omsFulfillment: 'N',
      available: 0,
      orderLimit: null,
      remainingCapacity: null
    });
  });

  it('filters by facility name or id and sorts available facilities first', () => {
    const rows = [
      { facilityId: 'B200', facilityName: 'Broadway', available: 0 },
      { facilityId: 'A100', facilityName: 'Main Street', available: 5 },
      { facilityId: 'C300', facilityName: 'Centerville', available: 2 }
    ] as any[];

    expect(filterFacilityRows(rows, 'main').map((row) => row.facilityId)).toEqual(['A100']);
    expect(filterFacilityRows(rows, 'c300').map((row) => row.facilityId)).toEqual(['C300']);
    expect(sortFacilityRows(rows).map((row) => row.facilityId)).toEqual(['A100', 'C300', 'B200']);
  });
});
