import { api, commonUtil, useSolrSearch } from "@common";
import type {
  AppeasementInput, AppeasementItemInput,
  CreateExchangeInput, ExchangeDetail, ExchangeItemInput, FulfillmentType,
  CreateReturnInput, OrderForReturn, PostalAddress, PushOutcome, ReplacementOrderDetail, ReturnableLine, ReturnDetail,
  ReturnReason, ReturnSummary, ReturnType, SyncState, SyncTarget,
} from "@/types/returns";
import {
  resolveOrigin, resolveExchangeSyncState, resolveShopifySyncState, type Identification, type ShopifySync,
} from "@/utils/returnSyncState";

// The return-type id that marks a return as an appeasement is the header-level returnHeaderTypeId ===
// "APPEASEMENT". Centralised here so a future change is still a one-line edit.
export const APPEASEMENT_RETURN_TYPE_ID = "APPEASEMENT";

/** Map a raw returnHeaderTypeId to the UI return-type discriminator. */
export function mapReturnType(returnHeaderTypeId?: string | null): ReturnType {
  return returnHeaderTypeId === APPEASEMENT_RETURN_TYPE_ID ? "appeasement" : "standard";
}

// ---- Pure mappers (unit-tested) ----

interface RawReturnDetail {
  returnDetail: {
    returnId: string; statusId: string; entryDate: string | number; returnDate?: string | number;
    // Order reference now lives on returnDetail. orderName/externalOrderId are the customer-facing name
    // (OrderHeader.orderName, equal values); orderExternalId is the Shopify GID and is NEVER displayed.
    orderId?: string; orderName?: string; externalOrderId?: string; orderExternalId?: string; orderDate?: string | number;
    // Appeasement (confirmed contract): header carries the type + currency; the refund amount/reason/note
    // ride the single monetary item line and the linkage is a RELATED_RETURN_ID identification.
    returnHeaderTypeId?: string; currencyUomId?: string;
  };
  items?: Array<{ orderId?: string; externalOrderId?: string; orderItemSeqId: string; productId?: string; productName?: string; sku?: string; returnQuantity: number | string; returnReasonId: string; itemDescription?: string; returnPrice?: number | string; reasonDescription?: string; description?: string }>;
  statusHistory?: Array<{ statusId: string; statusDatetime: string | number }>;
  identifications?: Identification[];
  shopifySync?: ShopifySync | null;
  isExchange?: boolean;
  exchange?: {
    replacementOrderId: string; orderName?: string; fulfillmentType: FulfillmentType; orderStatusId: string;
    items?: Array<{ productId: string; quantity: number | string; unitPrice?: number | string; itemDescription?: string }>;
    exchangeCreditAmount?: number | string;
  };
}

