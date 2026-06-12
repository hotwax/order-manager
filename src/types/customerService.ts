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
  customerName: string;
  productStoreId: string;
  salesChannelEnumId: string;
  facilityId: string;
  shipmentMethodTypeId: string;
  priority: boolean | null;
  dateFrom: string;
  dateThru: string;
}

export interface BulkActionDefinition {
  id: string;
  label: string;
  confirmText?: string;
}

export interface ProductStore {
  productStoreId: string;
  storeName: string;
}

export interface FacilityFulfillmentProgress {
  ordersAllocated: number;
  ordersPacked: number;
  ordersRejected: number;
  capacityLimit: number | null;
  fillRate: number;
  openCount: number;
  inProgressCount: number;
  totalPending: number;
  oldestAssignedTime: number | null;
  assignedBeforeTodayCount: number;
  openTime: string | null;
  closeTime: string | null;
  facilityTimeZone: string | null;
  carrierPickupTime: string | null;
}

export interface FulfillmentProgress {
  totalOrdersCount: number;
  totalShipGroupsCount: number;
  brokeredShipGroupsCount: number;
  pickedShipGroupsCount: number;
  packedShipGroupsCount: number;
  shippedShipGroupsCount: number;
}
