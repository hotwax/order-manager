import { defineStore } from "pinia";
import { api, commonUtil, logger, translate, useSolrSearch } from "@common";
import { seedData } from "@common/db";
import { FACILITY_CHANGE_PAGE_SIZE, UNFILLABLE_SAMPLE_SIZE, useOrderDetail, type IssuanceLine } from "@/composables/useOrderDetail";
import { useProductCacheStore } from "./productCache";
import { useCustomerStore } from "./customer";
import { useUserStore } from "./user";
import Actions from "@/authorization/actions";
import { escapeSolrValue } from "@/services/order";
import { getReturn } from "@/services/returns";
import { fetchOrderInventoryTransfers } from "@/services/inventoryTransfers";
import { enrichOrder, isPosCompletedShipGroup } from "@/utils/orderDetailEnrichment";
import { toMillis } from "@/utils/format";
import { type ItemIssuanceSummary, summariseIssuance } from "@/utils/inventoryIssuance";
import { OrderActionValidator } from "@/utils/OrderActionValidator";
import { buildOrderEvents, clusterEvents, type ExchangeChild, type OrderEvent, type UnfillableSummary } from "@/utils/orderEvents";
import { adjustmentAmount, adjustmentKey, adjustmentLabel } from "@/utils/orderAdjustments";
import type { EnrichedOrder } from "@/types/orderDetail";

type LoadStatus = "idle" | "loading" | "loaded" | "error" | "notfound";

interface OrderEntry {
  payload: any | null; // verbatim API response[0] — no transformation
  status: LoadStatus;
  loadedAt: string;
  error: string;
}

const HEADER_SEQ_ID = "_NA_";

/** Whether the sources behind an order's history are still loading, and whether one failed. */
export interface OrderHistoryStatus {
  loading: boolean;
  failed: boolean;
  /** The facility changes filled their page, so older moves are not shown. */
  truncated: boolean;
}

// Loads in flight, by source and order. A forced reload that arrives while one is running waits
// for it and then fetches again, so a reload right after an action never returns the stale rows.
const inFlight = new Map<string, Promise<void>>();

