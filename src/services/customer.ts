import { api } from '@common';
import { useSolrSearch } from '@common/composables/useSolrSearch';
import {
  allDocs,
  buildRelatedDataDocumentPayload,
  defaultDataDocuments,
  normalizeCustomerDoc,
  normalizeOrderCollectionResponse,
  normalizeOrderDoc,
  orderLookupFields,
  toStringValue,
  uniqueStrings
} from './OrderService';
import type { ContactMech, Customer, Order } from '@/types/order';
import type { CustomerContactMech, CustomerOrderSummary, CustomerProfile, CustomerRelationship, CustomerTaskSummary } from '@/types/customer';

export interface CustomerSearchParams {
  queryString?: string;
  status?: string;
  partyTypeId?: string;
  loyaltyTier?: string;
  pageSize?: number;
  pageIndex?: number;
}

export interface CustomerSearchResult {
  customers: Customer[];
  total: number;
}

export const partyTypes: Record<string, string> = {
  PERSON: 'Person',
  PARTY_GROUP: 'Company'
};

export interface CustomerContactMechResult {
  contactMechs: ContactMech[];
  emails: ContactMech[];
  phones: ContactMech[];
  postalAddresses: ContactMech[];
}

export interface CustomerOrderResult {
  orders: Order[];
  total: number;
}

export interface CustomerOrderParams {
  pageSize?: number;
  pageIndex?: number;
}

export function buildCustomerSearchRequests(params: CustomerSearchParams = {}) {
  const baseParams: Record<string, string | number> = {
    dependentLevels: 1,
    pageSize: Number(params.pageSize ?? 50),
    pageIndex: Number(params.pageIndex ?? 0)
  };
  const searchTerm = params.queryString?.trim();

  if (params.status && params.status !== 'All') baseParams.statusId = params.status;

  if (!searchTerm) {
    if (params.partyTypeId && params.partyTypeId !== 'All') baseParams.partyTypeId = params.partyTypeId;
    else if (!params.partyTypeId) baseParams.partyTypeId = 'PERSON';
    return [baseParams];
  }

  if (isPartyIdSearch(searchTerm)) {
    return [{
      partyId: searchTerm,
      ...baseParams
    }];
  }

  const requestedPartyType = params.partyTypeId && params.partyTypeId !== 'All' ? params.partyTypeId : '';
  const tokens = searchTerm.split(/\s+/).filter(Boolean);

  if (tokens.length > 1) {
    return [{
      partyTypeId: requestedPartyType || 'PERSON',
      firstName_op: 'contains',
      firstName: tokens[0],
      lastName_op: 'contains',
      lastName: tokens[tokens.length - 1],
      ...baseParams
    }];
  }

  if (requestedPartyType === 'PARTY_GROUP') {
    return [{
      partyTypeId: 'PARTY_GROUP',
      groupName_op: 'contains',
      groupName: searchTerm,
      ...baseParams
    }];
  }

  if (requestedPartyType === 'PERSON') {
    return [{
      partyTypeId: 'PERSON',
      lastName_op: 'contains',
      lastName: searchTerm,
      ...baseParams
    }];
  }

  return [
    {
      partyTypeId: 'PERSON',
      lastName_op: 'contains',
      lastName: searchTerm,
      ...baseParams
    },
    {
      partyTypeId: 'PARTY_GROUP',
      groupName_op: 'contains',
      groupName: searchTerm,
      ...baseParams
    }
  ];
}

