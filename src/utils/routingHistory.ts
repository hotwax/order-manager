import { useSeedData } from "@common/db";
import { type LocationStock, type ProductFacilityPair, pairKey } from "@/services/routingHistory";
import { toMillis } from "@/utils/format";

/**
 * The routing history of an order's items, with the stock each change saw.
 *
 * A routing change only says where an item went. Whether that location had stock, and what
 * happened to that stock after the item arrived, comes from the location's inventory movements
 * for the item's product. This module joins the two so the order page can answer "why is this
 * item here, and can it ship from here?" without anyone reading logs.
 */

export type RoutingEventKind = "brokered" | "released" | "allocated" | "moved" | "rejected" | "parked" | "unfillable" | "cancelled";

/** Stock at one location around a routing change. `exact` when the change's own movements were found. */
export interface StockMoment {
  facilityId: string;
  before: number | null;
  after: number | null;
  onHand: number | null;
  exact: boolean;
}

export interface RoutingEvent {
  id: string;
  at: number;
  attempts: number;
  kind: RoutingEventKind;
  fromFacilityId: string;
  toFacilityId: string;
  reasonEnumId: string;
  /** The user who made the change, or the routing that did. */
  actor: string;
  /** The user login when a person made the change; empty for routing and system changes. */
  user: string;
  rule: string;
  stock: StockMoment | null;
}

export interface StockMovement {
  id: string;
  at: number;
  atpDiff: number;
  qohDiff: number;
  atpAfter: number | null;
  qohAfter: number | null;
  /** The InventoryItemDetail row, for presenting it the way Order Routing's inventory history does. */
  raw: any;
}

/** What happened to stock at the item's current location since it was routed there. */
export interface SinceBlock {
  facilityId: string;
  fromAt: number;
  movements: StockMovement[];
  availableNow: number | null;
  onHandNow: number | null;
  /** More movements exist than were read. */
  truncated: boolean;
}

export interface ItemRoutingHistory {
  orderItemSeqId: string;
  productId: string;
  facilityId: string;
  events: RoutingEvent[];
  since: SinceBlock | null;
}

export type RoutingItem = { orderItemSeqId: string; productId: string; facilityId: string; statusId?: string };
export type MovementPage = { rows: any[]; truncated: boolean };

/** A change and its own inventory movements are written in one transaction, a moment apart. */
const SAME_CHANGE_WINDOW_MS = 2 * 60 * 1000;
const ARRIVALS: RoutingEventKind[] = ["brokered", "released", "allocated", "moved"];
const DEPARTURES: RoutingEventKind[] = ["rejected", "cancelled", "parked", "unfillable"];

const num = (value: unknown): number | null => {
  if(value === null || value === undefined || value === "") {return null;}
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

/** When a routing change happened. OMS returns epoch millis or SQL timestamps. */
export const changeAt = (row: any): number => toMillis(row.changeDatetime) ?? 0;

/** A movement's recorded time. External resets carry no effective date, only their creation time. */
export const movementAt = (row: any): number => toMillis(row.createdStamp) ?? toMillis(row.effectiveDate) ?? 0;

const bySequence = (a: any, b: any) => movementAt(a) - movementAt(b) ||
  (num(a.inventoryItemDetailSeqId) ?? 0) - (num(b.inventoryItemDetailSeqId) ?? 0);

const VIRTUAL_FACILITY = "VIRTUAL_FACILITY";

/**
 * Virtual locations (no facility yet, the parking lots) hold no stock to show. The facility's type
 * decides; the id convention is only the fallback for a facility the seed has not loaded.
 */
export function isStockLocation(facilityId?: string): boolean {
  if(!facilityId || facilityId === "_NA_") {return false;}
  const seed = useSeedData();
  const facility = seed.facility(facilityId);
  if(facility) {
    return facility.facilityTypeId !== VIRTUAL_FACILITY && seed.facilityType(facility.facilityTypeId)?.parentTypeId !== VIRTUAL_FACILITY;
  }

  return !facilityId.endsWith("_PARKING");
}

export function routingEventKind(row: any): RoutingEventKind {
  switch (row.changeReasonEnumId) {
    case "BROKERED": return "brokered";
    case "RELEASED": return "released";
    // A Shopify sync records its moves as allocations, even when it puts the item in a parking lot.
    case "ALLOCATED": return isStockLocation(row.facilityId) ? "allocated" : "parked";
    case "PARKED": return "parked";
    case "UNFILLABLE": return "unfillable";
    case "SHOPIFY_CANCELLATION": return "cancelled";
    case undefined: case null: case "": return "moved";
    default: return "rejected";
  }
}

/** "Primary : Standard Shipping : Warehouse]" (as stored) → "Primary › Standard Shipping › Warehouse". */
export function ruleLabel(routingRule?: string): string {
  return (routingRule || "").replace(/\]\s*$/, "").split(":").map((part) => part.trim()).filter(Boolean).join(" › ");
}

