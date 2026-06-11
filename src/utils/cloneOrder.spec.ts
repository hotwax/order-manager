import { describe, expect, it } from 'vitest';
import { buildClonePayload, cloneCustomerName, defaultCloneNote, type BuildClonePayloadOptions } from './cloneOrder';

const geoName = (geoId: string) => ({ NY: 'New York', USA: 'United States' } as Record<string, string>)[geoId] || geoId;

function sourceOrder(overrides: any = {}) {
  return {
    orderId: 'ORD10001',
    orderName: '#1001',
    externalId: '5551112223',
    currencyUom: 'EUR',
    roles: [
      { roleTypeId: 'SHIP_TO_CUSTOMER', partyId: 'CUST1' },
      { roleTypeId: 'PLACING_CUSTOMER', partyId: 'CUST1', person: { firstName: 'Jane', lastName: 'Doe' } }
    ],
    contactMechs: [
      { contactMechPurposeTypeId: 'ORDER_EMAIL', contactMech: { infoString: 'jane@example.com' } },
      {
        contactMechPurposeTypeId: 'SHIPPING_LOCATION',
        postalAddress: {
          toName: 'Jane Doe',
          address1: '1 Main St',
          address2: 'Apt 4',
          city: 'Brooklyn',
          stateProvinceGeoId: 'NY',
          postalCode: '11201',
          countryGeoId: 'USA'
        }
      },
      { contactMech: {}, telecomNumber: { countryCode: '1', areaCode: '718', contactNumber: '5550000' } }
    ],
    shipGroups: [
      {
        shipGroupSeqId: '00001',
        items: [
          { orderItemSeqId: '00101', productId: 'P1', quantity: 2, unitPrice: 25.5 },
          { orderItemSeqId: '00102', productId: 'P2', quantity: 1, unitPrice: 10 }
        ]
      },
      {
        shipGroupSeqId: '00002',
        items: [{ orderItemSeqId: '00103', productId: 'P3', quantity: 3, unitPrice: 5 }]
      }
    ],
    ...overrides
  };
}

const baseOpts: BuildClonePayloadOptions = {
  priceMode: 'CARRY',
  note: 'a note',
  shopId: 'SHOP1',
  shopifyCustomerId: '777',
  geoName
};

describe('defaultCloneNote', () => {
  it('uses the orderName when present', () => {
    expect(defaultCloneNote(sourceOrder())).toBe('Cloned from #1001 (ORD10001)');
  });

  it('falls back to the orderId when there is no orderName', () => {
    expect(defaultCloneNote(sourceOrder({ orderName: undefined }))).toBe('Cloned from ORD10001 (ORD10001)');
  });
});

describe('buildClonePayload price modes', () => {
  it('CARRY carries each source item unitPrice', () => {
    const payload = buildClonePayload(sourceOrder(), { ...baseOpts, priceMode: 'CARRY' });
    expect(payload.items.map((item) => item.price)).toEqual([25.5, 10, 5]);
  });

  it('CURRENT omits the price key entirely so Shopify prices at the current catalog', () => {
    const payload = buildClonePayload(sourceOrder(), { ...baseOpts, priceMode: 'CURRENT' });
    payload.items.forEach((item) => {
      expect('price' in item).toBe(false);
    });
  });

  it('FREE prices every item at zero', () => {
    const payload = buildClonePayload(sourceOrder(), { ...baseOpts, priceMode: 'FREE' });
    expect(payload.items.map((item) => item.price)).toEqual([0, 0, 0]);
  });
});

describe('buildClonePayload structure', () => {
  it('flattens all ship groups into one items list with original quantities', () => {
    const payload = buildClonePayload(sourceOrder(), baseOpts);
    expect(payload.items).toHaveLength(3);
    expect(payload.items.map((item) => item.productId)).toEqual(['P1', 'P2', 'P3']);
    expect(payload.items.map((item) => item.quantity)).toEqual([2, 1, 3]);
  });

  it('maps the shipping address with geo ids resolved to names and postalCode to zip', () => {
    const payload = buildClonePayload(sourceOrder(), baseOpts);
    expect(payload.shippingAddress).toEqual({
      address1: '1 Main St',
      address2: 'Apt 4',
      city: 'Brooklyn',
      province: 'New York',
      zip: '11201',
      country: 'United States',
      phone: '1 718 5550000'
    });
  });

  it('carries shop, customer id, currency, and note', () => {
    const payload = buildClonePayload(sourceOrder(), baseOpts);
    expect(payload.shopId).toBe('SHOP1');
    expect(payload.shopifyCustomerId).toBe('777');
    expect(payload.currencyCode).toBe('EUR');
    expect(payload.note).toBe('a note');
  });

  it('maps the customer from the placing-customer person and order email/phone', () => {
    const payload = buildClonePayload(sourceOrder(), baseOpts);
    expect(payload.customer).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '1 718 5550000'
    });
  });

  it('uses the injected product lookup for sku/title and falls back to productId', () => {
    const getProduct = (productId: string) =>
      productId === 'P1' ? { sku: 'SKU-1', parentProductName: 'Abominable Hoodie', productName: 'XS / Blue' } : undefined;
    const payload = buildClonePayload(sourceOrder(), { ...baseOpts, getProduct });
    expect(payload.items[0]).toMatchObject({ sku: 'SKU-1', title: 'Abominable Hoodie' });
    expect(payload.items[1]).toMatchObject({ sku: 'P2', title: 'P2' });
  });

  it('prefers itemDescription over productId for the title when no product is cached', () => {
    const raw = sourceOrder();
    raw.shipGroups[0].items[0].itemDescription = 'XS / Blue';
    const payload = buildClonePayload(raw, baseOpts);
    expect(payload.items[0].title).toBe('XS / Blue');
  });

  it('tolerates a missing email, phone, and shipping address without throwing', () => {
    const raw = sourceOrder({ contactMechs: [] });
    const payload = buildClonePayload(raw, baseOpts);
    expect(payload.customer.email).toBe('');
    expect(payload.customer.phone).toBe('');
    expect(payload.shippingAddress).toEqual({
      address1: '', address2: '', city: '', province: '', zip: '', country: '', phone: ''
    });
  });

  it('defaults the currency to USD when the order has none', () => {
    const payload = buildClonePayload(sourceOrder({ currencyUom: undefined }), baseOpts);
    expect(payload.currencyCode).toBe('USD');
  });
});

describe('cloneCustomerName fallbacks', () => {
  it('uses the partyGroup groupName when there is no person', () => {
    const raw = sourceOrder({
      roles: [{ roleTypeId: 'PLACING_CUSTOMER', partyId: 'CUST1', partyGroup: { groupName: 'Acme Corp' } }]
    });
    expect(cloneCustomerName(raw)).toEqual({ firstName: 'Acme Corp', lastName: '' });
  });

  it('splits the shipping toName when there is no placing-customer party detail', () => {
    const raw = sourceOrder({ roles: [] });
    expect(cloneCustomerName(raw)).toEqual({ firstName: 'Jane', lastName: 'Doe' });
  });

  it('returns empty names when nothing is available', () => {
    expect(cloneCustomerName({})).toEqual({ firstName: '', lastName: '' });
  });
});
