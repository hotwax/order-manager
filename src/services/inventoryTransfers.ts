import { api, useSolrSearch } from "@common";

const TERMINAL_ITEM_STATUSES = new Set(["ITEM_CANCELLED", "ITEM_COMPLETED"]);

export type InventoryTransferRequest = {
  productId: string;
  quantity: number;
  facilityId: string;
  facilityIdTo: string;
  orderId?: string;
  orderItemSeqId?: string;
  comments?: string;
};

export type RequestInventoryTransfersPayload = {
  transfers: InventoryTransferRequest[];
  requestReferencePrefix: string;
};

function numericValue(value: unknown) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function inventoryTransferOpenQuantity(item: Record<string, any>) {
  const quantity = numericValue(item.quantity);
  const cancelled = numericValue(item.cancelledQuantity ?? item.cancelQuantity);
  const fulfilled = numericValue(item.fulfilledQuantity ?? item.shippedQuantity);

  return Math.max(quantity - cancelled - fulfilled, 0);
}

export function isInventoryTransferEligibleItem(item: Record<string, any>, isVirtualFacility: boolean) {
  return Boolean(item.productId &&
    !isVirtualFacility &&
    !TERMINAL_ITEM_STATUSES.has(item.statusId) &&
    inventoryTransferOpenQuantity(item) > 0);
}

/** Every inventory transfer requested for an order's items. */
export async function fetchOrderInventoryTransfers(orderId: string): Promise<any[]> {
  const response: any = await api({
    url: "oms/inventoryTransfers",
    method: "GET",
    params: { orderId, pageSize: 250, orderByField: "-createdStamp" },
  });

  return Array.isArray(response.data) ? response.data : [];
}

/** A product's available to promise and quantity on hand at each of the given facilities. */
export async function fetchFacilityStock(productId: string, facilityIds: string[]): Promise<Record<string, { atp: number; qoh: number }>> {
  const response: any = await api({
    url: "oms/inventoryLogs",
    method: "GET",
    params: { productId, facilityId: facilityIds.join(","), facilityId_op: "in", pageSize: 500 },
  });
  const stock: Record<string, { atp: number; qoh: number }> = Object.fromEntries(facilityIds.map((facilityId) => [facilityId, { atp: 0, qoh: 0 }]));
  (Array.isArray(response.data) ? response.data : []).forEach((row: any) => {
    const entry = stock[row.facilityId];
    if(!entry) {return;}
    entry.atp += numericValue(row.availableToPromiseTotal);
    entry.qoh += numericValue(row.quantityOnHandTotal);
  });

  return stock;
}

/**
 * How fast each facility sells the product: its completed order items over the last `days` days,
 * per day, keyed by facility. Solr keeps no completion date on an order item, so the window is on the
 * order date. A facility with no such sales is left out.
 */
export async function fetchFacilitySalesVelocity(productId: string, days = 30): Promise<Record<string, number>> {
  const response: any = await useSolrSearch().runSolrQuery({
    json: {
      params: { rows: 0, "q.op": "AND" },
      query: "*:*",
      filter: [
        "docType: ORDER",
        "orderTypeId: SALES_ORDER",
        `productId: "${productId}"`,
        "orderItemStatusId: ITEM_COMPLETED",
        `orderDate:[NOW-${days}DAYS TO NOW]`,
      ],
      facet: { facilities: { type: "terms", field: "facilityId", limit: -1, mincount: 1 } },
    },
  });
  const buckets: any[] = response.data?.facets?.facilities?.buckets || [];

  return Object.fromEntries(buckets.map((bucket) => [bucket.val, numericValue(bucket.count) / days]));
}

/** Moves the stock: out of the source facility and into the destination, and marks the transfer complete. */
export function executeInventoryTransfer(inventoryTransferId: string) {
  return api({ url: `oms/inventoryTransfers/${inventoryTransferId}/execute`, method: "POST", data: { inventoryTransferId } });
}

export function cancelInventoryTransfer(inventoryTransferId: string) {
  return api({
    url: `oms/inventoryTransfers/${inventoryTransferId}/cancel`,
    method: "POST",
    data: { inventoryTransferId, statusReasonEnumId: "IXF_USER_CANCEL" },
  });
}

export async function requestInventoryTransfers(payload: RequestInventoryTransfersPayload): Promise<string[]> {
  const ids = await Promise.all(payload.transfers.map(async (transfer) => {
    const response: any = await api({
      url: "oms/inventoryTransfers",
      method: "POST",
      data: {
        ...transfer,
        statusId: "IXF_REQUESTED",
        sourceId: "ORDER_MANAGER",
        sourceReferenceId: `${payload.requestReferencePrefix}-${transfer.orderItemSeqId || transfer.productId}`,
      },
    });

    return response.data?.inventoryTransferId;
  }));

  return ids.filter(Boolean);
}
