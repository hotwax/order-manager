# Product data (rich product enrichment)

The order payload gives each line only `productId`, `itemDescription`, `externalId` — no
product name, SKU, or image. To show rich product info **without re-calling the same
product twice**, we adopt the inventory-count app's product-master pattern: a cache keyed
by `productId` that fetches on demand from Solr and refreshes cached products after the
configured stale window.

This is the **one product architecture** for the whole app — the order detail page is the
first consumer.

## Reference implementation

`inventory-count/src/composables/useProductMaster.ts` + `src/services/commonDatabase.ts`
+ `src/services/appInitializer.ts`.

Key properties of that implementation:

- **Per-OMS storage (multi-tenant).** The Dexie DB is named `${omsInstance}-CommonDB`, so
  each OMS keeps its own product cache. Logout does **not** drop the DB — switching OMS
  just opens a different database. Data for multiple OMS coexists.
- **`getById(productId)`** — read from cache; if hit and fresh (`updatedAt` within
  `staleMs`), return it; else fetch from Solr, upsert, return.
- **`prefetch(productIds)`** — fetch only missing or stale IDs, in batches.
- **`upsertFromApi(docs)`** — normalize Solr docs → product records + identification rows,
  bulk write.
- Product data source: a Solr query (`docType:PRODUCT`) selecting
  `productId, productName, parentProductName, internalName, mainImageUrl, goodIdentifications`.

## How order-manager differs

- **Solr access:** order-manager already queries Solr through `useSolrSearch().runSolrQuery`
  from `@common` (see `src/services/order.ts`). The product master uses the same, not the
  cycle-count-specific `inventory-cycle-count/runSolrQuery`.
- **Scope:** order detail only needs product display fields (name, SKU/identifier, image).
  No inventory/ATP tables, no scan/variance tables — those are cycle-count concerns.

## Storage backend — Dexie/IndexedDB

The backend is **Dexie/IndexedDB, multi-tenant per OMS**, aligned with inventory-count.
The `productCache` store keeps a reactive in-memory mirror for the current session and
persists records in the Dexie DB named `${oms}-CommonDB`.

`updatedAt` is written whenever Solr product data is cached. `useProductMaster` compares
that timestamp with `staleMs` before returning a cache hit, so persisted product data can
survive reloads without becoming permanent stale data.

| Capability | Current behavior |
| --- | --- |
| Fresh cache hit | Served from the reactive mirror after Dexie hydration |
| Missing or stale product | Re-fetched from Solr and persisted back to Dexie |
| Survives reload / new session | Yes, via `${oms}-CommonDB` |
| Multi-tenant per OMS | Yes, each OMS gets a separate Dexie DB |
| Logout behavior | Clears only the in-memory mirror; Dexie data stays available for the same OMS |
| Public API (`getById`, `getByIds`, `prefetch`, `upsertFromApi`, `cacheReady`) | Stable |

## API design

A Pinia store `productCache` owns the reactive mirror and Dexie persistence; a composable
`useProductMaster` is the public API (so consumers never touch the store internals —
matches inventory-count).

```ts
useProductMaster() => {
  init(opts?)                         // set staleMs etc.; marks cacheReady
  getById(productId): Promise<{ product, status }>   // cache hit | fetch+cache
  getByIds(productIds): Promise<Product[]>           // batched Solr fetch
  prefetch(productIds): Promise<void>                // fetch only missing or stale ids
  upsertFromApi(docs): void                          // normalize + store
  cacheReady: Ref<boolean>
}

Product = { productId, productName, sku, parentProductName, internalName, mainImageUrl, goodIdentifications, updatedAt }
```

`getByIds` builds a Solr query:

```
filter: productId:(ID1 OR ID2 ...),isVirtual:false
fields: productId, productName, parentProductName, internalName, sku, mainImageUrl, goodIdentifications
```

## Order detail integration

After the order loads, prefetch the products for its items, then bind names from the cache:

```ts
const productIds = orderDetail.allItems.map(i => i.productId);
await useProductMaster().prefetch(productIds);   // one batched call, only missing/stale ids
```

Item display label resolves: `product.productName || itemDescription || productId`.
SKU resolves from `product.sku` (or `goodIdentifications`), falling back to `productId`.

The binding **degrades gracefully**: if the cache is empty (e.g. Solr unavailable), items
still render with `itemDescription` + `productId`. Product enrichment is additive, never a
hard dependency — the page always renders from the single order payload.
