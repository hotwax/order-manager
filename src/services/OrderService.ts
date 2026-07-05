import type { Customer, Order, ReturnRecord, Shipment } from '@/types/order';

export interface OrderSearchQuery {
  queryString?: string;
  status?: string;
  channel?: string;
  pageSize?: number;
  pageIndex?: number;
}

export interface OrderSearchResult {
  orders: Order[];
  total: number;
}

export interface OrderWorkflowData {
  orders: Order[];
  shipments: Shipment[];
  returns: ReturnRecord[];
  customers: Customer[];
}

export const defaultDataDocuments = {
  orderLookup: 'OrderManagerOrderLookup',
  orderItemLookup: 'OrderManagerOrderItemLookup',
  orderRoleLookup: 'OrderManagerOrderRoleLookup',
  orderShipmentLookup: 'OrderManagerOrderShipmentLookup',
  orderNoteLookup: 'OrderManagerOrderNoteLookup',
  noteDataLookup: 'OrderManagerNoteDataLookup',
  orderStatusLookup: 'OrderManagerOrderStatusLookup',
  shipmentLookup: 'OrderManagerShipmentLookup',
  returnLookup: 'OrderManagerReturnLookup',
  returnItemLookup: 'OrderManagerReturnItemLookup',
  customerLookup: 'OrderManagerCustomerLookup',
  customerContactLookup: 'OrderManagerCustomerContactLookup'
};

export const orderLookupFields = [
  'orderId',
  'hcOrderId',
  'orderName',
  'externalId',
  'orderDate',
  'statusId',
  'customerFirstName',
  'customerLastName',
  'customerName',
  'partyId',
  'customerPartyId',
  'salesChannelEnumId',
  'grandTotal',
  'currencyUom',
  'priority',
  'productStoreId'
];

export const shipmentLookupFields = [
  'shipmentId',
  'primaryOrderId',
  'shipmentTypeId',
  'statusId',
  'carrierPartyId',
  'originFacilityId',
  'destinationFacilityId',
  'estimatedShipDate',
  'estimatedArrivalDate',
  'latestCancelDate',
  'createdDate'
];

export const orderItemLookupFields = [
  'orderId',
  'orderItemSeqId',
  'productId',
  'itemDescription',
  'quantity',
  'unitPrice',
  'statusId',
  'facilityId'
];

export const orderRoleLookupFields = [
  'orderId',
  'partyId',
  'roleTypeId',
  'fromDate',
  'thruDate'
];

export const orderShipmentLookupFields = [
  'orderId',
  'orderItemSeqId',
  'shipmentId',
  'shipmentItemSeqId',
  'quantity',
  'productId',
  'itemDescription'
];

export const orderNoteLookupFields = [
  'orderId',
  'noteId',
  'internalNote'
];

export const noteDataLookupFields = [
  'noteId',
  'noteName',
  'noteInfo',
  'noteDateTime',
  'noteParty'
];

export const orderStatusLookupFields = [
  'orderStatusId',
  'orderId',
  'statusId',
  'statusDatetime',
  'statusUserLogin'
];

export const returnLookupFields = [
  'returnId',
  'externalId',
  'statusId',
  'returnHeaderTypeId',
  'fromPartyId',
  'toPartyId',
  'entryDate',
  'createdDate',
  'receivedDate',
  'currencyUomId',
  'createdBy',
  'orderId',
  'returnTotal',
  'grandTotal'
];

export const returnItemLookupFields = [
  'returnId',
  'returnItemSeqId',
  'returnReasonId',
  'returnTypeId',
  'returnItemTypeId',
  'productId',
  'description',
  'orderId',
  'orderItemSeqId',
  'statusId',
  'returnQuantity',
  'receivedQuantity',
  'returnPrice',
  'returnItemResponseId'
];

export const customerLookupFields = [
  'partyId',
  'partyTypeId',
  'externalId',
  'statusId',
  'firstName',
  'middleName',
  'lastName',
  'personalTitle',
  'groupName',
  'partyName',
  'emailAddress',
  'infoString',
  'contactNumber',
  'phoneNumber',
  'loyaltyTier',
  'lifetimeOrders',
  'lifetimeValue',
  'createdStamp',
  'lastUpdatedStamp'
];

