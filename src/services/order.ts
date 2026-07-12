import { api, commonUtil, useSolrSearch } from '@common';
import { getActivePinia } from 'pinia';
import { useSeedStore } from '@/store/seed';
import type { Order } from '@/types/order';
import type {
  AllocationItemDocument,
  AllocationSummaryOptions,
  OrderRowEnrichment
} from '@/types/orderRow';
import { summarizeOrderAllocation } from '@/utils/orderRows';
import {
  allDocs,
  normalizeOrderDoc,
  toStringValue,
  toNumberValue,
  type OrderSearchResult
} from './OrderService';

// Facility id used by OMS to hold archived order items (General Operations Parking).
// Confirmed present in ORDER docs via the indexed `facilityId` field (see PR #309 field dump).
export const GENERAL_OPS_PARKING_FACILITY_ID = 'GENERAL_OPS_PARKING';

export interface OrderSearchParams {
  queryString?: string;
  status?: string | string[];
  channel?: string;
  shipmentMethodTypeId?: string;
  productStoreId?: string;
  facilityIds?: string[];
  hasVirtualFacilityItems?: boolean;
  archivedOnly?: boolean;
  dateFrom?: string;
  dateThru?: string;
  sort?: string;
  pageSize?: number;
  pageIndex?: number;
  allocationSummary?: AllocationSummaryOptions;
}

export interface VirtualLocationCountParams {
  productStoreId?: string;
  facilityIds: string[];
  status?: string | string[];
  // Order-item status filter (item docs carry `orderItemStatusId`, e.g. ITEM_CREATED /
  // ITEM_APPROVED), as opposed to `status` above which filters the order header `orderStatusId`.
  itemStatus?: string | string[];
}

export interface VirtualLocationOrderCount {
  facilityId: string;
  count: number;
}

const orderSolrFields = [
  'orderId',
  'orderName',
  'externalOrderId',
  'externalId',
  'orderItemSeqId',
  'shipGroupSeqId',
  'orderItemShipGroupIdentifier',
  'quantity',
  'orderDate',
  'orderStatusId',
  'orderStatusDesc',
  'statusId',
  'customerPartyId',
  'customerPartyName',
  'customerFirstName',
  'customerLastName',
  'customerName',
  'customerEmailId',
  'contactPhoneNumbers',
  'carrierPartyId',
  'partyId',
  'salesChannelEnumId',
  'salesChannelDesc',
  'productStoreId',
  'productStoreName',
  'grandTotal',
  'currencyUom',
  'presentmentCurrencyUom',
  'shipmentMethodTypeId',
  'shipmentMethodDesc',
  'shipmentId',
  'estimatedDeliveryDate',
  'shipBeforeDate',
  'shipByDate',
  'promisedDatetime',
  'facilityId',
  'reservationFacilityId',
  'facilityTypeId',
  'facilityName',
  'orderFacilityId',
  'orderFacilityName',
  'originFacilityProductId',
  'destinationFacilityProductId',
  'rejectionReason',
  'rejectionReasonId',
  'rejectionReasonDesc',
  'ruleName',
  'routingRuleName',
  'facilityRuleName',
  'priority'
];

const orderSearchQueryFields = [
  'orderId^20',
  'orderName^20',
  'externalOrderId^15',
  'externalId^15',
  'search_orderIdentifications^15',
  'customerPartyId^10',
  'customerPartyName^12',
  'customerName^12',
  'customerEmailId^10',
  'contactPhoneNumbers^10',
  'productId^6',
  'productName^6',
  'internalName^6',
  'parentProductName^4',
  'goodIdentifications^6',
  'orderNotes^4',
  'salesChannelDesc',
  'productStoreName',
  'shipmentId'
];

