export type OrderStatus = string;

export interface Address {
  label: string;
  lines: string[];
  contactMechId?: string;
  contactMechTypeId?: string;
  contactMechPurposeTypeId?: string;
}

export interface PostalAddress {
  address1: string;
  address2: string;
  city: string;
  stateProvinceGeoId: string;
  postalCode: string;
  countryGeoId: string;
}

export interface ContactMech {
  contactMechId: string;
  contactMechTypeId: string;
  contactMechPurposeTypeId: string;
  infoString: string;
  postalAddress?: PostalAddress;
  expireDate: string;
}

export interface PaymentPreference {
  id: string;
  method: string;
  status: string;
  amount: number;
  gatewayResponse: string;
  capturedAt?: string;
  orderItemSeqId?: string;
  shipGroupSeqId?: string;
  paymentMethodId?: string;
  paymentMethodTypeId?: string;
  paymentMethodTypeDesc?: string;
  statusDesc?: string;
  presentmentAmount?: number;
  presentmentCurrencyUom?: string;
  manualAuthCode?: string;
  manualRefNum?: string;
  parentRefNum?: string;
  billingPostalCode?: string;
  createdDate?: string;
  createdByUserLogin?: string;
  lastModifiedDate?: string;
  lastModifiedByUserLogin?: string;
  requestId?: string;
  paymentMode?: string;
  processAttempt?: number;
}

export interface OrderTerm {
  id: string;
  type: string;
  value: string;
  description: string;
}

export interface OrderRole {
  partyId: string;
  roleTypeId: string;
  name: string;
  fromDate?: string;
  thruDate?: string;
}

export interface OrderAttribute {
  name: string;
  value: string;
  description?: string;
}

export interface CommunicationEvent {
  id: string;
  subject: string;
  entryDate: string;
  statusId: string;
  typeId: string;
  origCommEventId?: string;
  parentCommEventId?: string;
  contactMechTypeId?: string;
  contactMechIdFrom?: string;
  contactMechIdTo?: string;
  roleTypeIdFrom?: string;
  roleTypeIdTo?: string;
  partyIdFrom?: string;
  partyIdTo?: string;
  datetimeStarted?: string;
  datetimeEnded?: string;
  contentMimeTypeId?: string;
  content?: string;
  note?: string;
  reasonEnumId?: string;
  contactListId?: string;
  headerString?: string;
  fromString?: string;
  toString?: string;
  ccString?: string;
  bccString?: string;
  messageId?: string;
  externalId?: string;
  type?: string;
  status?: string;
  orderId?: string;
}

export interface OrderStatusChange {
  id: string;
  at: string;
  label: string;
  detail: string;
  itemSeqId?: string;
  paymentPreferenceId?: string;
  changeReason?: string;
  changeReasonEnumId?: string;
}

export interface OrderNote {
  id: string;
  author: string;
  createdAt: string;
  title?: string;
  body: string;
  internal: boolean;
}

export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  itemQuantity?: number;
  shippedQuantity?: number;
  cancelledQuantity?: number;
  returnedQuantity?: number;
  status: string;
  facility: string;
  facilityId?: string;
  facilityName?: string;
  facilityExternalId?: string;
  externalId?: string;
  productTypeId?: string;
  orderItemTypeId?: string;
  unitPrice: number;
  unitListPrice?: number;
  unitAverageCost?: number;
  unitRecurringPrice?: number;
  adjustments?: number;
  shipGroupSeqId?: string;
  orderItemGroupSeqId?: string;
  isItemGroupPrimary?: boolean;
  isPromo?: boolean;
  isDigital?: boolean;
  isPhysical?: boolean;
  maySplit?: string;
  slaShipmentMethodTypeId?: string;
  statusDatetime?: string;
  estimatedShipDate?: string;
  estimatedDeliveryDate?: string;
  requestedDeliveryDate?: string;
  requestedDeliveryTime?: string;
  shipAfterDate?: string;
  shipBeforeDate?: string;
  productStoreId?: string;
  comments?: string;
  imageUrl?: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  shipmentTypeId?: string;
  status: string;
  carrier: string;
  trackingCode: string;
  origin: string;
  destination: string;
  originFacilityId?: string;
  originFacilityName?: string;
  destinationFacilityId?: string;
  destinationFacilityName?: string;
  shipDate: string;
  estimatedShipDate?: string;
  estimatedArrivalDate?: string;
  latestCancelDate?: string;
  createdDate?: string;
  itemIds: string[];
  items?: ShipmentItem[];
  packages: ShipmentPackage[];
}

