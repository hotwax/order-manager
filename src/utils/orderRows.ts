import { DateTime } from 'luxon';
import type { Order } from '@/types/order';
import type { WorkflowOrder } from '@/types/customerService';
import type {
  AllocationItemDocument,
  AllocationSummaryOptions,
  OrderAllocationSummaryModel,
  OrderRowEnrichment,
  OrderRowViewModel
} from '@/types/orderRow';

type FacilityCount = {
  facilityId: string;
  facilityName: string;
  count: number;
};

export function summarizeOrderAllocation(
  documents: readonly AllocationItemDocument[],
  options: AllocationSummaryOptions
): OrderAllocationSummaryModel | undefined {
  const itemDocuments = documents.filter((document) => document.facilityId);
  const brokeredItemCount = itemDocuments.filter((document) => !isVirtualFacility(document)).length;
  const queueFacilityIds = new Set(options.queueFacilityIds || []);
  const candidates = options.mode === 'queue-first'
    ? itemDocuments.filter((document) => queueFacilityIds.has(String(document.facilityId)))
    : physicalFirstCandidates(itemDocuments);
  const rankedFacilities = rankFacilities(candidates);
  const selected = rankedFacilities[0];

  if (!selected) return undefined;

  return {
    facilityId: selected.facilityId,
    facilityName: selected.facilityName,
    additionalFacilityCount: Math.max(rankedFacilities.length - 1, 0),
    brokeredItemCount,
    totalItemCount: documents.length
  };
}

export function toSearchOrderRowViewModel(order: Order): OrderRowViewModel {
  return createOrderRowViewModel({
    orderId: order.id,
    orderName: order.orderName || order.id,
    customerName: order.customerName || order.customerId || 'Unknown customer',
    status: order.status,
    allocationSummary: order.allocationSummary,
    carrier: order.carrierPartyId,
    shippingMethod: order.deliveryMethod,
    channel: order.channel,
    orderDate: order.orderDate,
    estimatedDelivery: order.estimatedDeliveryDate || order.promisedDatetime || order.shipBeforeDate || order.shipByDate
  });
}

export function toWorkflowOrderRowViewModel(
  order: WorkflowOrder,
  enrichment?: OrderRowEnrichment
): OrderRowViewModel {
  return createOrderRowViewModel({
    orderId: order.orderId,
    orderName: order.orderName || enrichment?.orderName || order.orderId,
    customerName: enrichment?.customerPartyName || order.customerName?.trim() || order.customerPartyId || 'Unknown customer',
    allocationSummary: workflowAllocationSummary(order, enrichment),
    carrier: usableCarrier(order.carrierPartyId) || usableCarrier(enrichment?.carrierPartyId),
    shippingMethod: order.shipmentMethodDesc || order.shippingMethodTypeId || enrichment?.shipmentMethodTypeId,
    channel: enrichment?.salesChannelDesc || formatIdentifier(order.salesChannelEnumId),
    orderDate: order.orderDate,
    estimatedDelivery: order.estimatedDeliveryDate || enrichment?.estimatedDeliveryDate || enrichment?.promisedDatetime
  });
}

function workflowAllocationSummary(
  order: WorkflowOrder,
  enrichment?: OrderRowEnrichment
): OrderAllocationSummaryModel | undefined {
  if (!order.facilityId) return undefined;
  const enrichedProgress = enrichment
    ? summarizeOrderAllocation(enrichment.itemDocuments, { mode: 'physical-first' })
    : undefined;

  return {
    facilityId: order.facilityId,
    facilityName: order.facilityName || order.facilityId,
    additionalFacilityCount: 0,
    brokeredItemCount: enrichedProgress?.brokeredItemCount ?? order.itemCount,
    totalItemCount: enrichedProgress?.totalItemCount ?? order.itemCount
  };
}

