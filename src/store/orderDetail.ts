import { defineStore } from "pinia";
import { commonUtil } from "@common";
import logger from "@/logger";
import { useOrderDetail } from "@/composables/useOrderDetail";

type LoadStatus = "idle" | "loading" | "loaded" | "error";

interface OrderEntry {
  payload: any | null; // verbatim API response[0] — no transformation
  status: LoadStatus;
  loadedAt: string;
  error: string;
}

const HEADER_SEQ_ID = "_NA_";

const newEntry = (): OrderEntry => ({ payload: null, status: "idle", loadedAt: "", error: "" });

export const useOrderDetailStore = defineStore("orderDetail", {
  state: () => ({
    byOrderId: {} as Record<string, OrderEntry>,
    currentOrderId: ""
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

    /**
     * Order holds: the WorkEfforts joined via OrderHeaderWorkEffort, filtered to type ORDER_HOLD.
     * The nested workEffort omits its own id (parent key), so carry workEffortId from the link row.
     */
    holds(): any[] {
      return (this.current?.workEfforts || [])
        .filter((link: any) => link.workEffort && link.workEffort.workEffortTypeId === "ORDER_HOLD")
        .map((link: any) => ({ ...link.workEffort, workEffortId: link.workEffortId }));
    },

    /** Holds still open (not released). */
    openHolds(): any[] {
      return this.holds.filter((hold: any) => hold.statusId === "ORD_HOLD_OPEN");
    },

    hasOpenHolds(): boolean {
      return this.openHolds.length > 0;
    }
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
    async setCurrentOrder(orderId: string) {
      this.currentOrderId = orderId;
      await this.fetchOrder(orderId);
    },
    reset() {
      this.$reset();
    }
  },
  persist: false
});
