# Compromises log

Status: **historical implementation log**. Use this for context on why decisions were made
or how the local environment was verified; use the other docs for the current planned
architecture.

Running log of compromises made during the order-detail data-enrichment build
(autonomous session, 2026-05-31). Read top to bottom.

---

## 0. Bugs found & fixed during end-to-end preview testing

Drove the running app (`/orders/M103061`) in a browser preview. The page initially got
stuck on "Loading order…"; fixed three issues, all verified live afterwards (status badge
"Approved", customer "Kumar kartikey Choudhary" from the Person join, "Ext Other Gateways"/
"Authorized", "Shopify Order Id/Name/Number", facility "Dallas", and item "Abominable Hoodie"
+ SKU from the Dexie cache):

1. **Reactivity bug in `orderDetail.fetchOrder`** — `const entry = this.byOrderId[id] || (this.byOrderId[id] = newEntry())` captured the *raw* object, so `entry.status = "loaded"` / `entry.payload = …` mutated outside the reactive proxy and the UI never left "loading". Fixed by reading the entry back through the store (`this.byOrderId[id]`) so it's the reactive proxy.

2. **Seed datasets stuck on `loading` across reloads** — `persist: true` saved the transient "loading" status if a prior load was interrupted (e.g. during the Moqui restart), and `loadDataset` skips anything already "loading" → permanent stuck, labels never resolved. Fixed with `resetTransientLoadStates()` (called at the start of `loadInitialSeedData`) which demotes stale non-"loaded" statuses to "idle"/"loaded" so they refetch. Verified self-heal by injecting a stuck state and reloading.

3. **Seed not reloaded on an authenticated reload** — `postLogin` only fires on a login *transition*, so reloading a page with a persisted session never reran `loadInitialSeedData`. Added an idempotent authenticated-boot load in `App.vue onMounted`.

---

## 1. Dexie — ✅ RESOLVED (now installed + wired)

The blocker was a **dangling, unused `"chart.js": "catalog:"`** in `order-manager/package.json`
(no catalog entry, never imported anywhere). Removed that line → workspace installs again →
`pnpm --filter order-manager add dexie` (got **dexie 4.4.3**, resolved from the local store).
Wired the **multi-tenant Dexie backend**: `src/services/productDb.ts` (`${oms}-CommonDB`),
and `productCache.ts` now keeps a reactive in-memory mirror **persisted to Dexie** — hydrated
per OMS, never drops on logout (only the mirror clears). 28 tests + build still green.

The original in-memory-only note is kept below for history.

### (history) Dexie not installed — product cache is in-memory for now

**What:** The product master was specced to use Dexie/IndexedDB (multi-tenant per OMS,
persistent across sessions), mirroring inventory-count. Dexie is **not installed**.

**Why:** `pnpm --filter order-manager add dexie` fails on a **pre-existing workspace
catalog error**:
```
ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC  No catalog entry 'chart.js' was found for catalog 'default'.
```
`apps/order-manager/package.json` references `"chart.js": "catalog:"` but the workspace
catalog (`pnpm-workspace.yaml`) does not define `chart.js`. This blocks **all** new
dependency installs workspace-wide. Fixing it (adding a chart.js catalog entry) is out of
scope and would mean guessing a version, so I left it alone.

**What I did instead:** implemented `useProductMaster` with the **same public API** backed
by an **in-memory Pinia cache**. It still never refetches a product within a session. Only
cross-session persistence and multi-tenant on-disk storage are deferred.