export function buildOrderLookupPayload(params: OrderSearchParams = {}) {
  const viewSize = Number(params.pageSize ?? 50);
  const viewIndex = Number(params.pageIndex ?? 0);
  const searchTerm = params.queryString?.trim() ?? '';
  const filters = ['docType: ORDER', 'orderTypeId: SALES_ORDER'];
  const statusIds = selectedStatuses(params.status);

  if (statusIds.length === 1) filters.push(`orderStatusId:${escapeSolrValue(statusIds[0])}`);
  if (statusIds.length > 1) filters.push(`orderStatusId:(${statusIds.map(escapeSolrValue).join(' OR ')})`);
  if (params.channel && params.channel !== 'All') filters.push(`salesChannelEnumId:${escapeSolrValue(params.channel)}`);
  if (params.shipmentMethodTypeId && params.shipmentMethodTypeId !== 'All') filters.push(`shipmentMethodTypeId:${escapeSolrValue(params.shipmentMethodTypeId)}`);
  if (params.productStoreId && params.productStoreId !== 'All') filters.push(`productStoreId:${escapeSolrValue(params.productStoreId)}`);

  const facilityIds = (params.facilityIds ?? []).filter((facilityId) => facilityId && facilityId !== 'All');
  const facilityFilter = buildShipGroupFacilityFilter(facilityIds);
  if (facilityFilter) filters.push(facilityFilter);

  // Orders with at least one item still sitting at a virtual facility.
  // Backed by the indexed `facilityTypeId` field on the ORDER item docs.
  if (params.hasVirtualFacilityItems) filters.push(`facilityTypeId:${escapeSolrValue('VIRTUAL_FACILITY')}`);

  // Archived orders = items parked in General Operations Parking.
  // Backed by the indexed `facilityId` field on the ORDER item docs.
  if (params.archivedOnly) filters.push(`facilityId:${escapeSolrValue(GENERAL_OPS_PARKING_FACILITY_ID)}`);

  const dateFilter = buildOrderDateSolrFilter(params.dateFrom, params.dateThru);
  if (dateFilter) filters.push(dateFilter);

  const payload = {
    json: {
      params: {
        sort: params.sort ?? 'orderDate desc',
        rows: viewSize,
        start: viewSize * viewIndex,
        group: true,
        'group.field': 'orderId',
        'group.limit': 10000,
        'group.ngroups': true,
        'q.op': 'AND',
        fl: orderSolrFields.join(' ')
      } as Record<string, any>,
      query: '*:*',
      filter: filters
    }
  };

  if (searchTerm) {
    payload.json.params.defType = 'edismax';
    payload.json.params.qf = orderSearchQueryFields.join(' ');
    payload.json.query = buildOrderSearchQuery(searchTerm);
  }

  return payload;
}

export async function searchOrders(params: OrderSearchParams = {}): Promise<OrderSearchResult> {
  const response = await useSolrSearch().runSolrQuery(buildOrderLookupPayload(params));

  if (commonUtil.hasError(response)) return Promise.reject(response.data);

  const result = normalizeOrderSolrResponse(response.data, params.allocationSummary);
  if (params.allocationSummary?.mode !== 'queue-first' || !result.orders.length) return result;

  const enrichment = await fetchOrderRowEnrichment(result.orders.map((order) => order.id));
  return {
    ...result,
    orders: result.orders.map((order) => mergeSearchOrderEnrichment(order, enrichment[order.id], params.allocationSummary!))
  };
}

const orderRowEnrichmentFields = [
  'orderId',
  'externalOrderId',
  'orderName',
  'customerPartyName',
  'customerEmailId',
  'contactPhoneNumbers',
  'carrierPartyId',
  'salesChannelDesc',
  'salesChannelEnumId',
  'facilityId',
  'facilityName',
  'facilityTypeId',
  'orderItemSeqId',
  'shipmentMethodTypeId',
  'estimatedDeliveryDate',
  'promisedDatetime',
  'shipBeforeDate',
  'shipByDate'
];

export function buildOrderRowEnrichmentPayload(orderIds: readonly string[]) {
  const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
  return {
    json: {
      params: {
        rows: uniqueOrderIds.length,
        start: 0,
        group: true,
        'group.field': 'orderId',
        'group.limit': 10000,
        'group.ngroups': true,
        'q.op': 'AND',
        fl: orderRowEnrichmentFields.join(' ')
      },
      query: '*:*',
      filter: [
        'docType: ORDER',
        'orderTypeId: SALES_ORDER',
        `orderId:(${uniqueOrderIds.map(escapeSolrValue).join(' OR ')})`
      ]
    }
  };
}

