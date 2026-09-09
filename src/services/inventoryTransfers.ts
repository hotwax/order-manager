import { api } from "@common";

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
