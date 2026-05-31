# Product data (rich product enrichment)

The order payload gives each line only `productId`, `itemDescription`, `externalId` — no
product name, SKU, or image. To show rich product info **without re-calling the same
product twice**, we adopt the inventory-count app's product-master pattern: a cache keyed
by `productId` that fetches on demand from Solr and never refetches a cached product.

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
- **`prefetch(productIds)`** — fetch only the IDs **not already cached**, in batches.
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

## Storage backend — Dexie deferred (see Compromises.md)

The intended backend is **Dexie/IndexedDB, multi-tenant per OMS**, identical to
inventory-count. It is **not installed yet**: `pnpm add dexie` fails on a pre-existing
workspace catalog error (`No catalog entry 'chart.js'`) that is out of scope to fix.

Therefore this phase ships a **storage-abstracted in-memory cache** with the **same public
API**. The order-detail consumer code does not change when we later swap the backend to
Dexie — only the internals of the store/composable do.

| Capability | In-memory (now) | Dexie (target) |
| --- | --- | --- |
| Never refetch within a session | ✅ | ✅ |
| Survives reload / new session | ❌ (re-fetched on demand) | ✅ |
| Multi-tenant per OMS | n/a (cleared on logout) | ✅ `${oms}-CommonDB` |
| Public API (`getById`, `getByIds`, `prefetch`, `upsertFromApi`, `cacheReady`) | ✅ | ✅ |

When the catalog issue is resolved: `pnpm --filter order-manager add dexie`, then replace
the in-memory Map in the product store with the `CommonDB` Dexie tables (products +
productIdentification), keyed by `${oms}-CommonDB`. No consumer changes.

## API design (this phase)

A Pinia store `productCache` holds the cache; a composable `useProductMaster` is the public
API (so consumers never touch the store internals — matches inventory-count).

```ts
useProductMaster() => {
  init(opts?)                         // set staleMs etc.; marks cacheReady
  getById(productId): Promise<{ product, status }>   // cache hit | fetch+cache
  getByIds(productIds): Promise<Product[]>           // batched Solr fetch
  prefetch(productIds): Promise<void>                // fetch only uncached ids
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
await useProductMaster().prefetch(productIds);   // one batched call, only uncached ids
```

Item display label resolves: `product.productName || itemDescription || productId`.
SKU resolves from `product.sku` (or `goodIdentifications`), falling back to `productId`.

The binding **degrades gracefully**: if the cache is empty (e.g. Solr unavailable), items
still render with `itemDescription` + `productId`. Product enrichment is additive, never a
hard dependency — the page always renders from the single order payload.