export async function searchCustomers(params: CustomerSearchParams = {}): Promise<CustomerSearchResult> {
  const { runSolrQuery } = useSolrSearch();
  const searchTerm = params.queryString?.trim();
  const rows = Number(params.pageSize ?? 50);
  const start = rows * Number(params.pageIndex ?? 0);

  const payload: any = {
    json: {
      params: {
        rows,
        start,
        qf: 'partyId^100 fullName^50 firstName^30 lastName^30 groupName^30 emailAddress^20 phoneNumber^10',
        defType: 'edismax'
      },
      query: '*:*',
      filter: 'docType: CUSTOMER'
    }
  };

  if (searchTerm) {
    payload.json.query = `${searchTerm}* OR "${searchTerm}"^100`;
  }

  if (params.status && params.status !== 'All') {
    payload.json.filter += ` AND statusId: ${params.status}`;
  }

  if (params.partyTypeId && params.partyTypeId !== 'All') {
    payload.json.filter += ` AND partyTypeId: ${params.partyTypeId}`;
  }

  const resp = await runSolrQuery(payload);
  const docs: any[] = resp?.data?.response?.docs ?? [];
  const total: number = resp?.data?.response?.numFound ?? 0;

  return {
    customers: docs,
    total
  };
}

export async function getCustomer(partyId: string): Promise<Customer> {
  const [partyRes, lookupRes] = await Promise.all([
    api({
      url: `oms/parties/${partyId}`,
      method: 'get'
    }),
    Promise.resolve(api({
      url: 'oms/dataDocumentView',
      method: 'post',
      data: {
        dataDocumentId: 'OrderManagerCustomerLookup',
        format: 'json',
        customParametersMap: {
          partyId,
          partyid: partyId
        },
        pageSize: 1,
        pageIndex: 0
      }
    })).catch(() => null)
  ]);

  const doc = partyRes.data;

  if (lookupRes && lookupRes.data) {
    const lookupDocs = allDocs(lookupRes.data);
    const lookupDoc = lookupDocs[0];
    if (lookupDoc) {
      doc.createdStamp = lookupDoc.createdStamp || lookupDoc.createdstamp;
      doc.lastUpdatedStamp = lookupDoc.lastUpdatedStamp || lookupDoc.lastupdatedstamp;
    }
  }

  return normalizeCustomerDoc(doc, partyId);
}

export async function getCustomerContactMechs(partyId: string): Promise<CustomerContactMechResult> {
  const response = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: buildRelatedDataDocumentPayload(
      defaultDataDocuments.customerContactLookup,
      'partyid',
      partyId
    )
  });
  const contactMechs = allDocs(response.data).map(normalizeContactMech);

  return groupContactMechs(contactMechs);
}

export async function getCustomerOrders(partyId: string, params: CustomerOrderParams = {}): Promise<CustomerOrderResult> {
  const roleResponse = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: {
      dataDocumentId: defaultDataDocuments.orderRoleLookup,
      format: 'json',
      customParametersMap: {
        partyId,
        partyid: partyId,
        roleTypeId: 'PLACING_CUSTOMER',
        roletypeid: 'PLACING_CUSTOMER'
      },
      pageSize: Number(params.pageSize ?? 10),
      pageIndex: Number(params.pageIndex ?? 0)
    }
  });

  const roleDocs = allDocs(roleResponse.data);
  const total = Number(roleResponse.data?.count ?? roleResponse.data?.total ?? roleResponse.data?.response?.numFound ?? roleDocs.length);

  if (!roleDocs.length) {
    return { orders: [], total };
  }

  const orderPromises = roleDocs.map(async (roleDoc: any) => {
    const orderId = toStringValue(roleDoc.orderId ?? roleDoc.orderid);
    if (!orderId) return null;

    try {
      const orderResponse = await api({
        url: 'oms/dataDocumentView',
        method: 'post',
        data: {
          dataDocumentId: defaultDataDocuments.orderLookup,
          format: 'json',
          fieldsToSelect: orderLookupFields,
          customParametersMap: {
            hcOrderId: orderId
          },
          pageSize: 1,
          pageIndex: 0
        }
      });
      const doc = allDocs(orderResponse.data)[0];
      return doc ? normalizeOrderDoc(doc) : null;
    } catch (error) {
      console.error(`Failed to fetch details for order ${orderId}`, error);
      return null;
    }
  });

  const orders = (await Promise.all(orderPromises)).filter(Boolean) as Order[];

  return {
    orders,
    total
  };
}

