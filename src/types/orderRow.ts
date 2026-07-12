export type AllocationSummaryMode = 'physical-first' | 'queue-first';

export interface AllocationItemDocument {
  orderId: string;
  orderItemSeqId?: string;
  facilityId?: string;
  facilityName?: string;
  facilityTypeId?: string;
  facilityParentTypeId?: string;
}

export interface AllocationSummaryOptions {
  mode: AllocationSummaryMode;
  queueFacilityIds?: readonly string[];
}

export interface OrderAllocationSummaryModel {
  facilityId: string;
  facilityName: string;
  additionalFacilityCount: number;
  brokeredItemCount: number;
  totalItemCount: number;
}

export interface OrderRowEnrichment {
  orderId: string;
  orderName?: string;
  externalOrderId?: string;
  customerPartyName?: string;
  customerEmailId?: string;
  contactPhoneNumbers?: string[];
  carrierPartyId?: string;
  salesChannelDesc?: string;
  shipmentMethodTypeId?: string;
  estimatedDeliveryDate?: string;
  promisedDatetime?: string;
  shipBeforeDate?: string;
  shipByDate?: string;
  itemDocuments: AllocationItemDocument[];
}

export interface OrderRowViewModel {
  orderId: string;
  orderReference: string;
  customerName: string;
  status?: string;
  allocationSummary?: OrderAllocationSummaryModel;
  fulfillmentContext: string;
  channelName: string;
  orderedDateTime: string;
  orderedRelativeAge: string;
  estimatedDeliveryDateTime?: string;
  estimatedDeliveryRelativeLabel?: string;
}
