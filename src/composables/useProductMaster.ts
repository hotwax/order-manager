import { ref } from "vue";
import { useSolrSearch, commonUtil, logger} from "@common";
import { useProductCacheStore, type CachedProduct, type ProductIdentification } from "@/store/productCache";
import { useProductStore } from "@/store/productStore";

/**
 * Product master — fetch rich product data (name, SKU, image) from Solr, cached per
 * productId and NEVER refetched once cached. The order detail page is the first consumer.
 *
 * This mirrors inventory-count/src/composables/useProductMaster.ts. Same public API; the
 * storage backend is currently the in-memory productCache store (Dexie deferred — see
 * docs/ProductData.md and docs/Compromises.md). Consumers never touch the store directly.
 */

const PRODUCT_FIELDS = "productId productName parentProductName internalName goodIdentifications mainImageUrl productFeatures";
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
    productFeatures: Array.isArray(doc.productFeatures) ? doc.productFeatures : [],
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

/**
 * A product persisted before a field joined PRODUCT_FIELDS has no such key at all, and the
 * never-refetch rule would strand it incomplete forever. Treat a missing key as a miss so it
 * heals exactly once; an empty array is a real answer and stays cached. Add a key here
 * whenever PRODUCT_FIELDS grows.
 */
function isFullyCached(product?: CachedProduct): boolean {
  return !!product && "productFeatures" in product;
}

/** Fetch only the productIds not already cached, then store them. The never-refetch path. */
async function prefetch(productIds: string[]) {
  const cache = useProductCacheStore();
  await cache.ensureHydrated(); // pull this OMS's persisted products from Dexie first
  const idsToFetch = [...new Set(productIds.filter(Boolean))].filter((id) => !isFullyCached(cache.getProduct(id)));
  if (!idsToFetch.length) return;

  const products = await getByIds(idsToFetch);
  if (products.length) await cache.upsert(products);
}

/** Cache-first single lookup. */
async function getById(productId: string, opts?: { refresh?: boolean }) {
  const cache = useProductCacheStore();
  await cache.ensureHydrated();
  const existing = cache.getProduct(productId);
  if (isFullyCached(existing) && !opts?.refresh) return { product: existing, status: "hit" as const };

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

/**
 * Product identity — the operator-configured display name and secondary line (Settings >
 * Product identifier), mirroring inventory-count/src/composables/useProductMaster.ts's
 * primaryId/secondaryId. Every place that shows a product for an order, return, or swap item
 * reads it through here instead of a hardcoded field (productName, sku, internalName, ...), so
 * the store's chosen identifier (e.g. internalName/parentProductName on rails-oms) is honored
 * everywhere rather than in whichever views happened to be written against it.
 *
 * `product` is whatever identity-bearing object is on hand for this row — a cached
 * CachedProduct, a denormalized order/return/swap item, or nothing yet. commonUtil.
 * getProductIdentificationValue throws on `undefined` (`Object.keys(undefined)`), so this
 * always normalizes it first; callers never need to guard that themselves.
 *
 * `fallbacks` is an ordered list of this call site's own denormalized fields, used only when
 * the preferred identifier has no value on this particular product — e.g. before the product
 * cache has warmed, or when a custom line item has no catalog product at all. inventory-count's
 * version has no such parameter (its fallback is a fixed SKU-then-productId chain); order-manager
 * needed the caller-supplied list because its call sites' available fallback data genuinely
 * differs row to row (a Shopify custom line item falls back to its own title, a ship-group item
 * to its order-payload name).
 */
function resolveIdentity(idKey: string, product: any, fallbacks: Array<string | null | undefined>): string {
  const preferred = commonUtil.getProductIdentificationValue(idKey, product || {});
  return preferred || fallbacks.find((candidate) => !!candidate) || "";
}

function primaryId(product: any, fallbacks: Array<string | null | undefined> = []): string {
  return resolveIdentity(useProductStore().getProductIdentificationPref.primaryId, product, fallbacks);
}

function secondaryId(product: any, fallbacks: Array<string | null | undefined> = []): string {
  return resolveIdentity(useProductStore().getProductIdentificationPref.secondaryId, product, fallbacks);
}

export function useProductMaster() {
  return { init, getById, getByIds, prefetch, upsertFromApi, cacheReady, primaryId, secondaryId };
}
