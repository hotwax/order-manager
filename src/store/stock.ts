import { defineStore } from "pinia"
import { api, commonUtil, logger, translate } from "@common";

interface StockState {
  products: Record<string, any>
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
        logger.error(err)
        commonUtil.showToast(translate("No data available"))
      }
    }
  },
  persist: false
})
