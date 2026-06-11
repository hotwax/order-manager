/**
 * Pure payload builder for the clone-order flow (no store/`@common` imports — unit
 * testable without mocks). Maps the raw order master-detail payload
 * (orderDetailStore.current, the verbatim API response) onto the POST
 * `oms/orders/shopify` body shape established by CreateOrder.vue.
 *
 * Product decisions (2026-06-11):
 * - ALWAYS clone ALL items with ORIGINAL ordered quantities, all ship groups
 *   flattened into one items[] — the operator trims the new order while it is
 *   in created status.
 * - Price modes: CARRY (price = source unitPrice), CURRENT (omit price so
 *   Shopify prices at the current catalog), FREE (price = 0).
 * - NO externalId is sent: cloning posts to Shopify synchronously and the new
 *   order takes its externalId from the Shopify order id on sync. Shopify
 *   legitimately posts multiple orders with the same externalId (exchanges),
 *   so externalId is NOT a dedup/idempotency key.
 */

export type ClonePriceMode = 'CARRY' | 'CURRENT' | 'FREE';

export interface CloneOrderItem {
  productId: string;
  sku: string;
  title: string;
  quantity: number;
  /** Absent in CURRENT mode — Shopify then prices the line at the current variant price. */
  price?: number;
}

export interface CloneOrderPayload {
  shopId: string;
  shopifyCustomerId: string;
  currencyCode: string;
  customer: { firstName: string; lastName: string; email: string; phone: string };
  shippingAddress: { address1: string; address2: string; city: string; province: string; zip: string; country: string; phone: string };
  items: CloneOrderItem[];
  note: string;
}

export interface BuildClonePayloadOptions {
  priceMode: ClonePriceMode;
  note: string;
  shopId: string;
  shopifyCustomerId: string;
  /** Maps stateProvinceGeoId / countryGeoId to display names — inject seed.geoName. */
  geoName: (geoId: string) => string;
  /** Optional product-cache lookup for richer sku/title — inject productCache.getProduct. */
  getProduct?: (productId: string) => any;
}

/** Default (editable) note prefill: "Cloned from <orderName or orderId> (<orderId>)". */
export function defaultCloneNote(raw: any): string {
  return `Cloned from ${raw?.orderName || raw?.orderId || ''} (${raw?.orderId || ''})`;
}

function findMechByPurpose(raw: any, purposeTypeId: string): any {
  return (raw?.contactMechs || []).find((mech: any) => mech.contactMechPurposeTypeId === purposeTypeId);
}

/** Customer email from the ORDER_EMAIL contact mech ("" when absent). */
export function cloneEmail(raw: any): string {
  return findMechByPurpose(raw, 'ORDER_EMAIL')?.contactMech?.infoString || '';
}

/** First telecom number on the order, joined like OrderDetail's customer computed ("" when absent). */
export function clonePhone(raw: any): string {
  const telecom = (raw?.contactMechs || []).find((mech: any) => mech.telecomNumber)?.telecomNumber;
  return telecom ? [telecom.countryCode, telecom.areaCode, telecom.contactNumber].filter(Boolean).join(' ') : '';
}

/**
 * Customer first/last name from the placing-customer role's joined Person,
 * falling back to PartyGroup.groupName, then to the shipping address toName
 * (split on the first space) — mirroring orderDetailStore.customerName.
 */
export function cloneCustomerName(raw: any): { firstName: string; lastName: string } {
  const role = (raw?.roles || []).find((entry: any) => entry.roleTypeId === 'PLACING_CUSTOMER');
  const person = role?.person;
  if (person && (person.firstName || person.lastName)) {
    return { firstName: person.firstName || '', lastName: person.lastName || '' };
  }
  if (role?.partyGroup?.groupName) {
    return { firstName: role.partyGroup.groupName, lastName: '' };
  }
  const toName: string = findMechByPurpose(raw, 'SHIPPING_LOCATION')?.postalAddress?.toName || '';
  const [firstName = '', ...rest] = toName.split(' ').filter(Boolean);
  return { firstName, lastName: rest.join(' ') };
}

export function buildClonePayload(raw: any, opts: BuildClonePayloadOptions): CloneOrderPayload {
  const email = cloneEmail(raw);
  const phone = clonePhone(raw);
  const { firstName, lastName } = cloneCustomerName(raw);
  const address = findMechByPurpose(raw, 'SHIPPING_LOCATION')?.postalAddress || {};

  const items: CloneOrderItem[] = (raw?.shipGroups || []).flatMap((shipGroup: any) =>
    (shipGroup.items || []).map((item: any) => {
      const product = opts.getProduct?.(item.productId);
      const cloned: CloneOrderItem = {
        productId: item.productId,
        sku: product?.sku || item.productId,
        title: product?.parentProductName || product?.productName || item.itemDescription || item.productId,
        quantity: Number(item.quantity || 0)
      };
      if (opts.priceMode === 'CARRY') cloned.price = Number(item.unitPrice || 0);
      if (opts.priceMode === 'FREE') cloned.price = 0;
      // CURRENT: leave price out entirely so Shopify uses the current variant price.
      return cloned;
    })
  );

  return {
    shopId: opts.shopId,
    shopifyCustomerId: opts.shopifyCustomerId,
    currencyCode: raw?.currencyUom || 'USD',
    customer: { firstName, lastName, email, phone },
    shippingAddress: {
      address1: address.address1 || '',
      address2: address.address2 || '',
      city: address.city || '',
      province: address.stateProvinceGeoId ? opts.geoName(address.stateProvinceGeoId) : '',
      zip: address.postalCode || '',
      country: address.countryGeoId ? opts.geoName(address.countryGeoId) : '',
      phone
    },
    items,
    note: opts.note
  };
}
