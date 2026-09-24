import { commonUtil, translate } from '@common';
import {
  arrowUndoOutline,
  checkmarkDoneOutline,
  closeCircleOutline,
  compassOutline,
  downloadOutline,
  pauseCircleOutline,
  pulseOutline,
  storefrontOutline,
  sunnyOutline,
  swapHorizontalOutline,
  warningOutline,
} from 'ionicons/icons';
import { summarizeBrokeredFacilities } from '@/services/order';
import { OrderActionValidator } from './OrderActionValidator';
import { shipGroupItemStates } from './shipGroupItemStates';
import { rollUpItemStatuses } from './itemStatusBadges';
import { sentimentCounts } from './index';
import { findTimeDiff, timelineMillis } from './orderDetailDates';
import { adjustmentAmount, adjustmentKey, adjustmentLabel } from './orderAdjustments';
import type { useSeedStore } from '@/store/seed';
import type { useProductCacheStore } from '@/store/productCache';
import type { FacilityChangeEvent, ItemIssuanceSummary, ItemStatusEvent, UnfillableSummary } from '@/store/orderDetail';
import type {
  EnrichedItemGroup,
  EnrichedOrder,
  EnrichedOrderItem,
  EnrichedOrderPayments,
  EnrichedOrderTimelineEvent,
  EnrichedShipGroup,
  EnrichedShippingAddress,
  ItemIssuance,
} from '@/types/orderDetail';

export interface ExchangeChild {
  orderId: string;
  itemCount: number;
  facilityName: string;
  value: number;
}

/** What the order store has already derived or loaded for the order; see enrichedOrderByOrderId. */
export interface EnrichmentAuxiliaryData {
  totals: { subtotal: number; adjustments: Record<string, number>; includedAdjustments: Record<string, number>; total: number };
  groupAdjustments: Record<string, Array<{ label: string; amount: number; isIncluded: boolean }>>;
  customerPartyId: string;
  customerName: string;
  customerProfile: any;
  /** Header-level OrderStatus rows, newest first. */
  headerStatuses: any[];
  itemStatusEvents: ItemStatusEvent[];
  facilityChangeEvents: FacilityChangeEvent[];
  /** The raw OrderFacilityChange rows; they carry the shipGroupSeqId the clustered events drop. */
  facilityChangeRows: any[];
  unfillable: UnfillableSummary | null;
  fulfillmentTimeline: any[];
  timelineByShipGroup: Record<string, any>;
  issuanceByItem: Record<string, ItemIssuanceSummary> | null;
  riskAssessments: any[];
  returnedQtyBySeqId: Record<string, number>;
  exchangeChildren: ExchangeChild[];
  returnHeadersById: Record<string, any | null>;
}

export interface EnrichmentStores {
  seed: ReturnType<typeof useSeedStore>;
  productCache: ReturnType<typeof useProductCacheStore>;
}

const PAYMENT_COLLECTED_STATUSES = new Set(['PAYMENT_AUTHORIZED', 'PAYMENT_SETTLED', 'PAYMENT_RECEIVED']);

// OrderFacilityChange reasons that describe where items went. Every other reason — the
// REPORT_VAR/REPORT_NO_VAR rejection reasons, damaged, inventory-not-found — is a rejection,
// and reads by where the items came from instead.
const FACILITY_CHANGE_LABELS: Record<string, string> = {
  BROKERED: 'Brokered',
  ALLOCATED: 'Allocated',
  RELEASED: 'Released',
  PARKED: 'Parked',
};

const FACILITY_CHANGE_ICONS: Record<string, string> = {
  BROKERED: compassOutline,
  ALLOCATED: compassOutline,
  RELEASED: storefrontOutline,
  PARKED: pauseCircleOutline,
};

/**
 * A ship group sold over the counter. OMS treats POS_COMPLETED as needing no fulfillment at all
 * (`requiresFulfillment` in OrderServices get#SalesOrder), so the group has no carrier, no ship-to
 * address, and no brokering/pick/pack/ship dates — the goods left with the customer.
 */