/** Map the `GET /oms/returns/{id}` payload into a ReturnDetail. */
export function mapReturnDetail(raw: RawReturnDetail): ReturnDetail {
  const idents = raw.identifications ?? [];
  const items = raw.items ?? [];
  const origin = resolveOrigin(idents);
  // The backend marks an exchange on `shopifySync` (shopifySync.isExchange + replacementOrderId). Older/stub
  // payloads use a top-level isExchange + exchange block, so accept both.
  const isExchange = raw.isExchange === true || raw.shopifySync?.isExchange === true;
  const replacementOrderId = raw.exchange?.replacementOrderId ?? raw.shopifySync?.replacementOrderId ?? undefined;
  const shopify: SyncState = isExchange
    ? resolveExchangeSyncState(raw.shopifySync)
    : resolveShopifySyncState(raw.shopifySync);
  // The detail only needs to carry the replacement order id; the exchange-detail screen fetches the rest
  // (status, fulfillment, lines, total) via getReplacementOrder. Use the richer raw.exchange block when present.
  const exchange: ExchangeDetail | undefined = isExchange && replacementOrderId
    ? {
        replacementOrderId,
        orderName: raw.exchange?.orderName,
        fulfillmentType: raw.exchange?.fulfillmentType,
        orderStatusId: raw.exchange?.orderStatusId,
        items: raw.exchange?.items
          ? raw.exchange.items.map((it) => ({
              productId: it.productId,
              quantity: Number(it.quantity),
              unitPrice: it.unitPrice != null ? Number(it.unitPrice) : undefined,
              itemDescription: it.itemDescription,
            }))
          : undefined,
        exchangeCreditAmount: raw.exchange?.exchangeCreditAmount != null ? Number(raw.exchange.exchangeCreditAmount) : undefined,
      }
    : undefined;
  const shopifyReturnId = raw.shopifySync?.shopifyReturnId
    ?? idents.find((i) => i.returnIdentificationTypeId === "SHOPIFY_RTN_ID")?.idValue
    ?? null;
  const rd = raw.returnDetail;
  const type = mapReturnType(rd.returnHeaderTypeId);
  // Appeasement detail: shape is detected by whether the lines carry a productId.
  // - amount-only / legacy: a single synthetic monetary line (no productId) — amount = its returnPrice.
  // - lost-in-shipment: real product line(s) — amount = Σ(returnPrice × returnQuantity).
  // The linked standard return is a RELATED_RETURN_ID identification.
  const appLines = type === "appeasement" ? items : [];
  const isItemAppeasement = appLines.length > 0 && !!appLines[0].productId;
  const appeasement = type === "appeasement"
    ? {
        amount: isItemAppeasement
          ? appLines.reduce((s, it) => s + Number(it.returnPrice ?? 0) * Number(it.returnQuantity), 0)
          : Number(appLines[0]?.returnPrice ?? 0),
        currencyUomId: rd.currencyUomId ?? "USD",
        reasonId: appLines[0]?.returnReasonId ?? "",
        reasonDesc: appLines[0]?.reasonDescription || undefined,
        note: isItemAppeasement ? undefined : appLines[0]?.description || undefined,
        relatedReturnId: idents.find((i) => i.returnIdentificationTypeId === "RELATED_RETURN_ID")?.idValue || undefined,
      }
    : undefined;
  // Display name: prefer orderName, then its alias externalOrderId. Never orderExternalId (the GID).
  const orderName = rd.orderName ?? rd.externalOrderId ?? items[0]?.externalOrderId ?? "";
  return {
    returnId: rd.returnId,
    type,
    appeasement,
    isExchange,
    exchange,
    // Order ref now lives on returnDetail; fall back to the first item only for older payloads.
    orderId: rd.orderId ?? items[0]?.orderId ?? "",
    orderName,
    orderDate: rd.orderDate != null ? String(rd.orderDate) : undefined,
    statusId: rd.statusId,
    entryDate: String(rd.entryDate),
    origin,
    sync: { shopify },
    // Carry the raw object so the view can surface pushErrorMessage + Shopify-side returnStatusId.
    shopifySync: raw.shopifySync ?? null,
    items: items.map((i) => ({
      orderItemSeqId: i.orderItemSeqId,
      productId: i.productId ?? "",
      // Prefer an explicit productName; fall back to the order item's itemDescription. "" -> view shows sku/productId.
      productName: i.productName ?? i.itemDescription ?? "",
      sku: i.sku ?? undefined,
      returnQuantity: Number(i.returnQuantity),
      returnReasonId: i.returnReasonId,
      // Backend getReturn does not join ReturnReason.description; view prettifies the reasonId instead.
    })),
    statuses: (raw.statusHistory ?? []).map((s) => ({ statusId: s.statusId, statusDate: String(s.statusDatetime) })),
    externalIds: { shopify: shopifyReturnId },
  };
}

interface RawOrderItem {
  orderItemSeqId: string;
  productId?: string;
  productName?: string;
  sku?: string;
  quantity: number | string;
  unitPrice: number | string;
  alreadyReturnedQuantity?: number | string;
  returnableQuantity?: number | string;
}
interface RawPostalAddress {
  toName?: string; attnName?: string; address1?: string; address2?: string; city?: string;
  stateProvinceGeoId?: string; postalCode?: string; countryGeoId?: string; phone?: string;
}

/** Map a raw ship-group postal address; returns undefined when there's no usable address (no address1). */
export function mapPostalAddress(raw?: RawPostalAddress | null): PostalAddress | undefined {
  if (!raw || !raw.address1) return undefined;
  return {
    ...(raw.toName ? { toName: raw.toName } : {}),
    ...(raw.attnName ? { attnName: raw.attnName } : {}),
    address1: raw.address1,
    ...(raw.address2 ? { address2: raw.address2 } : {}),
    city: raw.city ?? "",
    ...(raw.stateProvinceGeoId ? { stateProvinceGeoId: raw.stateProvinceGeoId } : {}),
    postalCode: raw.postalCode ?? "",
    countryGeoId: raw.countryGeoId ?? "",
    ...(raw.phone ? { phone: raw.phone } : {}),
  };
}

