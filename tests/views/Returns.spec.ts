import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("Returns View", () => {
  const source = readFileSync(resolve(process.cwd(), "src/views/Returns.vue"), "utf8");

  it("renders Find returns title and searchbar", () => {
    expect(source).toContain("translate('Find returns')");
    expect(source).toContain("translate('RMA number, return ID, order ID')");
  });

  it("uses the standardized search and filter layout", () => {
    expect(source).toContain("<SearchFilterCard");
    expect(source).toContain("<UniformFilterLayout @clear=\"clearFilters\">");
    expect(source).toContain("<DateFilterSelect");
    expect(source).toContain(":label=\"translate('Return date from')\"");
    expect(source).toContain(":label=\"translate('Return date through')\"");
  });

  it("loads Open returns and Pending refunds from dedicated metric queries", () => {
    expect(source).toContain("translate('Open returns')");
    expect(source).toContain("translate('Pending refunds')");
    expect(source).toContain("getOpenReturnsCount");
    expect(source).toContain("getPendingRefundTotals");
    expect(source).toContain("loadOpenReturnsCount();");
    expect(source).toContain("loadPendingRefundTotals();");
    expect(source).not.toContain("returns.value.filter");
  });

  it("renders list-item return rows and explicit result states", () => {
    expect(source).toContain("<ReturnListRow");
    expect(source).toContain("return translate(\"Blind return\")");
    expect(source).not.toContain("`${translate(\"Return\")} #${returnRecord.returnId}`");
    expect(source).toContain("<ion-progress-bar v-if=\"loading\"");
    expect(source).toContain("<ErrorState");
    expect(source).toContain("<EmptyState");
    expect(source).toContain("translate('{loaded} of {total} matching returns'");
  });

  it("integrates useReturnSearchRouteState and listReturns service", () => {
    expect(source).toContain("useReturnSearchRouteState");
    expect(source).toContain("listReturns");
  });

  it("enriches return rows with customer names and keeps the order as secondary context", () => {
    expect(source).toContain("getReturnCustomerNames");
    expect(source).toContain(":primary-label=\"primaryLabel(returnRecord)\"");
    expect(source).toContain(":secondary-label=\"secondaryLabel(returnRecord)\"");
    expect(source).toContain("returnRecord.fromPartyId");
  });
});
