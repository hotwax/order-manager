export type ReturnSearchField = "RETURN_ID" | "ORDER_ID" | "CUSTOMER_ID";

export type ReturnSyncState = "not_synced" | "pending" | "synced" | "failed";

export interface ReturnListQuery {
  pageIndex?: number;
  pageSize?: number;
  orderId?: string;
  statusId?: string;
  returnHeaderTypeId?: string;
  fromPartyId?: string;
  returnChannelEnumId?: string;
}

export interface ReturnSummary {
  returnId: string;
  orderId?: string;
  orderName?: string;
  orderExternalId?: string;
  orderDate?: string;
  returnHeaderTypeId?: string;
  statusId: string;
  entryDate?: string;
  returnDate?: string;
  fromPartyId?: string;
  customerName?: string;
  toPartyId?: string;
  currencyUomId?: string;
  returnChannelEnumId?: string;
  destinationFacilityId?: string;
  isExchange?: boolean;
}

export interface ReturnListResult {
  items: ReturnSummary[];
  total: number;
}

export interface ReturnIdentification {
  returnIdentificationTypeId: string;
  idValue: string;
}

export interface ShopifyReturnSync {
  synced?: boolean | null;
  shopifyReturnId?: string | null;
  shopifyRefundId?: string | null;
  returnStatusId?: string | null;
  lastSyncedDate?: string | null;
  lastAttemptDate?: string | null;
  pushStatusId?: string | null;
  pushErrorMessage?: string | null;
  closePushStatusId?: string | null;
  closePushErrorMessage?: string | null;
  exchangePushStatusId?: string | null;
  exchangePushErrorMessage?: string | null;
  exchangeProcessStatusId?: string | null;
  exchangeProcessErrorMessage?: string | null;
  isExchange?: boolean | null;
  replacementOrderId?: string | null;
}

export interface ReturnItemDetail {
  returnItemSeqId: string;
  orderId?: string;
  orderName?: string;
  orderItemSeqId?: string;
  productId?: string;
  productName?: string;
  sku?: string;
  description?: string;
  statusId?: string;
  returnReasonId?: string;
  returnReasonDescription?: string;
  returnTypeId?: string;
  returnItemTypeId?: string;
  expectedItemStatus?: string;
  returnQuantity: number;
  receivedQuantity?: number;
  unitPrice?: number;
  returnPrice?: number;
}

export interface ReturnStatusHistory {
  statusId: string;
  statusDate: string;
  returnItemSeqId?: string;
}

export interface ReturnDetail extends ReturnSummary {
  itemCount: number;
  returnTotal?: number;
  totalSource?: "header" | "items";
  items: ReturnItemDetail[];
  statuses: ReturnStatusHistory[];
  identifications: ReturnIdentification[];
  shopifySync?: ShopifyReturnSync | null;
  syncState: ReturnSyncState;
  origin: "shopify" | "oms";
  replacementOrderId?: string;
}

export interface ReturnsQueryState {
  searchField: ReturnSearchField;
  searchTerm: string;
  statusId: string;
  returnHeaderTypeId: string;
  returnChannelEnumId: string;
}