interface RawShipGroup {
  items?: RawOrderItem[];
  shipmentMethod?: string;
  trackingCode?: string;
  carrier?: string;
  shippingAddress?: RawPostalAddress;
}
interface RawOrder {
  // orderName/externalOrderId are the customer-facing name; orderExternalId is the GID (never displayed).
  orderDetail: {
    orderId: string;
    orderName?: string;
    externalOrderId?: string;
    orderExternalId?: string;
    billingEmail?: string;
    currencyUom?: string;
    currencyUomId?: string;
    shipGroups?: Array<RawShipGroup>;
  };
}
interface RawReplacementOrder {
  orderDetail: {
    orderId: string; orderName?: string; externalOrderId?: string; orderDate?: string | number;
    // The order's status is the EXISTING `orderStatusId` field (ORDER_APPROVED | ORDER_COMPLETED) —
    // not a new `statusId` alias. Mirrors the same field on the return detail's exchange block.
    orderStatusId?: string; currencyUomId?: string; grandTotal?: number | string;
    fulfillmentType?: FulfillmentType; shipGroups?: Array<RawShipGroup>;
  };
}

/** Map `GET /oms/orders/{id}` into an OrderForReturn, trusting the backend's returnableQuantity. */
export function mapOrderToReturnable(raw: RawOrder): OrderForReturn {
  const rawItems = (raw.orderDetail.shipGroups ?? []).flatMap((g) => g.items ?? []);
  const items: ReturnableLine[] = rawItems.map((it) => {
    const orderedQty = Number(it.quantity);
    const alreadyReturnedQty = Number(it.alreadyReturnedQuantity ?? 0);
    const returnableQty = it.returnableQuantity != null
      ? Number(it.returnableQuantity)
      : Math.max(0, orderedQty - alreadyReturnedQty);
    return {
      orderItemSeqId: it.orderItemSeqId,
      productId: it.productId ?? "",
      productName: it.productName ?? "",
      sku: it.sku ?? undefined,
      orderedQty,
      alreadyReturnedQty,
      returnableQty,
      unitPrice: Number(it.unitPrice),
    };
  });
  const shippingAddress = (raw.orderDetail.shipGroups ?? [])
    .map((g) => mapPostalAddress(g.shippingAddress))
    .find((a) => a != null);
  return {
    orderId: raw.orderDetail.orderId,
    // Prefer orderName, then its alias externalOrderId. Never orderExternalId (the GID).
    orderName: raw.orderDetail.orderName ?? raw.orderDetail.externalOrderId ?? "",
    currencyUomId: raw.orderDetail.currencyUomId ?? raw.orderDetail.currencyUom ?? "USD",
    billingEmail: raw.orderDetail.billingEmail,
    items,
    ...(shippingAddress ? { shippingAddress } : {}),
  };
}

/**
 * Map `GET /oms/orders/{id}` into a ReplacementOrderDetail for the exchange-detail replacement panel.
 * Order-level detail (date, status, total, fulfillment/tracking) plus the flattened ship-group lines.
 * Trusts the backend `grandTotal`; defaults currency to USD; falls back orderName to the order id.
 */
export function mapReplacementOrder(raw: RawReplacementOrder): ReplacementOrderDetail {
  const od = raw.orderDetail;
  const groups = od.shipGroups ?? [];
  const items = groups.flatMap((g) => g.items ?? []).map((it) => ({
    productId: it.productId ?? "",
    productName: it.productName ?? "",
    sku: it.sku ?? undefined,
    quantity: Number(it.quantity),
    unitPrice: Number(it.unitPrice),
  }));
  // Fulfillment/tracking ride the (typically single) ship group.
  const fulfillment = groups.find((g) => g.trackingCode || g.shipmentMethod || g.carrier);
  return {
    orderId: od.orderId,
    orderName: od.orderName ?? od.externalOrderId ?? od.orderId,
    orderDate: od.orderDate != null ? String(od.orderDate) : undefined,
    statusId: od.orderStatusId ?? "",
    currencyUomId: od.currencyUomId ?? "USD",
    grandTotal: od.grandTotal != null ? Number(od.grandTotal) : undefined,
    fulfillmentType: od.fulfillmentType,
    shipmentMethod: fulfillment?.shipmentMethod,
    trackingCode: fulfillment?.trackingCode,
    carrier: fulfillment?.carrier,
    items,
  };
}