export async function fetchOrderRowEnrichment(orderIds: readonly string[]): Promise<Record<string, OrderRowEnrichment>> {
  const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
  if (!uniqueOrderIds.length) return {};
  const response = await useSolrSearch().runSolrQuery(buildOrderRowEnrichmentPayload(uniqueOrderIds));
  if (commonUtil.hasError(response)) return Promise.reject(response.data);
  return normalizeOrderRowEnrichment(response.data);
}

export function buildVirtualLocationCountsPayload(params: VirtualLocationCountParams) {
  const filters = ['docType: ORDER', 'orderTypeId: SALES_ORDER'];
  const statusIds = selectedStatuses(params.status ?? ['ORDER_CREATED', 'ORDER_APPROVED']);

  if (statusIds.length === 1) filters.push(`orderStatusId:${escapeSolrValue(statusIds[0])}`);
  if (statusIds.length > 1) filters.push(`orderStatusId:(${statusIds.map(escapeSolrValue).join(' OR ')})`);

  // Optional order-item status filter (item docs carry `orderItemStatusId`, e.g. ITEM_CREATED /
  // ITEM_APPROVED). Used to restrict a facility's count to orders whose item at that location is
  // still active — e.g. Unfillable should only count active items, not cancelled/completed ones.
  const itemStatusIds = selectedStatuses(params.itemStatus);
  if (itemStatusIds.length === 1) filters.push(`orderItemStatusId:${escapeSolrValue(itemStatusIds[0])}`);
  if (itemStatusIds.length > 1) filters.push(`orderItemStatusId:(${itemStatusIds.map(escapeSolrValue).join(' OR ')})`);

  if (params.productStoreId && params.productStoreId !== 'All') filters.push(`productStoreId:${escapeSolrValue(params.productStoreId)}`);

  const facilityIds = [...new Set((params.facilityIds ?? []).filter((facilityId) => facilityId && facilityId !== 'All'))];
  const facilityFilter = buildShipGroupFacilityFilter(facilityIds);
  if (facilityFilter) filters.push(facilityFilter);

  return {
    json: {
      params: {
        rows: 0,
        start: 0,
        'q.op': 'AND'
      },
      query: '*:*',
      filter: filters,
      facet: {
        facilityCounts: {
          type: 'terms',
          field: 'facilityId',
          mincount: 1,
          limit: -1,
          facet: {
            orders: 'unique(orderId)'
          }
        }
      }
    }
  };
}

export async function fetchVirtualLocationOrderCounts(params: VirtualLocationCountParams): Promise<VirtualLocationOrderCount[]> {
  if (!params.facilityIds.length) return [];

  const response = await useSolrSearch().runSolrQuery(buildVirtualLocationCountsPayload(params));

  if (commonUtil.hasError(response)) return Promise.reject(response.data);

  return normalizeVirtualLocationCountResponse(response.data);
}

function normalizeVirtualLocationCountResponse(data: any): VirtualLocationOrderCount[] {
  const buckets = data?.facets?.facilityCounts?.buckets
    || data?.response?.facets?.facilityCounts?.buckets
    || [];

  return buckets
    .map((bucket: any) => ({
      facilityId: toStringValue(bucket.val ?? bucket.value),
      count: toNumberValue(bucket.orders ?? bucket.count)
    }))
    .filter((row: VirtualLocationOrderCount) => row.facilityId);
}

function normalizeOrderSolrResponse(data: any, allocationSummary?: AllocationSummaryOptions): OrderSearchResult {
  const groupedOrders = data?.grouped?.orderId;

  if (groupedOrders) {
    return {
      orders: (groupedOrders.groups || [])
        .map((group: any) => normalizeGroupedOrder(group, allocationSummary))
        .filter(Boolean),
      total: Number(groupedOrders.ngroups ?? groupedOrders.matches ?? (groupedOrders.groups?.length || 0))
    };
  }

  const docs = allDocs(data);
  return {
    orders: docs
      .map((doc: any) => normalizeOrderWithParkingUnits([doc], allocationSummary))
      .filter(Boolean) as Order[],
    total: Number(data?.response?.numFound ?? docs.length)
  };
}

