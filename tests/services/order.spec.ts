import { describe, expect, it, vi } from 'vitest';
import { api, commonUtil, useSolrSearch } from '@common';
import {
  buildActivePhysicalFacilityOrderVolumePayload,
  buildOrderLookupPayload,
  buildOrderRowEnrichmentPayload,
  buildUnfillableProductCandidatesPayload,
  buildUnfillableShipGroupsForProductPayload,
  getActivePhysicalFacilityOrderVolume,
  buildVirtualLocationCountsPayload,
  fetchUnfillableProductCandidates,
  fetchUnfillableShipGroupsForProduct,
  fetchVirtualLocationOrderCounts,
  fetchWorkflowOrderTotals,
  searchOrders
} from '@/services/order';

vi.mock('@common', () => ({
  api: vi.fn(),
  commonUtil: { hasError: vi.fn() },
  useSolrSearch: vi.fn()
}));

function filtersOf(params: Parameters<typeof buildOrderLookupPayload>[0]) {
  return buildOrderLookupPayload(params).json.filter as string[];
}

function fieldsOf(params: Parameters<typeof buildOrderLookupPayload>[0] = {}) {
  return String(buildOrderLookupPayload(params).json.params.fl).split(' ');
}

function activeFacilityFiltersOf(params: Parameters<typeof buildActivePhysicalFacilityOrderVolumePayload>[0] = {}) {
  return buildActivePhysicalFacilityOrderVolumePayload(params).json.filter as string[];
}

function mockSolrResponse(data: any) {
  (commonUtil.hasError as any).mockReturnValue(false);
  (useSolrSearch as any).mockReturnValue({
    runSolrQuery: vi.fn().mockResolvedValue({ data })
  });
}

