import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { ROUTING_FLOW_SIZE, buildRoutingFlow, estimateFlowHeight, layoutRoutingFlow } from "@/utils/routingFlow";

const t = (iso: string) => Date.parse(iso);
const change = (id: string, item: string, shipGroup: string, from: string, to: string, reason: string, iso: string, extra: Record<string, any> = {}) => ({
  orderFacilityChangeId: id, orderItemSeqId: item, shipGroupSeqId: shipGroup, fromFacilityId: from, facilityId: to,
  changeReasonEnumId: reason, changeDatetime: t(iso), ...extra,
});

describe("routing flow", () => {
  it("splits an imported ship group into the groups brokering created", () => {
    // Shaped on #1015608: six items imported into the queue, five brokered to the warehouse, one to a store.
    const items = ["01", "02", "03", "04", "05", "06"].map((id) => ({ orderItemSeqId: id, shipGroupSeqId: id === "01" ? "00003" : "00002" }));
    const changes = ["02", "03", "04", "05", "06"].map((id) => change(`b${id}`, id, "00002", "_NA_", "100000", "BROKERED", "2026-10-08T17:02:00Z", { routingRule: "Primary : Standard Shipping : Warehouse]", comments: "Primary : Inventory found for Warehouse." }))
      .concat([change("b01", "01", "00003", "_NA_", "100007", "BROKERED", "2026-10-08T17:02:01Z")]);

    const flow = buildRoutingFlow({
      items,
      shipGroups: [{ id: "00001", facilityId: "_NA_" }, { id: "00002", facilityId: "100000" }, { id: "00003", facilityId: "100007" }],
      changes,
      importedAt: t("2026-10-08T16:59:45Z"),
    });

    expect(flow.columns.map((column) => column.kind)).toEqual(["imported", "brokered"]);
    expect(flow.nodes.map((node) => [node.id, node.orderItemSeqIds.length, node.isCurrent])).toEqual([
      ["0-00001", 6, false],
      ["1-00002", 5, true],
      ["1-00003", 1, true],
    ]);
    expect(flow.edges.map((edge) => [edge.from, edge.to, edge.kind, edge.orderItemSeqIds.length, edge.rule])).toEqual([
      ["0-00001", "1-00002", "brokered", 5, "Primary › Standard Shipping › Warehouse"],
      ["0-00001", "1-00003", "brokered", 1, ""],
    ]);
  });

  it("follows an item through a rejection, and folds routing's retries into one step", () => {
    // Shaped on #1012730: brokered, rejected, unfillable, sent back to the queue, unfillable again.
    const flow = buildRoutingFlow({
      items: [{ orderItemSeqId: "01", shipGroupSeqId: "00004" }],
      shipGroups: [
        { id: "00001", facilityId: "_NA_" }, { id: "00002", facilityId: "100000" },
        { id: "00003", facilityId: "REJECTED_ITM_PARKING" }, { id: "00004", facilityId: "UNFILLABLE_PARKING" },
      ],
      changes: [
        change("c1", "01", "00002", "_NA_", "100000", "BROKERED", "2026-10-02T22:51:50Z"),
        change("c2", "01", "00003", "100000", "REJECTED_ITM_PARKING", "NOT_IN_STOCK", "2026-10-09T21:28:41Z", { changeUserLogin: "monica.thorbourne" }),
        change("c3", "01", "00004", "REJECTED_ITM_PARKING", "UNFILLABLE_PARKING", "UNFILLABLE", "2026-10-09T21:31:49Z"),
        change("c4", "01", "00001", "UNFILLABLE_PARKING", "_NA_", "ALLOCATED", "2026-10-09T21:48:46Z"),
        change("c5", "01", "00004", "_NA_", "UNFILLABLE_PARKING", "UNFILLABLE", "2026-10-09T21:50:47Z"),
      ],
      importedAt: t("2026-10-02T22:51:48Z"),
    });

    expect(flow.columns.map((column) => [column.kind, column.attempts])).toEqual([
      ["imported", 1], ["brokered", 1], ["rejected", 1], ["unfillable", 2],
    ]);
    expect(flow.nodes.map((node) => node.id)).toEqual(["0-00001", "1-00002", "2-00003", "3-00004"]);
    expect(flow.nodes[3].isCurrent).toBe(true);
    expect(flow.edges[1]).toMatchObject({ kind: "rejected", actor: "monica.thorbourne", reasonEnumId: "NOT_IN_STOCK" });
  });

  it("keeps a rejection that routing followed within seconds, and folds a Shopify detour between retries", () => {
    // Shaped on #1007732: rejected, unfillable 9 seconds later, moved by a Shopify sync, unfillable again.
    const flow = buildRoutingFlow({
      items: [{ orderItemSeqId: "01", shipGroupSeqId: "00004" }],
      shipGroups: [
        { id: "00001", facilityId: "_NA_" }, { id: "00002", facilityId: "100000" },
        { id: "00003", facilityId: "REJECTED_ITM_PARKING" }, { id: "00004", facilityId: "UNFILLABLE_PARKING" },
      ],
      changes: [
        change("a", "01", "00002", "_NA_", "100000", "BROKERED", "2026-09-23T17:46:22Z"),
        change("b", "01", "00003", "100000", "REJECTED_ITM_PARKING", "NOT_IN_STOCK", "2026-10-09T21:25:39Z", { changeUserLogin: "monica.thorbourne" }),
        change("c", "01", "00004", "REJECTED_ITM_PARKING", "UNFILLABLE_PARKING", "UNFILLABLE", "2026-10-09T21:25:48Z"),
        change("d", "01", "00003", "UNFILLABLE_PARKING", "REJECTED_ITM_PARKING", "ALLOCATED", "2026-10-09T21:35:47Z", { comments: "Shopify sync: could not reopen in-progress fulfillment order" }),
        change("e", "01", "00004", "REJECTED_ITM_PARKING", "UNFILLABLE_PARKING", "UNFILLABLE", "2026-10-09T21:40:46Z"),
      ],
      importedAt: t("2026-09-23T17:46:00Z"),
    });

    expect(flow.columns.map((column) => [column.kind, column.attempts])).toEqual([
      ["imported", 1], ["brokered", 1], ["rejected", 1], ["unfillable", 2],
    ]);
    expect(flow.edges.map((edge) => edge.kind)).toEqual(["brokered", "rejected", "unfillable"]);
  });

  it("gives a ship group a new card when some items leave, joined by a stayed line", () => {
    const flow = buildRoutingFlow({
      items: [{ orderItemSeqId: "01", shipGroupSeqId: "00002" }, { orderItemSeqId: "02", shipGroupSeqId: "00003" }],
      shipGroups: [{ id: "00001", facilityId: "_NA_" }, { id: "00002", facilityId: "100000" }, { id: "00003", facilityId: "REJECTED_ITM_PARKING" }],
      changes: [
        change("a", "01", "00002", "_NA_", "100000", "BROKERED", "2026-10-01T10:00:00Z"),
        change("b", "02", "00002", "_NA_", "100000", "BROKERED", "2026-10-01T10:00:00Z"),
        change("c", "02", "00003", "100000", "REJECTED_ITM_PARKING", "NOT_IN_STOCK", "2026-10-03T10:00:00Z"),
      ],
      importedAt: t("2026-10-01T09:59:00Z"),
    });

    expect(flow.nodes.map((node) => [node.id, node.orderItemSeqIds.join()])).toEqual([
      ["0-00001", "01,02"], ["1-00002", "01,02"], ["2-00002", "01"], ["2-00003", "02"],
    ]);
    expect(flow.edges.slice(1).map((edge) => [edge.from, edge.to, edge.kind])).toEqual([
      ["1-00002", "2-00002", "stayed"],
      ["1-00002", "2-00003", "rejected"],
    ]);
  });

  it("orders and groups SQL timestamps the same as epoch millis", () => {
    const sql = (iso: string) => DateTime.fromISO(iso).toFormat("yyyy-MM-dd HH:mm:ss.SSS");
    const items = [{ orderItemSeqId: "01", shipGroupSeqId: "00003" }, { orderItemSeqId: "02", shipGroupSeqId: "00002" }];
    const moves: Array<[string, string, string, string, string, string, string]> = [
      ["b1", "01", "00002", "_NA_", "100000", "BROKERED", "2026-10-08T17:02:00Z"],
      ["b2", "02", "00002", "_NA_", "100000", "BROKERED", "2026-10-08T17:02:01Z"],
      ["r1", "01", "00003", "100000", "REJECTED_ITM_PARKING", "NOT_IN_STOCK", "2026-10-08T19:00:00Z"],
    ];
    const build = (at: (iso: string) => any) => buildRoutingFlow({
      items,
      shipGroups: [{ id: "00001", facilityId: "_NA_" }, { id: "00002", facilityId: "100000" }, { id: "00003", facilityId: "REJECTED_ITM_PARKING" }],
      // Newest first, as the endpoint returns them, so the order has to come from the timestamps.
      changes: [...moves].reverse().map(([id, item, shipGroup, from, to, reason, iso]) => ({ ...change(id, item, shipGroup, from, to, reason, iso), changeDatetime: at(iso) })),
      importedAt: t("2026-10-08T16:59:45Z"),
    });

    const flow = build(sql);
    expect(flow.columns.map((column) => column.kind)).toEqual(["imported", "brokered", "rejected"]);
    expect(flow).toEqual(build(t));
  });

  it("ignores moves that leave an item in the ship group it is already in", () => {
    // Only the latest unfillable attempts are read, so older "back to the queue" loops lose the
    // attempts between them and arrive as repeated moves into the queue's ship group.
    const flow = buildRoutingFlow({
      items: [{ orderItemSeqId: "01", shipGroupSeqId: "00001" }],
      shipGroups: [{ id: "00001", facilityId: "_NA_" }, { id: "00004", facilityId: "UNFILLABLE_PARKING" }],
      changes: [
        change("u", "01", "00004", "_NA_", "UNFILLABLE_PARKING", "UNFILLABLE", "2026-10-01T10:00:00Z"),
        change("q1", "01", "00001", "UNFILLABLE_PARKING", "_NA_", "ALLOCATED", "2026-10-02T10:00:00Z"),
        change("q2", "01", "00001", "_NA_", "_NA_", "ALLOCATED", "2026-10-03T10:00:00Z"),
        change("q3", "01", "00001", "_NA_", "_NA_", "ALLOCATED", "2026-10-04T10:00:00Z"),
      ],
      importedAt: t("2026-10-01T09:59:00Z"),
    });

    expect(flow.nodes.map((node) => node.id)).toEqual(["0-00001", "1-00004", "2-00001"]);
    expect(flow.edges.map((edge) => [edge.kind, edge.attempts])).toEqual([["unfillable", 1], ["requeued", 3]]);
  });

  it("estimates the graph's height from today's ship groups before the routing loads", () => {
    // Six items imported together, then split five and one: the estimate is the height the graph takes.
    const items = ["01", "02", "03", "04", "05", "06"].map((id) => ({ orderItemSeqId: id, shipGroupSeqId: id === "01" ? "00003" : "00002" }));
    const flow = buildRoutingFlow({
      items,
      shipGroups: [{ id: "00001", facilityId: "_NA_" }, { id: "00002", facilityId: "100000" }, { id: "00003", facilityId: "100007" }],
      changes: items.map((item) => change(`b${item.orderItemSeqId}`, item.orderItemSeqId, item.shipGroupSeqId, "_NA_", item.shipGroupSeqId === "00002" ? "100000" : "100007", "BROKERED", "2026-10-08T17:02:00Z")),
      importedAt: t("2026-10-08T16:59:45Z"),
    });

    expect(estimateFlowHeight([5, 1])).toBe(layoutRoutingFlow(flow, ROUTING_FLOW_SIZE).height);
    expect(estimateFlowHeight([])).toBe(0);
  });

  it("shows an order that never moved as its imported ship group", () => {
    const flow = buildRoutingFlow({
      items: [{ orderItemSeqId: "01", shipGroupSeqId: "00001" }],
      shipGroups: [{ id: "00001", facilityId: "100005" }],
      changes: [],
      importedAt: t("2026-10-01T09:59:00Z"),
    });
    expect(flow.nodes).toEqual([expect.objectContaining({ id: "0-00001", isCurrent: true })]);
    expect(flow.edges).toEqual([]);
  });

  it("lines cards up with where their items came from, without overlap", () => {
    const flow = buildRoutingFlow({
      items: [{ orderItemSeqId: "01", shipGroupSeqId: "00002" }, { orderItemSeqId: "02", shipGroupSeqId: "00003" }],
      shipGroups: [{ id: "00001", facilityId: "_NA_" }, { id: "00002", facilityId: "100000" }, { id: "00003", facilityId: "100007" }],
      changes: [
        change("a", "01", "00002", "_NA_", "100000", "BROKERED", "2026-10-01T10:00:00Z"),
        change("b", "02", "00003", "_NA_", "100007", "BROKERED", "2026-10-01T10:00:00Z"),
      ],
      importedAt: t("2026-10-01T09:59:00Z"),
    });
    const layout = layoutRoutingFlow(flow, { cardWidth: 200, columnGap: 100, headerHeight: 40, rowHeight: 50, cardGap: 20, top: 30, left: 10 });
    expect(layout.positions["0-00001"]).toEqual({ x: 10, y: 30, height: 140 });
    expect(layout.positions["1-00002"]).toEqual({ x: 310, y: 30, height: 90 });
    expect(layout.positions["1-00003"]).toEqual({ x: 310, y: 140, height: 90 });
    expect(layout.width).toBe(520);
  });
});
