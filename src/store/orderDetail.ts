import { defineStore } from "pinia";
import { api, commonUtil, logger} from "@common";
import { UNFILLABLE_SAMPLE_SIZE, useOrderDetail } from "@/composables/useOrderDetail";
import { useProductCacheStore } from "./productCache";
import { useSeedStore } from "./seed";

type LoadStatus = "idle" | "loading" | "loaded" | "error" | "notfound";

interface OrderEntry {
  payload: any | null; // verbatim API response[0] — no transformation
  status: LoadStatus;
  loadedAt: string;
  error: string;
}

const HEADER_SEQ_ID = "_NA_";

const newEntry = (): OrderEntry => ({ payload: null, status: "idle", loadedAt: "", error: "" });

// Order adjustments (e.g. tax) commonly carry only an orderAdjustmentTypeId, no free-text
// comment/description — fall back to the seeded enum description so rows show "Sales Tax"
// rather than the raw "SALES_TAX" id. This also backs the rollup grouping key below, so
// adjustments only merge under their human-readable label, not the raw type id.
const adjustmentDisplayLabel = (adj: any) =>
  adj.comments
  || adj.comment
  || adj.description
  || useSeedStore().orderAdjustmentTypeDescription(adj.orderAdjustmentTypeId)
  || adj.orderAdjustmentTypeId
  || "OTHER_ADJUSTMENT";

const adjustmentUniqueKey = (adj: any, fallbackSeqId = "") =>
  adj.orderAdjustmentId || [
    fallbackSeqId || adj.orderItemSeqId || "",
    adj.shipGroupSeqId || "",
    adj.orderAdjustmentTypeId || "",
    adjustmentDisplayLabel(adj),
    Number(adj.amount || 0)
  ].join("|");

const NON_CANCELLABLE_ITEM_STATUSES = new Set(["ITEM_CANCELLED", "ITEM_COMPLETED"]);

function orderPayload(data: any) {
  return Array.isArray(data) ? data[0] : data;
}

function responseList(data: any): any[] {
  return Array.isArray(data) ? data : (data?.docs || []);
}

function eventMillis(value: any): number {
  return commonUtil.parseDateTimeValue(value)?.toMillis() ?? 0;
}

// OMS records order events one row per order item, so a single operator action on a
// three-item ship group writes three rows milliseconds apart. Rows sharing a key
// within this window are one event; anything further apart is a separate action,
// even when it repeats an earlier move.
const EVENT_CLUSTER_MS = 60_000;

interface EventCluster {
  id: string;
  value: number;
  rows: any[];
}

function clusterEvents(rows: any[], keyOf: (row: any) => string, millisOf: (row: any) => number): EventCluster[] {
  const clusters: EventCluster[] = [];
  const openByKey: Record<string, EventCluster> = {};

  rows
    .map((row) => ({ row, millis: millisOf(row) }))
    .filter(({ millis }) => millis > 0)
    .sort((left, right) => left.millis - right.millis)
    .forEach(({ row, millis }) => {
      const key = keyOf(row);
      const open = openByKey[key];
      if (open && millis - open.value <= EVENT_CLUSTER_MS) {
        open.rows.push(row);
        return;
      }
      const cluster: EventCluster = { id: `${key}|${millis}`, value: millis, rows: [row] };
      openByKey[key] = cluster;
      clusters.push(cluster);
    });

  return clusters;
}

/** Distinct order items touched by a cluster; falls back to the row count for header-scoped rows. */
function clusterItemCount(cluster: EventCluster): number {
  const itemSeqIds = new Set(cluster.rows.map((row: any) => row.orderItemSeqId).filter(Boolean));
  return itemSeqIds.size || cluster.rows.length;
}

export interface FacilityChangeEvent {
  id: string;
  changeReasonEnumId: string;
  fromFacilityId: string;
  facilityId: string;
  changeUserLogin: string;
  comments: string;
  routingRuleId: string;
  itemCount: number;
  value: number;
}

/**
 * Collapse OrderFacilityChange rows into one event per operation — "3 items
 * released to Broadway" rather than three separate lines.
 */
function clusterFacilityChanges(rows: any[]): FacilityChangeEvent[] {
  return clusterEvents(
    rows,
    (row) => [row.changeReasonEnumId || "", row.fromFacilityId || "", row.facilityId || ""].join("|"),
    (row) => eventMillis(row.changeDatetime)
  ).map((cluster) => {
    const first = cluster.rows[0];
    // Actor and comment are per row; system-written rows leave both null, so take
    // whichever row in the cluster carried one.
    return {
      id: cluster.id,
      changeReasonEnumId: first.changeReasonEnumId || "",
      fromFacilityId: first.fromFacilityId || "",
      facilityId: first.facilityId || "",
      changeUserLogin: cluster.rows.find((row: any) => row.changeUserLogin)?.changeUserLogin || "",
      comments: cluster.rows.find((row: any) => row.comments)?.comments || "",
      routingRuleId: first.routingRuleId || "",
      itemCount: clusterItemCount(cluster),
      value: cluster.value
    };
  });
}

