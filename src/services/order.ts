import { api, commonUtil, useSolrSearch } from '@common';
import { getActivePinia } from 'pinia';
import { useSeedStore } from '@/store/seed';
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

  return normalizeOrderSolrResponse(response.data);
}

function normalizeOrderSolrResponse(data: any): OrderSearchResult {
  const groupedOrders = data?.grouped?.orderId;

  if (groupedOrders?.groups?.length) {
    return {
      orders: groupedOrders.groups
        .map(normalizeGroupedOrder)
        .filter(Boolean),
      total: Number(groupedOrders.ngroups ?? groupedOrders.matches ?? groupedOrders.groups.length)
    };
  }

  const docs = allDocs(data);
  return {
    orders: docs.map((doc: any) => normalizeOrderWithParkingUnits([doc])),
    total: Number(data?.response?.numFound ?? docs.length)
  };
}

function normalizeGroupedOrder(group: any) {
  const docs = allDocs(group?.doclist);
  return normalizeOrderWithParkingUnits(docs);
}

function normalizeOrderWithParkingUnits(docs: any[]) {
  const primaryDoc = docs[0];
  if (!primaryDoc) return undefined;

  return {
    ...normalizeOrderDoc(primaryDoc),
    parkingUnitCount: sumParkingUnits(docs),
    ...summarizeBrokeredFacilities(docs)
  };
}

function sumParkingUnits(docs: any[]) {
  return docs.reduce((total, doc) => total + toNumberValue(doc.quantity), 0);
}

// Derives the brokered-to facility summary purely from the per-item ORDER docs
// the grouped search already returns (no per-row detail fetch). Virtual/parking
// facilities are excluded from the brokered numerator / chip / split count, using
// the same classification as OrderQueueList.isVirtualShipGroup.
function summarizeBrokeredFacilities(docs: any[]) {
  const itemsByPhysicalFacility = new Map<string, { name: string; count: number }>();
  let brokeredItemCount = 0;

  docs.forEach((doc) => {
    const facilityId = toStringValue(doc.facilityId);
    if (!facilityId || isVirtualFacilityDoc(doc)) return;

    const existing = itemsByPhysicalFacility.get(facilityId);
    const name = toStringValue(doc.facilityName) || facilityId;
    if (existing) {
      existing.count += 1;
      if (!existing.name) existing.name = name;
    } else {
      itemsByPhysicalFacility.set(facilityId, { name, count: 1 });
    }
    brokeredItemCount += 1;
  });

  const ranked = [...itemsByPhysicalFacility.values()].sort((a, b) => b.count - a.count);
  const topFacility = ranked[0];

  return {
    brokeredFacilityName: topFacility?.name ?? '',
    brokeredFacilitySplitCount: ranked.length > 1 ? ranked.length - 1 : 0,
    brokeredItemCount,
    totalItemCount: docs.length
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

function escapeSolrValue(value: string) {
  return String(value).replace(/([\\+\-!(){}[\]^"~*?:]|&&|\|\|)/g, '\\$1');
}