/** Build the POST body for the appeasement create call. Shape is selected by `items`:
 *  amount-only sends `amount`; lost-in-shipment sends `items` and only sends `amount` when overridden. */
export function buildAppeasementCreateBody(orderId: string, a: AppeasementInput, relatedReturnId?: string): {
  orderId: string; reasonId: string; currencyUomId: string;
  note?: string; relatedReturnId?: string; items?: AppeasementItemInput[]; amount?: number;
} {
  return {
    orderId,
    reasonId: a.reasonId,
    currencyUomId: a.currencyUomId,
    ...(a.note ? { note: a.note } : {}),
    ...(relatedReturnId ? { relatedReturnId } : {}),
    ...(a.items?.length ? { items: a.items } : {}),
    ...(a.amount != null ? { amount: a.amount } : {}),
  };
}

/** Build the POST body for the customerExchange create call. unitPrice is omitted per item when absent
 *  (backend defaults to the product price → even swap). fulfillmentType is required; SHIPPED carries
 *  shipmentMethodTypeId (ignored server-side until the backend threads it through), IMMEDIATE carries
 *  facilityId (origin facility issued from now). Optional note/currencyUomId are omitted when empty. */
export function buildExchangeCreateBody(input: CreateExchangeInput): {
  orderId: string;
  returnItems: Array<{ orderItemSeqId: string; returnQuantity: number; returnReasonId: string }>;
  exchangeItems: ExchangeItemInput[]; fulfillmentType: FulfillmentType;
  shipmentMethodTypeId?: string; facilityId?: string; note?: string; currencyUomId?: string;
  shippingAddress?: PostalAddress;
} {
  return {
    orderId: input.orderId,
    returnItems: input.returnItems.map((i) => ({
      orderItemSeqId: i.orderItemSeqId,
      returnQuantity: i.returnQuantity,
      returnReasonId: i.returnReasonId,
    })),
    exchangeItems: input.exchangeItems.map((e) => ({
      productId: e.productId,
      quantity: e.quantity,
      ...(e.unitPrice != null ? { unitPrice: e.unitPrice } : {}),
    })),
    fulfillmentType: input.fulfillmentType,
    ...(input.shipmentMethodTypeId ? { shipmentMethodTypeId: input.shipmentMethodTypeId } : {}),
    ...(input.facilityId ? { facilityId: input.facilityId } : {}),
    ...(input.note ? { note: input.note } : {}),
    ...(input.currencyUomId ? { currencyUomId: input.currencyUomId } : {}),
    ...(input.shippingAddress ? { shippingAddress: input.shippingAddress } : {}),
  };
}

// ---- API (Maarg oms/returns via @common Bearer auth) ----
//
// Unlike the source returns app, order-manager authenticates every Maarg call with the standard
// @common Bearer token (api()); there is no api_key/maargAuth wrapper. This matches the shipped
// customer-returns calls in services/customer.ts.

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.returns)) return data.returns;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.docs)) return data.docs;
  if (Array.isArray(data?.list)) return data.list;
  if (data && typeof data === 'object' && data.returnId) return [data];
  return [];
}

const OPEN_RETURN_STATUS_IDS = ["RETURN_REQUESTED", "RETURN_ACCEPTED"];

export interface ReturnAmountTotal {
  currencyUomId: string;
  amount: number;
}

export function buildReturnCustomerLookupPayload(partyIds: string[]) {
  const uniquePartyIds = [...new Set(partyIds.map((partyId) => partyId.trim()).filter(Boolean))];
  const partyFilter = uniquePartyIds
    .map((partyId) => `"${partyId.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`)
    .join(" OR ");

  return {
    coreName: "enterpriseSearch",
    json: {
      query: "*:*",
      filter: ["docType:CUSTOMER", `partyId:(${partyFilter})`],
      params: {
        rows: uniquePartyIds.length,
        fl: "partyId fullName firstName lastName groupName",
      },
    },
  };
}

