import { toMillis } from "@/utils/format";

/**
 * Whether, and how far, inventory was issued for an order's items: one reading of the issuance
 * movements, shared by the ship group view and the routing timeline so the two always agree.
 */

export interface ItemIssuanceSummary {
  /** Units taken off the books for this order item. */
  issued: number;
  /** Quantity on hand across the inventory items involved, before and after the issuance. */
  qohBefore: number;
  qohAfter: number;
}

/** A movement that issued stock for an order item: it names the order item and the ItemIssuance it wrote. */
export function isIssuanceRow(row: any, orderId?: string, orderItemSeqId?: string): boolean {
  return Boolean(row?.itemIssuanceId && row.orderItemSeqId) &&
    (!orderId || row.orderId === orderId) &&
    (!orderItemSeqId || row.orderItemSeqId === orderItemSeqId);
}

/**
 * Fold an order's issuance rows into a per-order-item summary.
 *
 * `lastQuantityOnHand` is written by the PopulateInventoryItemDetailLastTotals EECA
 * *before* the row is stored, so it is the balance the issuance started from and
 * `last + quantityOnHandDiff` is where it ended. Rows are grouped by inventory item and
 * read in effective order, because two issuances against the same inventory item chain
 * — the second one's "before" is the first one's "after", and summing both would count
 * the opening balance twice.
 */
export function summariseIssuance(rows: any[]): Record<string, ItemIssuanceSummary> {
  const byItemAndInventory: Record<string, Record<string, any[]>> = {};

  rows.forEach((row: any) => {
    if(!isIssuanceRow(row)) {return;}
    byItemAndInventory[row.orderItemSeqId] ||= {};
    (byItemAndInventory[row.orderItemSeqId][row.inventoryItemId || ""] ||= []).push(row);
  });

  const summary: Record<string, ItemIssuanceSummary> = {};
  Object.entries(byItemAndInventory).forEach(([orderItemSeqId, byInventoryItem]) => {
    const totals: ItemIssuanceSummary = { issued: 0, qohBefore: 0, qohAfter: 0 };

    Object.values(byInventoryItem).forEach((inventoryRows) => {
      const ordered = inventoryRows
        .slice()
        .sort((left, right) =>
          (toMillis(left.effectiveDate) ?? 0) - (toMillis(right.effectiveDate) ?? 0) ||
          String(left.inventoryItemDetailSeqId).localeCompare(String(right.inventoryItemDetailSeqId)));
      const first = ordered[0];
      const last = ordered[ordered.length - 1];

      totals.issued += ordered.reduce((sum, row) => sum + Math.abs(Number(row.quantityOnHandDiff) || 0), 0);
      totals.qohBefore += Number(first.lastQuantityOnHand) || 0;
      totals.qohAfter += (Number(last.lastQuantityOnHand) || 0) + (Number(last.quantityOnHandDiff) || 0);
    });

    summary[orderItemSeqId] = totals;
  });

  return summary;
}