export function formatIdentifier(value?: string | null) {
  if (!value) return '';
  return value
    .replace(/_SALES_CHANNEL$/, '')
    .replace(/_CHANNEL$/, '')
    .replace(/^ORDER_/, '')
    .replace(/^ITEM_/, '')
    .replace(/^SHIPMENT_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function dateFromOrderValue(value?: string | null) {
  if (!value) return undefined;
  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    const numericDate = DateTime.fromMillis(String(Math.trunc(numericValue)).length <= 10 ? numericValue * 1000 : numericValue);
    if (numericDate.isValid) return numericDate;
  }

  const sqlDate = DateTime.fromSQL(value);
  if (sqlDate.isValid) return sqlDate;
  const isoDate = DateTime.fromISO(value);
  return isoDate.isValid ? isoDate : undefined;
}

function createOrderRowViewModel(input: {
  orderId: string;
  orderName: string;
  customerName: string;
  status?: string;
  allocationSummary?: OrderAllocationSummaryModel;
  carrier?: string;
  shippingMethod?: string;
  channel?: string;
  orderDate?: string;
  estimatedDelivery?: string | null;
}): OrderRowViewModel {
  const ordered = dateFromOrderValue(input.orderDate);
  const deadline = dateFromOrderValue(input.estimatedDelivery);
  const carrier = usableCarrier(input.carrier);
  const shippingMethod = formatIdentifier(input.shippingMethod);

  return {
    orderId: input.orderId,
    orderName: input.orderName,
    customerName: input.customerName,
    status: input.status ? formatIdentifier(input.status) : undefined,
    allocationSummary: input.allocationSummary,
    fulfillmentContext: [carrier, shippingMethod].filter(Boolean).join(' - '),
    channelName: formatIdentifier(input.channel),
    orderedDateTime: ordered?.toFormat('MMM d, h:mm a') || '',
    orderedRelativeAge: orderedRelativeLabel(ordered),
    estimatedDeliveryDateTime: deadline?.toFormat('MMM d, h:mm a'),
    estimatedDeliveryRelativeLabel: deadlineRelativeLabel(deadline)
  };
}

function physicalFirstCandidates(documents: AllocationItemDocument[]) {
  const physicalDocuments = documents.filter((document) => !isVirtualFacility(document));
  return physicalDocuments.length ? physicalDocuments : documents;
}

function rankFacilities(documents: readonly AllocationItemDocument[]) {
  const counts = new Map<string, FacilityCount>();
  documents.forEach((document) => {
    const facilityId = String(document.facilityId || '');
    if (!facilityId) return;
    const facilityName = document.facilityName || facilityId;
    const current = counts.get(facilityId);
    if (current) current.count += 1;
    else counts.set(facilityId, { facilityId, facilityName, count: 1 });
  });

  return [...counts.values()].sort((left, right) =>
    right.count - left.count
      || left.facilityName.localeCompare(right.facilityName)
      || left.facilityId.localeCompare(right.facilityId)
  );
}

function isVirtualFacility(document: AllocationItemDocument) {
  return document.facilityTypeId === 'VIRTUAL_FACILITY'
    || document.facilityParentTypeId === 'VIRTUAL_FACILITY';
}

function usableCarrier(value?: string | null) {
  const carrier = String(value || '').trim();
  if (!carrier || carrier.toUpperCase() === 'N/A' || carrier === '_NA_') return '';
  return /^[A-Z0-9-]{2,8}$/.test(carrier) ? carrier : formatIdentifier(carrier);
}

function orderedRelativeLabel(date?: DateTime) {
  if (!date) return '';
  const now = DateTime.now();
  if (date.hasSame(now, 'day')) {
    const minutes = Math.max(Math.floor(now.diff(date, 'minutes').minutes), 0);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`;
  }

  const days = Math.max(Math.floor(now.startOf('day').diff(date.startOf('day'), 'days').days), 1);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function deadlineRelativeLabel(date?: DateTime) {
  if (!date) return undefined;
  const minutes = Math.round(date.diffNow('minutes').minutes);
  const overdue = minutes < 0;
  const absoluteMinutes = Math.abs(minutes);
  const value = absoluteMinutes < 60
    ? `${absoluteMinutes} min`
    : absoluteMinutes < 1440
      ? `${Math.round(absoluteMinutes / 60)}h`
      : `${Math.round(absoluteMinutes / 1440)} ${Math.round(absoluteMinutes / 1440) === 1 ? 'day' : 'days'}`;
  return overdue ? `overdue by ${value}` : `in ${value}`;
}
