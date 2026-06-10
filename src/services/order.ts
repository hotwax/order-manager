import { commonUtil } from '@common';
import {
  allDocs,
  normalizeOrderDoc,
  type OrderSearchResult
} from './OrderService';
import { executeSolrQuery } from './solr';

export interface OrderSearchParams {
  queryString?: string;
  status?: string | string[];
  channel?: string;
  productStoreId?: string;
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
  'customerPhoneNumber',
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
  'returnId',
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
  'customerPhoneNumber^10',
  'productId^6',
  'productName^6',
  'internalName^6',
  'parentProductName^4',
  'goodIdentifications^6',
  'orderNotes^4',
  'salesChannelDesc',
  'productStoreName',
  'shipmentId',
  'returnId'
];

export function buildOrderLookupPayload(params: OrderSearchParams = {}) {
  const viewSize = Number(params.pageSize ?? 50);
  const viewIndex = Number(params.pageIndex ?? 0);
  const searchTerm = params.queryString?.trim() ?? '';
  const filters = ['docType: ORDER', 'orderTypeId: SALES_ORDER'];
  const statusIds = selectedStatuses(params.status);

  if (statusIds.length === 1) filters.push(`orderStatusId:${escapeSolrValue(statusIds[0])}`);
  if (statusIds.length > 1) filters.push(`orderStatusId:(${statusIds.map(escapeSolrValue).join(' OR ')})`);
  if (params.channel && params.channel !== 'All') filters.push(`salesChannelEnumId: ${escapeSolrValue(params.channel)}`);
  if (params.productStoreId && params.productStoreId !== 'All') filters.push(`productStoreId: ${escapeSolrValue(params.productStoreId)}`);

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
  const response = await executeSolrQuery(buildOrderLookupPayload(params));

  if (commonUtil.hasError(response)) return Promise.reject(response.data);

  return normalizeOrderSolrResponse(response.data);
}

function normalizeOrderSolrResponse(data: any): OrderSearchResult {
  const groupedOrders = data?.grouped?.orderId;

  if (groupedOrders?.groups?.length) {
    return {
      orders: groupedOrders.groups
        .map((group: any) => group?.doclist?.docs?.[0])
        .filter(Boolean)
        .map(normalizeOrderDoc),
      total: Number(groupedOrders.ngroups ?? groupedOrders.matches ?? groupedOrders.groups.length)
    };
  }

  const docs = allDocs(data);
  return {
    orders: docs.map(normalizeOrderDoc),
    total: Number(data?.response?.numFound ?? docs.length)
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

function selectedStatuses(status?: string | string[]) {
  const statuses = Array.isArray(status) ? status : [status];
  return [...new Set(statuses.filter((statusId): statusId is string => Boolean(statusId && statusId !== 'All')))];
}

function escapeSolrValue(value: string) {
  return String(value).replace(/([\\+\-!(){}[\]^"~*?:]|&&|\|\|)/g, '\\$1');
}