export interface ShipmentItem {
  id: string;
  orderId: string;
  orderItemSeqId: string;
  productId: string;
  description: string;
  quantity: number;
  dimensions?: string;
}

export interface ShipmentPackageContent {
  shipmentItemSeqId: string;
  quantity: number;
  productId: string;
}

export interface ShipmentPackage {
  id: string;
  shipmentId: string;
  packageName: string;
  boxTypeId: string;
  dimensions: string;
  weight: number;
  weightUomId: string;
  trackingCode: string;
  carrier: string;
  routeSegmentId: string;
  contents: ShipmentPackageContent[];
}

export interface ShipmentRouteSegment {
  id: string;
  shipmentId: string;
  carrier: string;
  method: string;
  trackingCode: string;
  status: string;
  actualCarrierCode: string;
  estimatedShipDate: string;
  estimatedArrivalDate: string;
  statusDate: string;
}

export interface ShipmentStatusChange {
  id: string;
  shipmentId: string;
  statusId: string;
  statusDate: string;
  changedBy: string;
}

export interface ReturnRecord {
  id: string;
  externalId?: string;
  orderId: string;
  status: string;
  reason: string;
  requestedDate: string;
  receivedDate?: string;
  returnDate?: string;
  returnHeaderTypeId?: string;
  fromPartyId?: string;
  toPartyId?: string;
  destinationFacilityId?: string;
  destinationFacilityName?: string;
  entryDate?: string;
  currencyUomId?: string;
  createdBy?: string;
  itemIds: string[];
  refundTotal: number;
}

export interface ReturnItem {
  returnId: string;
  returnItemSeqId: string;
  returnReasonId: string;
  returnTypeId: string;
  returnItemTypeId: string;
  productId: string;
  description: string;
  orderId: string;
  orderItemSeqId: string;
  statusId: string;
  returnQuantity: number;
  receivedQuantity: number;
  returnPrice: number;
  returnItemResponseId: string;
}

export interface ReturnStatusChange {
  id: string;
  returnId: string;
  statusId: string;
  statusDate: string;
  changedBy: string;
}

export interface Customer {
  id: string;
  partyId?: string;
  name: string;
  personalTitle?: string;
  partyTypeId?: string;
  statusId?: string;
  externalId?: string;
  createdStamp?: string;
  lastUpdatedStamp?: string;
  email: string;
  phone: string;
  loyaltyTier: string;
  lifetimeOrders: number;
  lifetimeValue: number;
  addresses: Address[];
  contactMechs?: ContactMech[];
  emails?: ContactMech[];
  phones?: ContactMech[];
  postalAddresses?: ContactMech[];
}

export interface OrderIdentification {
  orderIdentificationTypeId: string;
  idValue: string;
  fromDate?: string;
  thruDate?: string;
  createdStamp?: string;
  lastUpdatedStamp?: string;
}

export interface Order {
  id: string;
  externalId: string;
  orderName?: string;
  shopifyOrderId?: string;
  identifications?: OrderIdentification[];
  orderDate: string;
  status: OrderStatus;
  customerId: string;
  customerName?: string;
  channel: string;
  total: number;
  currency: string;
  productStoreId?: string;
  entryDate?: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  deliveryMethod: string;
  priority: string;
  items: OrderItem[];
  shipmentIds: string[];
  returnIds: string[];
  notes: OrderNote[];
  history: OrderStatusChange[];
  payments?: PaymentPreference[];
  terms?: OrderTerm[];
  roles?: OrderRole[];
  attributes?: OrderAttribute[];
  communicationEvents?: CommunicationEvent[];
  shipGroups?: Array<{
    id: string;
    shipmentId: string;
    shipmentMethodTypeId?: string;
    method: string;
    status: string;
    trackingCode: string;
    trackingNumber?: string;
    carrier: string;
    carrierRoleTypeId?: string;
    carrierService?: string;
    carrierAccountNumber?: string;
    facilityId: string;
    facilityName: string;
    facilityTypeId?: string;
    facilityTypeDescription?: string;
    parentFacilityTypeId?: string;
    picklistId?: string;
    picklistDate?: string;
    pickerId?: string;
    pickerName?: string;
    pickerFirstName?: string;
    pickerLastName?: string;
    pickerGroupName?: string;
    orderFacilityId?: string;
    supplierPartyId?: string;
    vendorPartyId?: string;
    shippingInstructions?: string;
    giftMessage?: string;
    maySplit?: string;
    isGift?: string;
    shipAfterDate?: string;
    shipByDate?: string;
    estimatedShipDate?: string;
    estimatedDeliveryDate?: string;
    contactMechId?: string;
    telecomContactMechId?: string;
  }>;
  contactInfo?: Address[];
}
