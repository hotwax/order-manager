import { defineStore } from "pinia"
import { api, commonUtil, logger, translate, useSolrSearch } from "@common";
import { numericValue, sumFacilityStock, type RequestInventoryTransfersPayload } from "@/utils/inventoryTransfers";

interface StockState {
  products: Record<string, any>
}

/** The rows of a list response, whichever key the endpoint puts them under. */
function listOf(data: any): any[] {
  return Array.isArray(data) ? data : data?.entityValueList ?? data?.docs ?? data?.list ?? data?.items ?? [];
}

export const useStockStore = defineStore("stock", {
  state: (): StockState => ({
    products: {}
  }),
  getters: {
    getProductStock: (state) => (productId: any, facilityId: any) => {
      return state.products[productId] ? state.products[productId][facilityId] ? state.products[productId][facilityId] : {} : {}
    }
  },
  actions: {
    /**
     * Every row of a list endpoint, page after page. The total comes back in X-Total-Count, which the OMS
     * doesn't expose to the browser, so a short page is the only sign that nothing is left. One page can
     * silently hide rows, and understated coverage is worse than a second request.
     */
    async fetchAllRows(url: string, params: Record<string, unknown>, pageSize = 250): Promise<any[]> {
      const rows: any[] = [];
      for(let pageIndex = 0; pageIndex < 20; pageIndex++) {
        const response: any = await api({ url, method: "GET", params: { ...params, pageIndex, pageSize } });
        const page = listOf(response.data);
        rows.push(...page);
        if(page.length < pageSize) {break;}
      }

      return rows;
    },
    /** Each facility's order count on `entryDate` (yyyy-MM-dd): live consumption, never cached. */
    async fetchFacilityOrderCounts(facilityIds: string[], entryDate: string): Promise<any[]> {
      const response: any = await api({
        url: "admin/facilities/orderCount",
        method: "GET",
        params: {
          facilityId: facilityIds.join(","),
          facilityId_op: "in",
          entryDate,
          pageSize: Math.max(facilityIds.length, 1)
        }
      });
      return listOf(response.data);
    },
    /** The ProductFacility rows of one product: where it is stocked and the facility's settings for it. */
    async fetchProductFacilities(productId: string): Promise<any[]> {
      const response: any = await api({
        url: "oms/productFacilities",
        method: "GET",
        params: { productId }
      });
      return Array.isArray(response.data) ? response.data : response.data?.list ?? [];
    },
    /** One page of the products stocked at a facility that match a keyword: `{ products, totalCount }`. */
    async searchFacilityProducts(params: { facilityId: string; keyword: string; pageIndex: number; pageSize: number }): Promise<any> {
      const response: any = await api({
        url: "oms/productFacilities/search",
        method: "GET",
        params
      });
      return response.data ?? {};
    },
    /** Every inventory transfer requested for an order's items, newest first. */
    async fetchOrderInventoryTransfers(orderId: string): Promise<any[]> {
      const rows = await this.fetchAllRows("oms/inventoryTransfers", { orderId, orderByField: "-createdStamp" });

      // Moqui drops a filter on a field it doesn't know and returns every order's transfers, and items
      // match their transfers by sequence id alone ("01"), so keep only this order's.
      return rows.filter((row) => row.orderId === orderId);
    },
    /** A product's available to promise and quantity on hand at each of the given facilities. */
    async fetchFacilityStock(productId: string, facilityIds: string[]): Promise<Record<string, { atp: number; qoh: number }>> {
      const rows = await this.fetchAllRows("oms/inventoryLogs", { productId, facilityId: facilityIds.join(","), facilityId_op: "in" }, 500);

      return sumFacilityStock(rows, facilityIds);
    },
    /**
     * How fast each facility sells the product: its completed order items over the last `days` days,
     * per day, keyed by facility. Solr keeps no completion date on an order item, so the window is on the
     * order date. A facility with no such sales is left out.
     */
    async fetchFacilitySalesVelocity(productId: string, days = 30): Promise<Record<string, number>> {
      const response: any = await useSolrSearch().runSolrQuery({
        json: {
          params: { rows: 0, "q.op": "AND" },
          query: "*:*",
          filter: [
            "docType: ORDER",
            "orderTypeId: SALES_ORDER",
            `productId: "${productId}"`,
            "orderItemStatusId: ITEM_COMPLETED",
            `orderDate:[NOW-${days}DAYS TO NOW]`,
          ],
          facet: { facilities: { type: "terms", field: "facilityId", limit: -1, mincount: 1 } },
        },
      });
      const buckets: any[] = response.data?.facets?.facilities?.buckets || [];

      return Object.fromEntries(buckets.map((bucket) => [bucket.val, numericValue(bucket.count) / days]));
    },
    /** Moves the stock: out of the source facility and into the destination, and marks the transfer complete. */
    executeInventoryTransfer(inventoryTransferId: string) {
      return api({ url: `oms/inventoryTransfers/${inventoryTransferId}/execute`, method: "POST", data: { inventoryTransferId } });
    },
    cancelInventoryTransfer(inventoryTransferId: string) {
      return api({
        url: `oms/inventoryTransfers/${inventoryTransferId}/cancel`,
        method: "POST",
        data: { inventoryTransferId, statusReasonEnumId: "IXF_USER_CANCEL" },
      });
    },
    async requestInventoryTransfers(payload: RequestInventoryTransfersPayload): Promise<string[]> {
      const ids = await Promise.all(payload.transfers.map(async (transfer) => {
        const response: any = await api({
          url: "oms/inventoryTransfers",
          method: "POST",
          data: {
            ...transfer,
            statusId: "IXF_REQUESTED",
            sourceId: "ORDER_MANAGER",
            sourceReferenceId: `${payload.requestReferencePrefix}-${transfer.orderItemSeqId || transfer.productId}`,
          },
        });

        return response.data?.inventoryTransferId;
      }));

      return ids.filter(Boolean);
    },
    addProductStock(payload: any) {
      if (this.products[payload.productId]) {
        this.products[payload.productId][payload.facilityId] = payload.stock
      } else {
        this.products[payload.productId] = {
          [payload.facilityId]: payload.stock
        }
      }
    },
    async fetchStock({ productId, facilityId}: { productId: any; facilityId?: any }) {
      try {
        const resp: any = await api({
          url: `/poorti/getInventoryAvailableByFacility`,
          method: "GET",
          params: {
            productId,
            facilityId
          },
        });

        if (!commonUtil.hasError(resp)) {
          this.addProductStock({ productId: productId, facilityId: facilityId, stock: resp.data })
        } else {
          throw resp.data
        }
      } catch (err) {
        const serverError = commonUtil.getErrorMessage(err);
        logger.error(err)
        commonUtil.showToast(`${translate("No data available.")} ${serverError}`);
      }
    }
  },
  persist: false
})