/** The rule itself, without its routing group and routing: "Primary › Standard Shipping › Warehouse" → "Warehouse". */
export function ruleName(rule: string): string {
  return rule.split(" › ").pop() || rule;
}

/** Who made a facility change: the user, or the system its comment names ("Primary : Inventory found…"). */
export function changeActor(row: any): string {
  if(row.changeUserLogin) {return String(row.changeUserLogin);}
  const prefix = String(row.comments || "").split(":")[0]?.trim();

  return prefix && prefix.length < 40 && prefix !== row.comments ? prefix : "";
}

/** Where a change's stock is read: the location an item arrived at, or the one it left. */
function stockLocationOf(event: Pick<RoutingEvent, "kind" | "fromFacilityId" | "toFacilityId">): string {
  if(ARRIVALS.includes(event.kind)) {return isStockLocation(event.toFacilityId) ? event.toFacilityId : "";}
  if(DEPARTURES.includes(event.kind)) {return isStockLocation(event.fromFacilityId) ? event.fromFacilityId : "";}

  return "";
}

function balanceAfter(row: any) {
  const atpBefore = num(row.lastAvailableToPromise);
  const qohBefore = num(row.lastQuantityOnHand);

  return {
    atp: atpBefore === null ? null : atpBefore + (num(row.availableToPromiseDiff) ?? 0),
    qoh: qohBefore === null ? null : qohBefore + (num(row.quantityOnHandDiff) ?? 0),
  };
}

function toMovement(row: any): StockMovement {
  const after = balanceAfter(row);

  return {
    id: String(row.inventoryItemDetailSeqId ?? `${row.inventoryItemId}-${movementAt(row)}`),
    at: movementAt(row),
    atpDiff: num(row.availableToPromiseDiff) ?? 0,
    qohDiff: num(row.quantityOnHandDiff) ?? 0,
    atpAfter: after.atp,
    qohAfter: after.qoh,
    raw: row,
  };
}

/** Stock at a location around a change: from the change's own movements when they exist, else the last balance before it. */
export function stockAt(rows: any[], facilityId: string, at: number, orderId: string): StockMoment | null {
  const sorted = [...rows].sort(bySequence);
  const own = sorted.filter((row) => row.orderId === orderId && Math.abs(movementAt(row) - at) <= SAME_CHANGE_WINDOW_MS);
  if(own.length) {
    const first = own[0];
    const last = own[own.length - 1];

    return { facilityId, before: num(first.lastAvailableToPromise), after: balanceAfter(last).atp, onHand: balanceAfter(last).qoh, exact: true };
  }
  const prior = sorted.filter((row) => movementAt(row) <= at).pop();
  if(!prior) {return null;}
  const balance = balanceAfter(prior);

  return { facilityId, before: balance.atp, after: balance.atp, onHand: balance.qoh, exact: false };
}

function eventsForItem(changes: any[], item: RoutingItem): RoutingEvent[] {
  const events: RoutingEvent[] = [];
  changes
    .filter((row) => row.orderItemSeqId === item.orderItemSeqId)
    .forEach((row) => {
      const at = changeAt(row);
      const kind = routingEventKind(row);
      const previous = events[events.length - 1];
      // Routing retries an unfillable item every run; one line per run would bury everything else.
      if(kind === "unfillable" && previous?.kind === "unfillable") {
        previous.attempts += 1;

        return;
      }
      events.push({
        id: String(row.orderFacilityChangeId ?? `${item.orderItemSeqId}-${at}`),
        at,
        attempts: 1,
        kind,
        fromFacilityId: row.fromFacilityId || "",
        toFacilityId: row.facilityId || "",
        reasonEnumId: row.changeReasonEnumId || "",
        actor: changeActor(row),
        user: row.changeUserLogin ? String(row.changeUserLogin) : "",
        rule: ruleLabel(row.routingRule),
        stock: null,
      });
    });

  return events;
}