export function isPosCompletedShipGroup(shipGroup: any): boolean {
  return shipGroup?.shipmentMethodTypeId === 'POS_COMPLETED';
}

function earliestMillis(values: any[]): number | undefined {
  const millis = values.map(timelineMillis).filter((value): value is number => value != undefined);
  return millis.length ? Math.min(...millis) : undefined;
}

function itemWord(count: number): string {
  return count === 1 ? translate('item') : translate('items');
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
  const thruMillis = timelineMillis(contact.thruDate);
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
    const comment = isIncluded ? `${label} (${translate('included')})` : label;
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
  context: { contactMechsById: Record<string, any>; shippingLocation: any; facilityChangeDateByShipGroup: Record<string, number> }
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
  const timelineEntry = aux.timelineByShipGroup[sg.shipGroupSeqId];

  // `get#OrderFulfillmentTimeline` dates brokering off rows carrying a BROKERED or RELEASED
  // reason, which only the routing engine writes; a group allocated at order import has no
  // date there, so its earliest OrderFacilityChange row dates it instead. On a virtual facility
  // those rows record parking, rejections and cancellations, none of which is a brokering.
  const brokeredDate = timelineEntry?.firstBrokeredDate || timelineEntry?.firstReleasedDate
    || (isVirtual ? undefined : context.facilityChangeDateByShipGroup[sg.shipGroupSeqId]);
  const isBrokered = !isVirtual || !!brokeredDate;

  // Item status wins for a stopped group; the timeline only describes one still in motion.
  let progress = 0;
  if (isPosCompleted) progress = 1;
  else if (settled) progress = fulfilled / total;
  else progress = [isBrokered, timelineEntry?.picklistDate, timelineEntry?.packedDate, timelineEntry?.shippedDate].filter(Boolean).length * 0.25;

  // Cancelled items are routinely moved to a virtual facility such as REJECTED_ITM_PARKING, so the
  // brokering label comes after the terminal checks or a stopped card would read "Not Brokered".
  let statusLabel = `${Math.round(progress * 100)}% ${translate('Complete')}`;
  if (isPosCompleted) statusLabel = translate('Sold in store');
  else if (settled && fulfilled === 0) statusLabel = translate('Cancelled');
  else if (settled && fulfilled < total) statusLabel = translate('Partially complete');
  else if (!settled && isVirtual) statusLabel = translate('Not Brokered');

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
      facilityName: facilityName || 'Facility',
      attributes,
      attributeCount: attributes.length,
      adjustments: itemAdjustmentSummaries(raw, item, seed),
      issuance: isPosCompleted && aux.issuanceByItem ? itemIssuance(item, aux.issuanceByItem) : undefined,
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
    itemSummary: `${rawItems.length} ${itemWord(rawItems.length)}, ${units} ${units === 1 ? translate('unit') : translate('units')}`,
    lifecycle: { ...(timelineEntry || {}), firstBrokeredDate: brokeredDate },
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

/* ── Payments, attributes, timeline ───────────────────────────────────────── */

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

export function buildOrderTimeline(raw: any, aux: EnrichmentAuxiliaryData, seed: EnrichmentStores['seed']): EnrichedOrderTimelineEvent[] {
  const timeline: EnrichedOrderTimelineEvent[] = [];
  const usedStatusIds = new Set<string>();
  const orderDate = timelineMillis(raw.orderDate);
  const entryDate = timelineMillis(raw.entryDate);
  const statusDate = (statusIds: string[]) =>
    earliestMillis(aux.headerStatuses.filter((status: any) => statusIds.includes(status.statusId)).map((status: any) => status.statusDatetime));
  const fulfillmentDate = (field: string) => earliestMillis(aux.fulfillmentTimeline.map((entry: any) => entry?.[field]));
  // Every entry after the first measures its age from the order date.
  const add = (event: EnrichedOrderTimelineEvent) => timeline.push({ ...event, timeDiff: findTimeDiff(orderDate, event.value) });

  if (orderDate) {
    timeline.push({ id: 'orderDate', label: 'Created in Shopify', value: orderDate, icon: sunnyOutline });
    usedStatusIds.add('ORDER_CREATED');
  }

  // Exchange lineage: OrderItemAssoc rows of type EXCHANGE on this order point at the order it
  // was exchanged from (toOrderId). One entry per distinct source order.
  const assocs = (raw.itemAssocs || []).filter((assoc: any) =>
    assoc.orderItemAssocTypeId === 'EXCHANGE' && assoc.toOrderId && assoc.toOrderId !== raw.orderId);
  [...new Set(assocs.map((assoc: any) => assoc.toOrderId as string))].forEach((toOrderId) => {
    const assoc = (raw.itemAssocs || []).find((row: any) => row.toOrderId === toOrderId);
    timeline.push({
      id: `exchange-${toOrderId}`,
      label: 'Exchanged from',
      value: timelineMillis(assoc?.createdStamp) || orderDate,
      icon: swapHorizontalOutline,
      metaData: toOrderId as string,
      link: { kind: 'exchangeSource', id: toOrderId as string },
    });
  });

  // Returns raised against this order: one entry per distinct returnId. The processing facility
  // comes from the lazily loaded return header; the wording drops the location until it lands.
  const returnGroups: Record<string, { count: number; value: number }> = {};
  (raw.returnItems || []).forEach((item: any) => {
    if (!item.returnId) return;
    const group = returnGroups[item.returnId] ||= { count: 0, value: 0 };
    group.count += Number(item.returnQuantity || 0) || 1;
    const created = timelineMillis(item.createdStamp);
    if (created && (!group.value || created < group.value)) group.value = created;
  });
  Object.entries(returnGroups).forEach(([returnId, group]) => {
    const facilityId = aux.returnHeadersById[returnId]?.destinationFacilityId;
    const facilityName = facilityId ? seed.facilityName(facilityId) : '';
    add({
      id: `return-${returnId}`,
      label: 'Return created',
      value: group.value || orderDate,
      icon: arrowUndoOutline,
      metaData: facilityName
        ? `${group.count} ${itemWord(group.count)} ${translate('returned at')} ${facilityName}`
        : `${group.count} ${itemWord(group.count)} ${translate('returned')}`,
      link: { kind: 'return', id: returnId },
    });
  });

  // Exchange orders created from this order (reverse lineage discovered asynchronously).
  aux.exchangeChildren.forEach((child) => {
    add({
      id: `exchange-child-${child.orderId}`,
      label: 'Exchange created',
      value: child.value || orderDate,
      icon: swapHorizontalOutline,
      metaData: child.facilityName
        ? `${child.itemCount} ${itemWord(child.itemCount)} ${translate('purchased in exchange at')} ${child.facilityName}`
        : `${child.itemCount} ${itemWord(child.itemCount)} ${translate('purchased in exchange')}`,
      link: { kind: 'exchangeChild', id: child.orderId },
    });
  });

  if (entryDate) add({ id: 'entryDate', label: 'Imported from Shopify', value: entryDate, icon: downloadOutline });

  const approvedDate = statusDate(['ORDER_APPROVED', 'ORDER_ACCEPTED']);
  if (approvedDate) {
    add({ id: 'approvedDate', label: 'Approved for fulfillment', value: approvedDate, icon: checkmarkDoneOutline });
    usedStatusIds.add('ORDER_APPROVED');
    usedStatusIds.add('ORDER_ACCEPTED');
  }

  const firstBrokeredDate = fulfillmentDate('firstBrokeredDate') ?? fulfillmentDate('firstReleasedDate');
  if (firstBrokeredDate) add({ id: 'firstBrokeredDate', label: 'First Brokered', value: firstBrokeredDate, icon: checkmarkDoneOutline });

  const completedDate = statusDate(['ORDER_COMPLETED']);
  if (completedDate) {
    add({ id: 'completedDate', label: 'Order completed', value: completedDate, icon: pulseOutline });
    usedStatusIds.add('ORDER_COMPLETED');
  }

  // Item cancellations and rejections, one entry per action rather than per item.
  aux.itemStatusEvents.forEach((event) => {
    add({
      id: `item-status-${event.id}`,
      label: seed.statusDescription(event.statusId),
      value: event.value,
      icon: closeCircleOutline,
      metaData: [
        `${event.itemCount} ${itemWord(event.itemCount)}`,
        event.changeReason ? seed.describe(event.changeReason) : '',
        event.statusUserLogin,
      ].filter(Boolean).join(' - '),
    });
  });

  // Brokering, release, park and reject moves. UNFILLABLE is summarised below instead, since a
  // single order can carry thousands of those rows.
  aux.facilityChangeEvents.forEach((event) => {
    const knownMove = FACILITY_CHANGE_LABELS[event.changeReasonEnumId];
    const isRejection = !knownMove && !!event.changeReasonEnumId;
    const facilityId = isRejection ? event.fromFacilityId : event.facilityId;
    const facilityName = facilityId ? seed.facilityName(facilityId) : '';
    add({
      id: `facility-change-${event.id}`,
      label: knownMove || (isRejection ? 'Rejected' : 'Facility changed'),
      value: event.value,
      icon: FACILITY_CHANGE_ICONS[event.changeReasonEnumId] || (isRejection ? closeCircleOutline : compassOutline),
      metaData: [
        `${event.itemCount} ${itemWord(event.itemCount)}`,
        facilityName ? `${isRejection ? translate('from') : translate('to')} ${facilityName}` : '',
        isRejection ? seed.enumDescription(event.changeReasonEnumId) : '',
        event.changeUserLogin,
      ].filter(Boolean).join(' - '),
    });
  });

  const lastUnfillableDate = timelineMillis(aux.unfillable?.lastAttemptDate);
  if (aux.unfillable && lastUnfillableDate) {
    const { count, atLeast } = aux.unfillable;
    add({
      id: 'unfillable-attempts',
      label: 'Brokering could not fill',
      value: lastUnfillableDate,
      icon: warningOutline,
      metaData: `${count}${atLeast ? '+' : ''} ${count === 1 ? translate('attempt') : translate('attempts')}`,
    });
  }

  aux.headerStatuses
    .filter((status: any) => status.statusId && !usedStatusIds.has(status.statusId))
    .forEach((status: any) => {
      const value = timelineMillis(status.statusDatetime);
      if (!value) return;
      add({
        id: status.orderStatusId || `${status.statusId}-${status.statusDatetime}`,
        label: seed.statusDescription(status.statusId),
        value,
        icon: pulseOutline,
        metaData: [status.statusUserLogin, status.changeReason ? seed.describe(status.changeReason) : ''].filter(Boolean).join(' - '),
      });
    });

  return timeline.sort((left, right) => {
    if (left.value === right.value) return 0;
    if (left.value == undefined) return 1;
    if (right.value == undefined) return -1;
    return left.value - right.value;
  });
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

  const facilityChangeDateByShipGroup: Record<string, number> = {};
  aux.facilityChangeRows.forEach((change: any) => {
    const millis = timelineMillis(change?.changeDatetime);
    if (!change?.shipGroupSeqId || millis == undefined) return;
    const current = facilityChangeDateByShipGroup[change.shipGroupSeqId];
    if (current == undefined || millis < current) facilityChangeDateByShipGroup[change.shipGroupSeqId] = millis;
  });

  const shipGroups = (raw.shipGroups || []).map((sg: any) =>
    enrichShipGroup(sg, raw, aux, stores, { contactMechsById, shippingLocation, facilityChangeDateByShipGroup }));

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
    timeline: buildOrderTimeline(raw, aux, seed),
  };
}
