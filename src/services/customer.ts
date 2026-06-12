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
export interface PartySearchResult {
  partyId: string;
  name: string;
  partyTypeId: string;
}

export async function findParties(params: {
  partyTypeId: 'PERSON' | 'PARTY_GROUP';
  firstName?: string;
  lastName?: string;
  groupName?: string;
  pageSize?: number;
}): Promise<PartySearchResult[]> {
  const query: Record<string, any> = {
    partyTypeId: params.partyTypeId,
    statusId: 'PARTY_ENABLED',
    pageSize: params.pageSize ?? 20
  };
  if (params.firstName?.trim()) { query.firstName_op = 'contains'; query.firstName = params.firstName.trim(); }
  if (params.lastName?.trim()) { query.lastName_op = 'contains'; query.lastName = params.lastName.trim(); }
  if (params.groupName?.trim()) { query.groupName_op = 'contains'; query.groupName = params.groupName.trim(); }
  const response = await api({ url: 'oms/parties', method: 'get', params: query });
  return asList(response.data).map((doc: any) => ({
    partyId: toStringValue(doc.partyId),
    name: toStringValue(doc.groupName) || [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim() || toStringValue(doc.partyId),
    partyTypeId: toStringValue(doc.partyTypeId)
  }));
}

export async function getPartyNames(partyIds: string[]): Promise<Array<{ partyId: string; name: string; partyTypeId: string }>> {
  if (!partyIds.length) return [];
  const response = await api({
    url: 'oms/parties',
    method: 'get',
    params: { partyId_op: 'in', partyId: partyIds.join(',') }
  });
  return asList(response.data).map((doc: any) => ({
    partyId: toStringValue(doc.partyId),
    name: toStringValue(doc.groupName) || [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim() || toStringValue(doc.partyId),
    partyTypeId: toStringValue(doc.partyTypeId)
  }));
}

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

  const id = toStringValue(doc?.partyId) || partyId;

  const relationshipsFrom: any[] = doc?.relationshipsFrom || [];
  const relationshipsTo: any[] = doc?.relationshipsTo || [];

  return {
    id,
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
    relationshipsFrom: relationshipsFrom.map(normalizeCustomerRelationship),
    relationshipsTo: relationshipsTo.map(normalizeCustomerRelationship)
  };
}

export function normalizeCustomerContactMech(raw: any): CustomerContactMech {
  const mech = raw?.contactMech || raw || {};
  const contactMechTypeId = toStringValue(mech.contactMechTypeId || raw?.contactMechTypeId);
  const infoString = toStringValue(mech.infoString ?? raw?.infoString);
  const purposeTypeIds = raw?.purposes
    ? (raw.purposes as any[]).map((p) => toStringValue(p.contactMechPurposeTypeId)).filter(Boolean)
    : (raw?.contactMechPurposeTypeId ? [toStringValue(raw.contactMechPurposeTypeId)] : []);

  const postal = raw?.postalAddress;
  const telecom = raw?.telecomNumber;

  return {
    partyId: toStringValue(raw?.partyId),
    contactMechId: toStringValue(raw?.contactMechId),
    contactMechTypeId,
    contactMechPurposeTypeId: purposeTypeIds[0] || '',
    purposeTypeIds,
    infoString,
    fromDate: raw?.fromDate ? toStringValue(raw.fromDate) : undefined,
    thruDate: raw?.thruDate ? toStringValue(raw.thruDate) : undefined,
    postalAddress: contactMechTypeId === 'POSTAL_ADDRESS' ? {
      address1: postal?.address1 ?? raw?.address1,
      address2: postal?.address2 ?? raw?.address2,
      city: postal?.city ?? raw?.city,
      stateProvinceGeoId: postal?.stateProvinceGeoId ?? raw?.stateProvinceGeoId,
      postalCode: postal?.postalCode ?? raw?.postalCode,
      countryGeoId: postal?.countryGeoId ?? raw?.countryGeoId
    } : undefined,
    telecomNumber: contactMechTypeId === 'TELECOM_NUMBER' ? {
      countryCode: telecom?.countryCode ?? raw?.countryCode,
      areaCode: telecom?.areaCode ?? raw?.areaCode,
      contactNumber: telecom?.contactNumber ?? raw?.contactNumber
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
  if (detail.partyGroup?.groupName) return toStringValue(detail.partyGroup.groupName);
  if (detail.groupName) return toStringValue(detail.groupName);
  const person = detail.person || detail;
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
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
  const isUnfillable = docs.some((doc) => toStringValue(doc.facilityId) === 'UNFILLABLE_PARKING');

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
    isUnfillable,
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
      orders.push(summary);
    });

    if (orders.length >= lifetimeOrders) break;
  }

  // Fetch grandTotal and currencyUom from the Orders REST API for all orders,
  // since grandTotal is not indexed in the Solr ORDER doc.
  let lifetimeValue = 0;
  if (orders.length) {
    try {
      const orderIds = orders.map((o) => o.orderId).join(',');
      const ordersRes = await api({
        url: 'oms/orders',
        method: 'get',
        params: { orderId_op: 'in', orderId: orderIds, pageSize: orders.length }
      });
      const orderHeaders: any[] = asList(ordersRes.data);
      const totalsById: Record<string, { grandTotal: number; currencyUom: string }> = {};
      orderHeaders.forEach((h: any) => {
        const id = toStringValue(h.orderId);
        if (id) totalsById[id] = { grandTotal: Number(h.grandTotal || 0), currencyUom: toStringValue(h.currencyUom) || 'USD' };
      });
      orders.forEach((order) => {
        const totals = totalsById[order.orderId];
        if (totals) {
          order.grandTotal = totals.grandTotal;
          currencyUom = totals.currencyUom || currencyUom;
        }
        lifetimeValue += order.grandTotal;
      });
    } catch {
      // Best-effort — lifetime value stays 0 if the batch call fails
    }
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

export async function createPartyEmail(partyId: string, data: { infoString: string; contactMechPurposeTypeId?: string }): Promise<void> {
  await api({ url: `oms/customers/${partyId}/emails`, method: 'post', data: { partyId, ...data } });
}

export async function updatePartyEmail(partyId: string, contactMechId: string, data: { infoString: string; contactMechPurposeTypeId?: string }): Promise<void> {
  await api({ url: `oms/customers/${partyId}/emails`, method: 'put', data: { partyId, contactMechId, ...data } });
}

export async function createPartyTelecomNumber(partyId: string, data: { contactNumber: string; countryCode?: string; areaCode?: string; contactMechPurposeTypeId?: string }): Promise<void> {
  await api({ url: `oms/customers/${partyId}/telecomNumbers`, method: 'post', data: { partyId, ...data } });
}

export async function updatePartyTelecomNumber(partyId: string, contactMechId: string, data: { contactNumber: string; countryCode?: string; areaCode?: string; contactMechPurposeTypeId?: string }): Promise<void> {
  await api({ url: `oms/customers/${partyId}/telecomNumbers`, method: 'put', data: { partyId, contactMechId, ...data } });
}

export async function createPartyPostalAddress(partyId: string, data: { address1: string; city: string; postalCode: string; address2?: string; stateProvinceGeoId?: string; countryGeoId?: string; contactMechPurposeTypeId?: string }): Promise<void> {
  await api({ url: `oms/customers/${partyId}/postalAddresses`, method: 'post', data: { partyId, ...data } });
}

export async function updatePartyPostalAddress(partyId: string, contactMechId: string, data: { address1: string; city: string; postalCode: string; address2?: string; stateProvinceGeoId?: string; countryGeoId?: string; contactMechPurposeTypeId?: string }): Promise<void> {
  await api({ url: `oms/customers/${partyId}/postalAddresses`, method: 'put', data: { partyId, contactMechId, ...data } });
}

export async function expirePartyContactMech(partyId: string, contactMechId: string): Promise<void> {
  await api({ url: `oms/customers/${partyId}/contactMechs/${contactMechId}`, method: 'delete', data: { partyId, contactMechId } });
}

function normalizeComm(doc: any): import('@/types/customer').CustomerCommunicationSummary {
  return {
    communicationEventId: toStringValue(doc.communicationEventId),
    communicationEventTypeId: toStringValue(doc.communicationEventTypeId),
    statusId: toStringValue(doc.statusId),
    subject: doc.subject ? toStringValue(doc.subject) : undefined,
    entryDate: doc.entryDate ? toStringValue(doc.entryDate) : undefined,
    datetimeStarted: doc.datetimeStarted ? toStringValue(doc.datetimeStarted) : undefined,
    datetimeEnded: doc.datetimeEnded ? toStringValue(doc.datetimeEnded) : undefined,
    partyIdFrom: doc.partyIdFrom ? toStringValue(doc.partyIdFrom) : undefined,
    partyIdTo: doc.partyIdTo ? toStringValue(doc.partyIdTo) : undefined,
    roleTypeIdFrom: doc.roleTypeIdFrom ? toStringValue(doc.roleTypeIdFrom) : undefined,
    roleTypeIdTo: doc.roleTypeIdTo ? toStringValue(doc.roleTypeIdTo) : undefined,
    contactMechTypeId: doc.contactMechTypeId ? toStringValue(doc.contactMechTypeId) : undefined,
    content: doc.content ? toStringValue(doc.content) : undefined,
    note: doc.note ? toStringValue(doc.note) : undefined
  };
}

export async function getCustomerCommunications(partyId: string): Promise<import('@/types/customer').CustomerCommunicationSummary[]> {
  const [fromRes, toRes] = await Promise.all([
    api({ url: 'oms/customers/communications', method: 'get', params: { partyIdFrom: partyId, orderByField: '-entryDate', pageSize: 100 } }),
    api({ url: 'oms/customers/communications', method: 'get', params: { partyIdTo: partyId, orderByField: '-entryDate', pageSize: 100 } })
  ]);
  const seen = new Set<string>();
  const results: import('@/types/customer').CustomerCommunicationSummary[] = [];
  for (const doc of [...asList(fromRes.data), ...asList(toRes.data)]) {
    const id = toStringValue(doc.communicationEventId);
    if (id && !seen.has(id)) {
      seen.add(id);
      results.push(normalizeComm(doc));
    }
  }
  return results.sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''));
}

