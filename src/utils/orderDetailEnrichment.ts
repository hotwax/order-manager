import { commonUtil, translate } from '@common';
import { summarizeBrokeredFacilities } from '@/services/order';
import { OrderActionValidator } from './OrderActionValidator';
import { shipGroupItemStates } from './shipGroupItemStates';
import { rollUpItemStatuses } from './itemStatusBadges';
import { sentimentCounts } from './index';
import { toMillis } from './format';
import { shipGroupMilestones, type OrderEvent } from './orderEvents';
import { adjustmentAmount, adjustmentKey, adjustmentLabel } from './orderAdjustments';
import type { SeedLookup } from './seedLookup';
import type { useProductCacheStore } from '@/store/productCache';
import type { ItemIssuanceSummary } from '@/store/orderDetail';
import type {
  EnrichedItemGroup,
  EnrichedOrder,
  EnrichedOrderItem,
  EnrichedOrderPayments,
  EnrichedShipGroup,
  EnrichedShippingAddress,
  EnrichedTransfer,
  ItemIssuance,
} from '@/types/orderDetail';

/** What the order store has already derived or loaded for the order; see enrichedOrderByOrderId. */
export interface EnrichmentAuxiliaryData {
  totals: { subtotal: number; adjustments: Record<string, number>; includedAdjustments: Record<string, number>; total: number };
  groupAdjustments: Record<string, Array<{ label: string; amount: number; isIncluded: boolean }>>;
  customerPartyId: string;
  customerName: string;
  customerProfile: any;
  /** The order's history as typed events (see utils/orderEvents); ship groups read their milestones here. */
  events: OrderEvent[];
  issuanceByItem: Record<string, ItemIssuanceSummary> | null;
  riskAssessments: any[];
  returnedQtyBySeqId: Record<string, number>;
  /** Raw InventoryTransfer rows for the order's items, newest first. */
  inventoryTransfers: any[];
}

export interface EnrichmentStores {
  seed: SeedLookup;
  productCache: ReturnType<typeof useProductCacheStore>;
}

const PAYMENT_COLLECTED_STATUSES = new Set(['PAYMENT_AUTHORIZED', 'PAYMENT_SETTLED', 'PAYMENT_RECEIVED']);

/**
 * A ship group sold over the counter. OMS treats POS_COMPLETED as needing no fulfillment at all
 * (`requiresFulfillment` in OrderServices get#SalesOrder), so the group has no carrier, no ship-to
 * address, and no brokering/pick/pack/ship dates — the goods left with the customer.
 */
export function isPosCompletedShipGroup(shipGroup: any): boolean {
  return shipGroup?.shipmentMethodTypeId === 'POS_COMPLETED';
}

/* ── Contacts ─────────────────────────────────────────────────────────────── */

function contactPurposeIds(contact: any): string[] {
  return [
    contact?.contactMechPurposeTypeId,
    ...(contact?.purposeTypeIds || []),
    ...((contact?.purposes || []).map((purpose: any) => purpose.contactMechPurposeTypeId)),
  ].filter(Boolean);
}

function contactMatchesPurpose(contact: any, purposeTypeIds: string[]) {
  if (!purposeTypeIds.length) return true;
  const purposes = new Set(contactPurposeIds(contact));
  return purposeTypeIds.some((purposeTypeId) => purposes.has(purposeTypeId));
}

const contactPostalAddress = (contact: any) => contact?.postalAddress || contact?.contactMech?.postalAddress;
const contactTelecomNumber = (contact: any) => contact?.telecomNumber || contact?.contactMech?.telecomNumber;
const contactInfoString = (contact: any) => contact?.contactMech?.infoString || contact?.infoString || '';

function contactMechTypeIdFromContact(contact: any, fallbackTypeId: string) {
  return contact?.contactMechTypeId || contact?.contactMech?.contactMechTypeId
    || (contactPostalAddress(contact) ? 'POSTAL_ADDRESS' : contactTelecomNumber(contact) ? 'TELECOM_NUMBER' : fallbackTypeId);
}

function formatTelecomNumber(telecom: any) {
  if (!telecom) return '';
  return [telecom.countryCode, telecom.areaCode, telecom.contactNumber].filter(Boolean).join(' ');
}

