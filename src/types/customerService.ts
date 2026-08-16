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
  shipmentId?: string;
  shipmentStatusId?: string;
  shippingMethodTypeId: string;
  shipmentMethodDesc: string;
  carrierPartyId?: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  facilityId: string | null;
  facilityName: string | null;
  brokeringDate: string | null;
  picklistBinId: string | null;
  pickedDate: string | null;
  receivedAtFacility: boolean;
  shipBeforeDate: string | null;
  estimatedDeliveryDate?: string | null;
  shippingAddress1?: string;
  shippingCity?: string;
  shippingStateProvinceGeoId?: string;
  shippingPostalCode?: string;
  shippingCountryGeoId?: string;
  bucket: WorkflowBucket;
}

export type WorkflowOrderSort = 'newestOrder' | 'oldestOrder' | 'highestTotal' | 'lowestTotal';

export interface WorkflowOrderSortOption {
  label: string;
  value: WorkflowOrderSort;
}

export const WORKFLOW_ORDER_SORT_OPTIONS: WorkflowOrderSortOption[] = [
  { label: 'Newest order first', value: 'newestOrder' },
  { label: 'Oldest order first', value: 'oldestOrder' },
  { label: 'Highest order total', value: 'highestTotal' },
  { label: 'Lowest order total', value: 'lowestTotal' },
];

// Moqui `orderByField` values for get#Open/Inflight/PackedSalesOrders, which pass the
// parameter straight through `<search-form-inputs/>`. Only fields aliased on the
// Open/Inflight/PackedSalesOrder view entities are sortable; orderId is appended as a
// tie-breaker so paging an infinite-scroll queue cannot repeat or skip a row.
export const WORKFLOW_ORDER_SORT_ORDER_BY: Record<WorkflowOrderSort, string> = {
  newestOrder: '-orderDate,-orderId',
  oldestOrder: 'orderDate,orderId',
  highestTotal: '-grandTotal,-orderId',
  lowestTotal: 'grandTotal,orderId',
};

export const DEFAULT_WORKFLOW_ORDER_SORT: WorkflowOrderSort = 'newestOrder';

export interface WorkflowFilters {
  query: string;
  customerName: string;
  productStoreId: string;
  salesChannelEnumId: string;
  facilityId: string;
  shipmentMethodTypeId: string;
  priority: 'HIGH' | 'NORMAL' | 'LOW' | null;
  dateFrom: string;
  dateThru: string;
  sort: WorkflowOrderSort;
}

export interface BulkActionDefinition {
  id: string;
  label: string;
  confirmText?: string;
}

export interface VirtualLocationWorkCount {
  id: string;
  label: string;
  facilityIds: string[];
  count: number;
}

export interface HoldTaskCount {
  workEffortPurposeTypeId: string;
  description: string;
  sequenceNum: number | null;
  taskCount: number;
}

export interface HoldTaskCounts {
  holdTasksTotalCount: number;
  holdTaskCounts: HoldTaskCount[];
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
