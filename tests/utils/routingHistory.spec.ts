import { DateTime } from "luxon";
import { describe, expect, it, vi } from "vitest";
import { summariseIssuance } from "@/utils/inventoryIssuance";
import {
  buildRoutingHistory, isShortAtLocation, isStockLocation, movementRequests, noInventoryImpact, routingEventKind, ruleLabel, stockAt,
} from "@/utils/routingHistory";

// One seeded facility: a parking lot whose id does not follow the *_PARKING convention.
vi.mock("@common/db", () => ({
  useSeedData: () => ({
    facility: (facilityId: string) => facilityId === "PARKING" ? { facilityId, facilityTypeId: "PARKING_LOT" } : undefined,
    facilityType: (facilityTypeId: string) => facilityTypeId === "PARKING_LOT" ? { facilityTypeId, parentTypeId: "VIRTUAL_FACILITY" } : undefined,
  }),
}));

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
    const moment = stockAt(rows, WAREHOUSE, t("2026-10-04T00:00:00Z"), "another-order", "01");
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

  it("knows a virtual location by its facility type, whatever its id", () => {
    expect(isStockLocation("PARKING")).toBe(false);
    expect(isStockLocation("REJECTED_ITM_PARKING")).toBe(false);
    expect(isStockLocation(WAREHOUSE)).toBe(true);
  });

  it("calls a Shopify sync's move into a parking lot parked, not allocated", () => {
    const shopifySync = { changeReasonEnumId: "ALLOCATED", fromFacilityId: "UNFILLABLE_PARKING", comments: "Shopify sync: could not reopen in-progress fulfillment order" };
    expect(routingEventKind({ ...shopifySync, facilityId: "REJECTED_ITM_PARKING" })).toBe("parked");
    expect(routingEventKind({ ...shopifySync, facilityId: "PARKING" })).toBe("parked");
    expect(routingEventKind({ ...shopifySync, facilityId: WAREHOUSE })).toBe("allocated");
    // Back to the brokering queue is not parking.
    expect(routingEventKind({ ...shopifySync, facilityId: "_NA_" })).toBe("requeued");
  });

  it("gives each unit of a split line its own stock change, not its siblings'", () => {
    // Three units of one line, brokered to the warehouse together: each reserved one.
    const units = ["01", "02", "03"];
    const unitRows = units.map((seq, index) => movement(`60${index}`, `2026-10-02T22:51:50.4${ index }Z`, {
      orderId: ORDER_ID, orderItemSeqId: seq, reasonEnumId: "INV_RES_CREATE",
      lastAvailableToPromise: 5 - index, availableToPromiseDiff: -1, lastQuantityOnHand: 5, quantityOnHandDiff: 0,
    }));
    const history = buildRoutingHistory({
      orderId: ORDER_ID,
      items: units.map((seq) => ({ ...item, orderItemSeqId: seq })),
      changes: units.map((seq) => ({ ...brokered, orderFacilityChangeId: `fc-${seq}`, orderItemSeqId: seq })),
      movements: { [`${PRODUCT}|${WAREHOUSE}`]: { rows: unitRows, truncated: false } },
      stock: { [`${PRODUCT}|${WAREHOUSE}`]: { atp: 2, qoh: 5 } },
    });

    expect(history.map((unit) => [unit.events[0].stock?.before, unit.events[0].stock?.after])).toEqual([[5, 4], [4, 3], [3, 2]]);
  });

  it("shows a counter sale's issuance, and the return after it, the way the ship group view reads it", () => {
    // Shaped on a store order that came in with its return: never routed, issued on import, and the
    // return received in the same instant. The two rows share a createdStamp; sequence orders them.
    const STORE = "100010";
    const sale = { orderItemSeqId: "01", productId: PRODUCT, facilityId: STORE, statusId: "ITEM_COMPLETED" };
    const issuanceRow = {
      inventoryItemDetailSeqId: "139820", inventoryItemId: "247224", productId: PRODUCT, facilityId: STORE, createdStamp: t("2026-08-17T08:19:24.276Z"),
      effectiveDate: t("2026-08-17T08:19:24.596Z"), orderId: ORDER_ID, orderItemSeqId: "01", itemIssuanceId: "100022",
      lastAvailableToPromise: 0, availableToPromiseDiff: -1, lastQuantityOnHand: 0, quantityOnHandDiff: -1,
    };
    const returnRow = {
      inventoryItemDetailSeqId: "139827", inventoryItemId: "247224", productId: PRODUCT, facilityId: STORE, createdStamp: t("2026-08-17T08:19:24.276Z"),
      effectiveDate: t("2026-08-17T08:19:24.897Z"), returnId: "100515", reasonEnumId: "RTN_ITM_RCPT",
      lastAvailableToPromise: -1, availableToPromiseDiff: 1, lastQuantityOnHand: -1, quantityOnHandDiff: 1,
    };
    const importedAt = t("2026-08-17T08:19:24.324Z");

    expect(movementRequests([sale], [], importedAt)).toEqual([{ productId: PRODUCT, facilityId: STORE, sinceMillis: importedAt }]);

    const [history] = buildRoutingHistory({
      orderId: ORDER_ID,
      items: [sale],
      changes: [],
      movements: { [`${PRODUCT}|${STORE}`]: { rows: [returnRow, issuanceRow], truncated: false } },
      stock: { [`${PRODUCT}|${STORE}`]: { atp: 0, qoh: 0 } },
    });

    expect(history.events).toHaveLength(1);
    expect(history.events[0]).toMatchObject({ kind: "issued", toFacilityId: STORE, stock: { before: 0, after: -1, onHand: -1, onHandBefore: 0, exact: true } });
    // The ship group view's issuance, from the same rows: the same answer.
    expect(summariseIssuance([issuanceRow, returnRow])["01"]).toEqual({ issued: 1, qohBefore: 0, qohAfter: -1 });
    expect(history.since?.movements.map((movement) => [movement.raw.reasonEnumId, movement.qohDiff, movement.qohAfter])).toEqual([["RTN_ITM_RCPT", 1, 0]]);
  });

  it("shows only today's stock for an item with neither a routing arrival nor an issuance", () => {
    const [history] = buildRoutingHistory({
      orderId: ORDER_ID,
      items: [item],
      changes: [],
      movements: { [`${PRODUCT}|${WAREHOUSE}`]: { rows, truncated: false } },
      stock: { [`${PRODUCT}|${WAREHOUSE}`]: { atp: -1, qoh: 1 } },
    });
    expect(history.events).toEqual([]);
    expect(history.since).toMatchObject({ movements: [], availableNow: -1, onHandNow: 1 });
  });

  it("explains an empty timeline: completed before go-live, or nothing moved yet", () => {
    // Shaped on a 2023 web order imported at launch: one unit arrived fulfilled, so nothing issued for it.
    const launchAt = t("2026-08-17T03:59:55Z");
    const completedEarly = { ...item, statusId: "ITEM_COMPLETED", completedAt: t("2023-03-06T03:45:09Z") };
    const empty = { orderItemSeqId: "01", productId: PRODUCT, facilityId: WAREHOUSE, events: [], since: null };

    expect(noInventoryImpact(completedEarly, empty, launchAt)).toEqual({ reason: "preLaunch", launchAt });
    expect(noInventoryImpact({ ...completedEarly, completedAt: t("2026-09-01T00:00:00Z") }, empty, launchAt)).toEqual({ reason: "none" });
    expect(noInventoryImpact(completedEarly, empty, null)).toEqual({ reason: "none" });
    expect(noInventoryImpact(item, empty, launchAt)).toEqual({ reason: "none" });
    expect(noInventoryImpact(item, { ...empty, events: [{} as any] }, launchAt)).toBeNull();
  });

  it("shows a reservation's change when its rows record no balance", () => {
    // The other unit of that line, allocated by a Shopify sync: its reservation row carries the diff only.
    const allocated = { ...brokered, orderFacilityChangeId: "fc9", changeReasonEnumId: "ALLOCATED", changeDatetime: t("2026-08-17T13:11:36.201Z") };
    const reservation = movement("141001", "2026-08-17T13:11:36.117Z", { orderId: ORDER_ID, orderItemSeqId: "01", reasonEnumId: "INV_RES_CREATE", availableToPromiseDiff: -1, quantityOnHandDiff: 0 });
    const [history] = buildRoutingHistory({
      orderId: ORDER_ID,
      items: [item],
      changes: [allocated],
      movements: { [`${PRODUCT}|${WAREHOUSE}`]: { rows: [reservation], truncated: false } },
      stock: {},
    });

    expect(history.events[0].stock).toMatchObject({ before: null, after: null, change: -1, exact: true });
  });

  it("reads SQL timestamps the same as epoch millis", () => {
    const sql = (millis: number) => DateTime.fromMillis(millis).toFormat("yyyy-MM-dd HH:mm:ss.SSS");
    const input = {
      orderId: ORDER_ID,
      items: [item],
      changes: [brokered],
      movements: { [`${PRODUCT}|${WAREHOUSE}`]: { rows, truncated: false } },
      stock: { [`${PRODUCT}|${WAREHOUSE}`]: { atp: -1, qoh: 1 } },
    };
    const asSql = {
      ...input,
      changes: [{ ...brokered, changeDatetime: sql(brokered.changeDatetime) }],
      movements: { [`${PRODUCT}|${WAREHOUSE}`]: { rows: rows.map((row) => ({ ...row, createdStamp: sql(row.createdStamp) })), truncated: false } },
    };
    const strip = (history: any) => ({ ...history, since: { ...history.since, movements: history.since.movements.map((movement: any) => ({ ...movement, raw: undefined })) } });

    expect(strip(buildRoutingHistory(asSql)[0])).toEqual(strip(buildRoutingHistory(input)[0]));
    expect(buildRoutingHistory(asSql)[0].events[0].at).toBe(brokered.changeDatetime);
  });

  it("cleans the stored rule name", () => {
    expect(ruleLabel("Primary : Standard Shipping : Warehouse]")).toBe("Primary › Standard Shipping › Warehouse");
    expect(ruleLabel(undefined)).toBe("");
  });
});