/** The product and location pairs whose movements the history needs, each from the earliest moment it matters. */
export function movementRequests(items: RoutingItem[], changes: any[]): Array<ProductFacilityPair & { sinceMillis: number }> {
  const requests = new Map<string, ProductFacilityPair & { sinceMillis: number }>();
  const want = (productId: string, facilityId: string, at: number) => {
    if(!productId || !isStockLocation(facilityId)) {return;}
    const key = pairKey(productId, facilityId);
    const existing = requests.get(key);
    if(!existing || at < existing.sinceMillis) {requests.set(key, { productId, facilityId, sinceMillis: at });}
  };
  items.forEach((item) => {
    const events = eventsForItem(changes, item);
    events.forEach((event) => want(item.productId, stockLocationOf(event), event.at));
    if(isStockLocation(item.facilityId)) {
      const arrival = [...events].reverse().find((event) => ARRIVALS.includes(event.kind) && event.toFacilityId === item.facilityId);
      want(item.productId, item.facilityId, arrival?.at ?? Date.now());
    }
  });

  return [...requests.values()];
}

export function buildRoutingHistory(input: {
  orderId: string;
  items: RoutingItem[];
  changes: any[];
  movements: Record<string, MovementPage>;
  stock: Record<string, LocationStock>;
}): ItemRoutingHistory[] {
  const { orderId, items, changes, movements, stock } = input;

  return items.map((item) => {
    const events = eventsForItem(changes, item);
    events.forEach((event) => {
      const facilityId = stockLocationOf(event);
      const page = facilityId ? movements[pairKey(item.productId, facilityId)] : undefined;
      event.stock = page ? stockAt(page.rows, facilityId, event.at, orderId) : null;
    });

    let since: SinceBlock | null = null;
    if(isStockLocation(item.facilityId)) {
      const key = pairKey(item.productId, item.facilityId);
      const page = movements[key];
      const arrival = [...events].reverse().find((event) => ARRIVALS.includes(event.kind) && event.toFacilityId === item.facilityId);
      if(page || stock[key]) {
        const fromAt = arrival?.at ?? 0;
        // Without the arrival there is no "since" to measure from, so only the current stock shows.
        const later = arrival ? (page?.rows || [])
          .filter((row) => movementAt(row) > fromAt)
          .filter((row) => !(row.orderId === orderId && Math.abs(movementAt(row) - arrival.at) <= SAME_CHANGE_WINDOW_MS))
          .sort(bySequence)
          .map((row) => toMovement(row)) : [];
        const lastMovement = later[later.length - 1];
        since = {
          facilityId: item.facilityId,
          fromAt,
          movements: later,
          availableNow: stock[key]?.atp ?? lastMovement?.atpAfter ?? arrival?.stock?.after ?? null,
          onHandNow: stock[key]?.qoh ?? lastMovement?.qohAfter ?? arrival?.stock?.onHand ?? null,
          truncated: Boolean(page?.truncated),
        };
      }
    }

    return { orderItemSeqId: item.orderItemSeqId, productId: item.productId, facilityId: item.facilityId, events, since };
  });
}

/** An item still waiting to ship from a real location that now has less than nothing to promise. */
export function isShortAtLocation(item: RoutingItem, stock: Record<string, LocationStock>): boolean {
  if(!isStockLocation(item.facilityId)) {return false;}
  if(item.statusId && ["ITEM_COMPLETED", "ITEM_CANCELLED", "ITEM_REJECTED"].includes(item.statusId)) {return false;}
  const atp = stock[pairKey(item.productId, item.facilityId)]?.atp;

  return typeof atp === "number" && atp < 0;
}