export const customerContactLookupFields = [
  'partyId',
  'contactMechId',
  'contactMechTypeId',
  'contactMechPurposeTypeId',
  'infoString',
  'countryCode',
  'areaCode',
  'contactNumber',
  'address1',
  'address2',
  'city',
  'stateProvinceGeoId',
  'postalCode',
  'countryGeoId',
  'expireDate'
];

export function buildOrderDataDocumentPayload(dataDocumentId: string, query: OrderSearchQuery = {}) {
  const customParametersMap: Record<string, string> = {
    orderTypeId: 'SALES_ORDER'
  };
  const searchTerm = query.queryString?.trim();

  if (searchTerm) {
    if (searchTerm.startsWith('#')) {
      customParametersMap.orderName = searchTerm;
    } else if (isInternalOrderId(searchTerm)) {
      customParametersMap.hcOrderId = searchTerm;
    } else {
      customParametersMap.externalId = searchTerm;
    }
  }
  if (query.status && query.status !== 'All') customParametersMap.statusId = query.status;
  if (query.channel && query.channel !== 'All') customParametersMap.salesChannel = query.channel;

  return {
    dataDocumentId,
    format: 'json',
    fieldsToSelect: orderLookupFields,
    customParametersMap,
    orderByField: '-orderDate',
    pageSize: Number(query.pageSize ?? 50),
    pageIndex: Number(query.pageIndex ?? 0)
  };
}

export function buildDetailDataDocumentPayload(dataDocumentId: string, idField: string, id: string, fieldsToSelect: string[]) {
  return {
    dataDocumentId,
    format: 'json',
    fieldsToSelect,
    customParametersMap: {
      [idField]: id
    },
    pageSize: 1,
    pageIndex: 0
  };
}

export function buildRelatedDataDocumentPayload(dataDocumentId: string, idField: string, id: string, fieldsToSelect?: string[]) {
  const payload: Record<string, any> = {
    dataDocumentId,
    format: 'json',
    customParametersMap: {
      [idField]: id
    },
    pageSize: 100,
    pageIndex: 0
  };

  if (fieldsToSelect) payload.fieldsToSelect = fieldsToSelect;

  return payload;
}

export function normalizeOrderCollectionResponse(data: any): OrderSearchResult {
  const docs = allDocs(data);

  return {
    orders: docs.map(normalizeOrderDoc),
    total: Number(data?.count ?? data?.total ?? data?.response?.numFound ?? docs.length)
  };
}

export function normalizeOrderDoc(doc: any): Order {
  const orderId = toStringValue(doc.orderId ?? doc.hcOrderId ?? doc.externalId ?? doc.orderName);
  const customerName = toStringValue(doc.customerName) || [doc.customerFirstName, doc.customerLastName]
    .map((value) => toStringValue(value))
    .filter(Boolean)
    .join(' ');

  return {
    id: orderId,
    externalId: toStringValue(doc.orderName ?? doc.externalOrderId ?? doc.externalId, orderId),
    orderDate: toStringValue(doc.orderDate ?? doc.orderEntryDate),
    status: toStringValue(doc.orderStatusDesc ?? doc.orderStatusId ?? doc.statusId, 'Created') as Order['status'],
    customerId: toStringValue(doc.customerPartyId ?? doc.customerId ?? doc.partyId),
    customerName: customerName || toStringValue(doc.customerPartyName),
    channel: toStringValue(doc.salesChannelDesc ?? doc.salesChannelEnumId ?? doc.productStoreId),
    total: toNumberValue(doc.grandTotal),
    currency: toStringValue(doc.currencyUom ?? doc.presentmentCurrencyUom, 'USD'),
    paymentStatus: toStringValue(doc.paymentStatus ?? doc.paymentStatusDesc),
    fulfillmentStatus: toStringValue(doc.fulfillmentStatus ?? doc.orderStatusDesc ?? doc.orderStatusId ?? doc.statusId),
    deliveryMethod: toStringValue(doc.shipmentMethodDesc ?? doc.shipmentMethodTypeId),
    priority: toStringValue(doc.priority ?? doc.orderStatusDesc ?? doc.orderStatusId ?? doc.statusId),
    shippingAddress1: toStringValue(doc.shippingAddress1 ?? doc.address1),
    shippingCity: toStringValue(doc.shippingCity ?? doc.city),
    shippingStateProvinceGeoId: toStringValue(doc.shippingStateProvinceGeoId ?? doc.stateProvinceGeoId),
    shippingPostalCode: toStringValue(doc.shippingPostalCode ?? doc.postalCode),
    shippingCountryGeoId: toStringValue(doc.shippingCountryGeoId ?? doc.countryGeoId),
    estimatedDeliveryDate: toStringValue(doc.estimatedDeliveryDate ?? doc.promisedDatetime),
    promisedDatetime: toStringValue(doc.promisedDatetime),
    shipBeforeDate: toStringValue(doc.shipBeforeDate),
    shipByDate: toStringValue(doc.shipByDate),
    queueReason: toStringValue(doc.rejectionReasonDesc ?? doc.rejectionReason ?? doc.rejectionReasonId),
    rejectionReason: toStringValue(doc.rejectionReason ?? doc.rejectionReasonDesc ?? doc.rejectionReasonId),
    ruleName: toStringValue(doc.ruleName ?? doc.routingRuleName ?? doc.facilityRuleName),
    items: [],
    shipmentIds: toStringList(doc.shipmentId ?? doc.primaryShipmentId),
    returnIds: toStringList(doc.returnId ?? doc.primaryReturnId),
    notes: [],
    history: []
  };
}