describe('buildOrderLookupPayload facility filtering', () => {
  it('always scopes to sales orders', () => {
    const filters = filtersOf({});
    expect(filters).toContain('docType: ORDER');
    expect(filters).toContain('orderTypeId: SALES_ORDER');
  });

  it('does not add a facility filter when none is given', () => {
    const filters = filtersOf({});
    expect(filters.some((filter) => filter.startsWith('facilityId'))).toBe(false);
  });

  it('builds the Unfillable queue filter (single facility)', () => {
    const filters = filtersOf({ facilityIds: ['UNFILLABLE_PARKING'] });
    expect(filters).toContain('facilityId:UNFILLABLE_PARKING');
  });

  it('builds the Brokering queue filter (brokering OR rejected parking)', () => {
    const filters = filtersOf({ facilityIds: ['_NA_', 'REJECTED_PARKING'] });
    expect(filters).toContain('facilityId:(_NA_ OR REJECTED_PARKING)');
  });

  it('finds operational parking items by excluding physical and archived facilities', () => {
    const filters = filtersOf({ hasVirtualFacilityItems: true });

    expect(filters).toContain('-facilityTypeId:(RETAIL_STORE OR WAREHOUSE)');
    expect(filters).toContain('-facilityId:GENERAL_OPS_PARKING');
    expect(filters).not.toContain('facilityTypeId:VIRTUAL_FACILITY');
  });

  it("ignores the 'All' sentinel and empty facility values", () => {
    const filters = filtersOf({ facilityIds: ['All', '', 'UNFILLABLE_PARKING'] });
    expect(filters).toContain('facilityId:UNFILLABLE_PARKING');
    expect(filters).not.toContain('facilityId:(All OR  OR UNFILLABLE_PARKING)');
  });

  it('maps the Find Order allocation state to the matching indexed facility', () => {
    expect(filtersOf({ allocationState: 'Allocated' })).toContain('facilityTypeId:(RETAIL_STORE OR WAREHOUSE)');
    expect(filtersOf({ allocationState: 'AwaitingBrokering' })).toContain('facilityId:(_NA_ OR REJECTED_ITM_PARKING OR REJECTED_PARKING)');
    expect(filtersOf({ allocationState: 'Unfillable' })).toContain('facilityId:UNFILLABLE_PARKING');
    expect(filtersOf({ allocationState: 'Archived' })).toContain('facilityId:GENERAL_OPS_PARKING');
  });

  it("applies no allocation facility filter for 'All' or an unset allocation state", () => {
    expect(filtersOf({ allocationState: 'All' }).some((filter) => filter.startsWith('facilityId') || filter.startsWith('facilityTypeId'))).toBe(false);
    expect(filtersOf({}).some((filter) => filter.startsWith('facilityTypeId'))).toBe(false);
  });

  it('combines a facility preset with status, sales channel, and shipping method filters', () => {
    const filters = filtersOf({
      facilityIds: ['UNFILLABLE_PARKING'],
      status: ['ORDER_APPROVED'],
      channel: 'WEB_SALES_CHANNEL',
      shipmentMethodTypeId: 'STOREPICKUP'
    });
    expect(filters).toContain('facilityId:UNFILLABLE_PARKING');
    expect(filters).toContain('orderStatusId:ORDER_APPROVED');
    expect(filters).toContain('salesChannelEnumId:WEB_SALES_CHANNEL');
    expect(filters).toContain('shipmentMethodTypeId:STOREPICKUP');
  });

  it('requests the item and ship-group facility fields used by queue filtering', () => {
    const fields = fieldsOf();
    expect(fields).toEqual(expect.arrayContaining([
      'orderItemSeqId',
      'shipGroupSeqId',
      'orderItemShipGroupIdentifier',
      'quantity',
      'facilityId',
      'reservationFacilityId',
      'facilityTypeId',
      'facilityName',
      'orderFacilityId',
      'orderFacilityName'
    ]));
  });

  it('requests the reason and delivery fields used by queue list rows', () => {
    const fields = fieldsOf();
    expect(fields).toEqual(expect.arrayContaining([
      'estimatedDeliveryDate',
      'shipBeforeDate',
      'rejectionReason',
      'rejectionReasonDesc',
      'ruleName',
      'routingRuleName'
    ]));
  });

  it('sums grouped item quantities as the units in parking for each order', async () => {
    mockSolrResponse({
      grouped: {
        orderId: {
          ngroups: 1,
          groups: [{
            doclist: {
              docs: [{
                orderId: 'M100001',
                orderName: '#100001',
                externalOrderId: '5202667012349',
                orderDate: '2026-06-12T10:00:00Z',
                orderStatusId: 'ORDER_APPROVED',
                customerPartyId: 'CUST_1',
                customerName: 'Angela Crutchfield',
                address1: '602 White Oak Dr',
                city: 'Eufaula',
                stateProvinceGeoId: 'AL',
                postalCode: '36027',
                countryGeoId: 'USA',
                estimatedDeliveryDate: '2026-06-10T00:00:00Z',
                rejectionReasonDesc: 'Inventory not available',
                routingRuleName: 'Rule name',
                facilityId: 'UNFILLABLE_PARKING',
                quantity: 2
              }, {
                orderId: 'M100001',
                orderName: '#100001',
                orderDate: '2026-06-12T10:00:00Z',
                orderStatusId: 'ORDER_APPROVED',
                customerPartyId: 'CUST_1',
                facilityId: 'UNFILLABLE_PARKING',
                quantity: '1.5'
              }]
            }
          }]
        }
      }
    });

    const result = await searchOrders({ facilityIds: ['UNFILLABLE_PARKING'] });

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].parkingUnitCount).toBe(3.5);
    expect(result.orders[0]).toMatchObject({
      orderName: '#100001',
      customerName: 'Angela Crutchfield',
      shippingAddress1: '602 White Oak Dr',
      shippingCity: 'Eufaula',
      shippingStateProvinceGeoId: 'AL',
      shippingPostalCode: '36027',
      shippingCountryGeoId: 'USA',
      estimatedDeliveryDate: '2026-06-10T00:00:00Z',
      queueReason: 'Inventory not available',
      ruleName: 'Rule name'
    });
  });

  it('builds a current physical facility volume query from indexed ORDER fields', () => {
    const payload = buildActivePhysicalFacilityOrderVolumePayload({ productStoreId: 'STORE_1' });
    const filters = activeFacilityFiltersOf({ productStoreId: 'STORE_1' });

    expect(filters).toContain('docType: ORDER');
    expect(filters).toContain('orderTypeId: SALES_ORDER');
    expect(filters).toContain('facilityId:[* TO *]');
    expect(filters).toContain('-facilityTypeId:VIRTUAL_FACILITY');
    expect(filters).toContain('-facilityId:(_NA_ OR REJECTED_ITM_PARKING OR REJECTED_PARKING OR UNFILLABLE_PARKING OR GENERAL_OPS_PARKING)');
    expect(filters).toContain('-orderStatusId:(ORDER_COMPLETED OR ORDER_CANCELLED)');
    expect(filters).toContain('productStoreId:STORE_1');
    expect(payload.json.facet.physicalFacilities).toMatchObject({
      type: 'terms',
      field: 'facilityId',
      sort: 'orderCount desc'
    });
  });

  it('normalizes active physical facility volume buckets', async () => {
    mockSolrResponse({
      facets: {
        physicalFacilities: {
          buckets: [{
            val: 'BROADWAY',
            count: 4,
            orderCount: 2,
            itemQuantity: 6,
            facilityNames: { buckets: [{ val: 'Broadway' }] }
          }, {
            val: 'GARDEN_CITY',
            count: 1,
            orderCount: 1,
            itemQuantity: 1,
            facilityNames: { buckets: [{ val: 'Garden City' }] }
          }, {
            val: 'OREM',
            count: 336,
            orderCount: 336,
            itemQuantity: 0,
            facilityNames: { buckets: [{ val: 'Orem' }] }
          }, {
            val: 'EMPTY_STORE',
            count: 0,
            orderCount: 0,
            itemQuantity: 0
          }]
        }
      }
    });

    await expect(getActivePhysicalFacilityOrderVolume()).resolves.toEqual([{
      facilityId: 'BROADWAY',
      facilityName: 'Broadway',
      lastOrderCount: 2,
      assignedItemQuantity: 6
    }, {
      facilityId: 'GARDEN_CITY',
      facilityName: 'Garden City',
      lastOrderCount: 1,
      assignedItemQuantity: 1
    }]);
  });

  it('summarizes brokered facilities from physical facility docs only', async () => {
    mockSolrResponse({
      grouped: {
        orderId: {
          ngroups: 1,
          groups: [{
            doclist: {
              docs: [{
                orderId: 'M100002',
                orderName: '#100002',
                orderStatusId: 'ORDER_APPROVED',
                facilityId: 'BROADWAY',
                facilityName: 'Broadway',
                facilityTypeId: 'RETAIL_STORE',
                quantity: 1
              }, {
                orderId: 'M100002',
                orderName: '#100002',
                orderStatusId: 'ORDER_APPROVED',
                facilityId: 'BROADWAY',
                facilityName: 'Broadway',
                facilityTypeId: 'RETAIL_STORE',
                quantity: 1
              }, {
                orderId: 'M100002',
                orderName: '#100002',
                orderStatusId: 'ORDER_APPROVED',
                facilityId: 'GARDEN_CITY',
                facilityName: 'Garden City',
                facilityTypeId: 'RETAIL_STORE',
                quantity: 1
              }, {
                orderId: 'M100002',
                orderName: '#100002',
                orderStatusId: 'ORDER_APPROVED',
                facilityId: '_NA_',
                facilityName: 'Brokering Queue',
                facilityTypeId: 'VIRTUAL_FACILITY',
                quantity: 1
              }]
            }
          }]
        }
      }
    });

    const result = await searchOrders();

    expect(result.orders[0]).toMatchObject({
      brokeredFacilityName: 'Broadway',
      brokeredFacilitySplitCount: 1,
      dominantVirtualFacilityName: '',
      brokeredItemCount: 3,
      totalItemCount: 4
    });
  });

  it('uses the dominant virtual facility when an order is fully unbrokered', async () => {
    mockSolrResponse({
      grouped: {
        orderId: {
          ngroups: 1,
          groups: [{
            doclist: {
              docs: [{
                orderId: 'M100003',
                orderName: '#100003',
                orderStatusId: 'ORDER_APPROVED',
                facilityId: '_NA_',
                facilityName: 'Brokering Queue',
                facilityTypeId: 'VIRTUAL_FACILITY',
                quantity: 1
              }, {
                orderId: 'M100003',
                orderName: '#100003',
                orderStatusId: 'ORDER_APPROVED',
                facilityId: '_NA_',
                facilityName: 'Brokering Queue',
                facilityTypeId: 'VIRTUAL_FACILITY',
                quantity: 1
              }, {
                orderId: 'M100003',
                orderName: '#100003',
                orderStatusId: 'ORDER_APPROVED',
                facilityId: '_NA_',
                facilityName: 'Brokering Queue',
                facilityTypeId: 'VIRTUAL_FACILITY',
                quantity: 1
              }, {
                orderId: 'M100003',
                orderName: '#100003',
                orderStatusId: 'ORDER_APPROVED',
                facilityId: 'REJECTED_PARKING',
                facilityName: 'Rejected Queue',
                facilityTypeId: 'VIRTUAL_FACILITY',
                quantity: 1
              }]
            }
          }]
        }
      }
    });

    const result = await searchOrders();

    expect(result.orders[0]).toMatchObject({
      brokeredFacilityName: '',
      brokeredFacilitySplitCount: 0,
      dominantVirtualFacilityName: 'Brokering Queue',
      dominantVirtualFacilitySplitCount: 1,
      brokeredItemCount: 0,
      totalItemCount: 4
    });
  });
});