function normalizeGroupedOrder(group: any, allocationSummary?: AllocationSummaryOptions) {
  const docs = allDocs(group?.doclist);
  return normalizeOrderWithParkingUnits(docs, allocationSummary);
}

function normalizeOrderWithParkingUnits(docs: any[], allocationSummary?: AllocationSummaryOptions) {
  const primaryDoc = docs[0];
  if (!primaryDoc) return undefined;

  const itemDocuments = allocationDocuments(docs);
  return {
    ...normalizeOrderDoc(primaryDoc),
    parkingUnitCount: sumParkingUnits(docs),
    ...summarizeBrokeredFacilities(docs),
    allocationSummary: summarizeOrderAllocation(itemDocuments, allocationSummary || { mode: 'physical-first' })
  };
}

function sumParkingUnits(docs: any[]) {
  return docs.reduce((total, doc) => total + toNumberValue(doc.quantity), 0);
}

// Derives the location summary purely from the per-item ORDER docs the grouped
// search already returns (no per-row detail fetch). Physical facilities drive
// the brokered numerator/chip. When none are brokered, virtual/parking facilities
// provide the fallback location chip without contributing to the numerator.
// Exported so OrderDetail can summarize a grouped item's locations the same way.
export function summarizeBrokeredFacilities(docs: any[]) {
  const itemDocuments = allocationDocuments(docs);
  const summary = summarizeOrderAllocation(itemDocuments, { mode: 'physical-first' });
  const selectedDocument = itemDocuments.find((document) => document.facilityId === summary?.facilityId);
  const selectedIsVirtual = selectedDocument ? isVirtualFacilityDoc(selectedDocument) : false;

  return {
    brokeredFacilityName: !selectedIsVirtual ? summary?.facilityName ?? '' : '',
    brokeredFacilitySplitCount: !selectedIsVirtual ? summary?.additionalFacilityCount ?? 0 : 0,
    dominantVirtualFacilityName: selectedIsVirtual ? summary?.facilityName ?? '' : '',
    dominantVirtualFacilitySplitCount: selectedIsVirtual ? summary?.additionalFacilityCount ?? 0 : 0,
    brokeredItemCount: summary?.brokeredItemCount ?? 0,
    totalItemCount: itemDocuments.length
  };
}

function isVirtualFacilityDoc(doc: any) {
  const facilityTypeId = toStringValue(doc.facilityTypeId);
  if (facilityTypeId === 'VIRTUAL_FACILITY') return true;

  // The parent-type check needs the seed store; guard it so this service stays callable
  // outside an active Pinia (e.g. unit tests), falling back to the direct type check.
  if (!facilityTypeId || !getActivePinia()) return false;
  const parentTypeId = useSeedStore().facilityType(facilityTypeId)?.parentTypeId;
  return parentTypeId === 'VIRTUAL_FACILITY';
}

function allocationDocuments(docs: readonly any[]): AllocationItemDocument[] {
  const seedStore = getActivePinia() ? useSeedStore() : undefined;
  return docs.map((doc) => {
    const facilityTypeId = toStringValue(doc.facilityTypeId);
    return {
      orderId: toStringValue(doc.orderId),
      orderItemSeqId: toStringValue(doc.orderItemSeqId),
      facilityId: toStringValue(doc.facilityId),
      facilityName: toStringValue(doc.facilityName),
      facilityTypeId,
      facilityParentTypeId: seedStore?.facilityType(facilityTypeId)?.parentTypeId
    };
  });
}