function normalizeCustomerReturn(doc: any): import('@/types/customer').CustomerReturnSummary {
  const items: any[] = doc.items || [];
  const returnTotal = items.reduce((sum: number, item: any) => sum + Number(item.returnPrice || 0) * Number(item.returnQuantity || 1), 0);
  return {
    returnId: toStringValue(doc.returnId),
    externalId: doc.externalId ? toStringValue(doc.externalId) : undefined,
    statusId: toStringValue(doc.statusId),
    entryDate: toStringValue(doc.entryDate),
    returnTotal,
    currencyUomId: toStringValue(doc.currencyUomId) || 'USD',
    destinationFacilityId: doc.destinationFacilityId ? toStringValue(doc.destinationFacilityId) : undefined,
    returnChannelEnumId: doc.returnChannelEnumId ? toStringValue(doc.returnChannelEnumId) : undefined,
    itemCount: items.length,
    items: items.map((item: any) => ({
      returnItemSeqId: toStringValue(item.returnItemSeqId),
      productId: item.productId ? toStringValue(item.productId) : undefined,
      orderId: item.orderId ? toStringValue(item.orderId) : undefined,
      orderItemSeqId: item.orderItemSeqId ? toStringValue(item.orderItemSeqId) : undefined,
      statusId: toStringValue(item.statusId),
      returnReasonId: item.returnReasonId ? toStringValue(item.returnReasonId) : undefined,
      returnTypeId: item.returnTypeId ? toStringValue(item.returnTypeId) : undefined,
      returnQuantity: Number(item.returnQuantity || 0),
      receivedQuantity: item.receivedQuantity != null ? Number(item.receivedQuantity) : undefined,
      returnPrice: Number(item.returnPrice || 0),
      description: item.description ? toStringValue(item.description) : undefined
    }))
  };
}

export async function getCustomerReturns(partyId: string): Promise<import('@/types/customer').CustomerReturnSummary[]> {
  const response = await api({ url: 'oms/returns', method: 'get', params: { fromPartyId: partyId } });
  return asList(response.data).map(normalizeCustomerReturn);
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
