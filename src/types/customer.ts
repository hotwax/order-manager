// Customer 360 detail types. Kept separate from the shared `Order` types in
// `types/order.ts` so that file does not accumulate customer-only detail objects.
// These mirror the `/oms/customers/{partyId}` (Party customerDetail master) payload
// plus the focused related-list APIs (orders, tasks, returns, communications).

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface SourceEntry<T> {
  payload: T;
  status: LoadStatus;
  loadedAt: string;
  error: string;
  pageIndex?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

export interface CustomerContactMech {
  partyId: string;
  contactMechId: string;
  contactMechTypeId: 'EMAIL_ADDRESS' | 'TELECOM_NUMBER' | 'POSTAL_ADDRESS' | string;
  contactMechPurposeTypeId: string;
  purposeTypeIds: string[];
  infoString: string;
  fromDate?: string;
  thruDate?: string;
  postalAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    stateProvinceGeoId?: string;
    postalCode?: string;
    countryGeoId?: string;
  };
  telecomNumber?: {
    countryCode?: string;
    areaCode?: string;
    contactNumber?: string;
  };
}

export interface CustomerRelationship {
  partyIdFrom: string;
  partyIdTo: string;
  roleTypeIdFrom: string;
  roleTypeIdTo: string;
  fromDate: string;
  thruDate?: string;
  partyRelationshipTypeId: string;
  relationshipName: string;
  fromPartyName: string;
  toPartyName: string;
  comments?: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  partyTypeId: string;
  statusId: string;
  externalId?: string;
  createdStamp: string;
  lastUpdatedStamp: string;
  lifetimeOrders: number;
  lifetimeValue: number;
  roles: Array<{ roleTypeId: string; fromDate?: string; thruDate?: string }>;
  identifications: Array<{ partyIdentificationTypeId: string; idValue: string }>;
  contactMechs: CustomerContactMech[];
  relationshipsFrom: CustomerRelationship[];
  relationshipsTo: CustomerRelationship[];
  createdByUserLogin: string;
}

export interface CustomerOrderSummary {
  orderId: string;
  orderName: string;
  orderDate: string;
  statusId: string;
  statusDesc: string;
  grandTotal: number;
  currencyUom: string;
  itemCount: number;
  unitCount: number;
  progressLabel: string;
  progressValue: number;
  progressColor?: string;
  isUnfillable: boolean;
  items: Array<{
    orderItemSeqId: string;
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    imageUrl?: string;
  }>;
}

export interface CustomerTaskSummary {
  workEffortId: string;
  workEffortName: string;
  workEffortTypeId: string;
  workEffortPurposeTypeId?: string;
  taskStatusId: string;
  orderStatusId?: string;
  orderId?: string;
  orderName?: string;
  orderDate?: string;
  grandTotal?: number;
  customerPartyId?: string;
  assigneePartyId?: string;
  assigneeName?: string;
  assigneeSince?: string;
  reporterPartyId?: string;
  reporterName?: string;
  reporterSince?: string;
  notes?: string;
  resolution?: string;
  dueDate?: string;
}

export interface CustomerReturnSummary {
  returnId: string;
  externalId?: string;
  statusId: string;
  entryDate: string;
  returnTotal: number;
  currencyUomId: string;
  destinationFacilityId?: string;
  returnChannelEnumId?: string;
  itemCount: number;
  items: Array<{
    returnItemSeqId: string;
    productId?: string;
    orderId?: string;
    orderItemSeqId?: string;
    statusId: string;
    returnReasonId?: string;
    returnTypeId?: string;
    returnQuantity: number;
    receivedQuantity?: number;
    returnPrice: number;
    description?: string;
  }>;
}

export interface CustomerCommunicationSummary {
  communicationEventId: string;
  communicationEventTypeId: string;
  statusId: string;
  subject?: string;
  entryDate?: string;
  datetimeStarted?: string;
  datetimeEnded?: string;
  partyIdFrom?: string;
  partyIdTo?: string;
  roleTypeIdFrom?: string;
  roleTypeIdTo?: string;
  contactMechTypeId?: string;
  content?: string;
  note?: string;
}

export interface CustomerTimelineEvent {
  id: string;
  type: string;
  label: string;
  at: string;
  sourceId?: string;
}

// View-model shape the Contact card binds to: one section per contact-mech type.
export interface ContactSectionValue {
  display: string;
  contactMechId: string;
  contactMechTypeId: string;
  contactMechPurposeTypeId: string;
  active: boolean;
}

export interface ContactSection {
  key: string;
  label: string;
  contactMechTypeId: string;
  values: ContactSectionValue[];
}
