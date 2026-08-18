import { api } from "@common";

/**
 * OrderFacilityChange reason written for every failed brokering attempt. A single
 * order can accumulate thousands of these (11.5k on the worst order observed), so
 * the timeline excludes them from the row-level fetch and shows a count instead.
 */
export const UNFILLABLE_REASON_ID = "UNFILLABLE";

/**
 * How many UNFILLABLE rows to pull when summarising failed brokering.
 *
 * The rows themselves are needed, not just a count: one routing run writes a row per
 * unfillable item, so the attempt count comes from grouping rows by run. (The response's
 * `X-Total-Count` would not help even if it were readable — OMS omits it from
 * `Access-Control-Expose-Headers`, so the PWA's cross-origin session cannot see it —
 * and it counts rows, not runs.) An order whose failures fill this page is reported
 * as "N+".
 */
export const UNFILLABLE_SAMPLE_SIZE = 100;

/**
 * Order-domain API calls for the order detail page.
 *
 * The store calls these; it never calls `api()` directly. As write actions
 * (broker, park, cancel item, change shipment method, …) are designed, their
 * API calls belong here too.
 */
export function useOrderDetail() {
  /**
   * Fetch the full order master-detail document.
   *
   * `GET oms/orders?orderId={orderId}&dependentLevels=1` returns the OrderHeader
   * `default` entity master as an array of one. Returns the raw axios response;
   * the store unwraps `data[0]` and owns error handling.
   */
  async function getOrder(orderId: string): Promise<any> {
    return api({
      url: "oms/orders",
      method: "GET",
      params: { orderId, dependentLevels: 1 }
    });
  }

  async function getWorkEfforts(orderId: string): Promise<any> {
    return api({
      url: `oms/orders/${orderId}/workEfforts`,
      method: "GET"
    });
  }

  async function getCommunicationEvents(orderId: string): Promise<any> {
    return api({
      url: `oms/orders/${orderId}/communicationEvents`,
      method: "GET"
    });
  }

  async function getRiskAssessments(orderId: string): Promise<any> {
    return api({
      url: `oms/orders/${orderId}/risks`,
      method: "GET"
    });
  }


  /**
   * OrderFacilityChange rows (brokered, released, parked, rejected) for the order,
   * excluding UNFILLABLE. `_op=in` plus `_not=Y` builds `NOT IN ('UNFILLABLE') OR
   * changeReasonEnumId IS NULL`, so the reason-less rows are still returned.
   */
  async function getFacilityChanges(orderId: string): Promise<any> {
    return api({
      url: `oms/orders/${orderId}/facilityChange`,
      method: "GET",
      params: {
        changeReasonEnumId: UNFILLABLE_REASON_ID,
        changeReasonEnumId_op: "in",
        changeReasonEnumId_not: "Y",
        orderByField: "changeDatetime",
        pageSize: 200
      }
    });
  }

  /**
   * The most recent UNFILLABLE rows, newest first. The first row dates the last
   * failed attempt and the row count sizes the entry — see UNFILLABLE_SAMPLE_SIZE
   * for why the rows are counted rather than read off the count header.
   */
  async function getUnfillableAttempts(orderId: string): Promise<any> {
    return api({
      url: `oms/orders/${orderId}/facilityChange`,
      method: "GET",
      params: {
        changeReasonEnumId: UNFILLABLE_REASON_ID,
        orderByField: "-changeDatetime",
        pageSize: UNFILLABLE_SAMPLE_SIZE
      }
    });
  }

  /**
   * InventoryItemDetail rows for the order that record an inventory issuance.
   *
   * Issuing inventory writes a detail row carrying `itemIssuanceId` and a negative
   * `quantityOnHandDiff`; the reservation that precedes it writes a separate row with
   * `reasonEnumId` and no issuance id. `itemIssuanceId_op=empty` + `_not=Y` keeps only
   * the issuance rows, so the response is one row per issued line rather than two.
   *
   * There is no REST resource for ItemIssuance itself — this view is the only exposed
   * path to the same fact.
   */
  async function getInventoryIssuance(orderId: string): Promise<any> {
    return api({
      url: "oms/inventoryItem/detail",
      method: "GET",
      params: {
        orderId,
        itemIssuanceId_op: "empty",
        itemIssuanceId_not: "Y",
        pageSize: 500
      }
    });
  }

  return {
    getOrder,
    getWorkEfforts,
    getCommunicationEvents,
    getRiskAssessments,
    getFacilityChanges,
    getUnfillableAttempts,
    getInventoryIssuance
  };
}