export function groupContactMechs(contactMechs: ContactMech[]): CustomerContactMechResult {
  return {
    contactMechs,
    emails: contactMechs.filter((contactMech) => contactMech.contactMechTypeId === 'EMAIL_ADDRESS'),
    phones: contactMechs.filter((contactMech) => contactMech.contactMechTypeId === 'TELECOM_NUMBER'),
    postalAddresses: contactMechs.filter((contactMech) => contactMech.contactMechTypeId === 'POSTAL_ADDRESS')
  };
}

function normalizeContactMech(doc: any): ContactMech {
  const contactMechTypeId = readContactField(doc, 'contactMechTypeId');

  return {
    contactMechId: readContactField(doc, 'contactMechId'),
    contactMechTypeId,
    contactMechPurposeTypeId: readContactField(doc, 'contactMechPurposeTypeId'),
    infoString: contactMechTypeId === 'TELECOM_NUMBER' ? formatPhone(doc) : readContactField(doc, 'infoString'),
    postalAddress: contactMechTypeId === 'POSTAL_ADDRESS' ? {
      address1: readContactField(doc, 'address1'),
      address2: readContactField(doc, 'address2'),
      city: readContactField(doc, 'city'),
      stateProvinceGeoId: readContactField(doc, 'stateProvinceGeoId'),
      postalCode: readContactField(doc, 'postalCode'),
      countryGeoId: readContactField(doc, 'countryGeoId')
    } : undefined,
    expireDate: readContactField(doc, 'expireDate')
  };
}

function formatPhone(doc: any) {
  const countryCode = readContactField(doc, 'countryCode');
  const areaCode = readContactField(doc, 'areaCode');
  const contactNumber = readContactField(doc, 'contactNumber');
  const phone = [countryCode ? `+${countryCode}` : '', areaCode, contactNumber].filter(Boolean).join(' ');

  return phone || readContactField(doc, 'infoString');
}

function readContactField(doc: any, fieldName: string) {
  return toStringValue(doc[fieldName] ?? doc[fieldName.toLowerCase()]);
}

async function searchCustomersByContact(searchTerm: string, params: CustomerSearchParams): Promise<CustomerSearchResult> {
  const contactField = searchTerm.includes('@') ? 'infoString' : 'contactNumber';
  const response = await api({
    url: 'oms/dataDocumentView',
    method: 'post',
    data: {
      dataDocumentId: defaultDataDocuments.customerContactLookup,
      format: 'json',
      customParametersMap: {
        [contactField]: searchTerm
      },
      pageSize: Number(params.pageSize ?? 50),
      pageIndex: Number(params.pageIndex ?? 0)
    }
  });
  const contactDocs = allDocs(response.data);
  const partyIds = uniqueStrings(contactDocs.map((doc: any) => readContactField(doc, 'partyId')));

  if (!partyIds.length) {
    return { customers: [], total: 0 };
  }

  const customers = await Promise.all(partyIds.map(getCustomer));
  const filteredCustomers = customers.filter((customer) => {
    if (params.status && params.status !== 'All' && customer.statusId !== params.status) return false;
    if (params.partyTypeId && params.partyTypeId !== 'All' && customer.partyTypeId !== params.partyTypeId) return false;
    return true;
  });

  return {
    customers: filteredCustomers,
    total: filteredCustomers.length
  };
}

function responseList(data: any) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.list)) return data.list;
  return allDocs(data);
}

function responseTotal(data: any, fallback: number) {
  return Number(data?.count ?? data?.total ?? data?.documentDataCount ?? data?.response?.numFound ?? fallback);
}

function isPartyIdSearch(value: string) {
  return /^10\d+$/.test(value);
}

function isPhoneSearch(value: string) {
  return /^\d{7,}$/.test(value.replace(/[^\d]/g, ''));
}

