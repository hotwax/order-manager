# Product data

Status: **implemented**. Product enrichment is backed by Dexie and a reactive Pinia mirror.

The order payload gives each line `productId`, `itemDescription`, and `externalId`, but not
the rich product display fields the UI needs. Order Manager follows the inventory-count
product-master pattern: fetch product display data from Solr on demand, cache by
`productId`, and do not refetch products that are already cached.

## Runtime pieces

| Piece | File | Responsibility |
| --- | --- | --- |
| Product master API | `src/composables/useProductMaster.ts` | Fetch product docs from Solr, batch prefetch, map docs into cache records. |
| Reactive cache | `src/store/productCache.ts` | Synchronous UI reads from `byId`; hydrates and persists through Dexie. |
| Persistent storage | `src/services/productDb.ts` | Dexie database named `${oms}-CommonDB`, one cache per OMS instance. |

Consumers should use `useProductMaster()` for fetch/prefetch work and
`productCache.getProduct(productId)` for synchronous display reads. Screens should not
query Solr directly for product labels.

## Storage decision

Dexie is installed and wired. The cache has two layers:

- A reactive in-memory mirror in Pinia so Vue templates can render immediately and update
  when products arrive.
- A per-OMS Dexie database (`${oms}-CommonDB`) so product display data survives reloads and
  multiple OMS instances can coexist.

Logout clears only the in-memory mirror. Persisted Dexie data stays available for the next
login to the same OMS.

## Product master API

```ts
useProductMaster() => {
  init(opts?)
  getById(productId, opts?)
  getByIds(productIds)
  prefetch(productIds)
  upsertFromApi(docs)
  cacheReady
}
```

`prefetch(productIds)` hydrates the Dexie mirror first, removes IDs already in cache, then
fetches only the missing products in Solr batches.

`getById(productId)` is cache-first. It can refresh when explicitly requested, but normal
order-detail rendering does not refresh an already cached product.

## Solr query

The product master uses `useSolrSearch().runSolrQuery` from `@common`, matching the app's
existing Solr access pattern.

```text
filter: docType:PRODUCT
filter: productId:(ID1 OR ID2 ...)
fields: productId, productName, parentProductName, internalName, goodIdentifications, mainImageUrl
```

The app derives SKU from `doc.sku` when present, otherwise from `goodIdentifications` where
the type is `SKU`.

## Order detail integration

After an order loads, the page prefetches products for its item rows:

```ts
const productIds = orderDetail.allItems.map((item) => item.productId);
await useProductMaster().prefetch(productIds);
```

Display fallback order:

1. `product.productName`
2. `item.itemDescription`
3. `item.productId`

SKU fallback order:

1. `product.sku`
2. matching SKU value from `goodIdentifications`
3. `item.productId`

Product enrichment is additive. If Solr is unavailable or a product is missing from the
index, the order page still renders from the order payload.
