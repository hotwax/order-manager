import { defineStore } from "pinia";
export interface ProductIdentification {
  type: string;
  value: string;
}

export interface CachedProduct {
  productId: string;
  productName: string;
  sku: string;
  parentProductName: string;
  internalName: string;
  mainImageUrl: string;
  goodIdentifications: ProductIdentification[];
  productTypeId?: string;
  updatedAt: number;
}

/**
 * Product cache — the app's single source of rich product data.
 *
 * This store is intentionally in-memory only. The UI can read products synchronously
 * and re-render reactively, while useProductMaster owns fetching missing products.
 * Consumers go through useProductMaster, not this store directly.
 */
export const useProductCacheStore = defineStore("productCache", {
  state: () => ({
    byId: {} as Record<string, CachedProduct>
  }),
  getters: {
    getProduct: (state) => (productId: string) => state.byId[productId],
    has: (state) => (productId: string) => Boolean(state.byId[productId])
  },
  actions: {
    /** Compatibility no-op for callers that still wait for cache readiness. */
    async ensureHydrated() {
      return;
    },
    /** Update the reactive mirror synchronously for the UI. */
    async upsert(products: CachedProduct[]) {
      products.forEach((product) => {
        if (product.productId) this.byId[product.productId] = product;
      });
    },
    /** Logout: clear the in-memory mirror. */
    reset() {
      this.byId = {};
    }
  },
  persist: false
});
