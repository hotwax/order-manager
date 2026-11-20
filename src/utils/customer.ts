import { toStringValue } from '@/utils/orderDocs';
import type {
  CustomerCommunicationSummary,
  CustomerContactMech,
  CustomerOrderSummary,
  CustomerProfile,
  CustomerRelationship,
  CustomerTaskSummary
} from '@/types/customer';

export interface CustomerSearchParams {
  queryString?: string;
  status?: string;
  partyTypeId?: string;
  loyaltyTier?: string;
  pageSize?: number;
  pageIndex?: number;
  sort?: string;
}

export interface CustomerSearchRow {
  partyId: string;
  fullName?: string;
  emailAddress?: string;
  phoneNumber?: string;
}

export interface CustomerSearchResult {
  customers: CustomerSearchRow[];
  total: number;
}

export interface CustomerOrdersResult {
  orders: CustomerOrderSummary[];
  lifetimeOrders: number;
  lifetimeValue: number;
  currencyUom: string;
  firstOrderDate: string;
}

export interface RelationshipInput {
  partyIdFrom: string;
  partyIdTo: string;
  roleTypeIdFrom?: string;
  roleTypeIdTo?: string;
  fromDate: number;
  partyRelationshipTypeId: string;
  comments?: string;
}

export interface RelationshipKey {
  partyIdFrom: string;
  partyIdTo: string;
  roleTypeIdFrom: string;
  roleTypeIdTo: string;
  fromDate: string;
}

export function buildCustomerSearchPayload(params: CustomerSearchParams = {}) {
  const searchTerm = params.queryString?.trim();
  const rows = Number(params.pageSize ?? 50);
  const start = rows * Number(params.pageIndex ?? 0);

  const payload: any = {
    json: {
      params: {
        rows,
        start,
        qf: 'partyId^100 fullName^50 firstName^30 lastName^30 groupName^30 emailAddress^20 phoneNumber^10',
        defType: 'edismax',
        ...(params.sort ? { sort: params.sort } : {})
      },
      query: '*:*',
      filter: 'docType:CUSTOMER AND -statusId:PARTY_DISABLED'
    }
  };

  if (searchTerm) {
    payload.json.query = `*${searchTerm}* OR "${searchTerm}"^100`;
  }

  if (params.status && params.status !== 'All') {
    payload.json.filter += ` AND statusId:${params.status}`;
  }

  if (params.partyTypeId && params.partyTypeId !== 'All') {
    payload.json.filter += ` AND partyTypeId: ${params.partyTypeId}`;
  }

  return payload;
}

/** The customer order query for one page: Solr ORDER docs grouped by order, newest first. */
export function buildCustomerOrdersPayload(partyId: string, page: number, pageSize: number) {
  return {
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
  };
}

export function partyNameRow(doc: any): { partyId: string; name: string; partyTypeId: string } {
  return {
    partyId: toStringValue(doc.partyId),
    name: toStringValue(doc.groupName) || [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim() || toStringValue(doc.partyId),
    partyTypeId: toStringValue(doc.partyTypeId)
  };
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
    createdByUserLogin: toStringValue(doc?.createdByUserLogin),
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

// No real fulfillment percentage is indexed on the order doc, so we derive a
// coarse progress value from the order status purely for the dashboard bar.
const ORDER_PROGRESS: Record<string, number> = {
  ORDER_CREATED: 0.2,
  ORDER_APPROVED: 0.6,
  ORDER_HELD: 0.4,
  ORDER_COMPLETED: 1,
  ORDER_CANCELLED: 0
};

export function summarizeCustomerOrderGroup(group: any): CustomerOrderSummary {
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

/** The latest status per order item plus any shipment-item statuses, from a get-order payload. */
export function orderProgressStatuses(order: any): string[] {
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

export function normalizeCustomerTask(task: any): CustomerTaskSummary {
  return {
    workEffortId: toStringValue(task.workEffortId),
    workEffortName: toStringValue(task.workEffortName),
    workEffortTypeId: toStringValue(task.workEffortTypeId),
    workEffortPurposeTypeId: task.workEffortPurposeTypeId ? toStringValue(task.workEffortPurposeTypeId) : undefined,
    taskStatusId: toStringValue(task.taskStatusId),
    orderStatusId: task.orderStatusId ? toStringValue(task.orderStatusId) : undefined,
    orderId: task.orderId ? toStringValue(task.orderId) : undefined,
    orderName: task.orderName || undefined,
    orderDate: task.orderDate ? toStringValue(task.orderDate) : undefined,
    grandTotal: task.grandTotal != null ? Number(task.grandTotal) : undefined,
    customerPartyId: (task.customerPartyId || task.partyId) ? toStringValue(task.customerPartyId || task.partyId) : undefined,
    assigneePartyId: task.assigneePartyId ? toStringValue(task.assigneePartyId) : undefined,
    assigneeName: task.assigneeFullName || undefined,
    assigneeSince: task.assigneeSince ? toStringValue(task.assigneeSince) : undefined,
    reporterPartyId: task.reporterPartyId ? toStringValue(task.reporterPartyId) : undefined,
    reporterName: task.reporterFullName || undefined,
    reporterSince: task.reporterSince ? toStringValue(task.reporterSince) : undefined,
    notes: task.notes || undefined,
    resolution: task.resolution || undefined,
    dueDate: task.dueDate ? toStringValue(task.dueDate) : undefined,
  };
}

export function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

export function normalizeCustomerCommunication(doc: any): CustomerCommunicationSummary {
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
