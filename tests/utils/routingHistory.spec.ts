import { describe, expect, it } from "vitest";
import {
  buildRoutingHistory, isShortAtLocation, isStockLocation, movementRequests, ruleLabel, stockAt,
} from "@/utils/routingHistory";

// Shaped on a real order: brokered to the warehouse on the one unit an inventory reset had added,
// then a later reset took the warehouse to -1 while the item was still reserved there.
const ORDER_ID = "145309";
const WAREHOUSE = "100000";
const PRODUCT = "142557";
const t = (iso: string) => Date.parse(iso);

const item = { orderItemSeqId: "01", productId: PRODUCT, facilityId: WAREHOUSE, statusId: "ITEM_APPROVED" };

const brokered = {
  orderFacilityChangeId: "fc1", orderId: ORDER_ID, orderItemSeqId: "01", productId: PRODUCT,
  fromFacilityId: "_NA_", facilityId: WAREHOUSE, changeReasonEnumId: "BROKERED",
  changeDatetime: t("2026-10-02T22:51:50.496Z"), comments: "Primary : Inventory found for Warehouse.",
  routingRule: "Primary : Standard Shipping : Warehouse]",
};

const movement = (seq: string, iso: string, fields: Record<string, any>) => ({
  inventoryItemDetailSeqId: seq, inventoryItemId: "701163", productId: PRODUCT, facilityId: WAREHOUSE,
  createdStamp: t(iso), ...fields,
});

const rows = [
  movement("493946", "2026-10-02T07:23:26Z", { reasonEnumId: "VAR_EXT_RESET", lastAvailableToPromise: 1, availableToPromiseDiff: 3, lastQuantityOnHand: 4, quantityOnHandDiff: 3 }),
  movement("498313", "2026-10-02T21:12:51Z", { orderId: "145211", orderName: "#1012700", reasonEnumId: "INV_RES_CREATE", lastAvailableToPromise: 2, availableToPromiseDiff: -1, lastQuantityOnHand: 6, quantityOnHandDiff: 0, effectiveDate: t("2026-10-02T21:12:51Z") }),
  movement("499222", "2026-10-02T22:51:50.457Z", { orderId: ORDER_ID, orderName: "#1012730", reasonEnumId: "INV_RES_CREATE", lastAvailableToPromise: 1, availableToPromiseDiff: -1, lastQuantityOnHand: 4, quantityOnHandDiff: 0, effectiveDate: t("2026-10-02T22:51:50.479Z") }),
  movement("500440", "2026-10-03T07:23:40Z", { reasonEnumId: "VAR_EXT_RESET", lastAvailableToPromise: 0, availableToPromiseDiff: -1, lastQuantityOnHand: 4, quantityOnHandDiff: -1 }),
  movement("510897", "2026-10-05T23:22:00Z", { orderId: "145211", orderName: "#1012700", orderTypeId: "SALES_ORDER", lastAvailableToPromise: -1, availableToPromiseDiff: 0, lastQuantityOnHand: 3, quantityOnHandDiff: -1, effectiveDate: t("2026-10-05T23:22:00Z") }),
];

describe("routing history", () => {
  it("shows the stock a brokering saw, and what happened to that stock afterwards", () => {
    const [history] = buildRoutingHistory({
      orderId: ORDER_ID,
      items: [item],
      changes: [brokered],
      movements: { [`${PRODUCT}|${WAREHOUSE}`]: { rows, truncated: false } },
      stock: { [`${PRODUCT}|${WAREHOUSE}`]: { atp: -1, qoh: 1 } },
    });

    expect(history.events).toHaveLength(1);
    expect(history.events[0]).toMatchObject({
      kind: "brokered",
      rule: "Primary › Standard Shipping › Warehouse",
      actor: "Primary",
      stock: { facilityId: WAREHOUSE, before: 1, after: 0, onHand: 4, exact: true },
    });

    // The item's own reservation is the brokering itself, so "since" starts after it.
    expect(history.since?.movements.map((m) => [m.raw.inventoryItemDetailSeqId, m.atpAfter])).toEqual([["500440", -1], ["510897", -1]]);
    expect(history.since).toMatchObject({ facilityId: WAREHOUSE, availableNow: -1, onHandNow: 1, truncated: false });
  });

  it("places inventory resets by when they were recorded, since they carry no effective date", () => {
    const moment = stockAt(rows, WAREHOUSE, t("2026-10-04T00:00:00Z"), "another-order");
    expect(moment).toEqual({ facilityId: WAREHOUSE, before: -1, after: -1, onHand: 3, exact: false });
  });

  it("folds a run of unfillable attempts into one change", () => {
    const unfillable = (id: string, iso: string) => ({
      orderFacilityChangeId: id, orderItemSeqId: "01", fromFacilityId: "_NA_", facilityId: "UNFILLABLE_PARKING",
      changeReasonEnumId: "UNFILLABLE", changeDatetime: t(iso), routingRule: "Primary : Standard Shipping : Final Resort - Split Fullfillment]",
    });
    const [history] = buildRoutingHistory({
      orderId: ORDER_ID,
      items: [{ ...item, facilityId: "UNFILLABLE_PARKING" }],
      changes: [unfillable("u1", "2026-10-09T21:31:49Z"), unfillable("u2", "2026-10-09T21:50:47Z")],
      movements: {},
      stock: {},
    });
    expect(history.events).toHaveLength(1);
    expect(history.events[0]).toMatchObject({ kind: "unfillable", attempts: 2, stock: null });
    expect(history.since).toBeNull();
  });

  it("asks for each location the item touched, from the earliest change there", () => {
    const rejected = { ...brokered, orderFacilityChangeId: "fc2", fromFacilityId: WAREHOUSE, facilityId: "REJECTED_ITM_PARKING", changeReasonEnumId: "NOT_IN_STOCK", changeDatetime: t("2026-10-09T21:28:41Z") };
    expect(movementRequests([{ ...item, facilityId: "REJECTED_ITM_PARKING" }], [brokered, rejected])).toEqual([
      { productId: PRODUCT, facilityId: WAREHOUSE, sinceMillis: brokered.changeDatetime },
    ]);
  });

  it("flags only open items at a real location with negative stock", () => {
    const stock = { [`${PRODUCT}|${WAREHOUSE}`]: { atp: -1, qoh: 1 } };
    expect(isShortAtLocation(item, stock)).toBe(true);
    expect(isShortAtLocation({ ...item, statusId: "ITEM_COMPLETED" }, stock)).toBe(false);
    expect(isShortAtLocation({ ...item, facilityId: "UNFILLABLE_PARKING" }, stock)).toBe(false);
    expect(isShortAtLocation(item, { [`${PRODUCT}|${WAREHOUSE}`]: { atp: 0, qoh: 1 } })).toBe(false);
    expect(isStockLocation("_NA_")).toBe(false);
  });

  it("cleans the stored rule name", () => {
    expect(ruleLabel("Primary : Standard Shipping : Warehouse]")).toBe("Primary › Standard Shipping › Warehouse");
    expect(ruleLabel(undefined)).toBe("");
  });
});
