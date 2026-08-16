import { api } from "@common";
import type {
  ReturnDetail,
  ReturnIdentification,
  ReturnItemDetail,
  ReturnListQuery,
  ReturnListResult,
  ReturnSummary,
  ReturnSyncState,
  ShopifyReturnSync
} from "@/types/returns";

const asString = (value: unknown): string => value == null ? "" : String(value);

function optionalString(value: unknown): string | undefined {
  const stringValue = asString(value).trim();

  return stringValue || undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if(value == null || value === "") {return undefined;}
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function assertSuccessfulPayload(data: any): void {
  const messages = data?._ERROR_MESSAGE_LIST_ || data?.errorMessages;
  const message = data?._ERROR_MESSAGE_ || data?.errorMessage || (Array.isArray(messages) ? messages.join("; ") : "");
  if(message) {throw new Error(message);}
}

export function mapReturnSummary(raw: any): ReturnSummary {
  return {
    returnId: asString(raw?.returnId),
    orderId: optionalString(raw?.orderId),
    orderName: optionalString(raw?.orderName ?? raw?.externalOrderId),
    orderExternalId: optionalString(raw?.orderExternalId),
    orderDate: optionalString(raw?.orderDate),
    returnHeaderTypeId: optionalString(raw?.returnHeaderTypeId),
    statusId: asString(raw?.statusId),
    entryDate: optionalString(raw?.entryDate),
    returnDate: optionalString(raw?.returnDate),
    fromPartyId: optionalString(raw?.fromPartyId),
    customerName: optionalString(raw?.customerName ?? raw?.fromPartyName),
    toPartyId: optionalString(raw?.toPartyId),
    currencyUomId: optionalString(raw?.currencyUomId),
    returnChannelEnumId: optionalString(raw?.returnChannelEnumId),
    destinationFacilityId: optionalString(raw?.destinationFacilityId),
    isExchange: raw?.isExchange === true || undefined
  };
}

function resolveSyncState(shopifySync: ShopifyReturnSync | null | undefined, isExchange: boolean): ReturnSyncState {
  if(!shopifySync) {return "not_synced";}
  if(isExchange) {
    if(shopifySync.exchangeProcessStatusId === "PROC_OK") {return "synced";}
    if(shopifySync.exchangeProcessStatusId === "PROC_FAILED" || shopifySync.exchangePushStatusId === "PUSH_FAILED") {return "failed";}
    if(["PROC_PENDING"].includes(shopifySync.exchangeProcessStatusId || "") || ["PUSH_OK", "PUSH_PENDING"].includes(shopifySync.exchangePushStatusId || "")) {return "pending";}

    return "not_synced";
  }
  if(shopifySync.synced === true || shopifySync.pushStatusId === "PUSH_OK" || shopifySync.shopifyReturnId || shopifySync.shopifyRefundId) {return "synced";}
  if(shopifySync.pushStatusId === "PUSH_PENDING") {return "pending";}
  if(shopifySync.pushStatusId === "PUSH_FAILED") {return "failed";}

  return "not_synced";
}

function mapReturnItem(raw: any): ReturnItemDetail {
  return {
    returnItemSeqId: asString(raw?.returnItemSeqId ?? raw?.orderItemSeqId),
    orderId: optionalString(raw?.orderId),
    orderName: optionalString(raw?.orderName ?? raw?.externalOrderId),
    orderItemSeqId: optionalString(raw?.orderItemSeqId),
    productId: optionalString(raw?.productId),
    productName: optionalString(raw?.productName ?? raw?.itemDescription),
    sku: optionalString(raw?.sku),
    description: optionalString(raw?.description ?? raw?.itemDescription),
    statusId: optionalString(raw?.statusId),
    returnReasonId: optionalString(raw?.returnReasonId),
    returnReasonDescription: optionalString(raw?.reasonDescription),
    returnTypeId: optionalString(raw?.returnTypeId),
    returnItemTypeId: optionalString(raw?.returnItemTypeId),
    expectedItemStatus: optionalString(raw?.expectedItemStatus),
    returnQuantity: optionalNumber(raw?.returnQuantity) ?? 0,
    receivedQuantity: optionalNumber(raw?.receivedQuantity),
    unitPrice: optionalNumber(raw?.unitPrice),
    returnPrice: optionalNumber(raw?.returnPrice)
  };
}

export function mapReturnDetail(raw: any): ReturnDetail {
  const header = raw?.returnDetail ?? raw?.returnHeader ?? raw ?? {};
  const items = (raw?.items ?? raw?.returnItems ?? header?.items ?? []).map(mapReturnItem);
  const identifications: ReturnIdentification[] = (raw?.identifications ?? header?.identifications ?? [])
    .map((identification: any) => ({
      returnIdentificationTypeId: asString(identification?.returnIdentificationTypeId),
      idValue: asString(identification?.idValue)
    }))
    .filter((identification: ReturnIdentification) => identification.returnIdentificationTypeId && identification.idValue);
  const shopifySync: ShopifyReturnSync | null | undefined = raw?.shopifySync ?? header?.shopifySync;
  const isExchange = raw?.isExchange === true || header?.isExchange === true || shopifySync?.isExchange === true;
  const summary = mapReturnSummary({
    ...header,
    orderId: header?.orderId ?? items.find((item: ReturnItemDetail) => item.orderId)?.orderId,
    isExchange
  });
  const headerTotal = optionalNumber(header?.returnTotal ?? raw?.returnTotal);
  const hasCompleteItemPricing = items.length > 0 && items.every((item: ReturnItemDetail) => item.returnPrice != null);
  const isAmountOnlyAppeasement = summary.returnHeaderTypeId === "APPEASEMENT" &&
    items.length === 1 &&
    !items[0].productId;
  const itemTotal = hasCompleteItemPricing
    ? isAmountOnlyAppeasement
      ? Number(items[0].returnPrice)
      : items.reduce((total: number, item: ReturnItemDetail) => total + Number(item.returnPrice) * item.returnQuantity, 0)
    : undefined;
  const returnTotal = headerTotal ?? itemTotal;
  const shopifyReturnId = optionalString(shopifySync?.shopifyReturnId) ||
    identifications.find((identification) => identification.returnIdentificationTypeId === "SHOPIFY_RTN_ID")?.idValue;

  return {
    ...summary,
    itemCount: items.length,
    returnTotal,
    totalSource: headerTotal != null ? "header" : itemTotal != null ? "items" : undefined,
    items,
    statuses: (raw?.statusHistory ?? header?.statusHistory ?? []).map((status: any) => ({
      statusId: asString(status?.statusId),
      statusDate: asString(status?.statusDatetime ?? status?.statusDate),
      returnItemSeqId: optionalString(status?.returnItemSeqId)
    })).filter((status: any) => status.statusId),
    identifications,
    shopifySync: shopifySync ?? null,
    syncState: resolveSyncState(shopifySync, isExchange),
    origin: shopifyReturnId ? "shopify" : "oms",
    replacementOrderId: optionalString(raw?.exchange?.replacementOrderId ?? shopifySync?.replacementOrderId)
  };
}

export function toReturnSummary(detail: ReturnDetail): ReturnSummary {
  return mapReturnSummary(detail);
}

export async function listReturns(query: ReturnListQuery = {}): Promise<ReturnListResult> {
  const params = Object.fromEntries(Object.entries({
    pageIndex: query.pageIndex ?? 0,
    pageSize: query.pageSize ?? 25,
    orderId: query.orderId,
    statusId: query.statusId,
    returnHeaderTypeId: query.returnHeaderTypeId,
    fromPartyId: query.fromPartyId,
    returnChannelEnumId: query.returnChannelEnumId
  }).filter(([, value]) => value !== undefined && value !== ""));
  const response = await api({ url: "oms/returns", method: "get", params });
  assertSuccessfulPayload(response.data);
  const rows = Array.isArray(response.data)
    ? response.data
    : response.data?.returns ?? response.data?.returnList ?? response.data?.docs ?? [];
  const items = rows.map(mapReturnSummary).filter((item: ReturnSummary) => item.returnId);
  const total = Number(response.data?.returnsCount ?? response.data?.totalCount ?? items.length);

  return { items, total: Number.isFinite(total) ? total : items.length };
}

export async function getReturn(returnId: string): Promise<ReturnDetail> {
  const normalizedReturnId = returnId.trim();
  if(!normalizedReturnId) {throw new Error("Return ID is required");}
  const response = await api({ url: `oms/returns/${encodeURIComponent(normalizedReturnId)}`, method: "get" });
  assertSuccessfulPayload(response.data);
  const detail = mapReturnDetail(response.data);
  if(!detail.returnId) {throw new Error(`Return ${normalizedReturnId} was not found`);}

  return detail;
}