/** Resolve return customer names with one Solr request for all visible fromPartyId values. */
export async function getReturnCustomerNames(partyIds: string[]): Promise<Record<string, string>> {
  const uniquePartyIds = [...new Set(partyIds.map((partyId) => partyId.trim()).filter(Boolean))];
  if(!uniquePartyIds.length) {return {};}

  const response: any = await useSolrSearch().runSolrQuery(buildReturnCustomerLookupPayload(uniquePartyIds));
  if(commonUtil.hasError(response)) {throw new Error("Failed to load return customers");}

  return (response?.data?.response?.docs ?? []).reduce((names: Record<string, string>, doc: any) => {
    const partyId = String(doc.partyId ?? "").trim();
    const fullName = String(doc.fullName ?? "").trim() ||
      [doc.firstName, doc.lastName].filter(Boolean).join(" ").trim() ||
      String(doc.groupName ?? "").trim();
    if(partyId && fullName) {names[partyId] = fullName;}

    return names;
  }, {});
}

/** List customer returns (paginated). Optional statusId, query, and date boundaries narrow search. */
export async function listReturns(
  {
    pageIndex = 0,
    pageSize = 50,
    statusId,
    query,
    dateFrom,
    dateThru,
    sort
  }: {
    pageIndex?: number;
    pageSize?: number;
    statusId?: string;
    query?: string;
    dateFrom?: string;
    dateThru?: string;
    sort?: string;
  } = {}
): Promise<{ items: ReturnSummary[]; total: number }> {
  const params: Record<string, any> = { pageIndex, pageSize, returnHeaderTypeId: "CUSTOMER_RETURN" };
  if (statusId && statusId !== 'All') params.statusId = statusId;
  if (query?.trim()) {
    const q = query.trim();
    // Moqui entity-find parameters on oms/returns: accepts returnId and orderId
    params.returnId = q;
    params.orderId = q;
  }
  if (dateFrom) params.entryDate_from = dateFrom;
  if (dateThru) params.entryDate_thru = dateThru;
  if (sort) params.orderBy = sort === 'entryDate asc' ? 'entryDate asc' : 'entryDate desc';

  const resp: any = await api({
    url: "oms/returns", method: "GET",
    params,
  });
  if (commonUtil.hasError(resp)) throw new Error("Failed to list returns");
  let rows: any[] = asList(resp.data);
  let total = Number(resp.data?.returnsCount ?? rows.length);

  // If query was supplied and specific parameter matches yielded no items, fetch broader set for client-side search across RMA / Order Name / Order ID
  if (query?.trim() && rows.length === 0) {
    const fallbackResp: any = await api({
      url: "oms/returns", method: "GET",
      params: { pageIndex: 0, pageSize: 500, returnHeaderTypeId: "CUSTOMER_RETURN" }
    });
    if (!commonUtil.hasError(fallbackResp)) {
      rows = asList(fallbackResp.data);
      total = Number(fallbackResp.data?.returnsCount ?? rows.length);
    }
  }

  const items: ReturnSummary[] = rows.map((r) => ({
    returnId: r.returnId,
    fromPartyId: r.fromPartyId ?? r.frompartyid ?? undefined,
    type: mapReturnType(r.returnHeaderTypeId),
    orderId: r.orderId ?? (r.items?.[0]?.orderId ?? undefined),
    // Customer-facing name: orderName, or its alias externalOrderId. Never orderExternalId (the GID).
    orderName: r.orderName ?? r.externalOrderId ?? undefined,
    // Shopify order GID — not displayed, indexed only so search can match a Shopify order id.
    orderExternalId: r.orderExternalId ?? undefined,
    orderDate: r.orderDate != null ? String(r.orderDate) : undefined,
    statusId: r.statusId,
    entryDate: String(r.entryDate ?? ""),
    returnChannelEnumId: r.returnChannelEnumId,
    returnTotal: r.returnTotal != null && !isNaN(Number(r.returnTotal)) && Number(r.returnTotal) > 0
      ? Number(r.returnTotal)
      : r.grandTotal != null && !isNaN(Number(r.grandTotal)) && Number(r.grandTotal) > 0
      ? Number(r.grandTotal)
      : Array.isArray(r.items)
      ? r.items.reduce((sum: number, item: any) => sum + ((Number(item.returnPrice) || 0) * (Number(item.returnQuantity) || 1)), 0)
      : 0,
    currencyUomId: r.currencyUomId ?? 'USD',
    // Open exchange rows on the exchange page directly. Accept the flag at the row level or on shopifySync.
    isExchange: r.isExchange === true || r.shopifySync?.isExchange === true,
  }));

  return { items, total };
}

