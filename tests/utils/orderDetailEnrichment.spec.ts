import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { enrichOrder, type EnrichmentAuxiliaryData } from '@/utils/orderDetailEnrichment';
import { buildOrderEvents } from '@/utils/orderEvents';

const T = (minutes: number) => 1_700_000_000_000 + minutes * 60_000;

const facilities: Record<string, any> = {
  STORE_A: { facilityTypeId: 'RETAIL_STORE', facilityName: 'Store A' },
  PARKING: { facilityTypeId: 'PARKING', facilityName: 'Parking' },
};
const facilityTypes: Record<string, any> = { PARKING: { parentTypeId: 'VIRTUAL_FACILITY' } };

const seed: any = {
  facility: (id: string) => facilities[id],
  facilityType: (id: string) => facilityTypes[id],
  facilityName: (id: string) => facilities[id]?.facilityName || id,
  statusDescription: (id: string) => (id ? `desc:${id}` : ''),
  enumDescription: (id: string) => `enum:${id}`,
  describe: (id: string) => `describe:${id}`,
  productStoreName: () => 'Store',
  orderIdentificationTypeDescription: (id: string) => id,
  paymentMethodDescription: (id: string) => id,
  shipmentMethodDescription: (id: string) => `method:${id}`,
  geoName: (id: string) => id,
  orderAdjustmentTypeDescription: (id: string) => id,
};
const stores = { seed, productCache: { getProduct: () => undefined } as any };

function aux(overrides: Partial<EnrichmentAuxiliaryData> = {}): EnrichmentAuxiliaryData {
  return {
    totals: { subtotal: 0, adjustments: {}, includedAdjustments: {}, total: 0 },
    groupAdjustments: {},
    customerPartyId: '',
    customerName: '',
    customerProfile: null,
    events: [],
    issuanceByItem: null,
    riskAssessments: [],
    returnedQtyBySeqId: {},
    inventoryTransfers: [],
    ...overrides,
  };
}

function rawOrder(overrides: Record<string, any> = {}) {
  return {
    orderId: 'O1',
    orderName: '#1001',
    statusId: 'ORDER_APPROVED',
    currencyUom: 'USD',
    orderDate: T(0),
    contactMechs: [{
      contactMechId: 'CM_SHIP',
      contactMechPurposeTypeId: 'SHIPPING_LOCATION',
      postalAddress: { toName: 'Jane', address1: '1 Main St', city: 'Austin', postalCode: ' 73301 ', latitude: '30.25', longitude: '-97.75' }
    }],
    shipGroups: [
      { shipGroupSeqId: '00001', facilityId: 'STORE_A', contactMechId: 'CM_SHIP', shipmentMethodTypeId: 'STANDARD',
        items: [{ orderItemSeqId: '01', productId: 'P1', externalId: 'EXT1', quantity: 1, unitPrice: 10, statusId: 'ITEM_APPROVED' }] },
      { shipGroupSeqId: '00002', facilityId: 'PARKING',
        items: [{ orderItemSeqId: '02', productId: 'P1', externalId: 'EXT1', quantity: 2, unitPrice: 10, statusId: 'ITEM_CREATED' }] },
      { shipGroupSeqId: '00003', facilityId: 'STORE_A', shipmentMethodTypeId: 'POS_COMPLETED',
        items: [{ orderItemSeqId: '03', productId: 'P3', quantity: 2, unitPrice: 5, statusId: 'ITEM_COMPLETED' }] },
    ],
    ...overrides,
  };
}