async function singleFlight(key: string, force: boolean, run: () => Promise<void>): Promise<void> {
  const running = inFlight.get(key);
  if (running) {
    if (!force) return running;
    await running.catch(() => undefined);
    const next = inFlight.get(key);
    if (next) return next;
  }
  const task = run().finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

// The brokering queue: a ship group waiting to be brokered sits on this facility id.
const QUEUE_FACILITY_ID = "_NA_";

/** Parking and queue facilities, where an item waits rather than being fulfilled. */
export function isVirtualFacilityId(facilityId: string): boolean {
  if (!facilityId || facilityId === QUEUE_FACILITY_ID) return true;
  const facilityTypeId = seedData.facility(facilityId)?.facilityTypeId;
  return OrderActionValidator.isVirtualFacility({
    facilityId,
    facilityTypeId,
    facilityParentTypeId: seedData.facilityType(facilityTypeId)?.parentTypeId,
  });
}

const newEntry = (): OrderEntry => ({ payload: null, status: "idle", loadedAt: "", error: "" });

const adjustmentDisplayLabel = (adj: any) =>
  adjustmentLabel(adj, seedData.orderAdjustmentTypeDescription, "OTHER_ADJUSTMENT");

const adjustmentUniqueKey = (adj: any, fallbackSeqId = "") =>
  adjustmentKey(adj, adjustmentDisplayLabel(adj), fallbackSeqId);

/**
 * Subtotal, adjustments grouped by label, and grand total. Sums the rows actually displayed
 * (subtotal + every adjustment, including tax) rather than trusting the backend's grandTotal,
 * which has been observed to exclude tax. Rounded to avoid floating-point drift
 * (e.g. 59 + 1.53 + 0.59 + 2.86 = 63.980000000000004).
 */
function orderTotals(order: any) {
  if (!order) return { subtotal: 0, adjustments: {}, total: 0, includedAdjustments: {} };

  let subtotal = 0;
  (order.shipGroups || []).forEach((sg: any) => {
    (sg.items || []).forEach((item: any) => {
      subtotal += Number(item.unitPrice || 0) * Number(item.quantity || 0);
    });
  });

  const adjustments: Record<string, number> = {};
  const includedAdjustments: Record<string, number> = {};
  let adjustmentsTotal = 0;
  const seenAdjustments = new Set<string>();

  const recordAdjustment = (adj: any, fallbackSeqId = "") => {
    const uniqueKey = adjustmentUniqueKey(adj, fallbackSeqId);
    if (seenAdjustments.has(uniqueKey)) return;
    seenAdjustments.add(uniqueKey);

    adjustmentsTotal += Number(adj.amount || 0);
    const { amount, isIncluded } = adjustmentAmount(adj);
    const label = adjustmentDisplayLabel(adj);

    // Included and excluded amounts stay in separate buckets: a label can carry both
    // (an included tax on one item, an ordinary one on another), and merging them would
    // label the ordinary amount "included" while it still adds to the grand total.
    const bucket = isIncluded ? includedAdjustments : adjustments;
    bucket[label] = (bucket[label] || 0) + amount;
  };

  (order.adjustments || []).forEach((adj: any) => recordAdjustment(adj));
  (order.shipGroups || []).forEach((sg: any) => {
    (sg.items || []).forEach((item: any) => {
      (item.adjustments || []).forEach((adj: any) => recordAdjustment(adj, item.orderItemSeqId));
    });
  });

  // Filter out zero-sum adjustments
  [adjustments, includedAdjustments].forEach((bucket) => {
    Object.keys(bucket).forEach((key) => {
      if (bucket[key] === 0) delete bucket[key];
    });
  });

  const computedTotal = Math.round((subtotal + adjustmentsTotal) * 100) / 100;
  return { subtotal, adjustments, total: computedTotal || order.grandTotal || 0, includedAdjustments };
}

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
    riskAssessmentsByOrderId: {} as Record<string, any[]>,
    riskAssessmentsStatusByOrderId: {} as Record<string, LoadStatus>,
    commEventsByOrderId: {} as Record<string, any[]>,
    shippingMethods: [] as any[],
    carrierParties: [] as any[],
    fulfillmentTimelineByOrderId: {} as Record<string, any[]>,
    // Order event sources behind the timeline. OrderStatus rows arrive on the order document;
    // OrderFacilityChange rows are the only other place OMS records who moved what and why.
    facilityChangesByOrderId: {} as Record<string, any[]>,
    facilityChangesTruncatedByOrderId: {} as Record<string, boolean>,
    unfillableByOrderId: {} as Record<string, UnfillableSummary>,
    historyStatusByOrderId: {} as Record<string, { loading: number; failed: boolean }>,
    // What inventory issuance did to each order item, keyed orderId -> orderItemSeqId.
    // Only loaded for orders that need it.
    issuanceByOrderId: {} as Record<string, Record<string, ItemIssuanceSummary>>,
    issuanceStatusByOrderId: {} as Record<string, LoadStatus>,
    exchangeChildrenByOrderId: {} as Record<string, ExchangeChild[]>,
    returnHeadersById: {} as Record<string, any | null>,
    // Inventory transfers requested for the order's items, by Order Manager, the Transfers app
    // or the regional broker.
    inventoryTransfersByOrderId: {} as Record<string, any[]>,
  }),
  getters: {
    /**
     * The order page's view model: the raw order document joined with the loaded auxiliary
     * sources (order events, issuance, risk, returns, transfers) and the seed,
     * product and customer caches. See utils/orderDetailEnrichment.
     */
    enrichedOrderByOrderId(): (orderId: string) => EnrichedOrder | null {
      return (orderId: string) => {
        const raw = this.orderById(orderId);
        if (!raw) return null;
        const customerPartyId = this.customerPartyIdByOrderId(orderId);
        return enrichOrder(raw, {
          totals: this.orderTotalsByOrderId(orderId),
          groupAdjustments: this.adjustmentsByExternalIdByOrderId(orderId),
          customerPartyId,
          customerName: this.customerNameByOrderId(orderId),
          customerProfile: customerPartyId ? useCustomerStore().getCustomer(customerPartyId) : null,
          events: this.orderEventsByOrderId(orderId),
          issuanceByItem: this.issuanceByItemSeqIdByOrderId(orderId),
          riskAssessments: this.riskAssessmentsForOrder(orderId),
          returnedQtyBySeqId: this.returnedQtyByItemSeqIdByOrderId(orderId),
          inventoryTransfers: this.inventoryTransfersByOrderId[orderId] || [],
        }, { seed: seedData, productCache: useProductCacheStore() });
      };
    },

    orderById: (state) => (orderId: string) => state.byOrderId[orderId]?.payload || null,
    /**
     * Whether an order's transfers have loaded. Until they have, every item looks like it has none,
     * so anything that must not duplicate a transfer waits for this.
     */
    inventoryTransfersLoaded: (state) => (orderId: string) => Array.isArray(state.inventoryTransfersByOrderId[orderId]),
    loadingById: (state) => (orderId: string) => state.byOrderId[orderId]?.status === "loading",
    errorById: (state) => (orderId: string) => state.byOrderId[orderId]?.error || "",
    /**
     * The order has not been answered yet: never requested, queued or in flight. Unlike
     * loadingById, a missing entry counts too, because callers ask before the fetch has started.
     */
    pendingById: (state) => (orderId: string) => {
      const status = state.byOrderId[orderId]?.status;
      return !status || status === "idle" || status === "loading";
    },
    commEventsForOrder: (state) => (orderId: string): any[] => state.commEventsByOrderId[orderId] || [],
    riskAssessmentsForOrder: (state) => (orderId: string): any[] => state.riskAssessmentsByOrderId[orderId] || [],

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
     * The order's history as typed events, oldest first: the OrderStatus rows on the order
     * document plus the facility changes, unfillable attempts, fulfillment dates, returns and
     * exchanges loaded beside it. See utils/orderEvents.
     */
    orderEventsByOrderId(): (orderId: string) => OrderEvent[] {
      return (orderId: string): OrderEvent[] => buildOrderEvents({
        order: this.byOrderId[orderId]?.payload || null,
        facilityChanges: this.facilityChangesByOrderId[orderId] || [],
        facilityChangesLoaded: Array.isArray(this.facilityChangesByOrderId[orderId]),
        facilityChangesTruncated: !!this.facilityChangesTruncatedByOrderId[orderId],
        unfillable: this.unfillableByOrderId[orderId] || null,
        fulfillment: this.fulfillmentTimelineByOrderId[orderId] || [],
        returnHeadersById: this.returnHeadersById,
        exchangeChildren: this.exchangeChildrenByOrderId[orderId] || [],
        isVirtualFacility: (facilityId: string) => isVirtualFacilityId(facilityId),
      });
    },

    orderHistoryStatus: (state) => (orderId: string): OrderHistoryStatus => ({
      loading: (state.historyStatusByOrderId[orderId]?.loading || 0) > 0,
      failed: !!state.historyStatusByOrderId[orderId]?.failed,
      truncated: !!state.facilityChangesTruncatedByOrderId[orderId],
    }),

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

    returnedQtyByItemSeqIdByOrderId: (state) => (orderId: string) => {
      const current = state.byOrderId[orderId]?.payload;
      const totals: Record<string, number> = {};
      (current?.returnItems || []).forEach((item: any) => {
        const seqId = item.orderItemSeqId;
        if (seqId) totals[seqId] = (totals[seqId] || 0) + Number(item.returnQuantity || 0);
      });
      return totals;
    },

    orderTotalsByOrderId(): (orderId: string) => ReturnType<typeof orderTotals> {
      return (orderId: string) => orderTotals(this.byOrderId[orderId]?.payload);
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

    /** Maps orderItemSeqId to its orderItemExternalId. */
    itemExternalIdBySeqIdByOrderId(): (orderId: string) => Record<string, string> {
      return (orderId: string) => {
        const map: Record<string, string> = {};
        const productCache = useProductCacheStore();
        (this.orderById(orderId)?.shipGroups || []).forEach((sg: any) => {
          (sg.items || []).forEach((item: any) => {
            const seqId = item.orderItemSeqId;
            if (!seqId) return;
            const sku = productCache.getProduct(item.productId)?.sku || item.productId;
            map[seqId] = item.externalId || sku || seqId;
          });
        });
        return map;
      };
    },

    /**
     * Adjustments grouped by orderItemExternalId, summing their amounts. Inclusion is carried
     * as metadata rather than baked into the label so the view can translate it at render time,
     * and so an included and an ordinary adjustment sharing a label stay separate rows.
     */
    adjustmentsByExternalIdByOrderId(): (orderId: string) => Record<string, Array<{ label: string; amount: number; isIncluded: boolean }>> {
      return (orderId: string) => {
        const current = this.orderById(orderId);
        const index: Record<string, Record<string, { label: string; amount: number; isIncluded: boolean }>> = {};
        const seqIdToExtId = this.itemExternalIdBySeqIdByOrderId(orderId);
        const seenAdjustments = new Set<string>();

        const recordAdj = (seqId: string, adj: any) => {
          const extId = seqIdToExtId[seqId] || seqId;
          if (!extId) return;
          const uniqueKey = `${extId}:${adjustmentUniqueKey(adj, seqId)}`;
          if (seenAdjustments.has(uniqueKey)) return;
          seenAdjustments.add(uniqueKey);

          const { amount, isIncluded } = adjustmentAmount(adj);
          const label = adjustmentDisplayLabel(adj);
          const bucketKey = isIncluded ? `${label}\u0000included` : label;
          const buckets = index[extId] ||= {};
          const bucket = buckets[bucketKey] ||= { label, amount: 0, isIncluded };
          bucket.amount += amount;
        };

        // 1. Top-level adjustments carry their orderItemSeqId
        (current?.adjustments || []).forEach((adj: any) => {
          const seqId = adj.orderItemSeqId;
          if (seqId && seqId !== HEADER_SEQ_ID) recordAdj(seqId, adj);
        });

        // 2. Adjustments nested under each ship group item
        (current?.shipGroups || []).forEach((sg: any) => {
          (sg.items || []).forEach((item: any) => {
            const seqId = item.orderItemSeqId;
            if (seqId) (item.adjustments || []).forEach((adj: any) => recordAdj(seqId, adj));
          });
        });

        return Object.fromEntries(
          Object.entries(index).map(([extId, buckets]) => [extId, Object.values(buckets)])
        );
      };
    },

    /** Shipping methods for a given carrier partyId, derived from the fetched carrierShipmentMethods list or the local database. */
    shippingMethodsByCarrier(): (carrierPartyId: string) => any[] {
      return (carrierPartyId: string) => {
        const fromDetail = this.shippingMethods.filter((m: any) => m.partyId === carrierPartyId || m.carrierPartyId === carrierPartyId);
        return fromDetail.length ? fromDetail : seedData.shipmentMethodsByCarrier(carrierPartyId);
      };
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
        entry.error = error?.message || translate("Failed to load order");
      }
    },
    /** Run one of the order's history loads, counting it in the history status. It says whether it worked. */
    async trackHistory(orderId: string, load: () => Promise<boolean>) {
      if (!this.historyStatusByOrderId[orderId]) this.historyStatusByOrderId[orderId] = { loading: 0, failed: false };
      const status = this.historyStatusByOrderId[orderId];
      status.loading++;
      try {
        if (!(await load())) status.failed = true;
      } finally {
        status.loading--;
      }
    },

    /** Picked, packed and shipped dates per ship group, from `get#OrderFulfillmentTimeline`. */
    async fetchFulfillmentTimeline(orderId: string, force = false) {
      if (!orderId) return;
      return singleFlight(`fulfillment:${orderId}`, force, () => this.trackHistory(orderId, async () => {
        try {
          const resp = await api({ url: `oms/orders/${orderId}/fulfillmentTimeline`, method: 'GET' });
          if (commonUtil.hasError(resp)) throw resp.data;
          this.fulfillmentTimelineByOrderId[orderId] = Array.isArray(resp.data) ? resp.data : (resp.data?.timeline ?? resp.data?.docs ?? []);
          return true;
        } catch (error: any) {
          logger.error('Failed to load fulfillment timeline', error);
          return false;
        }
      }));
    },

    /**
     * Load the order's facility changes and the UNFILLABLE attempt summary. Each call is settled
     * independently, so a failure in one source only costs the timeline that source's entries.
     * OrderStatus rows are not fetched here — they arrive complete on the order document.
     */
    async fetchOrderEvents(orderId: string, force = false) {
      if (!orderId) return;
      if (!force && Array.isArray(this.facilityChangesByOrderId[orderId])) return;

      return singleFlight(`events:${orderId}`, force, () => this.trackHistory(orderId, async () => {
        const orderDetail = useOrderDetail();
        const [facilityChanges, unfillable] = await Promise.allSettled([
          orderDetail.getFacilityChanges(orderId),
          orderDetail.getUnfillableAttempts(orderId)
        ]);

        const changesLoaded = facilityChanges.status === "fulfilled" && !commonUtil.hasError(facilityChanges.value);
        const unfillableLoaded = unfillable.status === "fulfilled" && !commonUtil.hasError(unfillable.value);
        if (changesLoaded) {
          const rows = responseList(facilityChanges.value.data);
          this.facilityChangesByOrderId[orderId] = rows;
          this.facilityChangesTruncatedByOrderId[orderId] = rows.length >= FACILITY_CHANGE_PAGE_SIZE;
        } else {
          logger.error(`Failed to load order facility changes for [${orderId}]`, facilityChanges);
        }

        if (unfillableLoaded) {
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
        return changesLoaded && unfillableLoaded;
      }));
    },

    /** Fetch the order's history again after a load failed. */
    async retryOrderHistory(orderId: string) {
      if (this.historyStatusByOrderId[orderId]) this.historyStatusByOrderId[orderId].failed = false;
      await Promise.all([
        this.fetchOrderEvents(orderId, true),
        this.fetchFulfillmentTimeline(orderId, true),
        this.fetchReturnHeaders(orderId, true),
        this.fetchExchangeChildren(orderId, true),
      ]);
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
        const lines = (this.orderById(orderId)?.shipGroups || [])
          .filter(isPosCompletedShipGroup)
          .flatMap((shipGroup: any) => (shipGroup.items || []).map((item: any) => ({ productId: item.productId, facilityId: shipGroup.facilityId })))
          .filter((line: IssuanceLine) => line.productId && line.facilityId);
        this.issuanceByOrderId[orderId] = summariseIssuance(await useOrderDetail().getInventoryIssuance(orderId, lines));
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
      } catch (error: any) {
        logger.error("Failed to load communication events", error);
      }
    },

    async fetchRiskAssessments(orderId: string, force = false) {
      if (!orderId) return;
      if (this.riskAssessmentsStatusByOrderId[orderId] === "loaded" && !force) return;
      if (this.riskAssessmentsStatusByOrderId[orderId] === "loading") return;

      this.riskAssessmentsStatusByOrderId[orderId] = "loading";

      try {
        const resp = await useOrderDetail().getRiskAssessments(orderId);
        if (commonUtil.hasError(resp)) throw resp.data;
        this.riskAssessmentsByOrderId[orderId] = Array.isArray(resp.data) ? resp.data : (resp.data?.docs || []);
        this.riskAssessmentsStatusByOrderId[orderId] = "loaded";
      } catch (error: any) {
        logger.error("Failed to load order risk assessments", error);
        this.riskAssessmentsStatusByOrderId[orderId] = "error";
      }
    },

    async fetchInventoryTransfers(orderId: string) {
      if (!orderId) return;
      try {
        this.inventoryTransfersByOrderId[orderId] = await fetchOrderInventoryTransfers(orderId);
      } catch (error: any) {
        logger.error(`Failed to load inventory transfers for [${orderId}]`, error);
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
    async updateShipGroup(orderId: string, shipGroupSeqId: string, data: Record<string, any>) {
      return api({ url: `oms/orders/${orderId}/shipGroups/${shipGroupSeqId}`, method: 'PUT', data });
    },
    async updateShipmentCarrierAndMethod(orderId: string, shipGroupSeqId: string, shipmentMethodTypeId: string, carrierPartyId: string) {
      try {
        await this.updateShipGroup(orderId, shipGroupSeqId, { shipmentMethodTypeId, carrierPartyId });
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
    /** Exchange orders created from this one, found by the `EXC-{orderName}-` name OMS gives them. */
    async fetchExchangeChildren(orderId: string, force = false) {
      const raw = this.orderById(orderId);
      if (!raw?.orderName) return;
      if (!force && orderId in this.exchangeChildrenByOrderId) return;

      return singleFlight(`exchanges:${orderId}`, force, () => this.trackHistory(orderId, async () => {
        try {
          const response = await useSolrSearch().runSolrQuery({
            json: {
              params: { rows: 50, q: '*:*' },
              filter: ['docType: ORDER', `orderName: ${escapeSolrValue(`EXC-${raw.orderName}-`)}*`]
            }
          });
          if (commonUtil.hasError(response)) throw response.data;
          const candidateIds = [...new Set(
            (response.data?.response?.docs || [])
              .map((doc: any) => String(doc.orderId || ''))
              .filter((candidateId: string) => candidateId && candidateId !== orderId)
          )] as string[];

          const children: ExchangeChild[] = [];
          await Promise.all(candidateIds.map(async (candidateId) => {
            await this.fetchOrder(candidateId);
            const payload = this.byOrderId[candidateId]?.payload;
            const assoc = (payload?.itemAssocs || []).find(
              (row: any) => row.orderItemAssocTypeId === 'EXCHANGE' && row.toOrderId === orderId
            );
            if (!assoc) return;

            const itemCount = (payload.shipGroups || [])
              .flatMap((shipGroup: any) => shipGroup.items || [])
              .reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
            children.push({
              orderId: candidateId,
              itemCount,
              facilityId: payload.originFacilityId && payload.originFacilityId !== QUEUE_FACILITY_ID ? payload.originFacilityId : '',
              value: toMillis(assoc.createdStamp) || toMillis(payload.orderDate) || 0
            });
          }));
          this.exchangeChildrenByOrderId[orderId] = children;
          return true;
        } catch (error) {
          logger.error('Failed to discover exchange orders for timeline', error);
          return false;
        }
      }));
    },
    /**
     * Return headers carry the return's own date (returnDate) and the facility it was processed at
     * (destinationFacilityId); the ReturnItem rows on the order document carry neither. null means
     * the header could not be loaded, and the timeline falls back to when the return was recorded.
     * Only users who may open the Returns pages (APP_ORDER_RETURN_VIEW) load them.
     */
    async fetchReturnHeaders(orderId: string, force = false) {
      if (!useUserStore().hasPermission(Actions.APP_ORDER_RETURN_VIEW)) return;
      const returnIds = [...new Set((this.orderById(orderId)?.returnItems || []).map((item: any) => item.returnId).filter(Boolean))] as string[];
      const pending = returnIds.filter((returnId) => force ? this.returnHeadersById[returnId] == null : !(returnId in this.returnHeadersById));
      if (!pending.length) return;

      return singleFlight(`returns:${orderId}`, force, () => this.trackHistory(orderId, async () => {
        let failed = false;
        await Promise.all(pending.map(async (returnId) => {
          this.returnHeadersById[returnId] = null;
          try {
            const header = await getReturn(returnId);
            if (header) this.returnHeadersById[returnId] = header;
          } catch (error) {
            failed = true;
            logger.debug(`Return header ${returnId} unavailable for the timeline`, error);
          }
        }));
        return !failed;
      }));
    },
    /**
     * Load an order and the sources behind its page. Only the order document is awaited; the
     * rest is fire-and-forget, so the page renders as soon as the order does and each section
     * fills in as its source lands.
     */
    async loadOrderAggregate(orderId: string, force = false) {
      if (!orderId) return;
      await this.fetchOrder(orderId, force);
      const raw = this.orderById(orderId);

      // A forced reload starts the history over, so an earlier failure stops showing.
      if (force && this.historyStatusByOrderId[orderId]) this.historyStatusByOrderId[orderId].failed = false;
      this.fetchFulfillmentTimeline(orderId, force);
      this.fetchOrderEvents(orderId, force);
      // A counter sale's only remaining question is whether inventory actually left the
      // books, so load the issuance rows for those orders and no others.
      if ((raw?.shipGroups || []).some(isPosCompletedShipGroup)) this.fetchInventoryIssuance(orderId, force);
      // Risk facts up front for risk-flagged orders, so the header Fraud risk card can show
      // its sentiment chips without waiting for the Holds tab.
      if (raw?.riskRecommendationEnumId || raw?.riskLevelEnumId) this.fetchRiskAssessments(orderId);
      this.fetchExchangeChildren(orderId);
      this.fetchReturnHeaders(orderId);
      this.fetchInventoryTransfers(orderId);
    },
    reset() {
      this.$reset();
    }
  },
  persist: false
});