/** Count every requested or accepted return independently from the visible Returns page filters. */
export async function getOpenReturnsCount(): Promise<number> {
  const results = await Promise.all(
    OPEN_RETURN_STATUS_IDS.map((statusId) => listReturns({ statusId, pageIndex: 0, pageSize: 1 }))
  );

  return results.reduce((count, result) => count + result.total, 0);
}

/**
 * Sum pending refund values across the complete requested/accepted return scope.
 * Totals stay separated by currency so the UI never adds unlike currencies together.
 */
export async function getPendingRefundTotals(): Promise<ReturnAmountTotal[]> {
  const statusResults = await Promise.all(
    OPEN_RETURN_STATUS_IDS.map((statusId) => listAllReturnsForStatus(statusId))
  );
  const totals = new Map<string, number>();

  statusResults.flat().forEach((returnRecord) => {
    const currencyUomId = returnRecord.currencyUomId || "USD";
    totals.set(currencyUomId, (totals.get(currencyUomId) || 0) + Number(returnRecord.returnTotal || 0));
  });

  return Array.from(totals.entries())
    .map(([currencyUomId, amount]) => ({ currencyUomId, amount }))
    .sort((a, b) => a.currencyUomId.localeCompare(b.currencyUomId));
}

async function listAllReturnsForStatus(statusId: string): Promise<ReturnSummary[]> {
  const pageSize = 200;
  const items: ReturnSummary[] = [];
  const seenReturnIds = new Set<string>();
  let pageIndex = 0;

  while (true) {
    const result = await listReturns({ statusId, pageIndex, pageSize, sort: "entryDate desc" });
    const newItems = result.items.filter((item) => !seenReturnIds.has(item.returnId));

    newItems.forEach((item) => {
      seenReturnIds.add(item.returnId);
      items.push(item);
    });

    if (items.length >= result.total || result.items.length === 0 || newItems.length === 0) break;
    pageIndex += 1;
  }

  return items;
}