describe('enrichOrder', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('dates a physical group from its earliest facility change when it has no brokered row', () => {
    const raw = rawOrder();
    const events = buildOrderEvents({
      order: raw,
      facilityChanges: [
        { shipGroupSeqId: '00001', fromFacilityId: 'STORE_A', facilityId: 'STORE_A', changeDatetime: T(20) },
        { shipGroupSeqId: '00001', changeReasonEnumId: 'ALLOCATED', fromFacilityId: 'PARKING', facilityId: 'STORE_A', changeDatetime: T(10) },
        { shipGroupSeqId: '00002', changeReasonEnumId: 'PARKED', fromFacilityId: 'STORE_A', facilityId: 'PARKING', changeDatetime: T(5) },
      ],
      facilityChangesLoaded: true,
      unfillable: null,
      fulfillment: [{ shipGroupSeqId: '00001', picklistDate: T(30) }],
      returnHeadersById: {},
      exchangeChildren: [],
      isVirtualFacility: (facilityId) => facilityId === 'PARKING',
    });
    const order = enrichOrder(raw, aux({ events }), stores);

    const [physical, parked] = order.shipGroups;
    expect(physical.lifecycle.firstBrokeredDate).toBe(T(10));
    expect(physical.isBrokered).toBe(true);
    // Picked is dated, packing and shipping are not: a quarter per step after brokering.
    expect(physical.lifecycle.picklistDate).toBe(T(30));
    expect(physical.progress).toBe(0.5);
    // A parked group's facility changes record parking and rejections, never a brokering.
    expect(parked.lifecycle.firstBrokeredDate).toBeUndefined();
    expect(parked.isBrokered).toBe(false);
    expect(parked.statusLabel).toBe('Not brokered');
  });

  it('reports issuance on counter-sale lines only, with a kind the card translates', () => {
    const order = enrichOrder(rawOrder(), aux({ issuanceByItem: { '03': { issued: 2, qohBefore: 5, qohAfter: 3 } } }), stores);
    expect(order.shipGroups[2].items[0].issuance).toEqual({ kind: 'issued', tone: 'success', qohBefore: 5, qohAfter: 3 });
    expect(order.shipGroups[0].items[0].issuance).toBeUndefined();

    // Rows not loaded yet (or failed) must not read as "not issued".
    expect(enrichOrder(rawOrder(), aux(), stores).shipGroups[2].items[0].issuance).toBeUndefined();
  });

  it("falls back to the customer's contact, matched on its purposeTypeIds", () => {
    const order = enrichOrder(rawOrder(), aux({
      customerProfile: {
        contactMechs: [
          { contactMechTypeId: 'EMAIL_ADDRESS', infoString: 'old@example.com', purposeTypeIds: ['PRIMARY_EMAIL'], thruDate: T(-10) },
          { contactMechTypeId: 'EMAIL_ADDRESS', infoString: 'jane@example.com', purposeTypeIds: ['PRIMARY_EMAIL'] },
        ],
      },
    }), stores);
    expect(order.customer.email).toBe('jane@example.com');
  });

  it('gives each item its inventory transfers, newest first, with names, status and source resolved', () => {
    const order = enrichOrder(rawOrder(), aux({
      inventoryTransfers: [
        { inventoryTransferId: 'X1', orderItemSeqId: '01', statusId: 'IXF_CANCELLED', statusReasonEnumId: 'IXF_ORDER_REALLOC',
          facilityId: 'PARKING', facilityIdTo: 'STORE_A', quantity: 1, sourceId: 'REGIONAL_BROKER', createdStamp: T(0) },
        { inventoryTransferId: 'X2', orderItemSeqId: '01', statusId: 'IXF_REQUESTED',
          facilityId: 'PARKING', facilityIdTo: 'STORE_A', quantity: 2, sourceId: 'ORDER_MANAGER', comments: 'Rush', createdStamp: T(10) },
        { inventoryTransferId: 'X3', orderItemSeqId: '02', statusId: 'IXF_COMPLETE',
          facilityId: 'STORE_A', facilityIdTo: 'PARKING', quantity: 1, createdStamp: T(5) },
      ],
    }), stores);
    const itemOf = (shipGroupId: string) => order.shipGroups.find((shipGroup) => shipGroup.id === shipGroupId)!.items[0];

    expect(itemOf('00001').transfers).toEqual([
      { id: 'X2', statusId: 'IXF_REQUESTED', status: 'desc:IXF_REQUESTED', isOpen: true, fromFacilityId: 'PARKING', fromFacilityName: 'Parking', toFacilityId: 'STORE_A', toFacilityName: 'Store A',
        quantity: 2, requestedDate: T(10), sourceLabel: 'Order Manager', comments: 'Rush', reason: '' },
      { id: 'X1', statusId: 'IXF_CANCELLED', status: 'desc:IXF_CANCELLED', isOpen: false, fromFacilityId: 'PARKING', fromFacilityName: 'Parking', toFacilityId: 'STORE_A', toFacilityName: 'Store A',
        quantity: 1, requestedDate: T(0), sourceLabel: 'Regional brokering', comments: '', reason: 'enum:IXF_ORDER_REALLOC' },
    ]);
    expect(itemOf('00002').transfers.map((transfer) => transfer.id)).toEqual(['X3']);
    expect(itemOf('00003').transfers).toEqual([]);
  });

  it('rolls items up by external id across ship groups', () => {
    const order = enrichOrder(rawOrder(), aux(), stores);
    const group = order.groupedItems.find((candidate) => candidate.externalId === 'EXT1')!;
    expect(group.items.map((item) => item.orderItemSeqId)).toEqual(['01', '02']);
    expect(group.totalQty).toBe(3);
    expect(group.totalPrice).toBe(30);
    expect(group.statuses).toEqual([
      { label: 'desc:ITEM_APPROVED', color: expect.any(String), count: 1 },
      { label: 'desc:ITEM_CREATED', color: expect.any(String), count: 2 },
    ]);
  });

  it('summarises payments: collected, net of refunds, and refunded pinned last', () => {
    const order = enrichOrder(rawOrder({
      paymentPreferences: [
        { orderPaymentPreferenceId: 'P1', statusId: 'PAYMENT_REFUNDED', maxAmount: 40 },
        { orderPaymentPreferenceId: 'P2', statusId: 'PAYMENT_SETTLED', maxAmount: 25.5 },
        { orderPaymentPreferenceId: 'P3', statusId: 'PAYMENT_CANCELLED', maxAmount: 99 },
      ],
    }), aux(), stores);

    expect(order.payments.receivedTotal).toBe(25.5);
    expect(order.payments.netAmount).toBe(-14.5);
    expect(order.payments.netColor).toBe('danger');
    expect(order.payments.sections.map((section) => section.statusId)).toEqual(['PAYMENT_SETTLED', 'PAYMENT_CANCELLED', 'PAYMENT_REFUNDED']);
  });

  it('carries the ship-to coordinates and postal code for the distance lookup', () => {
    const [physical] = enrichOrder(rawOrder(), aux(), stores).shipGroups;
    expect(physical.shippingAddress).toMatchObject({
      contactMechId: 'CM_SHIP',
      coordinates: { lat: 30.25, lon: -97.75 },
      postalCode: '73301',
      view: { name: 'Jane', street: '1 Main St', locality: 'Austin,  73301 ' },
    });
  });

  it('names an attribute without a name rather than dropping it', () => {
    const order = enrichOrder(rawOrder({ attributes: [{ attrName: 'gift', attrValue: 'yes' }, { attrValue: 'orphan' }] }), aux(), stores);
    expect(order.attributes.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'gift', value: 'yes' },
      { name: 'Attribute', value: 'orphan' },
    ]);
  });
});
