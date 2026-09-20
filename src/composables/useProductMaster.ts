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

// Every field Settings > Product identifier can point at: the static options from
// productStore.prepareProductIdentifierOptions plus goodIdentifications, which carries the
// fetched types (UPC and friends). A field missing here silently resolves to a call site's
// fallback, so the operator's choice would be honoured for some options and not others.
const PRODUCT_FIELDS = "productId productName parentProductName internalName groupId groupName primaryProductCategoryName title goodIdentifications mainImageUrl productFeatures";
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
    groupId: doc.groupId || "",
    groupName: doc.groupName || "",
    primaryProductCategoryName: doc.primaryProductCategoryName || "",
    title: doc.title || "",
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
 * heals exactly once; an empty value is a real answer and stays cached. Add a key here
 * whenever PRODUCT_FIELDS grows.
 */
const CACHED_IDENTITY_KEYS = [
  "productFeatures",
  "groupId",
  "groupName",
  "primaryProductCategoryName",
  "title"
] as const;

function isFullyCached(product?: CachedProduct): boolean {
  return !!product && CACHED_IDENTITY_KEYS.every((key) => key in product);
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
 * Product identity — the display name and secondary line the operator chose in
 * Settings > Product identifier. Every surface that names a product for an order, return or
 * swap reads it through here instead of hardcoding a field, so a store that identifies goods
 * by internalName or parentProductName gets that everywhere, not only in the views that
 * happened to be written against it.
 *
 * `product` is whatever identity-bearing object the row has: a CachedProduct, a denormalized
 * order/return/swap item, or nothing yet. commonUtil.getProductIdentificationValue throws on
 * undefined, so this normalizes first and callers never guard it themselves.
 *
 * `fallbacks` are the call site's own denormalized fields, used only when the preferred
 * identifier has no value here — before the cache warms, or for a custom line with no catalog
 * product at all. The list is per-call because what a row can fall back on genuinely differs:
 * a Shopify custom line has its own title, a return item its description.
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
