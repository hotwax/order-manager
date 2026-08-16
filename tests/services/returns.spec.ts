import { api } from "@common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RETURN_DETAIL_UNAVAILABLE, getReturn, listReturns, mapReturnDetail } from "@/services/returns";

vi.mock("@common", () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);

describe("returns service", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("uses only the existing list filters and maps the server count", async () => {
    apiMock.mockResolvedValueOnce({
      data: {
        returns: [{
          returnId: "R100",
          orderId: "M100",
          orderName: "#100",
          statusId: "RETURN_REQUESTED",
          returnHeaderTypeId: "CUSTOMER_RETURN",
          fromPartyId: "P100"
        }],
        returnsCount: 42
      }
    } as any);

    const result = await listReturns({
      pageIndex: 2,
      pageSize: 25,
      orderId: "M100",
      statusId: "RETURN_REQUESTED",
      returnHeaderTypeId: "CUSTOMER_RETURN",
      fromPartyId: undefined,
      returnChannelEnumId: ""
    });

    expect(apiMock).toHaveBeenCalledWith({
      url: "oms/returns",
      method: "get",
      params: {
        pageIndex: 2,
        pageSize: 25,
        orderId: "M100",
        statusId: "RETURN_REQUESTED",
        returnHeaderTypeId: "CUSTOMER_RETURN"
      }
    });
    expect(result.total).toBe(42);
    expect(result.items[0]).toMatchObject({ returnId: "R100", orderName: "#100", fromPartyId: "P100" });
  });

  it("loads detail through the canonical path endpoint", async () => {
    apiMock.mockResolvedValueOnce({
      data: {
        returnDetail: { returnId: "R/100", statusId: "RETURN_REQUESTED", entryDate: "2026-08-13" },
        items: [],
        statusHistory: []
      }
    } as any);

    const detail = await getReturn("R/100");

    expect(apiMock).toHaveBeenCalledWith({ url: "oms/returns/R%2F100", method: "get" });
    expect(detail.returnId).toBe("R/100");
  });

  // oms.rest.xml mounts only POST actions under returns/{returnId}, so a deployment without the
  // restored GET answers 405. A bare "status code 405" leaves an operator with nothing to act on.
  it("reports an unmounted detail endpoint as a cause rather than a bare 405", async () => {
    apiMock.mockRejectedValueOnce({ response: { status: 405 } });

    await expect(getReturn("10150")).rejects.toThrow(RETURN_DETAIL_UNAVAILABLE);
  });

  it("prefers an authoritative header total", () => {
    const detail = mapReturnDetail({
      returnDetail: {
        returnId: "R101",
        statusId: "RETURN_REQUESTED",
        returnTotal: "99.25",
        currencyUomId: "USD"
      },
      items: [{ returnItemSeqId: "00001", returnQuantity: 0, returnPrice: 10 }]
    });

    expect(detail.returnTotal).toBe(99.25);
    expect(detail.totalSource).toBe("header");
  });

  it("uses priced items only as a safe fallback and never turns zero quantity into one", () => {
    const detail = mapReturnDetail({
      returnDetail: { returnId: "R102", statusId: "RETURN_REQUESTED" },
      items: [
        { returnItemSeqId: "00001", returnQuantity: 0, returnPrice: 10 },
        { returnItemSeqId: "00002", returnQuantity: 2, returnPrice: 5 }
      ]
    });

    expect(detail.returnTotal).toBe(10);
    expect(detail.totalSource).toBe("items");
    expect(detail.items[0].returnQuantity).toBe(0);
  });

  it("retains header and item scope on return status history", () => {
    const detail = mapReturnDetail({
      returnDetail: { returnId: "R102A", statusId: "RETURN_COMPLETED" },
      items: [{ returnItemSeqId: "00001", returnQuantity: 1, returnPrice: 5 }],
      statusHistory: [
        { statusId: "RETURN_COMPLETED", statusDatetime: "2026-07-01", returnItemSeqId: "_NA_" },
        { statusId: "RETURN_COMPLETED", statusDatetime: "2026-07-01", returnItemSeqId: "00001" }
      ]
    });

    expect(detail.statuses).toEqual([
      { statusId: "RETURN_COMPLETED", statusDate: "2026-07-01", returnItemSeqId: "_NA_" },
      { statusId: "RETURN_COMPLETED", statusDate: "2026-07-01", returnItemSeqId: "00001" }
    ]);
  });

  it("omits a total when neither the header nor every item provides one", () => {
    const detail = mapReturnDetail({
      returnDetail: { returnId: "R103", statusId: "RETURN_REQUESTED" },
      items: [{ returnItemSeqId: "00001", returnQuantity: 1 }]
    });

    expect(detail.returnTotal).toBeUndefined();
    expect(detail.totalSource).toBeUndefined();
  });

  it("accepts detail item sequence IDs and amount-only appeasement totals from the existing detail contract", () => {
    const detail = mapReturnDetail({
      returnDetail: { returnId: "R103A", statusId: "RETURN_COMPLETED", returnHeaderTypeId: "APPEASEMENT" },
      items: [{
        orderItemSeqId: "00001",
        returnQuantity: 0,
        unitPrice: 20,
        returnPrice: 12.5,
        returnItemTypeId: "RET_LOST_ITEM",
        expectedItemStatus: "INV_NOT_RETURNED"
      }]
    });

    expect(detail.items[0].returnItemSeqId).toBe("00001");
    expect(detail.items[0].orderItemSeqId).toBe("00001");
    expect(detail.items[0].returnItemTypeId).toBe("RET_LOST_ITEM");
    expect(detail.items[0].expectedItemStatus).toBe("INV_NOT_RETURNED");
    expect(detail.items[0].unitPrice).toBe(20);
    expect(detail.returnTotal).toBe(12.5);
    expect(detail.totalSource).toBe("items");
  });

  it("maps exchange linkage and namespaced Shopify state without using lifecycle actions", () => {
    const detail = mapReturnDetail({
      returnDetail: { returnId: "R104", statusId: "RETURN_APPROVED", orderId: "M104" },
      items: [],
      shopifySync: {
        isExchange: true,
        replacementOrderId: "M105",
        exchangePushStatusId: "PUSH_OK",
        exchangeProcessStatusId: "PROC_PENDING"
      }
    });

    expect(detail.isExchange).toBe(true);
    expect(detail.replacementOrderId).toBe("M105");
    expect(detail.syncState).toBe("pending");
  });
});
