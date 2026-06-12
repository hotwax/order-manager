import { defineStore } from "pinia";
import { api, commonUtil } from "@common";
import logger from "@/logger";
import { useOrderDetail } from "@/composables/useOrderDetail";
import { useProductCacheStore } from "./productCache";

type LoadStatus = "idle" | "loading" | "loaded" | "error";

interface OrderEntry {
  payload: any | null; // verbatim API response[0] — no transformation
  status: LoadStatus;
  loadedAt: string;
  error: string;
}

const HEADER_SEQ_ID = "_NA_";

const newEntry = (): OrderEntry => ({ payload: null, status: "idle", loadedAt: "", error: "" });

const adjustmentDisplayLabel = (adj: any) =>
  adj.comments || adj.comment || adj.description || adj.orderAdjustmentTypeId || "OTHER_ADJUSTMENT";

const adjustmentUniqueKey = (adj: any, fallbackSeqId = "") =>
  adj.orderAdjustmentId || [
    fallbackSeqId || adj.orderItemSeqId || "",
    adj.shipGroupSeqId || "",
    adj.orderAdjustmentTypeId || "",
    adjustmentDisplayLabel(adj),
    Number(adj.amount || 0)
  ].join("|");

export const useOrderDetailStore = defineStore("orderDetail", {
  state: () => ({
    byOrderId: {} as Record<string, OrderEntry>,
    currentOrderId: "",
    orderHeaderWorkEfforts: [] as any[],
    riskAssessmentsByOrderId: {} as Record<string, any[]>,
    riskAssessmentsStatusByOrderId: {} as Record<string, LoadStatus>,
    riskAssessmentsErrorByOrderId: {} as Record<string, string>,
    commEvents: [] as any[],
    shippingMethods: [] as any[],
    carrierParties: [] as any[],
    fulfillmentTimeline: [] as any[],
  }),
  getters: {
    current: (state) => state.byOrderId[state.currentOrderId]?.payload || null,
    currentEntry: (state) => state.byOrderId[state.currentOrderId] || null,
    isLoading: (state) => state.byOrderId[state.currentOrderId]?.status === "loading",
    error: (state) => state.byOrderId[state.currentOrderId]?.error || "",

    /** Order-header timeline: status rows that are NOT item-scoped, newest first. */
    headerStatuses(): any[] {
      const statuses = this.current?.statuses || [];
      return statuses
        .filter((status: any) => (status.orderItemSeqId || HEADER_SEQ_ID) === HEADER_SEQ_ID)
        .slice()
        .sort((left: any, right: any) => Number(right.statusDatetime || 0) - Number(left.statusDatetime || 0));
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

      const total = this.current.grandTotal || (subtotal + adjustmentsTotal);

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

    /** Shipping methods for a given carrier partyId, derived from the fetched carrierShipmentMethods list. */
    shippingMethodsByCarrier: (state) => (carrierPartyId: string) =>
      state.shippingMethods.filter((m: any) => m.partyId === carrierPartyId || m.carrierPartyId === carrierPartyId),
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
        if (!payload) throw new Error("Order not found");

        entry.payload = payload;
        entry.status = "loaded";
        entry.loadedAt = new Date().toISOString();
      } catch (error: any) {
        logger.error("Failed to load order detail", error);
        entry.status = "error";
        entry.error = error?.message || "Failed to load order";
      }
    },
    async fetchOrderHeaderWorkEfforts(orderId: string) {
      if (!orderId) return;
      try {
        const resp = await useOrderDetail().getWorkEfforts(orderId);
        if (commonUtil.hasError(resp)) throw resp.data;
        this.orderHeaderWorkEfforts = Array.isArray(resp.data) ? resp.data : (resp.data?.docs || []);
      } catch (error: any) {
        logger.error("Failed to load work efforts", error);
      }
    },

    async fetchFulfillmentTimeline(orderId: string) {
      if (!orderId) return;
      try {
        const resp = await api({ url: `oms/orders/${orderId}/fulfillmentTimeline`, method: 'GET' });
        if (commonUtil.hasError(resp)) throw resp.data;
        this.fulfillmentTimeline = Array.isArray(resp.data) ? resp.data : (resp.data?.timeline ?? resp.data?.docs ?? []);
      } catch (error: any) {
        logger.error('Failed to load fulfillment timeline', error);
      }
    },

    async fetchCommEvents(orderId: string) {
      if (!orderId) return;
      try {
        const resp = await useOrderDetail().getCommunicationEvents(orderId);
        if (commonUtil.hasError(resp)) throw resp.data;
        this.commEvents = Array.isArray(resp.data) ? resp.data : (resp.data?.docs || []);
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
          return { orderId, shipGroupSeqId: shipGroups[0]?.shipGroupSeqId };
        })
      );
      const payload = shipGroupsByOrder
        .filter((item) => item.shipGroupSeqId)
        .map((item) => ({ ...item, ...taskData, statusId: 'TASK_CREATED' }));
      return api({ url: 'oms/orders/tasks', method: 'POST', data: payload });
    },
    async bulkCancelOrders(orderIds: string[]) {
      const payload = orderIds.map((orderId) => ({ orderId }));
      return api({ url: 'oms/orders/cancel', method: 'POST', data: payload });
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
