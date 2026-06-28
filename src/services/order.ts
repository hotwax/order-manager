import { api, commonUtil, useSolrSearch } from '@common';
import {
  allDocs,
  normalizeOrderDoc,
  toStringValue,
  toNumberValue,
  type OrderSearchResult
} from './OrderService';

const VIRTUAL_OR_PARKING_FACILITY_IDS = [
  '_NA_',
  'REJECTED_ITM_PARKING',
  'REJECTED_PARKING',
  'UNFILLABLE_PARKING',
  'GENERAL_OPS_PARKING'
];

export interface OrderSearchParams {
  queryString?: string;
  status?: string | string[];
  channel?: string;
  shipmentMethodTypeId?: string;
  productStoreId?: string;
  facilityIds?: string[];
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
  'address1',
  'shippingAddress1',
  'city',
  'shippingCity',
  'stateProvinceGeoId',
  'shippingStateProvinceGeoId',
  'postalCode',
  'shippingPostalCode',
  'countryGeoId',
  'shippingCountryGeoId',
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

export async function getActivePhysicalFacilityOrderVolume(params: { productStoreId?: string } = {}): Promise<ActiveFacilityOrderVolume[]> {
  const response = await useSolrSearch().runSolrQuery(buildActivePhysicalFacilityOrderVolumePayload(params));

  if (commonUtil.hasError(response)) return Promise.reject(response.data);

  return normalizeActivePhysicalFacilityOrderVolume(response.data);
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
    parkingUnitCount: sumParkingUnits(docs)
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