function isActiveContact(contact: any) {
  if (!contact.thruDate) return true;
  const thruMillis = toMillis(contact.thruDate);
  return !thruMillis || thruMillis > Date.now();
}

/** The order's own contact of this type and purpose, else the customer's active one. */
function findContact(raw: any, customerProfile: any, contactMechTypeId: string, orderPurposes: string[], customerPurposes = orderPurposes) {
  return (raw.contactMechs || []).find((contact: any) =>
    contactMechTypeId === contactMechTypeIdFromContact(contact, contactMechTypeId) && contactMatchesPurpose(contact, orderPurposes))
    || (customerProfile?.contactMechs || []).find((contact: any) =>
      contact.contactMechTypeId === contactMechTypeId && isActiveContact(contact) && contactMatchesPurpose(contact, customerPurposes));
}

const PHONE_PURPOSES = ['PHONE_BILLING', 'PRIMARY_PHONE', 'PHONE_SHIPPING', 'PHONE_MOBILE'];

function addressLines(postalAddress: any, seed: EnrichmentStores['seed']): string[] {
  if (!postalAddress) return [];
  return [
    postalAddress.toName,
    postalAddress.address1,
    postalAddress.address2,
    [postalAddress.city, seed.geoName(postalAddress.stateProvinceGeoId), postalAddress.postalCode].filter(Boolean).join(', '),
    seed.geoName(postalAddress.countryGeoId),
  ].filter(Boolean) as string[];
}