function normalizeOrderRowEnrichment(data: any): Record<string, OrderRowEnrichment> {
  const groups = data?.grouped?.orderId?.groups || [];
  return groups.reduce((byOrderId: Record<string, OrderRowEnrichment>, group: any) => {
    const docs = allDocs(group?.doclist);
    const primary = docs[0];
    const orderId = toStringValue(group?.groupValue ?? primary?.orderId);
    if (!orderId || !primary) return byOrderId;
    byOrderId[orderId] = {
      orderId,
      orderName: toStringValue(primary.orderName),
      externalOrderId: toStringValue(primary.externalOrderId),
      customerPartyName: toStringValue(primary.customerPartyName),
      customerEmailId: toStringValue(primary.customerEmailId),
      contactPhoneNumbers: Array.isArray(primary.contactPhoneNumbers)
        ? primary.contactPhoneNumbers.map((value: any) => toStringValue(value)).filter(Boolean)
        : [toStringValue(primary.contactPhoneNumbers)].filter(Boolean),
      carrierPartyId: toStringValue(primary.carrierPartyId),
      salesChannelDesc: toStringValue(primary.salesChannelDesc ?? primary.salesChannelEnumId),
      shipmentMethodTypeId: toStringValue(primary.shipmentMethodTypeId),
      estimatedDeliveryDate: toStringValue(primary.estimatedDeliveryDate),
      promisedDatetime: toStringValue(primary.promisedDatetime),
      shipBeforeDate: toStringValue(primary.shipBeforeDate),
      shipByDate: toStringValue(primary.shipByDate),
      itemDocuments: allocationDocuments(docs)
    };
    return byOrderId;
  }, {});
}

function mergeSearchOrderEnrichment(
  order: Order,
  enrichment: OrderRowEnrichment | undefined,
  allocationSummary: AllocationSummaryOptions
): Order {
  if (!enrichment) return { ...order, allocationSummary: undefined };
  return {
    ...order,
    externalId: enrichment.externalOrderId || order.externalId,
    customerName: enrichment.customerPartyName || order.customerName,
    carrierPartyId: enrichment.carrierPartyId || order.carrierPartyId,
    channel: enrichment.salesChannelDesc || order.channel,
    deliveryMethod: enrichment.shipmentMethodTypeId || order.deliveryMethod,
    estimatedDeliveryDate: enrichment.estimatedDeliveryDate || order.estimatedDeliveryDate,
    promisedDatetime: enrichment.promisedDatetime || order.promisedDatetime,
    shipBeforeDate: enrichment.shipBeforeDate || order.shipBeforeDate,
    shipByDate: enrichment.shipByDate || order.shipByDate,
    allocationSummary: summarizeOrderAllocation(enrichment.itemDocuments, allocationSummary)
  };
}

function buildOrderSearchQuery(searchTerm: string) {
  const escapedTerm = escapeSolrValue(searchTerm);
  const tokens = searchTerm
    .split(/\s+/)
    .map((token) => escapeSolrValue(token))
    .filter(Boolean);

  if (!tokens.length) return '*:*';

  return `(${tokens.map((token) => `${token}*`).join(' OR ')} OR "${escapedTerm}"^100)`;
}

function buildOrderDateSolrFilter(dateFrom?: string, dateThru?: string) {
  if (!dateFrom && !dateThru) return '';

  const fromDate = dateFrom ? `${dateFrom.split('T')[0]}T00:00:00Z` : '*';
  const thruDate = dateThru ? `${dateThru.split('T')[0]}T23:59:59Z` : '*';

  return `orderDate: [${fromDate} TO ${thruDate}]`;
}

function buildShipGroupFacilityFilter(facilityIds: string[]) {
  if (facilityIds.length === 1) return `facilityId:${escapeSolrValue(facilityIds[0])}`;
  if (facilityIds.length > 1) return `facilityId:(${facilityIds.map(escapeSolrValue).join(' OR ')})`;

  return '';
}

function selectedStatuses(status?: string | string[]) {
  const statuses = Array.isArray(status) ? status : [status];
  return [...new Set(statuses.filter((statusId): statusId is string => Boolean(statusId && statusId !== 'All')))];
}

// Exported for callers composing ad-hoc Solr filters (e.g. OrderDetail's reverse
// exchange-order lookup by orderName prefix).
export function escapeSolrValue(value: string) {
  return String(value).replace(/([\\+\-!(){}[\]^"~*?:]|&&|\|\|)/g, '\\$1');
}