describe('order-row enrichment payload', () => {
  it('deduplicates order IDs and requests the full grouped row contract in one query', () => {
    const payload = buildOrderRowEnrichmentPayload(['M100001', 'M100002', 'M100001']);
    const fields = String(payload.json.params.fl).split(' ');

    expect(payload.json.params.rows).toBe(2);
    expect(payload.json.params['group.field']).toBe('orderId');
    expect(payload.json.filter).toContain('orderId:(M100001 OR M100002)');
    expect(fields).toEqual(expect.arrayContaining([
      'customerPartyName',
      'carrierPartyId',
      'salesChannelDesc',
      'facilityId',
      'facilityName',
      'facilityTypeId',
      'orderItemSeqId',
      'shipmentMethodTypeId',
      'estimatedDeliveryDate',
      'promisedDatetime',
      'shipBeforeDate',
      'shipByDate'
    ]));
  });
});

describe('workflow order totals', () => {
  it('requests only the total from each authoritative workflow queue in one batch', async () => {
    const totalsByBucket = { open: 6440, inflight: 557, packed: 81 };
    (api as any).mockReset();
    (api as any).mockImplementation(({ url, params }: any) => {
      const bucket = url.split('/').pop() as keyof typeof totalsByBucket;
      expect(params).toMatchObject({ pageSize: 1, pageIndex: 0, productStoreId: 'STORE' });
      return Promise.resolve({ data: { ordersCount: totalsByBucket[bucket], orders: [] } });
    });

    await expect(fetchWorkflowOrderTotals('STORE')).resolves.toEqual(totalsByBucket);
    expect(api).toHaveBeenCalledTimes(3);
  });
});