function numeric(value: any): number | undefined {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function shippingAddress(mech: any, seed: EnrichmentStores['seed']): EnrichedShippingAddress | null {
  const addr = mech?.postalAddress;
  if (!addr) return null;
  const lat = numeric(addr.latitude);
  const lon = numeric(addr.longitude);
  return {
    contactMechId: mech.contactMechId || '',
    postalAddress: addr,
    lines: addressLines(addr, seed),
    view: {
      name: addr.toName || '',
      street: [addr.address1, addr.address2].filter(Boolean).join(', '),
      locality: [addr.city, addr.postalCode, seed.geoName(addr.stateProvinceGeoId), seed.geoName(addr.countryGeoId)].filter(Boolean).join(', '),
    },
    coordinates: lat !== undefined && lon !== undefined ? { lat, lon } : null,
    postalCode: String(addr.postalCode || '').trim(),
  };
}

/* ── Items and ship groups ────────────────────────────────────────────────── */

const OPEN_TRANSFER_STATUSES = new Set(['IXF_REQUESTED', 'IXF_SCHEDULED', 'IXF_EN_ROUTE']);
const TRANSFER_SOURCE_LABELS: Record<string, string> = {
  REGIONAL_BROKER: 'Regional brokering',
  ORDER_MANAGER: 'Order Manager',
  TRANSFERS_APP: 'Transfers app',
};

/** An order item's inventory transfers, newest first, with facility names, status and source resolved. */
function itemTransfers(orderItemSeqId: string, rows: any[], seed: EnrichmentStores['seed']): EnrichedTransfer[] {
  return rows
    .filter((row: any) => row.orderItemSeqId === orderItemSeqId)
    .map((row: any) => ({
      id: row.inventoryTransferId,
      statusId: row.statusId,
      status: seed.statusDescription(row.statusId),
      isOpen: OPEN_TRANSFER_STATUSES.has(row.statusId),
      fromFacilityId: row.facilityId,
      fromFacilityName: seed.facilityName(row.facilityId),
      toFacilityId: row.facilityIdTo,
      toFacilityName: seed.facilityName(row.facilityIdTo),
      quantity: Number(row.quantity || 0),
      requestedDate: toMillis(row.createdStamp),
      sourceLabel: row.sourceId ? translate(TRANSFER_SOURCE_LABELS[row.sourceId] || row.sourceId) : '',
      comments: row.comments || '',
      reason: row.statusReasonEnumId ? seed.enumDescription(row.statusReasonEnumId) : '',
    }))
    .sort((left, right) => (right.requestedDate || 0) - (left.requestedDate || 0));
}

function itemAdjustmentSummaries(raw: any, rawItem: any, seed: EnrichmentStores['seed']): Array<{ comment: string; amount: number }> {
  const orderItemSeqId = rawItem.orderItemSeqId;
  const totals: Record<string, number> = {};
  const seen = new Set<string>();

  [
    ...(raw.adjustments || []).filter((adj: any) => adj.orderItemSeqId === orderItemSeqId),
    ...(rawItem.adjustments || []),
  ].forEach((adj: any) => {
    const label = adjustmentLabel(adj, seed.orderAdjustmentTypeDescription, translate('Adjustment'));
    const key = adjustmentKey(adj, label, orderItemSeqId);
    if (seen.has(key)) return;
    seen.add(key);

    const { amount, isIncluded } = adjustmentAmount(adj);
    if (amount === 0) return;
    const comment = isIncluded ? translate('{label} (included)', { label }) : label;
    totals[comment] = (totals[comment] || 0) + amount;
  });

  return Object.entries(totals)
    .filter(([, amount]) => amount !== 0)
    .map(([comment, amount]) => ({ comment, amount }));
}

/**
 * Whether inventory was issued for a counter-sale line, and how completely. Completion and
 * issuance are separate steps — issue#PosOrderInventory skips an order whose facility is not a
 * physical store — so an item can be ITEM_COMPLETED with no inventory ever issued.
 */
function itemIssuance(rawItem: any, issuanceByItem: Record<string, ItemIssuanceSummary>): ItemIssuance {
  const ordered = Number(rawItem.quantity) || 0;
  const summary = issuanceByItem[rawItem.orderItemSeqId];
  const issued = summary?.issued || 0;
  const stock = { qohBefore: summary?.qohBefore ?? 0, qohAfter: summary?.qohAfter ?? 0 };

  if (issued <= 0) return { kind: 'none', tone: 'warning', ...stock };
  if (ordered && issued < ordered) return { kind: 'partial', tone: 'warning', ...stock };
  return { kind: 'issued', tone: 'success', ...stock };
}

function enrichShipGroup(
  sg: any,
  raw: any,
  aux: EnrichmentAuxiliaryData,
  stores: EnrichmentStores,
  context: { contactMechsById: Record<string, any>; shippingLocation: any }
): EnrichedShipGroup {
  const { seed, productCache } = stores;
  const facilityTypeId = seed.facility(sg.facilityId)?.facilityTypeId;
  const isVirtual = OrderActionValidator.isVirtualFacility({
    facilityId: sg.facilityId,
    facilityTypeId,
    facilityParentTypeId: seed.facilityType(facilityTypeId)?.parentTypeId,
  });
  const isPosCompleted = isPosCompletedShipGroup(sg);
  const { total, fulfilled, settled } = shipGroupItemStates(sg.items);
  // The same events the timeline shows date this group's brokered → pick → pack → ship steps.
  const lifecycle = shipGroupMilestones(aux.events, sg.shipGroupSeqId, isVirtual);
  const isBrokered = !isVirtual || !!lifecycle.firstBrokeredDate;

  // Item status wins for a stopped group; the timeline only describes one still in motion.
  let progress = 0;
  if (isPosCompleted) progress = 1;
  else if (settled) progress = fulfilled / total;
  else progress = [isBrokered, lifecycle.picklistDate, lifecycle.packedDate, lifecycle.shippedDate].filter(Boolean).length * 0.25;

  // Cancelled items are routinely moved to a virtual facility such as REJECTED_ITM_PARKING, so the
  // brokering label comes after the terminal checks or a stopped card would read "Not brokered".
  let statusLabel = translate('{percent}% complete', { percent: Math.round(progress * 100) });
  if (isPosCompleted) statusLabel = translate('Sold in store');
  else if (settled && fulfilled === 0) statusLabel = translate('Cancelled');
  else if (settled && fulfilled < total) statusLabel = translate('Partially complete');
  else if (!settled && isVirtual) statusLabel = translate('Not brokered');

  const facilityName = seed.facilityName(sg.facilityId);
  const rawItems: any[] = sg.items || [];
  const units = rawItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

  const items: EnrichedOrderItem[] = rawItems.map((item: any) => {
    const product = productCache.getProduct(item.productId);
    const sku = product?.sku || item.productId;
    const statusId = item.statusId || '';
    const status = seed.statusDescription(statusId);
    const statusColor = commonUtil.getStatusColor(statusId);
    const attributes = item.orderItemAttributes || item.attributes || item.orderItemAttributeList || [];
    return {
      orderItemSeqId: item.orderItemSeqId,
      externalId: item.externalId || sku || item.orderItemSeqId,
      productId: item.productId,
      // parentProductName is the product title ("Abominable Hoodie"); productName is the variant
      // ("XS / Blue", ~= itemDescription). Prefer the title, then the variant, then the id.
      name: product?.parentProductName || product?.productName || item.itemDescription || item.productId,
      sku,
      imageUrl: product?.mainImageUrl || '',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      statusId,
      status,
      statusColor,
      statuses: status ? [{ label: status, color: statusColor }] : [],
      shipGroupSeqId: sg.shipGroupSeqId,
      facilityId: sg.facilityId || '',
      facilityName: facilityName || translate('Facility'),
      attributes,
      attributeCount: attributes.length,
      adjustments: itemAdjustmentSummaries(raw, item, seed),
      issuance: isPosCompleted && aux.issuanceByItem ? itemIssuance(item, aux.issuanceByItem) : undefined,
      transfers: itemTransfers(item.orderItemSeqId, aux.inventoryTransfers, seed),
    };
  });

  return {
    id: sg.shipGroupSeqId,
    facilityId: sg.facilityId,
    facilityName,
    isVirtual,
    isPosCompleted,
    isBrokered,
    isSettled: settled,
    progress,
    statusLabel,
    itemSummary: `${translate('{count} items', { count: rawItems.length })}, ${translate('{count} units', { count: units })}`,
    lifecycle,
    shippingAddress: shippingAddress(sg.contactMechId ? context.contactMechsById[sg.contactMechId] : context.shippingLocation, seed),
    carrierPartyId: sg.carrierPartyId,
    shipmentMethodTypeId: sg.shipmentMethodTypeId,
    shippingMethodLabel: sg.shipmentMethodTypeId ? seed.shipmentMethodDescription(sg.shipmentMethodTypeId) : '',
    estimatedShipDate: sg.estimatedShipDate,
    estimatedDeliveryDate: sg.estimatedDeliveryDate,
    shipAfterDate: sg.shipAfterDate,
    shipByDate: sg.shipByDate,
    giftMessage: sg.giftMessage,
    shippingInstructions: sg.shippingInstructions,
    contactMechId: sg.contactMechId,
    items,
  };
}

/**
 * Same location-chip semantics as the Find Orders list rows: the top physical facility wins the
 * chip (+N for further splits), and virtual/parking facilities only label it when nothing is brokered.
 */
function groupLocationLabel(items: EnrichedOrderItem[], seed: EnrichmentStores['seed']): string {
  const summary = summarizeBrokeredFacilities(items.map((item) => ({
    facilityId: item.facilityId,
    facilityName: seed.facilityName(item.facilityId) || item.facilityName,
    facilityTypeId: seed.facility(item.facilityId)?.facilityTypeId,
  })));

  const brokered = Boolean(summary.brokeredFacilityName);
  const name = summary.brokeredFacilityName || summary.dominantVirtualFacilityName;
  if (!name) return '';
  const splitCount = brokered ? summary.brokeredFacilitySplitCount : summary.dominantVirtualFacilitySplitCount;
  return splitCount > 0 ? `${name} +${splitCount}` : name;
}

function groupItems(shipGroups: EnrichedShipGroup[], aux: EnrichmentAuxiliaryData, seed: EnrichmentStores['seed']): EnrichedItemGroup[] {
  const groups = new Map<string, EnrichedItemGroup>();
  shipGroups.flatMap((sg) => sg.items).forEach((item) => {
    let group = groups.get(item.externalId);
    if (!group) {
      group = {
        externalId: item.externalId,
        productId: item.productId || '',
        name: item.name,
        sku: item.sku,
        totalQty: 0,
        totalPrice: 0,
        statuses: [],
        locationLabel: '',
        adjustments: (aux.groupAdjustments[item.externalId] || [])
          .map((adj) => ({ ...adj, amount: Number(adj.amount) }))
          .filter((adj) => adj.amount !== 0),
        items: [],
      };
      groups.set(item.externalId, group);
    }
    group.items.push(item);
    group.totalQty += item.quantity;
    group.totalPrice += item.unitPrice * item.quantity;
  });

  return [...groups.values()].map((group) => ({
    ...group,
    statuses: rollUpItemStatuses(group.items),
    locationLabel: groupLocationLabel(group.items, seed),
  }));
}

/* ── Payments and attributes ──────────────────────────────────────────────── */

function paymentSummary(raw: any, aux: EnrichmentAuxiliaryData, seed: EnrichmentStores['seed']): EnrichedOrderPayments {
  const list = (raw.paymentPreferences || []).map((payment: any) => ({
    id: payment.orderPaymentPreferenceId,
    paymentMethodTypeId: payment.paymentMethodTypeId,
    paymentMethodTypeDesc: seed.paymentMethodDescription(payment.paymentMethodTypeId),
    amount: Number(payment.maxAmount ?? payment.presentmentAmount ?? 0),
    statusId: payment.statusId,
    statusDesc: seed.statusDescription(payment.statusId),
    createdDate: payment.createdDate || payment.createdStamp,
    parentRefNum: payment.parentRefNum || '',
  }));
  const round = (value: number) => Math.round(value * 100) / 100;

  // Only preferences that actually collected money count — refunded, cancelled and declined ones
  // would otherwise inflate the total past the grand total. Net subtracts refunds.
  let receivedTotal = 0;
  let netAmount = 0;
  const sectionsByStatus = new Map<string, EnrichedOrderPayments['sections'][number]>();
  list.forEach((payment: any) => {
    if (PAYMENT_COLLECTED_STATUSES.has(payment.statusId)) {
      receivedTotal += payment.amount;
      netAmount += payment.amount;
    } else if (payment.statusId === 'PAYMENT_REFUNDED') {
      netAmount -= payment.amount;
    }

    const statusId = payment.statusId || 'UNKNOWN';
    if (!sectionsByStatus.has(statusId)) {
      sectionsByStatus.set(statusId, { statusId, label: payment.statusDesc || statusId, payments: [], total: 0 });
    }
    const section = sectionsByStatus.get(statusId)!;
    section.payments.push(payment);
    section.total += payment.amount;
  });

  // One section per status in order of first appearance, refunded pinned to the bottom.
  const sections = [...sectionsByStatus.values()]
    .map((section) => ({ ...section, total: round(section.total) }))
    .sort((left, right) => Number(left.statusId === 'PAYMENT_REFUNDED') - Number(right.statusId === 'PAYMENT_REFUNDED'));

  // Negative net = more refunded than collected. Positive net on a fully returned order = money
  // still held for goods that all came back — likely a refund owed.
  const liveItems = (raw.shipGroups || []).flatMap((sg: any) => sg.items || []).filter((item: any) => item.statusId !== 'ITEM_CANCELLED');
  const allItemsReturned = liveItems.length > 0
    && liveItems.every((item: any) => (aux.returnedQtyBySeqId[item.orderItemSeqId] || 0) >= Number(item.quantity || 0));
  const net = round(netAmount);

  return {
    list,
    receivedTotal: round(receivedTotal),
    netAmount: net,
    netColor: net < 0 ? 'danger' : net > 0 && allItemsReturned ? 'warning' : undefined,
    sections,
  };
}

function orderAttributeRows(raw: any) {
  return (raw.attributes || raw.orderAttributes || raw.orderAttributeList || [])
    .map((attribute: any, index: number) => {
      const name = attribute.name ?? attribute.attrName ?? attribute.attributeName ?? attribute.orderAttributeName ?? attribute.orderAttributeTypeId;
      const value = attribute.value ?? attribute.attrValue ?? attribute.attributeValue ?? attribute.orderAttributeValue;
      const description = attribute.description ?? attribute.attrDescription ?? attribute.attributeDescription ?? '';
      return {
        id: attribute.orderAttributeId || `${name || 'attribute'}-${index}`,
        name: name ? String(name) : translate('Attribute'),
        value: value == undefined ? '' : String(value),
        description: description ? String(description) : '',
      };
    })
    .filter((attribute: any) => attribute.name || attribute.value || attribute.description);
}

/* ── The view model ───────────────────────────────────────────────────────── */

/**
 * Join the raw order document with what the store has loaded and derived around it, into the
 * shape the order page renders. Reads the seed and product caches, so it re-runs as they fill.
 */
export function enrichOrder(raw: any, aux: EnrichmentAuxiliaryData, stores: EnrichmentStores): EnrichedOrder {
  const { seed } = stores;
  const contactMechsById: Record<string, any> = {};
  let shippingLocation: any;
  (raw.contactMechs || []).forEach((mech: any) => {
    if (mech.contactMechId) contactMechsById[mech.contactMechId] = mech;
    if (mech.contactMechPurposeTypeId === 'SHIPPING_LOCATION') shippingLocation = mech;
  });

  const shipGroups = (raw.shipGroups || []).map((sg: any) =>
    enrichShipGroup(sg, raw, aux, stores, { contactMechsById, shippingLocation }));

  const emailContact = findContact(raw, aux.customerProfile, 'EMAIL_ADDRESS', ['ORDER_EMAIL'], ['ORDER_EMAIL', 'PRIMARY_EMAIL']);
  const phoneContact = findContact(raw, aux.customerProfile, 'TELECOM_NUMBER', PHONE_PURPOSES);
  const billingLines = addressLines(contactPostalAddress(findContact(raw, aux.customerProfile, 'POSTAL_ADDRESS', ['BILLING_LOCATION'])), seed);

  const shippingMethods = [...new Set(shipGroups.map((sg: EnrichedShipGroup) => sg.shippingMethodLabel).filter(Boolean))].join(', ');
  const adjustmentRows = [
    ...Object.entries(aux.totals.adjustments).map(([label, amount]) => ({ label, amount: Number(amount), isIncluded: false })),
    ...Object.entries(aux.totals.includedAdjustments || {}).map(([label, amount]) => ({ label, amount: Number(amount), isIncluded: true })),
  ]
    .filter((row) => row.amount !== 0)
    .map((row) => ({ ...row, detail: /shipping/i.test(row.label) ? shippingMethods : '' }));

  const riskRecommendationEnumId = raw.riskRecommendationEnumId || '';
  const riskLevelEnumId = raw.riskLevelEnumId || '';
  const riskFacts = aux.riskAssessments.flatMap((risk: any) => risk.facts || []);

  return {
    id: raw.orderId,
    orderName: raw.orderName,
    externalId: raw.externalId,
    status: seed.statusDescription(raw.statusId),
    statusId: raw.statusId,
    channel: seed.enumDescription(raw.salesChannelEnumId),
    salesChannelEnumId: raw.salesChannelEnumId,
    productStoreId: raw.productStoreId,
    productStoreName: seed.productStoreName(raw.productStoreId),
    // Origin/placed-at facility from the order header (set by the OMS order import for
    // POS/retail-location orders). '_NA_' on a POS order is a data gap worth surfacing.
    originFacilityId: raw.originFacilityId || '',
    originFacilityName: raw.originFacilityId && raw.originFacilityId !== '_NA_'
      ? (raw.originFacilityName || seed.facility(raw.originFacilityId)?.facilityName || raw.originFacilityId)
      : '',
    currency: raw.currencyUom,
    localeString: raw.localeString || raw.locale,
    riskLevelEnumId,
    customer: {
      partyId: aux.customerPartyId,
      name: aux.customerName,
      email: contactInfoString(emailContact),
      phone: formatTelecomNumber(contactTelecomNumber(phoneContact)) || contactInfoString(phoneContact),
      billingAddress: billingLines.length ? { lines: billingLines } : undefined,
    },
    identifications: (raw.identifications || [])
      .filter((identification: any) => !identification.thruDate || new Date(identification.thruDate).getTime() > Date.now())
      .map((identification: any) => ({
        orderIdentificationTypeId: identification.orderIdentificationTypeId,
        typeLabel: seed.orderIdentificationTypeDescription(identification.orderIdentificationTypeId),
        idValue: identification.idValue,
        fromDate: identification.fromDate,
      })),
    payments: paymentSummary(raw, aux, seed),
    risk: {
      hasRiskSignal: Boolean(riskRecommendationEnumId || riskLevelEnumId),
      recommendation: riskRecommendationEnumId ? seed.enumDescription(riskRecommendationEnumId) : translate('No recommendation'),
      level: riskLevelEnumId ? seed.enumDescription(riskLevelEnumId) : translate('No risk level'),
      facts: riskFacts,
      counts: sentimentCounts(riskFacts),
    },
    attributes: orderAttributeRows(raw),
    shipGroups,
    groupedItems: groupItems(shipGroups, aux, seed),
    totals: { subtotal: aux.totals.subtotal, total: aux.totals.total, adjustmentRows },
  };
}