**To finish (when you're back):**
1. Add a `chart.js` entry to the workspace catalog (or change order-manager's
   `"chart.js": "catalog:"` to a pinned version), so `pnpm install` works again.
2. `pnpm --filter order-manager add dexie`.
3. Swap the in-memory Map in `src/store/productCache.ts` for the `CommonDB` Dexie tables
   (per [Product data](../architecture/ProductData.md)). **No consumer changes** — the
   composable API is unchanged.

---

## 2. Person-name master join — ✅ RESOLVED (Moqui restarted + verified)

Restarted Moqui and confirmed the order payload now carries
`roles[PLACING_CUSTOMER].person` → customer name resolves to **"Kumar kartikey Choudhary"**
on order M103061. The running runtime's `oms` component is a symlink to
`~/Documents/GitHub/oms`, so the entity-master edit loaded on restart.

**Restart hiccup (for transparency):** `screen -X quit` killed the screen wrapper but
**orphaned** the original Moqui process tree, which kept holding port 8080. My relaunch then
collided on the war temp-extraction dir and corrupted the running classpath (a 500
"load global transforms" error). Recovered by killing the orphaned PIDs (8080 freed) and
relaunching a single clean instance. There is now exactly one healthy Moqui on 8080. If you
ever restart it yourself, kill the process tree (not just the screen): the start script is
`~/moqui-sd/notnaked/run-notnaked-moqui-local.sh`.

The original note is kept below for history.

### (history) Person-name master join requires a Moqui restart

**What:** Customer name should come from `Person`/`PartyGroup` via an extended `OrderRole`
master (see [Moqui changes](../backend/MoquiChanges.md)). I wrote the entity change in
`oms/entity/OrderExtendedEntities.xml` and validated the XML.

**Why a compromise:** Moqui loads entity definitions/masters at **framework startup** — it
does not hot-reload them. I did **not** restart your running Moqui (didn't want to disrupt
your environment). So until you restart Moqui, `oms/orders?...` will not include
`roles[].person`.

**Graceful behavior meanwhile:** the PWA reads `person.firstName + lastName` (or
`partyGroup.groupName`) when present, and **falls back to `postalAddress.toName`** when not.
After you restart Moqui, the richer name appears automatically — no PWA change needed.

**To finish:** restart Moqui, then verify `roles[].person`/`partyGroup` is in the payload.

---

## 3. seed.ts endpoint paths were broken; realigned to top-level

**What:** `seed.ts` called `oms/reference/{type}` for 7 datasets. The running server (and
the current `oms.rest.xml` working tree) serve these at **top-level `oms/{type}`**;
`oms/reference/*` now 404s. This was a **pre-existing break** (the worktree moved the
endpoints after commit `bc6892a`).

**Status:** by the time I added the new seed datasets, `seed.ts` was **already** on
top-level `oms/{type}` paths (matching the live server) — so no fix was needed in code.
Logged so you know the `oms/reference/*` layout from commit `bc6892a` is effectively
superseded by the top-level layout in both the running server and the PWA.

---

## 4. Order adjustment types endpoint is misplaced (used as-is)

`orderAdjustmentTypes` lives under `oms/shippingGateways/orderAdjustmentTypes` (nested in
the shippingGateways resource — almost certainly unintentional). It works, so the seed
store uses that path rather than adding a duplicate top-level endpoint. A future cleanup
should promote it to top-level `oms/orderAdjustmentTypes`. Left unchanged to avoid touching
unrelated structure.

---

## 6. Template graph left intact — some nodes are still static placeholders

Superseded for holds: the static hold banner was later removed and real holds now render in
the Holds tab via `OrderHeaderWorkEffort` / `ORDER_HOLD` WorkEfforts. The note below is kept
only as the earlier constraint that shaped the first binding pass.

I was told not to change the template graph or CSS of `OrderDetail.vue`, only the Vue
script and incorrect loops. Consequences:

- **Ship-group chips** ("May Split", "Gift", "High Priority") and the **"Order on hold:
  Address validation failed"** banner are **static** — they render on every order. The
  real values (`shipGroup.maySplit`, `shipGroup.isGift`) are now in the view model, so
  wiring `v-if` on the chips is a one-line change when you're ready. The hold banner needs
  work-effort/hold data, which is **explicitly deferred** (we are not loading work-effort
  seed yet), so it can't be bound now anyway.
- **Items and Comms segments render nothing** — the template only has a content `<div>`
  for the `ship-groups` segment. Adding `items`/`comms` content would change the graph, so
  I left it. The data is ready (`orderDetail.allItems`, `order.communicationEventOrders`)
  whenever you add those segment panels.
- **Fulfillment selects** (shipping method/carrier/address) keep their hardcoded options —
  they are action controls (deferred). Their `:value` binds to the real
  `shipmentMethodTypeId` / `carrierPartyId` / `contactMechId` so the current selection is
  correct; the option lists get seed-driven in the actions phase.

Everything that *could* be bound without touching the graph **is** bound: header, status,
timeline, customer card (name/email/phone/address with geo names), identifications,
payments, source, ship-group facility/method/carrier/address, and item rows (product
name/SKU from the cache). The one incorrect loop (`order.items` → `shipGroup.items`) was
fixed as authorized.

## 7. vue-tsc reports pre-existing project-wide type errors (not from this work)

`vue-tsc --noEmit` fails across the whole app (`App.vue`, `main.ts`, `order.ts`,
`customer.ts`, the user store, etc.) with `Property X does not exist on Store<…, {}, {}>` —
Pinia's getters/actions are being inferred as empty. This is a **pre-existing** project-wide
typing artifact. The project's build script is `vite build` (esbuild, no type-check) and it
**passes**; `vitest` **passes** (28 tests). My new files add no new error classes — the only
flags on them are the same Pinia store-access pattern every existing store already trips.
Not fixed (out of scope; would be a global tsconfig/Pinia-version change).

## 5. Geo loaded into the seed store (localStorage), not Dexie

Geo is 963 needed rows (~162 KB) / 1,388 total (~232 KB) — small. Put it in the seed store
(persisted to localStorage) like other reference data, rather than Dexie. This is a
deliberate choice, not a forced compromise: Dexie is reserved for large per-product data.
See [Geo data](../architecture/GeoData.md) for the measured size/load analysis.