describe('proactive swap setup queries', () => {
  it('facets approved active unfillable items by product count', () => {
    const payload = buildUnfillableProductCandidatesPayload('STORE_1', 25);
    expect(payload.json.filter).toEqual(expect.arrayContaining([
      'orderStatusId:ORDER_APPROVED',
      'orderItemStatusId:(ITEM_CREATED OR ITEM_APPROVED)',
      'facilityId:UNFILLABLE_PARKING',
      'productStoreId:STORE_1',
    ]));
    expect(payload.json.facet.products).toMatchObject({ field: 'productId', limit: 25, sort: 'count desc' });
  });

  it('normalizes product buckets in the server-provided count order', async () => {
    mockSolrResponse({ facets: { products: { buckets: [
      { val: 'SKU_A', count: 12 },
      { val: 'SKU_B', count: 4 },
    ] } } });
    await expect(fetchUnfillableProductCandidates('STORE_1')).resolves.toEqual([
      { productId: 'SKU_A', itemCount: 12 },
      { productId: 'SKU_B', itemCount: 4 },
    ]);
  });

  it('fetches and deduplicates affected ship groups for one product', async () => {
    const payload = buildUnfillableShipGroupsForProductPayload('STORE_1', 'SKU_A');
    expect(payload.json.filter).toContain('productId:SKU_A');
    mockSolrResponse({ response: { docs: [
      { orderId: 'ORDER_1', shipGroupSeqId: '00001' },
      { orderId: 'ORDER_1', shipGroupSeqId: '00001' },
      { orderId: 'ORDER_2', shipGroupSeqId: '00002' },
    ] } });
    await expect(fetchUnfillableShipGroupsForProduct('STORE_1', 'SKU_A')).resolves.toEqual([
      { orderId: 'ORDER_1', shipGroupSeqId: '00001' },
      { orderId: 'ORDER_2', shipGroupSeqId: '00002' },
    ]);
  });
});

