import { defineStore } from "pinia";
import { cookieHelper, logger } from "@common";
import { getProductDb, type CachedProduct, type ProductIdentification } from "@/services/productDb";

export type { CachedProduct, ProductIdentification };

const omsInstance = () => cookieHelper().get("oms") || "";

/**
 * Product cache — the app's single source of rich product data.
 *
 * Two layers:
 *  - a reactive in-memory mirror (`byId`) so the UI can read products synchronously and
 *    re-render reactively;
 *  - a multi-tenant Dexie DB (`${oms}-CommonDB`, see services/productDb.ts) that persists
 *    the cache per OMS across sessions, so a product is never fetched twice.
 *
 * The mirror is hydrated from Dexie once per OMS and is the source for synchronous reads.
 * Consumers go through useProductMaster, not this store directly.
 */
export const useProductCacheStore = defineStore("productCache", {
  state: () => ({
    byId: {} as Record<string, CachedProduct>,
    hydratedOms: ""
  }),
  getters: {
    getProduct: (state) => (productId: string) => state.byId[productId],
    has: (state) => (productId: string) => Boolean(state.byId[productId])
  },
  actions: {
    /** Load this OMS's cached products from Dexie into the reactive mirror (once per OMS). */
    async ensureHydrated() {
      const oms = omsInstance();
      if (!oms || this.hydratedOms === oms) return;
      try {
        const records = await getProductDb(oms).products.toArray();
        records.forEach((record) => {
          this.byId[record.productId] = record;
        });
        this.hydratedOms = oms;
      } catch (error) {
        logger.error("Failed to hydrate product cache from Dexie", error);
      }
    },
    /** Update the reactive mirror (synchronously, for the UI) and persist to Dexie. */
    async upsert(products: CachedProduct[]) {
      products.forEach((product) => {
        if (product.productId) this.byId[product.productId] = product;
      });
      const oms = omsInstance();
      if (!oms) return;
      try {
        await getProductDb(oms).products.bulkPut(products.filter((product) => product.productId));
      } catch (error) {
        logger.error("Failed to persist products to Dexie", error);
      }
    },
    /** Logout: clear the in-memory mirror only. Dexie data persists (multi-tenant). */
    reset() {
      this.byId = {};
      this.hydratedOms = "";
    }
  },
  persist: false
});
