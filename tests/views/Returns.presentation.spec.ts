import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Find Returns integration surface", () => {
  const returnsView = readFileSync(resolve(process.cwd(), "src/views/Returns.vue"), "utf8");
  const menu = readFileSync(resolve(process.cwd(), "src/components/layout/Menu.vue"), "utf8");
  const detail = readFileSync(resolve(process.cwd(), "src/views/ReturnDetail.vue"), "utf8");

  it("exposes only backend-supported exact identifier modes and server filters", () => {
    expect(returnsView).toContain("value=\"RETURN_ID\"");
    expect(returnsView).toContain("value=\"ORDER_ID\"");
    expect(returnsView).toContain("value=\"CUSTOMER_ID\"");
    expect(returnsView).not.toContain("client-side");
    expect(returnsView).toContain("query.returnChannelEnumId");
  });

  it("auto-applies filters with one clear action and keeps return rows concise", () => {
    expect(returnsView.match(/@ion-change="applyFilters"/g)).toHaveLength(4);
    expect(returnsView).toContain(":show-clear=\"false\"");
    expect(returnsView).not.toContain("return-search-button");
    expect(returnsView).not.toContain("translate('RMA')");
    expect(returnsView).toContain("returnRecord.customerName");
  });

  it("gates the navigation entry with the dedicated permission", () => {
    expect(menu).toContain("hasPermission(Actions.APP_ORDER_RETURN_VIEW)");
    expect(menu).toContain("router-link=\"/returns\"");
  });

  it("keeps detail read-only and linked to existing order and customer pages", () => {
    expect(detail).toContain("`/orders/${group.orderId}`");
    expect(detail).toContain("`/customers/${returnRecord.fromPartyId}`");
    expect(detail).not.toContain("approveReturn");
    expect(detail).not.toContain("completeReturn");
    expect(detail).not.toContain("pushToShopify");
  });

  it("uses compact accordion headers with the shared columnar return-item contract", () => {
    expect(detail).toContain("<ion-accordion-group>");
    expect(detail).toContain("<ion-accordion v-for=\"item in group.items\"");
    expect(detail).toContain("class=\"list-item return-item-row\"");
    expect(detail).toContain("--columns-desktop: 4");
    expect(detail).toContain("return-item-quantity");
    expect(detail).toContain("return-item-status");
    expect(detail).toContain("return-item-amount");
    expect(detail).toContain("slot=\"content\" class=\"return-item-details\"");
    expect(detail).toContain("Original unit price");
    expect(detail).toContain("Inventory outcome");
    expect(detail).toContain("itemReferenceLabel(item)");
    expect(detail).toContain("class=\"return-item-details-panel\"");
    expect(detail).toContain("grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))");
    expect(detail).not.toContain(".return-item-details ion-list");
  });

  it("shows the inventory disposition without inferring restock from authorization", () => {
    expect(detail).toContain("return-item-restock");
    expect(detail).toContain("Restocked");
    expect(detail).toContain("Not restocked");
    expect(detail).toContain("Restock pending");
    expect(detail).toContain("Restock not confirmed");
    expect(detail).toContain("expectedItemStatus");
    expect(detail).toContain("receivedQuantity != null && receivedQuantity > 0");
    expect(detail).toContain("commonUtil.getStatusColor");
  });

  it("groups return items by their source order and keeps order navigation in the group header", () => {
    expect(detail).toContain("v-for=\"group in itemGroups\"");
    expect(detail).toContain("Items from order");
    expect(detail).toContain("item.orderId || returnRecord.value?.orderId");
    expect(detail).not.toContain("`/orders/${returnRecord.orderId}`");
  });

  it("adds return totals and reuses source-order payment preferences without a new API", () => {
    expect(detail).toContain("Payment outcome");
    expect(detail).toContain("Net refunded");
    expect(detail).toContain("payment.statusId === \"PAYMENT_REFUNDED\" ? total + payment.amount : total");
    expect(detail).not.toContain("Source order net");
    expect(detail).toContain("Return total");
    expect(detail).toContain("orderDetailStore.fetchOrder(orderId)");
    expect(detail).toContain("paymentPreferences");
    expect(detail).toContain("Total return value");
  });

  it("places status history in the same responsive top-right timeline pattern as order detail", () => {
    expect(detail).toContain("class=\"return-detail-header\"");
    expect(detail).toContain("class=\"return-detail-identity\"");
    expect(detail).toContain("class=\"return-detail-header-details\"");
    expect(detail).toContain("class=\"timeline return-detail-timeline\"");
    expect(detail).toContain("{{ translate('Timeline') }}");
    expect(detail).toContain("grid-template-columns: minmax(0, 1fr) minmax(360px, 420px)");
    expect(detail).toContain("flex: 1 1 300px");
    expect(detail).not.toContain("{{ translate('Status history') }}");
  });

  it("distinguishes whole-return timeline events from item-scoped events", () => {
    expect(detail).toContain("timelineScopeLabel(status)");
    expect(detail).toContain("Whole return");
    expect(detail).toContain("status.returnItemSeqId === \"_NA_\"");
    expect(detail).toContain("candidate.returnItemSeqId === status.returnItemSeqId");
    expect(detail).toContain("`${translate(\"Item\")} · ${itemLabel}`");
  });

  it("builds a semantic timeline with event-specific icons and only confirms timed restocks from received item events", () => {
    expect(detail).toContain("returnTimelineEvents");
    expect(detail).toContain("label: translate(\"Requested\")");
    expect(detail).toContain("label: translate(\"Return date\")");
    expect(detail).toContain("returnTimelineIcon(status.statusId, isConfirmedRestock)");
    expect(detail).toContain("status.statusId === \"RETURN_RECEIVED\"");
    expect(detail).toContain("Number(item.receivedQuantity) > 0");
    expect(detail).toContain("if(isConfirmedRestock || statusId === \"RETURN_RECEIVED\") {return cubeOutline;}");
    expect(detail).toContain("return checkmarkDoneOutline;");
    expect(detail).toContain("return closeCircleOutline;");
    expect(detail).not.toContain(":icon=\"pulseOutline\" />\n              <ion-label class=\"ion-text-wrap\">\n                {{ describe(status.statusId) }}");
  });

  it("shows Shopify fields and exchange lineage already available through current detail contracts", () => {
    expect(detail).toContain("Shopify status");
    expect(detail).toContain("Shopify refund ID");
    expect(detail).toContain("Last synchronized");
    expect(detail).toContain("shopifyStatusColor(returnRecord.shopifySync.returnStatusId)");
    expect(detail).toContain("Exchange of");
    expect(detail).toContain("sourceOrder?.itemAssocs");
    expect(detail).toContain("association.orderItemAssocTypeId === \"EXCHANGE\"");
    expect(detail).toContain("exchangeOriginalOrderIds.value.map((orderId) => orderDetailStore.fetchOrder(orderId))");
  });

  it("uses the shared AccxUI status color utility for return lifecycle badges", () => {
    expect(detail).toContain(":color=\"returnStatusColor(returnRecord.statusId)\"");
    expect(detail).toContain(":color=\"returnStatusColor(item.statusId)\"");
    expect(detail).toContain("RETURN_CANCELLED: \"ORDER_CANCELLED\"");
    expect(detail).toContain("RETURN_COMPLETED: \"ORDER_COMPLETED\"");
    expect(detail).toContain("commonUtil.getStatusColor(returnStatusColorAliases[statusId] || statusId)");
    expect(detail).not.toContain("<ion-badge slot=\"end\" color=\"medium\">");
  });
});