// Item statuses worth a header-timeline entry. ITEM_CREATED/ITEM_APPROVED and the
// pending-fulfillment steps only restate what the header status rows and the ship
// group timeline already show.
const TIMELINE_ITEM_STATUSES = new Set(["ITEM_CANCELLED", "ITEM_REJECTED", "ITEM_REQ_CANCELATN"]);

export interface ItemStatusEvent {
  id: string;
  statusId: string;
  changeReason: string;
  statusUserLogin: string;
  itemCount: number;
  value: number;
}

/** Collapse item cancel/reject status rows into one event per action. */
function clusterItemStatuses(rows: any[]): ItemStatusEvent[] {
  return clusterEvents(
    rows.filter((row: any) => TIMELINE_ITEM_STATUSES.has(row.statusId)),
    (row) => `${row.statusId}|${row.changeReason || ""}`,
    (row) => eventMillis(row.statusDatetime)
  ).map((cluster) => {
    const first = cluster.rows[0];
    return {
      id: cluster.id,
      statusId: first.statusId || "",
      changeReason: first.changeReason || "",
      statusUserLogin: cluster.rows.find((row: any) => row.statusUserLogin)?.statusUserLogin || "",
      itemCount: clusterItemCount(cluster),
      value: cluster.value
    };
  });
}

