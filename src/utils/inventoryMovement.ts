import {
  cartOutline,
  clipboardOutline,
  createOutline,
  downloadOutline,
  fileTrayFullOutline,
  pencilOutline,
  repeatOutline,
  returnDownBackOutline,
  swapHorizontalOutline
} from "ionicons/icons";

/**
 * How an InventoryItemDetail row reads in an inventory history: its type (sales order, transfer
 * order, purchase receipt, return, cycle count, manual variance, rollover, receipt or adjustment),
 * the icon and colour for that type, and the reference to show (order name, reason, ...).
 *
 * Kept in step with Order Routing's inventory history (apps/order-routing/src/utils/inventoryMovement.ts)
 * so a movement looks the same in both apps. Apps do not import each other's source, so this is a
 * copy of its classification and presentation; Order Routing's deep links are left out.
 */

export type MovementTypeKey =
  | "SALES_ORDER" |
  "TRANSFER" |
  "PURCHASE" |
  "RETURN" |
  "CYCLE_COUNT" |
  "MANUAL_VARIANCE" |
  "ROLLOVER" |
  "RECEIPT" |
  "ADJUSTMENT";

export interface ClassifiedMovement {
  typeKey: MovementTypeKey;
  /** Translation key for the movement type, shown as the row's overline. */
  label: string;
  icon: string;
  /** Ionic color name. */
  color: string;
  /** The order name, reason or description the row is read by. */
  referenceLabel: string;
}

const TYPE_PRESENTATION: Record<MovementTypeKey, { label: string; icon: string; color: string }> = {
  SALES_ORDER: { label: "Sales order", icon: cartOutline, color: "primary" },
  TRANSFER: { label: "Transfer order", icon: swapHorizontalOutline, color: "tertiary" },
  PURCHASE: { label: "Purchase order", icon: fileTrayFullOutline, color: "secondary" },
  RETURN: { label: "Return", icon: returnDownBackOutline, color: "warning" },
  CYCLE_COUNT: { label: "Cycle count", icon: clipboardOutline, color: "medium" },
  MANUAL_VARIANCE: { label: "Manual variance", icon: pencilOutline, color: "warning" },
  ROLLOVER: { label: "Rollover", icon: repeatOutline, color: "medium" },
  RECEIPT: { label: "Receipt", icon: downloadOutline, color: "success" },
  ADJUSTMENT: { label: "Adjustment", icon: createOutline, color: "medium" }
};

function classifyType(row: any): MovementTypeKey {
  if(row.physicalInventoryId) {
    // A cycle count applies a variance through a count session; a manual variance is a person logging one.
    if(row.workEffortId || row.reasonEnumId === "CYCLE_COUNT") {return "CYCLE_COUNT";}

    return "MANUAL_VARIANCE";
  }
  if(row.reasonEnumId === "INV_ROLLOVER") {return "ROLLOVER";}
  if(row.returnId) {return "RETURN";}
  if(row.orderId) {
    // The scoped history endpoint returns the order's type on the row itself.
    if(row.orderTypeId === "TRANSFER_ORDER") {return "TRANSFER";}
    if(row.orderTypeId === "PURCHASE_ORDER") {return "PURCHASE";}

    return "SALES_ORDER";
  }
  if(row.shipmentId) {return "RECEIPT";}
  // The row whose detail seq id equals the inventory item id is the receipt that created the item.
  if(row.inventoryItemDetailSeqId && row.inventoryItemDetailSeqId === row.inventoryItemId) {return "RECEIPT";}

  return "ADJUSTMENT";
}

function referenceLabel(typeKey: MovementTypeKey, row: any, reasonDesc?: string): string {
  switch (typeKey) {
    case "SALES_ORDER":
    case "TRANSFER":
    case "PURCHASE":
      return row.orderName || row.orderId || "-";
    case "RETURN":
      return row.orderName || row.orderId || row.returnId || "-";
    case "CYCLE_COUNT":
      return reasonDesc || row.reasonEnumId || "Cycle count";
    case "MANUAL_VARIANCE":
      return reasonDesc || row.reasonEnumId || "Manual variance";
    case "ROLLOVER":
      return row.description || reasonDesc || "Rollover";
    case "RECEIPT":
      return row.description || reasonDesc || "Receipt";
    default:
      return row.description || reasonDesc || "Adjustment";
  }
}

/** `reasonDescription` resolves a reasonEnumId, e.g. from the seed's enum descriptions. */
export function classifyMovement(row: any, reasonDescription: (enumId: string) => string = () => ""): ClassifiedMovement {
  const typeKey = classifyType(row);
  const presentation = TYPE_PRESENTATION[typeKey];
  const reasonDesc = row.reasonEnumId ? reasonDescription(row.reasonEnumId) || undefined : undefined;

  return { typeKey, ...presentation, referenceLabel: referenceLabel(typeKey, row, reasonDesc) };
}

/** "+3", "-1", "0": a stock change as Order Routing writes it. */
export function signedChange(value: unknown): string {
  const num = Number(value) || 0;

  return num > 0 ? `+${num}` : `${num}`;
}

/** The class Order Routing colours a stock change with. */
export function changeClass(value: unknown): string {
  const num = Number(value) || 0;

  return num > 0 ? "diff-positive" : num < 0 ? "diff-negative" : "";
}