describe('virtual location count payload', () => {
  function virtualLocationFiltersOf(params: Parameters<typeof buildVirtualLocationCountsPayload>[0]) {
    return buildVirtualLocationCountsPayload(params).json.filter as string[];
  }

  it('counts created and approved orders by virtual facility for the selected product store', () => {
    const filters = virtualLocationFiltersOf({
      productStoreId: 'STORE',
      facilityIds: ['_NA_', 'REJECTED_ITM_PARKING', 'UNFILLABLE_PARKING']
    });

    expect(filters).toContain('docType: ORDER');
    expect(filters).toContain('orderTypeId: SALES_ORDER');
    expect(filters).toContain('orderStatusId:(ORDER_CREATED OR ORDER_APPROVED)');
    expect(filters).toContain('productStoreId:STORE');
    expect(filters).toContain('facilityId:(_NA_ OR REJECTED_ITM_PARKING OR UNFILLABLE_PARKING)');
  });

  it('adds an order-item status filter when itemStatus is provided', () => {
    const filters = virtualLocationFiltersOf({
      productStoreId: 'STORE',
      facilityIds: ['UNFILLABLE_PARKING'],
      itemStatus: ['ITEM_CREATED', 'ITEM_APPROVED']
    });

    expect(filters).toContain('orderItemStatusId:(ITEM_CREATED OR ITEM_APPROVED)');
    // order-header status filter is still applied alongside the item filter
    expect(filters).toContain('orderStatusId:(ORDER_CREATED OR ORDER_APPROVED)');
  });

  it('omits the order-item status filter when itemStatus is not provided', () => {
    const filters = virtualLocationFiltersOf({
      productStoreId: 'STORE',
      facilityIds: ['_NA_']
    });

    expect(filters.some((filter) => filter.startsWith('orderItemStatusId:'))).toBe(false);
  });

  it('normalizes Solr facet buckets into facility order counts', async () => {
    mockSolrResponse({
      facets: {
        facilityCounts: {
          buckets: [
            { val: '_NA_', count: 3, orders: 2 },
            { val: 'UNFILLABLE_PARKING', count: 5, orders: '4' }
          ]
        }
      }
    });

    const counts = await fetchVirtualLocationOrderCounts({
      productStoreId: 'STORE',
      facilityIds: ['_NA_', 'UNFILLABLE_PARKING']
    });

    expect(counts).toEqual([
      { facilityId: '_NA_', count: 2 },
      { facilityId: 'UNFILLABLE_PARKING', count: 4 }
    ]);
  });
});