/** Load the merged rich return detail (`GET /oms/returns/{returnId}`). */
export async function getReturn(returnId: string): Promise<ReturnDetail> {
  const resp: any = await api({ url: `oms/returns/${returnId}`, method: "GET" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to load return");
  const raw = resp.data;
  if (!raw?.returnDetail?.returnId) throw new Error("Failed to load return");
  return mapReturnDetail(raw);
}

/** Create a standard return and, when supplied, a linked appeasement return (a SEPARATE call). */
export async function createReturn(input: CreateReturnInput): Promise<{ returnId: string; appeasementReturnId?: string }> {
  let returnId = "";
  if (input.items.length) {
    const body = {
      orderId: input.orderId,
      items: input.items.map((i) => ({
        orderItemSeqId: i.orderItemSeqId,
        returnQuantity: i.returnQuantity,
        returnReasonId: i.returnReasonId,
      })),
    };
    const resp: any = await api({ url: "oms/returns/customerReturn", method: "POST", data: body });
    if (commonUtil.hasError(resp)) throw new Error("Failed to create return");
    returnId = resp.data.returnId;
  }
  if (!input.appeasement) return { returnId };
  // Appeasement is a SEPARATE call (confirmed contract: two calls, not one atomic create).
  const appResp: any = await api({
    url: "oms/returns/appeasementReturn", method: "POST",
    data: buildAppeasementCreateBody(input.orderId, input.appeasement, returnId || undefined),
  });
  if (commonUtil.hasError(appResp)) throw new Error("Failed to create appeasement");
  const appeasementReturnId = appResp.data.returnId;
  // Navigate to the standard return when there is one, else to the stand-alone appeasement.
  return { returnId: returnId || appeasementReturnId, appeasementReturnId };
}

/** Create an exchange (`POST /oms/returns/customerExchange`). */
export async function createExchange(input: CreateExchangeInput): Promise<{ returnId: string; replacementOrderId?: string }> {
  const resp: any = await api({ url: "oms/returns/customerExchange", method: "POST", data: buildExchangeCreateBody(input) });
  if (commonUtil.hasError(resp)) throw new Error("Failed to create exchange");
  return { returnId: resp.data.returnId, replacementOrderId: resp.data.replacementOrderId };
}

export async function retryExchangePush(returnId: string): Promise<void> {
  const resp: any = await api({ url: `oms/returns/${returnId}/pushExchangeToShopify`, method: "POST" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to push exchange to Shopify");
}

export async function approveReturn(returnId: string): Promise<void> {
  const resp: any = await api({ url: `oms/returns/${returnId}/approve`, method: "POST" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to approve return");
}

export async function rejectReturn(returnId: string): Promise<void> {
  const resp: any = await api({ url: `oms/returns/${returnId}/reject`, method: "POST" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to reject return");
}

export async function cancelReturn(returnId: string): Promise<void> {
  const resp: any = await api({ url: `oms/returns/${returnId}/cancel`, method: "POST" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to cancel return");
}

export async function completeReturn(returnId: string): Promise<void> {
  // OMS -> RETURN_COMPLETED immediately; the Shopify completion (returnProcess + returnClose) runs async.
  const resp: any = await api({ url: `oms/returns/${returnId}/complete`, method: "POST" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to complete return");
}

export async function retryComplete(returnId: string): Promise<void> {
  // Re-run the Shopify completion after a CLOSE_FAILED (idempotent).
  const resp: any = await api({ url: `oms/returns/${returnId}/retryComplete`, method: "POST" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to retry completion");
}

/** Load an order and map it into returnable lines for the create-return page. */
export async function getOrderForReturn(orderId: string): Promise<OrderForReturn> {
  const resp: any = await api({ url: `oms/orders/${orderId}`, method: "GET" });
  if (commonUtil.hasError(resp)) throw new Error("Order not found");
  return mapOrderToReturnable(resp.data);
}

/** Load the outgoing replacement order for the exchange-detail replacement panel. */
export async function getReplacementOrder(orderId: string): Promise<ReplacementOrderDetail> {
  const resp: any = await api({ url: `oms/orders/${orderId}`, method: "GET" });
  if (commonUtil.hasError(resp)) throw new Error("Replacement order not found");
  return mapReplacementOrder(resp.data);
}

/** Return reasons for create return line item reason selection. */
export async function listReturnReasons(): Promise<ReturnReason[]> {
  const resp: any = await api({ url: "oms/returnReasons", method: "GET" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to load return reasons");
  const reasons = Array.isArray(resp.data?.reasons)
    ? resp.data.reasons
    : Array.isArray(resp.data)
      ? resp.data
      : [];
  if (!reasons.length) throw new Error("No return reasons are configured");
  return reasons.map((r: any) => ({ returnReasonId: r.returnReasonId, description: r.description }));
}

/** Appeasement reasons for the create-return appeasement card (sorted by sequenceId). */
export async function listAppeasementReasons(): Promise<ReturnReason[]> {
  const resp: any = await api({ url: "oms/appeasementReasons", method: "GET" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to load appeasement reasons");
  return (resp.data?.reasons ?? [])
    .slice()
    .sort((x: any, y: any) => String(x.sequenceId ?? "").localeCompare(String(y.sequenceId ?? "")))
    .map((r: any) => ({ returnReasonId: r.returnReasonId, description: r.description }));
}

/** Manual retry of the OMS→Shopify push (the push also fires automatically on approve). */
export async function pushToShopify(returnId: string): Promise<PushOutcome> {
  const resp: any = await api({ url: `oms/returns/${returnId}/pushToShopify`, method: "POST" });
  if (commonUtil.hasError(resp)) throw new Error("Failed to push to Shopify");
  const status = resp.data?.status; // "pushed" | "already_synced" | "skipped" | "failed"
  if (status === "failed") throw new Error(resp.data.errorMessage || "Push to Shopify failed");
  return (status as PushOutcome) ?? "pushed";
}

/** The collapsed sync state, re-derived from a fresh detail fetch (used by the detail store's polling). */
export async function getSyncStatus(returnId: string): Promise<Record<SyncTarget, SyncState>> {
  const detail = await getReturn(returnId);
  return detail.sync;
}