export interface ItemIssuanceSummary {
  /** Units taken off the books for this order item. */
  issued: number;
  /** Quantity on hand across the inventory items involved, before and after the issuance. */
  qohBefore: number;
  qohAfter: number;
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
function summariseIssuance(rows: any[]): Record<string, ItemIssuanceSummary> {
  const byItemAndInventory: Record<string, Record<string, any[]>> = {};

  rows.forEach((row: any) => {
    if (!row.orderItemSeqId || !row.itemIssuanceId) return;
    const perItem = byItemAndInventory[row.orderItemSeqId] ||= {};
    (perItem[row.inventoryItemId || ""] ||= []).push(row);
  });

  const summary: Record<string, ItemIssuanceSummary> = {};
  Object.entries(byItemAndInventory).forEach(([orderItemSeqId, byInventoryItem]) => {
    const totals: ItemIssuanceSummary = { issued: 0, qohBefore: 0, qohAfter: 0 };

    Object.values(byInventoryItem).forEach((inventoryRows) => {
      const ordered = inventoryRows
        .slice()
        .sort((left, right) =>
          eventMillis(left.effectiveDate) - eventMillis(right.effectiveDate)
          || String(left.inventoryItemDetailSeqId).localeCompare(String(right.inventoryItemDetailSeqId)));
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

export interface UnfillableSummary {
  /** Brokering runs that failed, not rows: one run writes a row per unfillable item. */
  count: number;
  /** True when `count` is a floor — the sample filled its page, so older runs are unseen. */
  atLeast: boolean;
  lastAttemptDate: string;
}

/**
 * Count failed brokering attempts from UNFILLABLE rows.
 *
 * One routing run writes a row per unfillable item — an order rejected once with three
 * items has three rows — so counting rows would report "3 attempts" for a single run.
 * Rows carry the run that produced them; rows without one are grouped by time instead.
 */
function countUnfillableAttempts(rows: any[]): number {
  return clusterEvents(
    rows,
    (row) => row.routingRunId || "",
    (row) => eventMillis(row.changeDatetime)
  ).length;
}

function cancellableOrderItems(order: any) {
  return (order?.shipGroups || []).flatMap((shipGroup: any) => {
    const shipGroupSeqId = String(shipGroup.shipGroupSeqId || "").trim();

    return (shipGroup.items || [])
      .map((item: any) => ({
        orderItemSeqId: String(item.orderItemSeqId || "").trim(),
        shipGroupSeqId,
        statusId: String(item.statusId || "").trim(),
      }))
      .filter((item: any) =>
        item.orderItemSeqId
        && item.shipGroupSeqId
        && !NON_CANCELLABLE_ITEM_STATUSES.has(item.statusId)
      )
      .map(({ orderItemSeqId, shipGroupSeqId }: any) => ({
        orderItemSeqId,
        shipGroupSeqId,
        reason: "NO_VARIANCE_LOG",
        comment: "",
      }));
  });
}

export const useOrderDetailStore = defineStore("orderDetail", {
  state: () => ({
    byOrderId: {} as Record<string, OrderEntry>,
    currentOrderId: "",
    orderHeaderWorkEfforts: [] as any[],
    orderHeaderWorkEffortsByOrderId: {} as Record<string, any[]>,
    riskAssessmentsByOrderId: {} as Record<string, any[]>,
    riskAssessmentsStatusByOrderId: {} as Record<string, LoadStatus>,
    riskAssessmentsErrorByOrderId: {} as Record<string, string>,
    commEvents: [] as any[],
    commEventsByOrderId: {} as Record<string, any[]>,
    shippingMethods: [] as any[],
    carrierParties: [] as any[],
    fulfillmentTimeline: [] as any[],
    fulfillmentTimelineByOrderId: {} as Record<string, any[]>,
    // Order event sources behind the header timeline. OrderStatus and
    // OrderFacilityChange are the only places OMS records who changed what and why;
    // the order master-detail document carries neither.
    facilityChangesByOrderId: {} as Record<string, any[]>,
    unfillableByOrderId: {} as Record<string, UnfillableSummary>,
    orderEventsStatusByOrderId: {} as Record<string, LoadStatus>,
    // What inventory issuance did to each order item, keyed orderId -> orderItemSeqId.
    // Only loaded for orders that need it.
    issuanceByOrderId: {} as Record<string, Record<string, ItemIssuanceSummary>>,
    issuanceStatusByOrderId: {} as Record<string, LoadStatus>,
  }),
  getters: {
    current: (state) => state.byOrderId[state.currentOrderId]?.payload || null,
    currentEntry: (state) => state.byOrderId[state.currentOrderId] || null,
    isLoading: (state) => state.byOrderId[state.currentOrderId]?.status === "loading",
    error: (state) => state.byOrderId[state.currentOrderId]?.error || "",

    orderById: (state) => (orderId: string) => state.byOrderId[orderId]?.payload || null,
    loadingById: (state) => (orderId: string) => state.byOrderId[orderId]?.status === "loading",
    errorById: (state) => (orderId: string) => state.byOrderId[orderId]?.error || "",

    placingCustomerRoleByOrderId: (state) => (orderId: string) => {
      const current = state.byOrderId[orderId]?.payload;
      return (current?.roles || []).find((role: any) => role.roleTypeId === "PLACING_CUSTOMER") || null;
    },

    customerPartyIdByOrderId(): (orderId: string) => string {
      return (orderId: string) => this.placingCustomerRoleByOrderId(orderId)?.partyId || "";
    },

    customerNameByOrderId(): (orderId: string) => string {
      return (orderId: string) => {
        const role = this.placingCustomerRoleByOrderId(orderId);
        const person = role?.person;
        if (person && (person.firstName || person.lastName)) {
          return [person.firstName, person.lastName].filter(Boolean).join(" ");
        }
        if (role?.partyGroup?.groupName) return role.partyGroup.groupName;

        const current = this.orderById(orderId);
        const shipping = (current?.contactMechs || []).find(
          (mech: any) => mech.contactMechPurposeTypeId === "SHIPPING_LOCATION"
        );
        return shipping?.postalAddress?.toName || "";
      };
    },

    /**
     * Every OrderStatus row for the order, newest first — header and item level, with
     * statusDatetime, statusUserLogin and changeReason.
     *
     * These come from the order document itself: the OrderHeader `default` master
     * declares `<detail relationship="statuses"/>` with no field restriction, so the
     * rows arrive complete. Verified against rails-uat — identical to what
     * `GET oms/orders/{id}/status` returns, so there is nothing to fetch separately.
     */
    statusHistoryByOrderId: (state) => (orderId: string) =>
      (state.byOrderId[orderId]?.payload?.statuses || [])
        .slice()
        .sort((left: any, right: any) => eventMillis(right.statusDatetime) - eventMillis(left.statusDatetime)),

    headerStatusesByOrderId(): (orderId: string) => any[] {
      return (orderId: string) => this.statusHistoryByOrderId(orderId)
        .filter((status: any) => (status.orderItemSeqId || HEADER_SEQ_ID) === HEADER_SEQ_ID);
    },

    /** Item-scoped status rows — the per-item cancel/reject history the header rows never show. */
    itemStatusesByOrderId(): (orderId: string) => any[] {
      return (orderId: string) => this.statusHistoryByOrderId(orderId)
        .filter((status: any) => (status.orderItemSeqId || HEADER_SEQ_ID) !== HEADER_SEQ_ID);
    },

    /** Item cancel/reject status rows collapsed to one event per action, oldest first. */
    itemStatusEventsByOrderId(): (orderId: string) => ItemStatusEvent[] {
      return (orderId: string) => clusterItemStatuses(this.itemStatusesByOrderId(orderId));
    },

    /** OrderFacilityChange rows collapsed to one event per operation, oldest first. */
    facilityChangeEventsByOrderId: (state) => (orderId: string) =>
      clusterFacilityChanges(state.facilityChangesByOrderId[orderId] || []),

    /** Count and last date of the UNFILLABLE brokering attempts, or null when there were none. */
    unfillableAttemptsByOrderId: (state) => (orderId: string) =>
      state.unfillableByOrderId[orderId] || null,

    /**
     * Issuance summary per orderItemSeqId, or null until the rows have loaded. Null and
     * "issued nothing" are different answers — a failed or pending fetch must not be
     * read as "inventory was never issued".
     */
    issuanceByItemSeqIdByOrderId: (state) => (orderId: string) =>
      state.issuanceStatusByOrderId[orderId] === "loaded" ? (state.issuanceByOrderId[orderId] || {}) : null,

    contactMechsByPurposeByOrderId: (state) => (orderId: string) => {
      const current = state.byOrderId[orderId]?.payload;
      const index: Record<string, any> = {};
      (current?.contactMechs || []).forEach((mech: any) => {
        if (mech.contactMechPurposeTypeId) index[mech.contactMechPurposeTypeId] = mech;
      });
      return index;
    },

    contactMechsByIdByOrderId: (state) => (orderId: string) => {
      const current = state.byOrderId[orderId]?.payload;
      const index: Record<string, any> = {};
      (current?.contactMechs || []).forEach((mech: any) => {
        if (mech.contactMechId) index[mech.contactMechId] = mech;
      });
      return index;
    },

    returnedQtyByItemSeqIdByOrderId: (state) => (orderId: string) => {
      const current = state.byOrderId[orderId]?.payload;
      const totals: Record<string, number> = {};
      (current?.returnItems || []).forEach((item: any) => {
        const seqId = item.orderItemSeqId;
        if (seqId) totals[seqId] = (totals[seqId] || 0) + Number(item.returnQuantity || 0);
      });
      return totals;
    },

    orderTotalsByOrderId: (state) => (orderId: string) => {
      const current = state.byOrderId[orderId]?.payload;
      if (!current) return { subtotal: 0, adjustments: {}, total: 0 };

      let subtotal = 0;
      (current.shipGroups || []).forEach((sg: any) => {
        (sg.items || []).forEach((item: any) => {
          subtotal += Number(item.unitPrice || 0) * Number(item.quantity || 0);
        });
      });

      const adjustments: Record<string, number> = {};
      let adjustmentsTotal = 0;
      const seenAdjustments = new Set<string>();

      const recordAdjustment = (adj: any, fallbackSeqId = "") => {
        const uniqueKey = adjustmentUniqueKey(adj, fallbackSeqId);
        if (seenAdjustments.has(uniqueKey)) return;
        seenAdjustments.add(uniqueKey);

        const amount = Number(adj.amount || 0);
        adjustmentsTotal += amount;

        const label = adjustmentDisplayLabel(adj);
        adjustments[label] = (adjustments[label] || 0) + amount;
      };

      (current.adjustments || []).forEach((adj: any) => recordAdjustment(adj));

      (current.shipGroups || []).forEach((sg: any) => {
        (sg.items || []).forEach((item: any) => {
          (item.adjustments || []).forEach((adj: any) => recordAdjustment(adj, item.orderItemSeqId));
        });
      });

      // Filter out zero-sum adjustments
      Object.keys(adjustments).forEach((key) => {
        if (adjustments[key] === 0) {
          delete adjustments[key];
        }
      });

      const computedTotal = Math.round((subtotal + adjustmentsTotal) * 100) / 100;
      const total = computedTotal || current.grandTotal || 0;

      return { subtotal, adjustments, total };
    },

    allItemsByOrderId: (state) => (orderId: string) => {
      const current = state.byOrderId[orderId]?.payload;
      return (current?.shipGroups || []).flatMap((shipGroup: any) =>
        (shipGroup.items || []).map((item: any) => ({
          ...item,
          shipGroupSeqId: shipGroup.shipGroupSeqId,
          facilityId: shipGroup.facilityId
        }))
      );
    },

    timelineByShipGroupByOrderId: (state) => (orderId: string) => {
      const index: Record<string, any> = {};
      const timeline = state.fulfillmentTimelineByOrderId[orderId] || [];
      timeline.forEach((entry: any) => {
        if (entry.shipGroupSeqId) index[entry.shipGroupSeqId] = entry;
      });
      return index;
    },

    /** Order-header timeline: status rows that are NOT item-scoped, newest first. */
    headerStatuses(): any[] {
      return this.headerStatusesByOrderId(this.currentOrderId);
    },

    /** Item cancel/reject events for the current order, oldest first. */
    itemStatusEvents(): ItemStatusEvent[] {
      return this.itemStatusEventsByOrderId(this.currentOrderId);
    },

    /** Facility-change events for the current order, oldest first. */
    facilityChangeEvents(): FacilityChangeEvent[] {
      return this.facilityChangeEventsByOrderId(this.currentOrderId);
    },

    /** Unfillable brokering summary for the current order, or null. */
    unfillableAttempts(): UnfillableSummary | null {
      return this.unfillableAttemptsByOrderId(this.currentOrderId);
    },

    /** Contact mechs indexed by purpose (ORDER_EMAIL, SHIPPING_LOCATION, BILLING_LOCATION, …). */
    contactMechsByPurpose(): Record<string, any> {
      const index: Record<string, any> = {};
      (this.current?.contactMechs || []).forEach((mech: any) => {
        if (mech.contactMechPurposeTypeId) index[mech.contactMechPurposeTypeId] = mech;
      });
      return index;
    },

    /** Contact mechs indexed by contactMechId — used to resolve a ship group's address. */
    contactMechsById(): Record<string, any> {
      const index: Record<string, any> = {};
      (this.current?.contactMechs || []).forEach((mech: any) => {
        if (mech.contactMechId) index[mech.contactMechId] = mech;
      });
      return index;
    },

    /** The placing-customer order role (carries party + joined person/partyGroup). */
    placingCustomerRole(): any {
      return (this.current?.roles || []).find((role: any) => role.roleTypeId === "PLACING_CUSTOMER") || null;
    },

    /** partyId of the placing customer, for any party-scoped UI. */
    customerPartyId(): string {
      return this.placingCustomerRole?.partyId || "";
    },

    /**
     * Customer name from the joined Person/PartyGroup on the placing-customer role
     * (requires the extended OrderRole master — see docs/MoquiChanges.md). Falls back to
     * the shipping address `toName` until that master change is deployed, then "".
     */
    customerName(): string {
      const role = this.placingCustomerRole;
      const person = role?.person;
      if (person && (person.firstName || person.lastName)) {
        return [person.firstName, person.lastName].filter(Boolean).join(" ");
      }
      if (role?.partyGroup?.groupName) return role.partyGroup.groupName;

      const shipping = (this.current?.contactMechs || []).find(
        (mech: any) => mech.contactMechPurposeTypeId === "SHIPPING_LOCATION"
      );
      return shipping?.postalAddress?.toName || "";
    },

    /** Returned quantity summed by orderItemSeqId — crosses the top-level returnItems array. */
    returnedQtyByItemSeqId(): Record<string, number> {
      const totals: Record<string, number> = {};
      (this.current?.returnItems || []).forEach((item: any) => {
        const seqId = item.orderItemSeqId;
        if (!seqId) return;
        totals[seqId] = (totals[seqId] || 0) + Number(item.returnQuantity || 0);
      });
      return totals;
    },

    /** Maps orderItemSeqId to its orderItemExternalId. */
    itemExternalIdBySeqId(): Record<string, string> {
      const map: Record<string, string> = {};
      const productCache = useProductCacheStore();
      
      (this.current?.shipGroups || []).forEach((sg: any) => {
        (sg.items || []).forEach((item: any) => {
          const seqId = item.orderItemSeqId;
          if (seqId) {
            const product = productCache.getProduct(item.productId);
            const sku = product?.sku || item.productId;
            map[seqId] = item.externalId || sku || seqId;
          }
        });
      });
      return map;
    },

    /** Adjustments grouped by orderItemExternalId and comment, summing their amounts. */
    adjustmentsByExternalId(): Record<string, Record<string, number>> {
      const index: Record<string, Record<string, number>> = {};
      const seqIdToExtId = this.itemExternalIdBySeqId;
      const seenAdjustments = new Set<string>();

      const recordAdj = (seqId: string, adj: any) => {
        const extId = seqIdToExtId[seqId] || seqId;
        if (!extId) return;
        const uniqueKey = `${extId}:${adjustmentUniqueKey(adj, seqId)}`;
        if (seenAdjustments.has(uniqueKey)) return;
        seenAdjustments.add(uniqueKey);
        const comment = adjustmentDisplayLabel(adj);
        if (!index[extId]) index[extId] = {};
        index[extId][comment] = (index[extId][comment] || 0) + Number(adj.amount || 0);
      };

      // 1. Process top-level adjustments (which carry orderItemSeqId)
      (this.current?.adjustments || []).forEach((adj: any) => {
        const seqId = adj.orderItemSeqId;
        if (!seqId || seqId === HEADER_SEQ_ID) return;
        recordAdj(seqId, adj);
      });

      // 2. Process nested ship group item adjustments
      (this.current?.shipGroups || []).forEach((sg: any) => {
        (sg.items || []).forEach((item: any) => {
          const seqId = item.orderItemSeqId;
          if (!seqId) return;
          (item.adjustments || []).forEach((adj: any) => {
            recordAdj(seqId, adj);
          });
        });
      });

      return index;
    },

    /** Rolled up item price totals (sum of unitPrice * quantity) grouped by orderItemExternalId */
    totalsByExternalId(): Record<string, number> {
      const totals: Record<string, number> = {};
      const seqIdToExtId = this.itemExternalIdBySeqId;

      (this.current?.shipGroups || []).forEach((sg: any) => {
        (sg.items || []).forEach((item: any) => {
          const seqId = item.orderItemSeqId;
          const extId = seqIdToExtId[seqId] || seqId;
          if (!extId) return;
          const unitPrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 0);
          totals[extId] = (totals[extId] || 0) + (unitPrice * quantity);
        });
      });

      return totals;
    },

    /** Rolled up item quantities grouped by orderItemExternalId */
    quantitiesByExternalId(): Record<string, number> {
      const quantities: Record<string, number> = {};
      const seqIdToExtId = this.itemExternalIdBySeqId;

      (this.current?.shipGroups || []).forEach((sg: any) => {
        (sg.items || []).forEach((item: any) => {
          const seqId = item.orderItemSeqId;
          const extId = seqIdToExtId[seqId] || seqId;
          if (!extId) return;
          quantities[extId] = (quantities[extId] || 0) + Number(item.quantity || 0);
        });
      });

      return quantities;
    },

    /** Order totals (subtotal, adjustments grouped by comment/type, total) */
    totals(): { subtotal: number; adjustments: Record<string, number>; total: number } {
      if (!this.current) return { subtotal: 0, adjustments: {}, total: 0 };

      let subtotal = 0;
      (this.current.shipGroups || []).forEach((sg: any) => {
        (sg.items || []).forEach((item: any) => {
          subtotal += Number(item.unitPrice || 0) * Number(item.quantity || 0);
        });
      });

      const adjustments: Record<string, number> = {};
      let adjustmentsTotal = 0;
      const seenAdjustments = new Set<string>();

      const recordAdjustment = (adj: any, fallbackSeqId = "") => {
        const uniqueKey = adjustmentUniqueKey(adj, fallbackSeqId);
        if (seenAdjustments.has(uniqueKey)) return;
        seenAdjustments.add(uniqueKey);

        const amount = Number(adj.amount || 0);
        adjustmentsTotal += amount;

        const label = adjustmentDisplayLabel(adj);
        adjustments[label] = (adjustments[label] || 0) + amount;
      };

      (this.current.adjustments || []).forEach((adj: any) => recordAdjustment(adj));

      (this.current.shipGroups || []).forEach((sg: any) => {
        (sg.items || []).forEach((item: any) => {
          (item.adjustments || []).forEach((adj: any) => recordAdjustment(adj, item.orderItemSeqId));
        });
      });

      // Filter out zero-sum adjustments
      Object.keys(adjustments).forEach((key) => {
        if (adjustments[key] === 0) {
          delete adjustments[key];
        }
      });

      // Sum the rows actually displayed (subtotal + every adjustment, including tax) rather than
      // trusting the backend's grandTotal, which has been observed to exclude tax. Round to avoid
      // floating-point drift (e.g. 59 + 1.53 + 0.59 + 2.86 = 63.980000000000004).
      const computedTotal = Math.round((subtotal + adjustmentsTotal) * 100) / 100;
      const total = computedTotal || this.current.grandTotal || 0;

      return { subtotal, adjustments, total };
    },

    /** Flat list of all items across ship groups, each carrying its ship group context. */
    allItems(): any[] {
      return (this.current?.shipGroups || []).flatMap((shipGroup: any) =>
        (shipGroup.items || []).map((item: any) => ({
          ...item,
          shipGroupSeqId: shipGroup.shipGroupSeqId,
          facilityId: shipGroup.facilityId
        }))
      );
    },

    /** Fulfillment timeline indexed by shipGroupSeqId for O(1) lookup in the template. */
    timelineByShipGroup: (state): Record<string, any> => {
      const index: Record<string, any> = {};
      state.fulfillmentTimeline.forEach((entry: any) => {
        if (entry.shipGroupSeqId) index[entry.shipGroupSeqId] = entry;
      });
      return index;
    },

    openHolds: (state) => state.orderHeaderWorkEfforts,

    hasOpenHolds(): boolean {
      return this.openHolds.length > 0;
    },

    riskAssessments: (state): any[] => state.riskAssessmentsByOrderId[state.currentOrderId] || [],
    riskAssessmentsStatus: (state): LoadStatus => state.riskAssessmentsStatusByOrderId[state.currentOrderId] || "idle",
    riskAssessmentsError: (state): string => state.riskAssessmentsErrorByOrderId[state.currentOrderId] || "",

    /** Shipping methods for a given carrier partyId, derived from the fetched carrierShipmentMethods list or local cache. */
    shippingMethodsByCarrier: (state) => (carrierPartyId: string) => {
      const fromDetail = state.shippingMethods.filter((m: any) => m.partyId === carrierPartyId || m.carrierPartyId === carrierPartyId);
      if (fromDetail.length) return fromDetail;
      try {
        const seedStore = useSeedStore();
        return seedStore.shippingMethodsByCarrier(carrierPartyId);
      } catch {
        return [];
      }
    },
  },
  actions: {
    async fetchOrder(orderId: string, force = false) {
      if (!orderId) return;

      // Read the entry back through the store so `entry` is the reactive proxy — mutating a
      // captured raw object bypasses reactivity and the UI never updates off "loading".
      if (!this.byOrderId[orderId]) this.byOrderId[orderId] = newEntry();
      const entry = this.byOrderId[orderId];
      if (entry.status === "loaded" && !force) return;
      if (entry.status === "loading") return;

      entry.status = "loading";
      entry.error = "";

      try {
        const resp = await useOrderDetail().getOrder(orderId);
        if (commonUtil.hasError(resp)) throw resp.data;

        const payload = Array.isArray(resp.data) ? resp.data[0] : resp.data;
        if (!payload) {
          // HTTP 200 with no order row means this orderId is not in the order database.
          // Most common cause: a stale search index (Solr) still lists an order that no
          // longer exists — the queue/search shows it, but GET oms/orders returns nothing.
          // Surface this as "not found" (distinct from a genuine load failure) so the UI
          // and logs are precise instead of a generic "failed to load".
          logger.warn(`Order [${orderId}] not found in the database — GET oms/orders?orderId=${orderId}&dependentLevels=1 returned no order row (likely a stale search-index entry pointing at a deleted/missing order).`);
          entry.status = "notfound";
          entry.error = "";
          entry.payload = null;
          entry.loadedAt = new Date().toISOString();
          return;
        }

        entry.payload = payload;
        entry.status = "loaded";
        entry.loadedAt = new Date().toISOString();
      } catch (error: any) {
        logger.error(`Failed to load order detail for [${orderId}]`, error);
        entry.status = "error";
        entry.error = error?.message || "Failed to load order";
      }
    },
    async fetchOrderHeaderWorkEfforts(orderId: string) {
      if (!orderId) return;
      try {
        const resp = await useOrderDetail().getWorkEfforts(orderId);
        if (commonUtil.hasError(resp)) throw resp.data;
        const docs = Array.isArray(resp.data) ? resp.data : (resp.data?.docs || []);
        this.orderHeaderWorkEffortsByOrderId[orderId] = docs;
        this.orderHeaderWorkEfforts = docs;
      } catch (error: any) {
        logger.error("Failed to load work efforts", error);
      }
    },

    async fetchFulfillmentTimeline(orderId: string) {
      if (!orderId) return;
      try {
        const resp = await api({ url: `oms/orders/${orderId}/fulfillmentTimeline`, method: 'GET' });
        if (commonUtil.hasError(resp)) throw resp.data;
        const docs = Array.isArray(resp.data) ? resp.data : (resp.data?.timeline ?? resp.data?.docs ?? []);
        this.fulfillmentTimelineByOrderId[orderId] = docs;
        this.fulfillmentTimeline = docs;
      } catch (error: any) {
        logger.error('Failed to load fulfillment timeline', error);
      }
    },

    /**
     * Load the order's event history: OrderStatus rows, OrderFacilityChange rows,
     * and the UNFILLABLE attempt summary. Each call is settled independently so a
     * failure in one source only costs the timeline that source's entries.
     */
    async fetchOrderEvents(orderId: string, force = false) {
      if (!orderId) return;
      if (this.orderEventsStatusByOrderId[orderId] === "loaded" && !force) return;
      if (this.orderEventsStatusByOrderId[orderId] === "loading") return;

      this.orderEventsStatusByOrderId[orderId] = "loading";
      const orderDetail = useOrderDetail();

      // OrderStatus rows are not fetched here — they already arrive complete on the
      // order document. See statusHistoryByOrderId.
      const [facilityChanges, unfillable] = await Promise.allSettled([
        orderDetail.getFacilityChanges(orderId),
        orderDetail.getUnfillableAttempts(orderId)
      ]);

      if (facilityChanges.status === "fulfilled" && !commonUtil.hasError(facilityChanges.value)) {
        this.facilityChangesByOrderId[orderId] = responseList(facilityChanges.value.data);
      } else {
        logger.error(`Failed to load order facility changes for [${orderId}]`, facilityChanges);
      }

      if (unfillable.status === "fulfilled" && !commonUtil.hasError(unfillable.value)) {
        const rows = responseList(unfillable.value.data);
        // rows[0] is the newest, so it dates the last attempt. The count is of runs, not
        // rows, and is a floor when the sample filled its page — X-Total-Count would not
        // help here even when readable, since it counts rows.
        const count = countUnfillableAttempts(rows);
        if (count > 0) {
          this.unfillableByOrderId[orderId] = {
            count,
            atLeast: rows.length >= UNFILLABLE_SAMPLE_SIZE,
            lastAttemptDate: rows[0].changeDatetime
          };
        } else {
          delete this.unfillableByOrderId[orderId];
        }
      } else {
        logger.error(`Failed to load unfillable brokering attempts for [${orderId}]`, unfillable);
      }

      this.orderEventsStatusByOrderId[orderId] = facilityChanges.status === "fulfilled" ? "loaded" : "error";
    },

    /**
     * Load how much of each order item inventory was issued for. Rows are per inventory
     * item, so a line split across inventory items — or a marketing package that issues
     * its components — contributes several rows to the same order item.
     */
    async fetchInventoryIssuance(orderId: string, force = false) {
      if (!orderId) return;
      if (this.issuanceStatusByOrderId[orderId] === "loaded" && !force) return;
      if (this.issuanceStatusByOrderId[orderId] === "loading") return;

      this.issuanceStatusByOrderId[orderId] = "loading";
      try {
        const resp = await useOrderDetail().getInventoryIssuance(orderId);
        if (commonUtil.hasError(resp)) throw resp.data;

        this.issuanceByOrderId[orderId] = summariseIssuance(responseList(resp.data));
        this.issuanceStatusByOrderId[orderId] = "loaded";
      } catch (error: any) {
        logger.error(`Failed to load inventory issuance for [${orderId}]`, error);
        this.issuanceStatusByOrderId[orderId] = "error";
      }
    },

    async fetchCommEvents(orderId: string) {
      if (!orderId) return;
      try {
        const resp = await useOrderDetail().getCommunicationEvents(orderId);
        if (commonUtil.hasError(resp)) throw resp.data;
        const docs = Array.isArray(resp.data) ? resp.data : (resp.data?.docs || []);
        this.commEventsByOrderId[orderId] = docs;
        this.commEvents = docs;
      } catch (error: any) {
        logger.error("Failed to load communication events", error);
      }
    },

    async fetchRiskAssessments(orderId: string, force = false) {
      if (!orderId) return;
      if (this.riskAssessmentsStatusByOrderId[orderId] === "loaded" && !force) return;
      if (this.riskAssessmentsStatusByOrderId[orderId] === "loading") return;

      this.riskAssessmentsStatusByOrderId[orderId] = "loading";
      this.riskAssessmentsErrorByOrderId[orderId] = "";

      try {
        const resp = await useOrderDetail().getRiskAssessments(orderId);
        if (commonUtil.hasError(resp)) throw resp.data;
        this.riskAssessmentsByOrderId[orderId] = Array.isArray(resp.data) ? resp.data : (resp.data?.docs || []);
        this.riskAssessmentsStatusByOrderId[orderId] = "loaded";
      } catch (error: any) {
        logger.error("Failed to load order risk assessments", error);
        this.riskAssessmentsStatusByOrderId[orderId] = "error";
        this.riskAssessmentsErrorByOrderId[orderId] = error?.message || "Failed to load order risk assessments";
      }
    },

    async fetchShippingMethods() {
      try {
        const resp = await api({ url: 'oms/shippingGateways/carrierShipmentMethods', method: 'GET' });
        this.shippingMethods = Array.isArray(resp.data) ? resp.data : [];
      } catch (error: any) {
        logger.error('Failed to load shipping methods', error);
      }
    },
    async fetchCarrierParties() {
      try {
        const resp = await api({ url: 'oms/shippingGateways/carrierParties', method: 'GET', params: { roleTypeId: 'CARRIER' } });
        this.carrierParties = Array.isArray(resp.data) ? resp.data : [];
      } catch (error: any) {
        logger.error('Failed to load carrier parties', error);
      }
    },
    async updateShipmentCarrierAndMethod(orderId: string, shipGroupSeqId: string, shipmentMethodTypeId: string, carrierPartyId: string) {
      try {
        await api({
          url: `oms/orders/${orderId}/shipGroups/${shipGroupSeqId}`,
          method: 'PUT',
          data: { shipmentMethodTypeId, carrierPartyId },
        });
      } catch (error: any) {
        logger.error('Failed to update carrier/method', error);
        throw error;
      }
    },
    async bulkCreateOrderTasks(orderIds: string[], taskData: { workEffortTypeId: string; workEffortPurposeTypeId: string; workEffortName: string; description: string }) {
      const shipGroupsByOrder = await Promise.all(
        orderIds.map(async (orderId) => {
          const resp = await api({ url: `oms/orders/${orderId}/shipGroups`, method: 'GET' });
          const shipGroups: any[] = Array.isArray(resp.data) ? resp.data : (resp.data?.docs ?? []);
          return {
            orderId,
            shipGroupSeqIds: shipGroups.map((shipGroup) => shipGroup.shipGroupSeqId).filter(Boolean)
          };
        })
      );
      const payload = shipGroupsByOrder
        .flatMap(({ orderId, shipGroupSeqIds }) => shipGroupSeqIds.map((shipGroupSeqId) => ({
          orderId,
          shipGroupSeqId,
          ...taskData,
          statusId: 'TASK_CREATED'
        })));
      return api({ url: 'oms/orders/tasks', method: 'POST', data: payload });
    },
    async bulkCancelOrders(orderIds: string[]) {
      const results = await Promise.all(orderIds.map(async (orderId) => {
        const orderResponse = await useOrderDetail().getOrder(orderId);
        if (commonUtil.hasError(orderResponse)) throw orderResponse.data;

        const order = orderPayload(orderResponse.data);
        const items = cancellableOrderItems(order);
        if (!items.length) return { orderId, cancelledItems: 0 };

        await api({
          url: `oms/orders/${orderId}/items/cancel`,
          method: 'POST',
          data: { items },
        });

        return { orderId, cancelledItems: items.length };
      }));

      return results;
    },
    async bulkUpdateShippingMethods(orderIds: string[], carrierPartyId: string, shipmentMethodTypeId: string) {
      await Promise.allSettled(
        orderIds.map((orderId) =>
          api({
            url: `oms/orders/updateShippingMethod`,
            method: 'POST',
            data: { orderId, carrierPartyId, shipmentMethodTypeId },
          })
        )
      );
    },
    async setCurrentOrder(orderId: string) {
      this.currentOrderId = orderId;
      await this.fetchOrder(orderId);
      this.fetchFulfillmentTimeline(orderId);
    },
    reset() {
      this.$reset();
    }
  },
  persist: false
});
