import { api } from "@common";

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

  return { getOrder };
}