export function normalizeOrderItemDoc(doc: any) {
  return {
    id: toStringValue(doc.orderItemSeqId),
    sku: toStringValue(doc.productId),
    name: toStringValue(doc.itemDescription ?? doc.productId),
    quantity: toNumberValue(doc.quantity),
    status: toStringValue(doc.statusId ?? doc.status),
    facility: toStringValue(doc.facilityId),
    unitPrice: toNumberValue(doc.unitPrice),
    imageUrl: toStringValue(doc.mainImageUrl ?? doc.mediumImageUrl ?? doc.smallImageUrl ?? doc.productImageUrl ?? doc.imageUrl)
  };
}

export function normalizeOrderNoteDoc(doc: any) {
  return {
    id: toStringValue(doc.noteId),
    author: toStringValue(doc.noteParty, 'System'),
    createdAt: toStringValue(doc.noteDateTime),
    title: toStringValue(doc.noteName),
    body: toStringValue(doc.noteInfo)
  };
}

export function normalizeOrderStatusDoc(doc: any) {
  const statusId = toStringValue(doc.statusId);
  const statusUserLogin = toStringValue(doc.statusUserLogin);

  return {
    id: toStringValue(doc.orderStatusId ?? `${statusId}-${doc.statusDatetime}`),
    at: toStringValue(doc.statusDatetime ?? doc.statusDateTime),
    label: statusId,
    detail: statusUserLogin ? `Updated by ${statusUserLogin}` : statusId
  };
}

export function mergeOrderNoteDocs(noteDocs: any[], noteDataDocs: any[]) {
  const noteDataById = new Map(noteDataDocs.map((doc) => [toStringValue(doc.noteId), doc]));

  return noteDocs.map((noteDoc) => ({
    ...noteDoc,
    ...noteDataById.get(toStringValue(noteDoc.noteId))
  }));
}

export function normalizeShipmentDoc(doc: any, fallbackId = ''): Shipment {
  return {
    id: toStringValue(doc.shipmentId, fallbackId),
    orderId: toStringValue(doc.primaryOrderId ?? doc.orderId),
    shipmentTypeId: toStringValue(doc.shipmentTypeId),
    status: toStringValue(doc.statusId ?? doc.status),
    carrier: toStringValue(doc.carrierPartyId ?? doc.carrierServiceStatusId ?? doc.partyIdTo),
    trackingCode: toStringValue(doc.trackingCode ?? doc.trackingIdNumber),
    origin: toStringValue(doc.originFacilityName ?? doc.originFacilityId ?? doc.facilityId),
    destination: toStringValue(doc.destinationFacilityName ?? doc.destinationFacilityId),
    originFacilityId: toStringValue(doc.originFacilityId ?? doc.facilityId),
    originFacilityName: toStringValue(doc.originFacilityName),
    destinationFacilityId: toStringValue(doc.destinationFacilityId),
    destinationFacilityName: toStringValue(doc.destinationFacilityName),
    shipDate: toStringValue(doc.estimatedShipDate ?? doc.shipmentShippedDate ?? doc.shipDate ?? doc.createdDate),
    estimatedShipDate: toStringValue(doc.estimatedShipDate),
    estimatedArrivalDate: toStringValue(doc.estimatedArrivalDate),
    latestCancelDate: toStringValue(doc.latestCancelDate),
    createdDate: toStringValue(doc.createdDate ?? doc.shipmentCreatedDate),
    itemIds: toStringList(doc.shipmentItemSeqId ?? doc.orderItemSeqId),
    packages: []
  };
}