/**
 * Customer 360 profile read. Calls GET /oms/customers/{partyId} (the Party
 * `customerDetail` entity master) and flattens the nested master into the
 * CustomerProfile shape the detail store/getters consume. Bounded profile only -
 * orders, tasks, returns, and communications are separate paginated calls.
 */
export async function getCustomerProfile(partyId: string): Promise<CustomerProfile> {
  const response = await api({
    url: `oms/customers/${partyId}`,
    method: 'get'
  });
  return normalizeCustomerProfile(response.data, partyId);
}

export function normalizeCustomerProfile(doc: any, partyId = ''): CustomerProfile {
  const person = doc?.person;
  const group = doc?.partyGroup;
  const name = group?.groupName
    || [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim()
    || toStringValue(doc?.partyId)
    || partyId;

  return {
    id: toStringValue(doc?.partyId) || partyId,
    name,
    partyTypeId: toStringValue(doc?.partyTypeId),
    statusId: toStringValue(doc?.statusId),
    externalId: doc?.externalId ? toStringValue(doc.externalId) : undefined,
    createdStamp: toStringValue(doc?.createdDate ?? doc?.createdStamp),
    lastUpdatedStamp: toStringValue(doc?.lastUpdatedStamp ?? doc?.lastModifiedDate),
    lifetimeOrders: 0,
    lifetimeValue: 0,
    roles: (doc?.roles || []).map((role: any) => ({
      roleTypeId: toStringValue(role.roleTypeId),
      fromDate: role.fromDate ? toStringValue(role.fromDate) : undefined,
      thruDate: role.thruDate ? toStringValue(role.thruDate) : undefined
    })),
    identifications: (doc?.identifications || []).map((identification: any) => ({
      partyIdentificationTypeId: toStringValue(identification.partyIdentificationTypeId),
      idValue: toStringValue(identification.idValue)
    })),
    contactMechs: (doc?.contactMechs || []).map(normalizeCustomerContactMech),
    relationshipsFrom: (doc?.relationshipsFrom || []).map(normalizeCustomerRelationship),
    relationshipsTo: (doc?.relationshipsTo || []).map(normalizeCustomerRelationship)
  };
}

export function normalizeCustomerContactMech(contactMech: any): CustomerContactMech {
  const mech = contactMech?.contactMech || {};
  const purposeTypeIds = (contactMech?.purposes || [])
    .map((purpose: any) => toStringValue(purpose.contactMechPurposeTypeId))
    .filter(Boolean);
  const postal = contactMech?.postalAddress;
  const telecom = contactMech?.telecomNumber;

  return {
    partyId: toStringValue(contactMech?.partyId),
    contactMechId: toStringValue(contactMech?.contactMechId),
    contactMechTypeId: toStringValue(mech.contactMechTypeId),
    contactMechPurposeTypeId: purposeTypeIds[0] || '',
    purposeTypeIds,
    infoString: toStringValue(mech.infoString),
    fromDate: contactMech?.fromDate ? toStringValue(contactMech.fromDate) : undefined,
    thruDate: contactMech?.thruDate ? toStringValue(contactMech.thruDate) : undefined,
    postalAddress: postal ? {
      address1: postal.address1,
      address2: postal.address2,
      city: postal.city,
      stateProvinceGeoId: postal.stateProvinceGeoId,
      postalCode: postal.postalCode,
      countryGeoId: postal.countryGeoId
    } : undefined,
    telecomNumber: telecom ? {
      countryCode: telecom.countryCode,
      areaCode: telecom.areaCode,
      contactNumber: telecom.contactNumber
    } : undefined
  };
}

export function normalizeCustomerRelationship(relationship: any): CustomerRelationship {
  return {
    partyIdFrom: toStringValue(relationship?.partyIdFrom),
    partyIdTo: toStringValue(relationship?.partyIdTo),
    roleTypeIdFrom: toStringValue(relationship?.roleTypeIdFrom),
    roleTypeIdTo: toStringValue(relationship?.roleTypeIdTo),
    fromDate: toStringValue(relationship?.fromDate),
    thruDate: relationship?.thruDate ? toStringValue(relationship.thruDate) : undefined,
    partyRelationshipTypeId: toStringValue(relationship?.partyRelationshipTypeId),
    relationshipName: relationship?.relationshipType?.partyRelationshipName
      || toStringValue(relationship?.partyRelationshipTypeId),
    fromPartyName: partyNameFromDetail(relationship?.fromParty) || toStringValue(relationship?.partyIdFrom),
    toPartyName: partyNameFromDetail(relationship?.toParty) || toStringValue(relationship?.partyIdTo),
    comments: relationship?.comments
  };
}

function partyNameFromDetail(detail: any): string {
  if (!detail) return '';
  if (detail.groupName) return toStringValue(detail.groupName);
  return [detail.firstName, detail.lastName].filter(Boolean).join(' ').trim();
}

export interface CustomerOrdersResult {
  orders: CustomerOrderSummary[];
  lifetimeOrders: number;
  lifetimeValue: number;
  currencyUom: string;
  firstOrderDate: string;
}

// No real fulfillment percentage is indexed on the order doc, so we derive a
// coarse progress value from the order status purely for the dashboard bar.
const ORDER_PROGRESS: Record<string, number> = {
  ORDER_CREATED: 0.2,
  ORDER_APPROVED: 0.6,
  ORDER_HELD: 0.4,
  ORDER_COMPLETED: 1,
  ORDER_CANCELLED: 0
};

function mapOrderGroup(group: any): CustomerOrderSummary {
  const docs: any[] = group.doclist?.docs || [];
  const head = docs[0] || {};
  const statusId = toStringValue(head.orderStatusId || head.statusId);
  const unitCount = docs.reduce((sum, doc) => sum + Number(doc.quantity || 0), 0);

  return {
    orderId: toStringValue(group.groupValue),
    orderName: head.orderName || toStringValue(group.groupValue),
    orderDate: toStringValue(head.orderDate),
    statusId,
    statusDesc: head.orderStatusDesc || statusId,
    grandTotal: Number(head.grandTotal || 0),
    currencyUom: head.currencyUom || 'USD',
    itemCount: Number(group.doclist?.numFound ?? docs.length),
    unitCount,
    progressLabel: head.orderStatusDesc || statusId,
    progressValue: ORDER_PROGRESS[statusId] ?? 0.4,
    items: docs.slice(0, 3).map((doc) => ({
      orderItemSeqId: toStringValue(doc.orderItemSeqId),
      productId: toStringValue(doc.productId),
      sku: toStringValue(doc.internalName) || toStringValue(doc.productId),
      name: doc.parentProductName || doc.productName || doc.internalName || toStringValue(doc.productId),
      quantity: Number(doc.quantity || 0),
      imageUrl: doc.mainImageUrl || ''
    }))
  };
}

/**
 * Customer orders + lifetime aggregates from Solr (enterpriseSearch core,
 * docType:ORDER, customerPartyId). The app calls runSolrQuery directly. Order docs
 * are per-item, so we group by orderId. We PAGE THROUGH every group so the lifetime
 * value/count are accurate regardless of order volume (ngroups = order count; one
 * grandTotal per group summed = lifetime value). A Solr stats/facet sum can replace
 * this loop later for performance.
 */
export async function getCustomerOrdersFromSolr(partyId: string, params: { pageSize?: number } = {}): Promise<CustomerOrdersResult> {
  const pageSize = params.pageSize ?? 200;
  const maxPages = 50; // safety cap (~10k orders)

  const orders: CustomerOrderSummary[] = [];
  let lifetimeValue = 0;
  let lifetimeOrders = 0;
  let currencyUom = 'USD';

  for (let page = 0; page < maxPages; page++) {
    const response = await api({
      url: 'admin/runSolrQuery',
      method: 'post',
      data: {
        coreName: 'enterpriseSearch',
        json: {
          query: '*:*',
          filter: ['docType:ORDER', `customerPartyId:"${partyId}"`],
          params: {
            group: true,
            'group.field': 'orderId',
            'group.limit': 10,
            'group.ngroups': true,
            sort: 'orderDate desc',
            rows: pageSize,
            start: page * pageSize
          }
        }
      }
    });

    const grouped = response.data?.grouped?.orderId;
    const groups: any[] = grouped?.groups || [];
    lifetimeOrders = Number(grouped?.ngroups ?? (page * pageSize + groups.length));
    if (!groups.length) break;

    groups.forEach((group) => {
      const summary = mapOrderGroup(group);
      lifetimeValue += summary.grandTotal;
      currencyUom = summary.currencyUom || currencyUom;
      orders.push(summary);
    });

    if (orders.length >= lifetimeOrders) break;
  }

  // Earliest order date (orders are sorted desc) - "customer since" fallback.
  const firstOrderDate = orders.reduce((min, order) => {
    if (!order.orderDate) return min;
    return !min || order.orderDate < min ? order.orderDate : min;
  }, '');

  return { orders, lifetimeOrders, lifetimeValue, currencyUom, firstOrderDate };
}

/**
 * Current statuses that drive an order's progress, hydrated from the official get-order API
 * (GET oms/orders?orderId=... - the same path the order detail page uses), NOT from Solr.
 * Returns the latest status per order item, plus any shipment-item statuses the payload
 * includes (robust: shipments are factored when present, ignored when absent). The caller
 * maps each status to StatusItem.statusAge to compute the progress percentage.
 */
export async function getOrderProgressStatuses(orderId: string): Promise<string[]> {
  const response = await api({ url: 'oms/orders', method: 'get', params: { orderId, dependentLevels: 1 } });
  const order = Array.isArray(response.data) ? response.data[0] : response.data;
  if (!order) return [];

  // statuses[] is the full status history; keep the latest entry per order item.
  const latestByItem: Record<string, any> = {};
  (order.statuses || []).forEach((entry: any) => {
    const seqId = toStringValue(entry.orderItemSeqId);
    if (!seqId || seqId === '_NA_') return; // skip order-level / non-item statuses
    const current = latestByItem[seqId];
    if (!current || Number(entry.statusDatetime || 0) > Number(current.statusDatetime || 0)) {
      latestByItem[seqId] = entry;
    }
  });
  const statuses = Object.values(latestByItem)
    .map((entry: any) => toStringValue(entry.statusId))
    .filter(Boolean);

  // Shipment-item statuses if the order payload includes them (otherwise ignored).
  (order.shipments || []).forEach((shipment: any) => {
    (shipment.items || shipment.shipmentItems || []).forEach((item: any) => {
      const statusId = toStringValue(item.statusId);
      if (statusId) statuses.push(statusId);
    });
  });

  return statuses;
}

/**
 * Customer tasks via GET /oms/customers/{partyId}/tasks (get#PartyTasks). Separate,
 * paginated/filterable call - tasks are unbounded history, kept out of the profile master.
 */
export async function getCustomerTasks(
  partyId: string,
  params: { statusId?: string; pageSize?: number; pageIndex?: number; orderByField?: string } = {}
): Promise<CustomerTaskSummary[]> {
  const response = await api({
    url: `oms/customers/${partyId}/tasks`,
    method: 'get',
    params: {
      statusId: params.statusId,
      pageSize: params.pageSize ?? 20,
      pageIndex: params.pageIndex ?? 0,
      orderByField: params.orderByField
    }
  });
  return (response.data?.tasks || []).map(normalizeCustomerTask);
}

export function normalizeCustomerTask(task: any): CustomerTaskSummary {
  const person = (value: any) => (value
    ? { partyId: toStringValue(value.partyId), name: value.name || toStringValue(value.partyId), fromDate: value.fromDate ? toStringValue(value.fromDate) : undefined }
    : undefined);

  return {
    workEffortId: toStringValue(task.workEffortId),
    workEffortName: toStringValue(task.workEffortName),
    workEffortTypeId: toStringValue(task.workEffortTypeId),
    purposeTypeId: task.purposeTypeId ? toStringValue(task.purposeTypeId) : undefined,
    statusId: toStringValue(task.statusId),
    dueDate: task.dueDate ? toStringValue(task.dueDate) : undefined,
    orderId: task.orderId ? toStringValue(task.orderId) : undefined,
    orderName: task.orderName || undefined,
    orderDate: task.orderDate ? toStringValue(task.orderDate) : undefined,
    orderTotal: task.orderTotal != null ? Number(task.orderTotal) : undefined,
    assignee: person(task.assignee),
    reporter: person(task.reporter),
    notes: task.notes || undefined,
    resolution: task.resolution || undefined
  };
}

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

/**
 * Customer relationships from the dedicated /oms/partyRelationships endpoint (both
 * directions, merged). Used instead of the Party master's nested relationshipsFrom/To
 * because relationship-based master finds are cached and miss newly-created rows; the
 * direct entity-list query stays fresh.
 */
export async function getCustomerRelationships(partyId: string): Promise<CustomerRelationship[]> {
  const [fromRes, toRes] = await Promise.all([
    api({ url: 'oms/partyRelationships', method: 'get', params: { partyIdFrom: partyId } }),
    api({ url: 'oms/partyRelationships', method: 'get', params: { partyIdTo: partyId } })
  ]);

  const seen = new Set<string>();
  const merged: CustomerRelationship[] = [];
  [...asList(fromRes.data), ...asList(toRes.data)].forEach((row) => {
    const relationship = normalizeCustomerRelationship(row);
    const key = [relationship.partyIdFrom, relationship.partyIdTo, relationship.roleTypeIdFrom, relationship.roleTypeIdTo, relationship.fromDate].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(relationship);
  });
  return merged;
}

export interface RelationshipInput {
  partyIdFrom: string;
  partyIdTo: string;
  roleTypeIdFrom?: string;
  roleTypeIdTo?: string;
  fromDate: string;
  partyRelationshipTypeId: string;
  comments?: string;
}

export async function createPartyRelationship(input: RelationshipInput): Promise<void> {
  await api({
    url: 'oms/partyRelationships',
    method: 'post',
    data: {
      roleTypeIdFrom: 'CUSTOMER',
      roleTypeIdTo: 'CUSTOMER',
      ...input
    }
  });
}

export interface RelationshipKey {
  partyIdFrom: string;
  partyIdTo: string;
  roleTypeIdFrom: string;
  roleTypeIdTo: string;
  fromDate: string;
}

export async function expirePartyRelationship(key: RelationshipKey, thruDate: string): Promise<void> {
  await api({
    url: 'oms/partyRelationships',
    method: 'put',
    data: { ...key, thruDate }
  });
}

export async function searchShopifyCustomers(shopId: string, searchText: string): Promise<Customer[]> {
  const response = await api({
    url: 'oms/shopify/customers',
    method: 'get',
    params: {
      shopId,
      searchText
    }
  });
  return response.data?.customers || [];
}

export async function createShopifyCustomer(shopId: string, customerData: any): Promise<any> {
  const response = await api({
    url: 'oms/shopify/customers',
    method: 'post',
    data: {
      shopId,
      ...customerData
    }
  });
  return response.data;
}

export async function getShopifyShops(params: { productStoreId: string }): Promise<any[]> {
  const response = await api({
    url: 'oms/shopifyShops/shops',
    method: 'get',
    params
  });
  return response.data || [];
}
