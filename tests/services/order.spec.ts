import { describe, expect, it, vi } from 'vitest';
import { commonUtil, useSolrSearch } from '@common';
import { buildOrderLookupPayload, searchOrders } from '@/services/order';

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

  it("ignores the 'All' sentinel and empty facility values", () => {
    const filters = filtersOf({ facilityIds: ['All', '', 'UNFILLABLE_PARKING'] });
    expect(filters).toContain('facilityId:UNFILLABLE_PARKING');
    expect(filters).not.toContain('facilityId:(All OR  OR UNFILLABLE_PARKING)');
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

  it('requests the address, reason, and delivery fields used by queue list rows', () => {
    const fields = fieldsOf();
    expect(fields).toEqual(expect.arrayContaining([
      'address1',
      'city',
      'stateProvinceGeoId',
      'postalCode',
      'countryGeoId',
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
});