export function normalizeReturnDoc(doc: any, fallbackId = ''): ReturnRecord {
  const externalId = toStringValue(doc.externalId);
  return {
    id: toStringValue(doc.returnId, fallbackId),
    externalId: externalId || undefined,
    orderId: toStringValue(doc.orderId),
    status: toStringValue(doc.statusId ?? doc.status),
    reason: toStringValue(doc.returnReasonId ?? doc.returnHeaderTypeId ?? doc.reason),
    requestedDate: toStringValue(doc.entryDate ?? doc.createdDate),
    receivedDate: toStringValue(doc.receivedDate) || undefined,
    returnDate: toStringValue(doc.returnDate) || undefined,
    returnHeaderTypeId: toStringValue(doc.returnHeaderTypeId),
    fromPartyId: toStringValue(doc.fromPartyId),
    toPartyId: toStringValue(doc.toPartyId),
    destinationFacilityId: toStringValue(doc.destinationFacilityId),
    destinationFacilityName: toStringValue(doc.destinationFacilityName),
    entryDate: toStringValue(doc.entryDate),
    currencyUomId: toStringValue(doc.currencyUomId),
    createdBy: toStringValue(doc.createdBy),
    itemIds: toStringList(doc.returnItemSeqId ?? doc.orderItemSeqId),
    refundTotal: toNumberValue(doc.returnTotal ?? doc.grandTotal)
  };
}

export function normalizeCustomerDoc(doc: any, fallbackId = ''): Customer {
  const personalTitle = toStringValue(doc.personalTitle);
  const firstName = toStringValue(doc.firstName);
  const middleName = toStringValue(doc.middleName);
  const lastName = toStringValue(doc.lastName);
  const displayName = toStringValue(doc.groupName ?? doc.partyName);

  return {
    id: toStringValue(doc.partyId, fallbackId),
    name: displayName || [firstName, middleName, lastName].filter(Boolean).join(' '),
    personalTitle,
    partyTypeId: toStringValue(doc.partyTypeId),
    statusId: toStringValue(doc.statusId),
    externalId: toStringValue(doc.externalId),
    createdStamp: toStringValue(doc.createdStamp),
    lastUpdatedStamp: toStringValue(doc.lastUpdatedStamp),
    email: toStringValue(doc.emailAddress ?? doc.infoString),
    phone: toStringValue(doc.contactNumber ?? doc.phoneNumber),
    loyaltyTier: toStringValue(doc.loyaltyTier, 'Unassigned'),
    lifetimeOrders: toNumberValue(doc.lifetimeOrders),
    lifetimeValue: toNumberValue(doc.lifetimeValue),
    addresses: []
  };
}

export function firstDoc(data: any) {
  return allDocs(data)[0];
}

export function allDocs(data: any) {
  const docs = data?.entityValueList ?? data?.rows ?? data?.docs ?? data?.response?.docs ?? data ?? [];
  return Array.isArray(docs) ? docs : [];
}

export function toStringValue(value: any, fallback = '') {
  const candidate = firstValue(value);
  return candidate === undefined || candidate === null ? fallback : String(candidate);
}

export function toNumberValue(value: any, fallback = 0) {
  const parsed = Number(firstValue(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toStringList(value: any) {
  if (value === undefined || value === null || value === '') return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean).map(String);
}

export function selectCustomerIdFromRoles(roleDocs: any[]) {
  const customerRole = customerRolePriority
    .map((roleTypeId) => roleDocs.find((doc) => toStringValue(doc.roleTypeId) === roleTypeId))
    .find(Boolean);

  return toStringValue(customerRole?.partyId);
}

export function isCustomerOrderRole(doc: any) {
  return customerRolePriority.includes(toStringValue(doc.roleTypeId));
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function firstValue(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function isInternalOrderId(value: string) {
  return /^[A-Z]{2,}[-_]?\d+$/i.test(value) || /^\d{5,}$/.test(value);
}

const customerRolePriority = [
  'PLACING_CUSTOMER',
  'BILL_TO_CUSTOMER',
  'SHIP_TO_CUSTOMER',
  'END_USER_CUSTOMER',
  'CUSTOMER'
];
