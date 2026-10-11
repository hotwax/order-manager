import { describe, expect, it } from 'vitest';
import {
  buildFacilityCoverageRows,
  filterFacilityCoverageRows,
  isPhysicalFacility,
  sortFacilityCoverageRows
} from '@/utils/facilityInventory';

describe('facility coverage rows', () => {
  const facilities = [
    { facilityId: 'STORE_A', facilityName: 'Main Street', parentTypeId: 'PHYSICAL_STORE', maximumOrderLimit: 10 },
    { facilityId: 'STORE_B', facilityName: 'Broadway', parentTypeId: 'PHYSICAL_STORE' },
    { facilityId: 'STORE_C', facilityName: 'Centerville', parentTypeId: 'PHYSICAL_STORE', maximumOrderLimit: 0 }
  ];

  const items = [
    { orderItemSeqId: '00001', productId: 'TEE', name: 'Blue Tee', quantity: 2 },
    { orderItemSeqId: '00002', productId: 'SOCK', name: 'Grey Sock' }
  ];

  function build(overrides: Record<string, any> = {}) {
    return buildFacilityCoverageRows({
      today: '2026-06-11',
      facilities,
      items,
      productFacilities: [
        { productId: 'TEE', facilityId: 'STORE_A', lastInventoryCount: 6, minimumStock: 1 },
        { productId: 'SOCK', facilityId: 'STORE_A', lastInventoryCount: 4, allowBrokering: 'N' },
        { productId: 'TEE', facilityId: 'STORE_B', lastInventoryCount: 1 }
      ],
      facilityOrderCounts: [
        { facilityId: 'STORE_A', entryDate: '2026-06-11', lastOrderCount: 4 },
        { facilityId: 'STORE_A', entryDate: '2026-06-10', lastOrderCount: 9 }
      ],
      ...overrides
    });
  }

  it('reports a facility with no product record as unknown rather than zero', () => {
    const centerville = build().find((row) => row.facilityId === 'STORE_C')!;

    expect(centerville.coveredCount).toBe(0);
    expect(centerville.items.map((item) => ({ hasRecord: item.hasRecord, available: item.available, shortBy: item.shortBy })))
      .toEqual([
        { hasRecord: false, available: null, shortBy: 0 },
        { hasRecord: false, available: null, shortBy: 0 }
      ]);
  });

  it('counts coverage against the quantity ordered and reports the shortfall', () => {
    const rows = build();
    const mainStreet = rows.find((row) => row.facilityId === 'STORE_A')!;
    const broadway = rows.find((row) => row.facilityId === 'STORE_B')!;

    expect(mainStreet.coveredCount).toBe(2);
    expect(mainStreet.items[0]).toMatchObject({ required: 2, available: 5, covered: true, shortBy: 0 });
    expect(broadway.coveredCount).toBe(0);
    expect(broadway.items[0]).toMatchObject({ required: 2, available: 1, covered: false, shortBy: 1 });
    expect(broadway.items[1]).toMatchObject({ hasRecord: false, covered: false });
  });

  it('sums the requirement when two order items share a product', () => {
    const rows = buildFacilityCoverageRows({
      facilities: [facilities[0]],
      items: [
        { orderItemSeqId: '00001', productId: 'TEE', name: 'Blue Tee', quantity: 3 },
        { orderItemSeqId: '00002', productId: 'TEE', name: 'Blue Tee', quantity: 3 }
      ],
      productFacilities: [{ productId: 'TEE', facilityId: 'STORE_A', lastInventoryCount: 5 }]
    });

    expect(rows[0].items.map((item) => item.required)).toEqual([6, 6]);
    expect(rows[0].coveredCount).toBe(0);
  });

  it('treats an absent allowBrokering as Y and reports a mixed facility as partial', () => {
    const rows = build();

    expect(rows.find((row) => row.facilityId === 'STORE_A')!.allowBrokering).toBe('Partial');
    expect(rows.find((row) => row.facilityId === 'STORE_B')!.allowBrokering).toBe('Y');
    expect(rows.find((row) => row.facilityId === 'STORE_C')!.allowBrokering).toBe('Y');
  });

  it('reads the order limit from the facility record and today\'s consumption from the counts', () => {
    const rows = build();

    expect(rows.find((row) => row.facilityId === 'STORE_A')).toMatchObject({
      orderLimit: 10,
      consumedToday: 4,
      remainingCapacity: 6
    });
    // No count row for today is a real zero, not missing data.
    expect(rows.find((row) => row.facilityId === 'STORE_B')).toMatchObject({
      orderLimit: null,
      consumedToday: 0,
      remainingCapacity: null
    });
    // Zero is a limit of no capacity, not unlimited.
    expect(rows.find((row) => row.facilityId === 'STORE_C')).toMatchObject({
      orderLimit: 0,
      remainingCapacity: 0
    });
  });

  it('marks facilities outside the product store without dropping them', () => {
    const rows = build({ productStoreFacilities: [{ facilityId: 'STORE_A' }, { facilityId: 'STORE_B' }] });

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => [row.facilityId, row.inStore])).toEqual([
      ['STORE_A', true],
      ['STORE_B', true],
      ['STORE_C', false]
    ]);
  });

  it('sorts in-store and better covered facilities first', () => {
    const rows = sortFacilityCoverageRows(build({ productStoreFacilities: [{ facilityId: 'STORE_B' }, { facilityId: 'STORE_C' }] }));

    expect(rows.map((row) => row.facilityId)).toEqual(['STORE_B', 'STORE_C', 'STORE_A']);
  });

  it('ranks by the detailed item when the list is showing one', () => {
    const rows = build();

    // Only STORE_A stocks the sock, so detailing it puts STORE_A first even though the overall
    // coverage ordering is a tie between STORE_A and STORE_B.
    expect(sortFacilityCoverageRows(rows, 1).map((row) => row.facilityId)).toEqual(['STORE_A', 'STORE_B', 'STORE_C']);
  });

  it('searches by facility name or id', () => {
    const rows = build();

    expect(filterFacilityCoverageRows(rows, 'broad').map((row) => row.facilityId)).toEqual(['STORE_B']);
    expect(filterFacilityCoverageRows(rows, 'store_c').map((row) => row.facilityId)).toEqual(['STORE_C']);
    expect(filterFacilityCoverageRows(rows, '  ')).toHaveLength(3);
  });

  it('separates physical facilities from virtual ones by parent type', () => {
    expect(isPhysicalFacility({ facilityId: 'STORE_A', parentTypeId: 'PHYSICAL_STORE' })).toBe(true);
    expect(isPhysicalFacility({ facilityId: 'PRE_ORDER_PARKING', parentTypeId: 'VIRTUAL_FACILITY' })).toBe(false);
  });
});
