import { ref } from "vue";
import { useSolrSearch, commonUtil, logger} from "@common";
import { useProductCacheStore, type CachedProduct, type ProductIdentification } from "@/store/productCache";

/**
 * Product master — fetch rich product data (name, SKU, image) from Solr, cached per
 * productId and NEVER refetched once cached. The order detail page is the first consumer.
 *
 * This mirrors inventory-count/src/composables/useProductMaster.ts. Same public API; the
 * storage backend is currently the in-memory productCache store (Dexie deferred — see
 * docs/ProductData.md and docs/Compromises.md). Consumers never touch the store directly.
 */

const PRODUCT_FIELDS = "productId productName parentProductName internalName goodIdentifications mainImageUrl";
const BATCH_SIZE = 200;

const cacheReady = ref(false);
const staleMs = ref(24 * 60 * 60 * 1000);

function init(opts?: { staleMs?: number }) {
  if (opts?.staleMs !== undefined) staleMs.value = opts.staleMs;
  cacheReady.value = true;
}

function escapeSolrValue(value: string) {
  return String(value).replace(/([\\+\-!(){}[\]^"~*?:]|&&|\|\|)/g, "\\$1");
}

function parseGoodIdentifications(raw: any): ProductIdentification[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((identification: any) => {
    if (typeof identification === "string") {
      const slash = identification.indexOf("/");
      return slash === -1
        ? { type: "", value: identification.trim() }
        : { type: identification.slice(0, slash).trim(), value: identification.slice(slash + 1).trim() };
    }
    return { type: String(identification?.type || "").trim(), value: String(identification?.value || "").trim() };
  });
}

function mapDocToProduct(doc: any): CachedProduct {
  const goodIdentifications = parseGoodIdentifications(doc.goodIdentifications);
  const sku = doc.sku || goodIdentifications.find((identification) => identification.type === "SKU")?.value || "";
  return {
    productId: doc.productId,
    productName: doc.productName || "",
    sku,
    parentProductName: doc.parentProductName || "",
    internalName: doc.internalName || "",
    mainImageUrl: doc.mainImageUrl || "",
    goodIdentifications,
    updatedAt: Date.now()
  };
}

function buildProductQuery(productIds: string[]) {
  return {
    json: {
      params: {
        rows: productIds.length,
        start: 0,
        "q.op": "AND",
        fl: PRODUCT_FIELDS
      } as Record<string, any>,
      query: "*:*",
      filter: ["docType:PRODUCT", `productId:(${productIds.map(escapeSolrValue).join(" OR ")})`]
    }
  };
}

/** Fetch products from Solr in batches. Does not touch the cache. */
async function getByIds(productIds: string[]): Promise<CachedProduct[]> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return [];

  const products: CachedProduct[] = [];
  for (let index = 0; index < ids.length; index += BATCH_SIZE) {
    const batch = ids.slice(index, index + BATCH_SIZE);
    try {
      const resp = await useSolrSearch().runSolrQuery(buildProductQuery(batch));
      if (commonUtil.hasError(resp)) {
        logger.error("Product Solr query returned an error", resp.data);
        continue;
      }
      const docs = resp.data?.response?.docs || [];
      products.push(...docs.map(mapDocToProduct));
    } catch (error) {
      logger.error("Product Solr query failed", error);
    }
  }
  return products;
}

/** Fetch only the productIds not already cached, then store them. The never-refetch path. */
async function prefetch(productIds: string[]) {
  const cache = useProductCacheStore();
  await cache.ensureHydrated(); // pull this OMS's persisted products from Dexie first
  const idsToFetch = [...new Set(productIds.filter(Boolean))].filter((id) => !cache.has(id));
  if (!idsToFetch.length) return;

  const products = await getByIds(idsToFetch);
  if (products.length) await cache.upsert(products);
}

/** Cache-first single lookup. */
async function getById(productId: string, opts?: { refresh?: boolean }) {
  const cache = useProductCacheStore();
  await cache.ensureHydrated();
  const existing = cache.getProduct(productId);
  if (existing && !opts?.refresh) return { product: existing, status: "hit" as const };

  const products = await getByIds([productId]);
  if (products.length) {
    await cache.upsert(products);
    return { product: cache.getProduct(productId), status: existing ? ("refreshed" as const) : ("miss-refreshed" as const) };
  }
  return { product: existing, status: existing ? ("stale" as const) : ("miss" as const) };
}

function upsertFromApi(docs: any[]) {
  useProductCacheStore().upsert(docs.map(mapDocToProduct));
}

export function useProductMaster() {
  return { init, getById, getByIds, prefetch, upsertFromApi, cacheReady };
}
