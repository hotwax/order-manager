import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  summarizeOrderAllocation,
  toSearchOrderRowViewModel,
  toWorkflowOrderRowViewModel
} from '@/utils/orderRows';
import type { AllocationItemDocument } from '@/types/orderRow';

const physical = (facilityId: string, facilityName: string, orderItemSeqId: string): AllocationItemDocument => ({
  orderId: 'ORDER-1',
  orderItemSeqId,
  facilityId,
  facilityName,
  facilityTypeId: 'RETAIL_STORE'
});
const virtual = (facilityId: string, facilityName: string, orderItemSeqId: string): AllocationItemDocument => ({
  orderId: 'ORDER-1',
  orderItemSeqId,
  facilityId,
  facilityName,
  facilityTypeId: 'VIRTUAL_FACILITY'
});

describe('summarizeOrderAllocation', () => {
  it('elects physical allocation for Find Order and scoped allocation for Unfillable', () => {
    const documents = [
      physical('DALLAS', 'Dallas FC', '00001'),
      virtual('UNFILLABLE_EAST', 'Unfillable East', '00002'),
      virtual('UNFILLABLE_EAST', 'Unfillable East', '00003')
    ];

    expect(summarizeOrderAllocation(documents, { mode: 'physical-first' })).toMatchObject({
      facilityId: 'DALLAS',
      brokeredItemCount: 1,
      totalItemCount: 3
    });
    expect(summarizeOrderAllocation(documents, {
      mode: 'queue-first',
      queueFacilityIds: ['UNFILLABLE_EAST']
    })).toMatchObject({
      facilityId: 'UNFILLABLE_EAST',
      brokeredItemCount: 1,
      totalItemCount: 3
    });
  });

  it('counts additional relevant facilities and elects by item-document count', () => {
    const summary = summarizeOrderAllocation([
      virtual('UNFILLABLE_WEST', 'Unfillable West', '00001'),
      virtual('UNFILLABLE_EAST', 'Unfillable East', '00002'),
      virtual('UNFILLABLE_EAST', 'Unfillable East', '00003')
    ], {
      mode: 'queue-first',
      queueFacilityIds: ['UNFILLABLE_WEST', 'UNFILLABLE_EAST']
    });

    expect(summary).toMatchObject({
      facilityId: 'UNFILLABLE_EAST',
      additionalFacilityCount: 1,
      brokeredItemCount: 0,
      totalItemCount: 3
    });
  });

  it('uses a stable facility-name then ID tie-break and returns no unrelated queue summary', () => {
    const documents = [
      virtual('QUEUE_Z', 'Zulu Queue', '00001'),
      virtual('QUEUE_A2', 'Alpha Queue', '00002'),
      virtual('QUEUE_A1', 'Alpha Queue', '00003')
    ];
    const summary = summarizeOrderAllocation(documents, {
      mode: 'queue-first',
      queueFacilityIds: ['QUEUE_Z', 'QUEUE_A2', 'QUEUE_A1']
    });

    expect(summary?.facilityId).toBe('QUEUE_A1');
    expect(summary?.additionalFacilityCount).toBe(2);
    expect(summarizeOrderAllocation(documents, {
      mode: 'queue-first',
      queueFacilityIds: ['UNFILLABLE']
    })).toBeUndefined();
  });
});

describe('order row view models', () => {
  it('omits unavailable carriers and unsupported deadlines without a placeholder', () => {
    const model = toSearchOrderRowViewModel({
      id: 'ORDER-1',
      externalId: 'WEB-1',
      orderDate: DateTime.now().startOf('day').plus({ minutes: 1 }).toISO()!,
      status: 'ORDER_APPROVED',
      customerId: 'CUSTOMER-1',
      customerName: 'Priya Shah',
      channel: 'WEB_SALES_CHANNEL',
      total: 0,
      currency: 'USD',
      paymentStatus: '',
      fulfillmentStatus: '',
      deliveryMethod: 'STANDARD_SHIPPING',
      carrierPartyId: 'N/A',
      priority: '',
      items: [],
      shipmentIds: [],
      returnIds: [],
      notes: [],
      history: []
    });

    expect(model.fulfillmentContext).toBe('Standard Shipping');
    expect(model.channelName).toBe('Web');
    expect(model.orderedRelativeAge).toMatch(/min ago|h ago/);
    expect(model.estimatedDeliveryDateTime).toBeUndefined();
  });

  it('combines workflow authority with display-only Solr enrichment', () => {
    const model = toWorkflowOrderRowViewModel({
      orderId: 'ORDER-1',
      orderName: '',
      externalId: 'EXTERNAL-1',
      statusId: 'ORDER_APPROVED',
      orderDate: DateTime.now().minus({ days: 2 }).toISO()!,
      productStoreId: 'STORE',
      productStoreName: 'Store',
      salesChannelEnumId: 'WEB_SALES_CHANNEL',
      customerName: '',
      customerPartyId: 'CUSTOMER-1',
      grandTotal: 0,
      currencyUomId: 'USD',
      itemCount: 2,
      shipGroupSeqId: '00001',
      shippingMethodTypeId: 'GROUND',
      shipmentMethodDesc: 'Ground',
      carrierPartyId: 'UPS',
      priority: 'NORMAL',
      facilityId: 'DALLAS',
      facilityName: 'Dallas FC',
      brokeringDate: null,
      picklistBinId: null,
      pickedDate: null,
      receivedAtFacility: false,
      shipBeforeDate: null,
      bucket: 'open'
    }, {
      orderId: 'ORDER-1',
      orderName: 'WEB-1',
      externalOrderId: '123456789',
      customerPartyName: 'Priya Shah',
      salesChannelDesc: 'Shopify',
      itemDocuments: [
        physical('DALLAS', 'Dallas FC', '00001'),
        physical('MIAMI', 'Miami FC', '00002'),
        physical('MIAMI', 'Miami FC', '00003')
      ]
    });

    expect(model.customerName).toBe('Priya Shah');
    expect(model.orderReference).toBe('WEB-1');
    expect(model.fulfillmentContext).toBe('UPS - Ground');
    expect(model.channelName).toBe('Shopify');
    expect(model.allocationSummary).toEqual({
      facilityId: 'DALLAS',
      facilityName: 'Dallas FC',
      additionalFacilityCount: 0,
      brokeredItemCount: 3,
      totalItemCount: 3
    });
    expect(model.orderedRelativeAge).toBe('2 days ago');
  });
});
