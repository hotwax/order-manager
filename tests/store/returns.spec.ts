import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPartyNames } from "@/services/customer";
import { fetchOrderRowEnrichment } from "@/services/order";
import { getReturn, listReturns } from "@/services/returns";
import { useReturnsStore } from "@/store/returns";

vi.mock("@/services/customer", () => ({ getPartyNames: vi.fn() }));
vi.mock("@/services/order", () => ({ fetchOrderRowEnrichment: vi.fn() }));

vi.mock("@/services/returns", () => ({
  getReturn: vi.fn(),
  listReturns: vi.fn(),
  toReturnSummary: vi.fn((value) => value)
}));

const getReturnMock = vi.mocked(getReturn);
const listReturnsMock = vi.mocked(listReturns);
const getPartyNamesMock = vi.mocked(getPartyNames);
const fetchOrderRowEnrichmentMock = vi.mocked(fetchOrderRowEnrichment);

const detail = {
  returnId: "R200",
  orderId: "M200",
  statusId: "RETURN_REQUESTED",
  returnHeaderTypeId: "CUSTOMER_RETURN",
  itemCount: 0,
  items: [],
  statuses: [],
  identifications: [],
  syncState: "not_synced" as const,
  origin: "oms" as const
};

describe("returns store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getReturnMock.mockReset();
    listReturnsMock.mockReset();
    getPartyNamesMock.mockReset();
    getPartyNamesMock.mockResolvedValue([]);
    fetchOrderRowEnrichmentMock.mockReset();
    fetchOrderRowEnrichmentMock.mockResolvedValue({});
  });

  it("loads the first page with server paging", async () => {
    listReturnsMock.mockResolvedValueOnce({ items: [{ returnId: "R1", statusId: "RETURN_REQUESTED" }], total: 3 });
    const store = useReturnsStore();

    await store.search();

    expect(listReturnsMock).toHaveBeenCalledWith(expect.objectContaining({ pageIndex: 0, pageSize: 25 }));
    expect(store.returns.map((item) => item.returnId)).toEqual(["R1"]);
    expect(store.hasMore).toBe(true);
  });

  it("enriches order and customer names through existing batched lookups", async () => {
    listReturnsMock.mockResolvedValueOnce({
      items: [{ returnId: "R1", orderId: "M1", fromPartyId: "P1", statusId: "RETURN_REQUESTED" }],
      total: 1
    });
    fetchOrderRowEnrichmentMock.mockResolvedValueOnce({
      M1: { orderId: "M1", orderName: "#1001", itemDocuments: [] }
    });
    getPartyNamesMock.mockResolvedValueOnce([{ partyId: "P1", name: "Alex Morgan", partyTypeId: "PERSON" }]);
    const store = useReturnsStore();

    await store.search();

    expect(fetchOrderRowEnrichmentMock).toHaveBeenCalledWith(["M1"]);
    expect(getPartyNamesMock).toHaveBeenCalledWith(["P1"]);
    expect(store.returns[0]).toMatchObject({ orderName: "#1001", customerName: "Alex Morgan" });
  });

  it("keeps return results usable when optional name enrichment is unavailable", async () => {
    listReturnsMock.mockResolvedValueOnce({
      items: [{ returnId: "R1", orderId: "M1", orderName: "Existing name", fromPartyId: "P1", statusId: "RETURN_REQUESTED" }],
      total: 1
    });
    fetchOrderRowEnrichmentMock.mockRejectedValueOnce(new Error("Solr unavailable"));
    getPartyNamesMock.mockRejectedValueOnce(new Error("Party lookup unavailable"));
    const store = useReturnsStore();

    await store.search();

    expect(store.error).toBe("");
    expect(store.returns[0]).toMatchObject({ orderName: "Existing name", fromPartyId: "P1" });
  });

  it("uses canonical detail for an exact RMA lookup", async () => {
    getReturnMock.mockResolvedValueOnce(detail);
    const store = useReturnsStore();
    store.query.searchTerm = "RMA #R200";

    await store.search();

    expect(getReturnMock).toHaveBeenCalledWith("R200");
    expect(listReturnsMock).not.toHaveBeenCalled();
    expect(store.returns).toHaveLength(1);
  });

  it("enriches every source order represented by return detail items", async () => {
    getReturnMock.mockResolvedValueOnce({
      ...detail,
      fromPartyId: "P200",
      items: [
        { returnItemSeqId: "00001", orderId: "M200", returnQuantity: 1 },
        { returnItemSeqId: "00002", orderId: "M201", returnQuantity: 1 }
      ],
      itemCount: 2
    });
    fetchOrderRowEnrichmentMock.mockResolvedValueOnce({
      M200: { orderId: "M200", orderName: "#200", itemDocuments: [] },
      M201: { orderId: "M201", orderName: "#201", itemDocuments: [] }
    });
    getPartyNamesMock.mockResolvedValueOnce([{ partyId: "P200", name: "Alex Morgan", partyTypeId: "PERSON" }]);
    const store = useReturnsStore();

    await store.loadReturn("R200");

    expect(fetchOrderRowEnrichmentMock).toHaveBeenCalledWith(["M200", "M201"]);
    expect(store.current?.customerName).toBe("Alex Morgan");
    expect(store.current?.items.map((item) => item.orderName)).toEqual(["#200", "#201"]);
  });

  it("maps order and customer modes to the existing exact list filters", async () => {
    listReturnsMock.mockResolvedValue({ items: [], total: 0 });
    const store = useReturnsStore();
    store.query.searchField = "ORDER_ID";
    store.query.searchTerm = "M300";
    await store.search();
    expect(listReturnsMock).toHaveBeenLastCalledWith(expect.objectContaining({ orderId: "M300", fromPartyId: undefined }));

    store.query.searchField = "CUSTOMER_ID";
    store.query.searchTerm = "P300";
    await store.search();
    expect(listReturnsMock).toHaveBeenLastCalledWith(expect.objectContaining({ orderId: undefined, fromPartyId: "P300" }));
  });

  it("appends later pages without duplicating return IDs", async () => {
    listReturnsMock
      .mockResolvedValueOnce({ items: [{ returnId: "R1", statusId: "A" }, { returnId: "R2", statusId: "A" }], total: 3 })
      .mockResolvedValueOnce({ items: [{ returnId: "R2", statusId: "A" }, { returnId: "R3", statusId: "A" }], total: 3 });
    const store = useReturnsStore();

    await store.search();
    await store.loadMore();

    expect(store.returns.map((item) => item.returnId)).toEqual(["R1", "R2", "R3"]);
    expect(store.pageIndex).toBe(1);
  });

  // The OMS reports `returnsCount` as the size of the page it just returned, not the number of
  // matches, so a full first page arrives as "25 of 25". Keeping paging alive on a full page is
  // what makes every return past the first page reachable at all.
  it("keeps paging when a full page arrives with a total that only counts that page", async () => {
    const page = Array.from({ length: 25 }, (_, index) => ({ returnId: `R${index}`, statusId: "A" }));
    listReturnsMock.mockResolvedValueOnce({ items: page, total: 25 });
    const store = useReturnsStore();

    await store.search();

    expect(store.returns).toHaveLength(25);
    expect(store.total).toBe(25);
    expect(store.hasMore).toBe(true);
  });

  it("stops paging once a short page proves the end of the result set", async () => {
    const fullPage = Array.from({ length: 25 }, (_, index) => ({ returnId: `R${index}`, statusId: "A" }));
    listReturnsMock
      .mockResolvedValueOnce({ items: fullPage, total: 25 })
      .mockResolvedValueOnce({ items: [{ returnId: "R99", statusId: "A" }], total: 1 });
    const store = useReturnsStore();

    await store.search();
    await store.loadMore();

    expect(store.returns).toHaveLength(26);
    expect(store.hasMore).toBe(false);
  });

  it("treats a 404 exact lookup as an empty result rather than a page failure", async () => {
    getReturnMock.mockRejectedValueOnce({ response: { status: 404 } });
    const store = useReturnsStore();
    store.query.searchTerm = "R404";

    await store.search();

    expect(store.returns).toEqual([]);
    expect(store.error).toBe("");
  });
});
