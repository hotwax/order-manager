export type WorkflowBucket = 'unfillable' | 'fraud' | 'open' | 'inflight' | 'packed';

export interface WorkflowOrder {
  orderId: string;
  orderName: string;
  externalId: string;
  statusId: string;
  orderDate: string;
  productStoreId: string;
  productStoreName: string;
  salesChannelEnumId: string;
  customerName: string;
  customerPartyId: string;
  grandTotal: number;
  currencyUomId: string;
  itemCount: number;
  shipGroupSeqId: string;
  shippingMethodTypeId: string;
  shipmentMethodDesc: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  facilityId: string | null;
  facilityName: string | null;
  brokeringDate: string | null;
  picklistBinId: string | null;
  pickedDate: string | null;
  receivedAtFacility: boolean;
  shipBeforeDate: string | null;
  bucket: WorkflowBucket;
}

export interface WorkflowFilters {
  query: string;
  productStoreId: string;
  salesChannelEnumId: string;
  facilityId: string;
  priority: string;
  dateFrom: string;
  dateThru: string;
}

export interface BulkActionDefinition {
  id: string;
  label: string;
  confirmText?: string;
}
