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

const VIRTUAL_OR_PARKING_FACILITY_IDS = [
  '_NA_',
  'REJECTED_ITM_PARKING',
  'REJECTED_PARKING',
  'UNFILLABLE_PARKING',
  GENERAL_OPS_PARKING_FACILITY_ID
];

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

export interface ActiveFacilityOrderVolume {
  facilityId: string;
  facilityName: string;
  lastOrderCount: number;
  assignedItemQuantity: number;
}

export interface VirtualLocationCountParams {
  productStoreId?: string;
  facilityIds: string[];
  status?: string | string[];
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

export function buildActivePhysicalFacilityOrderVolumePayload(params: { productStoreId?: string } = {}) {
  const filters = [
    'docType: ORDER',
    'orderTypeId: SALES_ORDER',
    'facilityId:[* TO *]',
    '-facilityTypeId:VIRTUAL_FACILITY',
    `-facilityId:(${VIRTUAL_OR_PARKING_FACILITY_IDS.map(escapeSolrValue).join(' OR ')})`,
    '-orderStatusId:(ORDER_COMPLETED OR ORDER_CANCELLED)'
  ];

  if (params.productStoreId && params.productStoreId !== 'All') {
    filters.push(`productStoreId:${escapeSolrValue(params.productStoreId)}`);
  }

  return {
    json: {
      params: {
        rows: 0,
        'q.op': 'AND'
      } as Record<string, any>,
      query: '*:*',
      filter: filters,
      facet: {
        physicalFacilities: {
          type: 'terms',
          field: 'facilityId',
          limit: 50,
          sort: 'orderCount desc',
          facet: {
            orderCount: 'unique(orderId)',
            itemQuantity: 'sum(quantity)',
            facilityNames: {
              type: 'terms',
              field: 'facilityName',
              limit: 1
            }
          }
        }
      }
    }
  };
}

export function buildVirtualLocationCountsPayload(params: VirtualLocationCountParams) {
  const filters = ['docType: ORDER', 'orderTypeId: SALES_ORDER'];
  const statusIds = selectedStatuses(params.status ?? ['ORDER_CREATED', 'ORDER_APPROVED']);

  if (statusIds.length === 1) filters.push(`orderStatusId:${escapeSolrValue(statusIds[0])}`);
  if (statusIds.length > 1) filters.push(`orderStatusId:(${statusIds.map(escapeSolrValue).join(' OR ')})`);
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

export async function getActivePhysicalFacilityOrderVolume(params: { productStoreId?: string } = {}): Promise<ActiveFacilityOrderVolume[]> {
  const response = await useSolrSearch().runSolrQuery(buildActivePhysicalFacilityOrderVolumePayload(params));

  if (commonUtil.hasError(response)) return Promise.reject(response.data);

  return normalizeActivePhysicalFacilityOrderVolume(response.data);
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

function normalizeActivePhysicalFacilityOrderVolume(data: any): ActiveFacilityOrderVolume[] {
  const buckets = data?.facets?.physicalFacilities?.buckets
    || data?.response?.facets?.physicalFacilities?.buckets
    || [];

  return buckets
    .map((bucket: any) => {
      const facilityId = toStringValue(bucket.val ?? bucket.value);
      const facilityNameBucket = bucket.facilityNames?.buckets?.[0];
      const facilityName = toStringValue(facilityNameBucket?.val ?? facilityNameBucket?.value) || facilityId;
      const lastOrderCount = toNumberValue(bucket.orderCount ?? bucket.count);

      return {
        facilityId,
        facilityName,
        lastOrderCount,
        assignedItemQuantity: toNumberValue(bucket.itemQuantity)
      };
    })
    .filter((row: ActiveFacilityOrderVolume) => row.facilityId && row.lastOrderCount > 0)
    .sort((a: ActiveFacilityOrderVolume, b: ActiveFacilityOrderVolume) => b.lastOrderCount - a.lastOrderCount || a.facilityName.localeCompare(b.facilityName));
}

type FacilityItemCount = { name: string; count: number };

// Derives the location summary purely from the per-item ORDER docs the grouped
// search already returns (no per-row detail fetch). Physical facilities drive
// the brokered numerator/chip. When none are brokered, virtual/parking facilities
// provide the fallback location chip without contributing to the numerator.
function summarizeBrokeredFacilities(docs: any[]) {
  const itemsByPhysicalFacility = new Map<string, { name: string; count: number }>();
  const itemsByVirtualFacility = new Map<string, { name: string; count: number }>();
  let brokeredItemCount = 0;

  docs.forEach((doc) => {
    const facilityId = toStringValue(doc.facilityId);
    if (!facilityId) return;

    const name = toStringValue(doc.facilityName) || facilityId;
    if (isVirtualFacilityDoc(doc)) {
      addFacilityItemCount(itemsByVirtualFacility, facilityId, name);
      return;
    }

    addFacilityItemCount(itemsByPhysicalFacility, facilityId, name);
    brokeredItemCount += 1;
  });

  const rankedPhysical = rankFacilityItemCounts(itemsByPhysicalFacility);
  const rankedVirtual = brokeredItemCount === 0 ? rankFacilityItemCounts(itemsByVirtualFacility) : [];
  const topPhysicalFacility = rankedPhysical[0];
  const topVirtualFacility = rankedVirtual[0];

  return {
    brokeredFacilityName: topPhysicalFacility?.name ?? '',
    brokeredFacilitySplitCount: rankedPhysical.length > 1 ? rankedPhysical.length - 1 : 0,
    dominantVirtualFacilityName: topVirtualFacility?.name ?? '',
    dominantVirtualFacilitySplitCount: rankedVirtual.length > 1 ? rankedVirtual.length - 1 : 0,
    brokeredItemCount,
    totalItemCount: docs.length
  };
}

function addFacilityItemCount(counts: Map<string, FacilityItemCount>, facilityId: string, name: string) {
  const existing = counts.get(facilityId);
  if (existing) {
    existing.count += 1;
    if (!existing.name) existing.name = name;
    return;
  }

  counts.set(facilityId, { name, count: 1 });
}

function rankFacilityItemCounts(counts: Map<string, FacilityItemCount>) {
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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
