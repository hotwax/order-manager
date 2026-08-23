# Unified facility inventory modal

Spec for collapsing `PhysicalFacilityModal` and `ItemFacilityInventoryModal`
into one facility picker whose level of detail scales with how many order items
are being placed at once.

Status: **implemented and verified on Rails UAT** (`rails-uat.hotwax.io`).
Shipped as `src/components/fulfillment/FacilityInventoryModal.vue`; both
`PhysicalFacilityModal.vue` and `ItemFacilityInventoryModal.vue` are deleted.
Screenshots in [pr-screenshots/](pr-screenshots/).

Guiding principle for every rendering choice below: **maximum information
transparency without being inaccurate.** Never hide a facility the operator
could legitimately pick, and never print a number the data does not support —
a facility with no `ProductFacility` record shows `—`, not `0`.

Every endpoint, parameter, and field named in this spec was confirmed against
the Rails UAT release build. No invented endpoints; where the current code reads
a field that does not exist there, this spec says so.

## Today

| Surface | Modal | Facility universe | Per-facility data | Callers |
| --- | --- | --- | --- | --- |
| Item facility chip (single item) | `ItemFacilityInventoryModal` | `oms/productFacilities?productId=…`, narrowed to the store's `ProductStoreFacility` set when `productStoreId` is passed | Available, ATP, QOH, safety stock, brokering, OMS fulfillment, consumed/limit, remaining capacity | `rejectAndReleaseItem` — [OrderDetail.vue:3220](../src/views/OrderDetail.vue#L3220) |
| Ship group **Release** (1..n items) | `PhysicalFacilityModal` | `oms/facilities` filtered to non-virtual facilities | Name + id only | `releaseSelectedItems` → `openPhysicalFacilityModal` — [OrderDetail.vue:3535](../src/views/OrderDetail.vue#L3535) |

Both dismiss with a bare `facilityId` string and are single-select with a save
FAB. `FacilityModal` (parking, swaps, bad address) is a different concern —
virtual/parking facilities — and is **out of scope**.

The gap: the detailed modal is item-scoped by construction (`productId` is a
scalar prop), so the multi-item release path fell back to a modal with no
inventory signal at all. An operator releasing three items has to guess.

## Goal

One component, `FacilityInventoryModal.vue`, taking **a list of order items**:

- **1 item** — today's detail rows, plus a shortfall flag when
  `available < quantity` (resolved decision **R3**).
- **2+ items** — same facility rows and same facility-level data (brokering,
  consumed/limit, remaining capacity), with the per-item inventory columns
  collapsed to *how many of the selected items this facility covers*.

Plus a chip strip naming the items under evaluation, which doubles as a way to
focus one item and get the full detail back.

## Resolved decisions

| # | Decision | Consequence |
| --- | --- | --- |
| **R1** | Row set is **all physical facilities**, stocked or not | 17 facilities on Rails UAT (28 total, 11 virtual). Rows with no inventory record render `—`, never `0`. |
| **R2** | Releasing to a zero/unknown-stock facility is **allowed** | Every row selectable. No confirmation gate, no disabled rows. |
| **R3** | Single-item mode **flags** `available < quantity` | Shortfall logic shared by both modes, so they never disagree. |
| **R4** | `productId_op=in` **works on Rails UAT** | One `productFacilities` call and one `inventoryLogs` call cover every selected product. Verified live — see below. |

R1 has a knock-on the spec resolves rather than re-asks: today the item modal
narrows to the store's `ProductStoreFacility` set when `productStoreId` is
passed. Hiding those facilities contradicts R1, so instead **show them and label
them** — a facility outside the product store's set renders a `Not in store`
badge and sorts below in-store facilities.

## Backend contract (verified on Rails UAT)

Verified by authenticated read-only GETs against `rails-uat.hotwax.io` on
2026-08-16, using the dev credentials already in `.env.local`
(`VITE_DEV_OMS=rails-uat`). Every endpoint below is present on that release
build; response counts are that instance's real data.

### Endpoints

| Endpoint | Present | Live shape on Rails UAT |
| --- | --- | --- |
| `GET oms/facilities/` (list `FacilityAndType`) | ✅ | 28 rows total; 17 after the physical filter |
| `GET oms/productFacilities/` (list `ProductFacility`) | ✅ | 1,004,659 rows total |
| `GET oms/inventoryLogs/` (list `InventoryItem`) | ✅ | returns `quantityOnHandTotal`, `availableToPromiseTotal` |
| `GET oms/facilities/facilityOrderCounts` (list `FacilityOrderCount`) | ✅ | 5 rows total, 0 for today — **superseded** by the admin mount below |
| `GET admin/facilities/orderCount` (company app's call) | ✅ | same data, accepts `facilityId_op=in` + `entryDate`; the one this spec uses |
| `GET admin/productStores/{id}/facilities` | ✅ | 19 rows for store `STORE` |
| `GET oms/facilityGroups`, `GET oms/groupFacilities` | ✅ | already seeded by `seed.ts` |

### `_op=in` — confirmed live

These are Moqui entity-auto `operation="list"` mounts, so the search-form
suffixes (`_op`, `_not`, `_ic`, `_from`/`_thru`) apply to any entity field even
though Swagger advertises only the plain names. Verified, not assumed:

```
GET oms/productFacilities/?productId_op=in&productId=171502,171656&pageSize=50
→ 2 rows, X-Total-Count: 2, distinct productIds ['171502','171656']

GET oms/productFacilities/?productId=171502&pageSize=50
→ 1 row, X-Total-Count: 1
```

`oms/inventoryLogs/?productId_op=in&productId=171502,171656` behaves the same.
For `_op=in`, a string value is split on commas — fall back to per-product calls
if any selected `productId` contains a comma.

The physical-facility filter already used by `PhysicalFacilityModal` also checks
out, though **not for the reason the code implies**:

```
GET oms/facilities/?pageSize=1                                → X-Total-Count: 28
GET oms/facilities/?facilityTypeId=VIRTUAL_FACILITY           → X-Total-Count: 0
GET oms/facilities/ + facilityTypeId_not/parentTypeId_not     → X-Total-Count: 17
```

No facility has `facilityTypeId = VIRTUAL_FACILITY`; the exclusion is entirely
done by `parentTypeId != VIRTUAL_FACILITY`. The `facilityTypeId` half of that
query is dead weight and can be dropped.

Every list op **silently caps at 100 rows** without an explicit `pageSize` or
`pageNoLimit=true`. Responses do carry `X-Total-Count`, but **the browser cannot
read it**: the OMS omits it from `Access-Control-Expose-Headers` (which lists
only `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`,
`X-CSRF-Token`, `moquiSessionToken`), and every call the app makes is
cross-origin. Verified from the running app — `resp.headers.get('x-total-count')`
returns `null` while curl sees the header.

So the paging signal is row count: request an explicit `pageSize` and keep
fetching while a page comes back full. Silent truncation would understate
coverage, the one failure mode the transparency principle cannot tolerate.
Exposing the header is a one-line OMS fix worth proposing separately.

### Order capacity: cached limit, live consumption

The **company app already solves this**, and order-manager should copy it rather
than invent a third approach.

**Limit — cached.** `maximumOrderLimit` is a facility field, and order-manager
**already persists it to IndexedDB**: the `facilities` table's
`facilityProjection` stores `facilityId`, `facilityName`, `facilityTypeId`,
`parentTypeId`, `ownerPartyId`, `maximumOrderLimit`, `description`
([commonSeedEntities.ts:77-88](../../../common/cache/domains/commonSeedEntities.ts#L77-L88)).
So the limit needs no network call at all. Company's semantics, which this spec
adopts verbatim
([useFacilities.ts:742](../../company/src/composables/useFacilities.ts#L742)):

```
maximumOrderLimit === 0   → no capacity (accepts no orders)
maximumOrderLimit > 0     → custom limit
absent / null             → unlimited
```

What the current modal reads instead is broken, which is why the column has
never shown a number:

- **`ProductFacility.maximumOrderLimit`** is not a field on the entity (Swagger
  lists `maximumStock`, `reorderPoint`, `minimumStock`, `allowBrokering`, …, no
  `maximumOrderLimit`), so
  [facilityInventory.ts:105](../src/utils/facilityInventory.ts#L105) always
  resolves it to `null`.
- **`ProductStoreFacility.maximumOrderLimit`** exists on the entity, but
  `admin/productStores/STORE/facilities` returns no such key on any of its 19
  rows.

**Consumption — live, never cached.** Company fetches it on every entry and
deliberately keeps it out of the cached record, because caching a
constantly-changing number would serve a stale count from IndexedDB
([useFacilities.ts:566-591](../../company/src/composables/useFacilities.ts#L566-L591)):

```
GET admin/facilities/orderCount
    ?facilityId=<comma-joined>&facilityId_op=in
    &entryDate=<today>&pageSize=<facilityIds.length>
→ rows of { facilityId, lastOrderCount, entryDate }
```

Confirmed live on Rails UAT with the 17 physical facility ids: HTTP 200,
`X-Total-Count: 0` for today, 5 rows across all dates (most recent
`M100051 = 158`). So on this instance every facility legitimately reads
**0 consumed today** — that is a real measurement, not missing data. Order
manager should switch from `oms/facilities/facilityOrderCounts` (unscoped, all
facilities) to this scoped call.

Two traps the company app documents and this spec inherits: the endpoint is a
**time series**, one row per facility per `entryDate` oldest-first, so it must
be filtered to today — taking the first row of an unfiltered response yields the
oldest day on record; and the field is `lastOrderCount`, not `orderCount`.
`normalizeFacilityRows` already gets both of these right; only the endpoint and
the facility scoping change.

### Field population reality on Rails UAT

| Field | Populated | Consequence for rendering |
| --- | --- | --- |
| `ProductFacility.allowBrokering` | 164,494 / 1,004,659 rows (~16%) | **Absent means `Y`.** Keep the existing `\|\| 'Y'` default — it is the domain default, not a fabrication. |
| `ProductFacility.minimumStock` | 7,758 rows (<1%) | Display `—` when absent; still compute `available` with `0`. |
| `FacilityOrderCount` for today | 0 rows | `0 consumed` is accurate. Capacity reads `0 / Unlimited` for most facilities, which is the true state. |
| `lastInventoryCount` | often negative (`-1` seen) | Display the real number; floor at `0` only for the coverage test. |

## Component contract

```ts
// src/components/fulfillment/FacilityInventoryModal.vue
type FacilityInventoryModalItem = {
  orderItemSeqId: string;
  productId: string;
  name: string;          // groupPrimaryIdentifier(group) at the call site
  sku?: string;
  imageUrl?: string;     // getProduct(productId)?.mainImageUrl
  quantity?: number;     // defaults to 1
};

defineProps<{
  items: FacilityInventoryModalItem[];
  productStoreId?: string;
  title?: string;        // defaults to translate('Select Facility')
}>();
```

Dismiss payload stays a bare `facilityId: string`, so both call sites keep their
current `const { data: facilityId } = await modal.onWillDismiss()`.
Multi-facility splitting (item A here, item B there) is **not** in scope.

`cssClass`: rename `item-facility-inventory-modal` → `facility-inventory-modal`
(same `--width: 800px` above 991px).

## Layout

### Header

```
┌────────────────────────────────────────────────┐
│ ✕   Select Facility                            │  toolbar 1
├────────────────────────────────────────────────┤
│ [🖼 Blue Tee ×2] [🖼 Grey Sock] [🖼 Cap]  →     │  toolbar 2, h-scroll
├────────────────────────────────────────────────┤
│ 🔍 Search facilities                           │  toolbar 3
└────────────────────────────────────────────────┘
```

- Toolbar 1: start-slot icon-only close button, required by
  [modalCompliance.spec.ts](../tests/components/modalCompliance.spec.ts).
- Toolbar 2 — **item chip strip**: one `ion-chip` per item in caller order, each
  with an `ion-avatar` + `DxpShopifyImg` thumbnail and a label of `name` plus
  `×{quantity}` when quantity > 1. Horizontally scrollable, never wrapping.
  - **Focus (2+ items):** tapping a chip focuses that item — the list switches to
    full single-item detail rows for it; the focused chip renders filled, the
    rest `outline`. Tapping it again returns to the summary.
  - **1 item:** the single chip renders filled and inert.
  - Filled vs. `outline` carries active state, so no new colour CSS.
- Toolbar 3: existing searchbar (`filterFacilityRows`, unchanged).

Focus changes never reset the selected facility or the search query.

### List — single item (or focused item)

Today's columns minus OMS fulfillment: Available, ATP, QOH, Safety stock,
Brokering, Consumed/Limit + Remaining. Mobile keeps the accordion with the same
values as `ion-item`/`ion-note` pairs. The OMS fulfillment Y/N column was
dropped from both modes — it does not inform where to place an item.

Changes, all from the field-population findings above:

- `available < requiredQuantity` → `Short by N` sub-line on the Available cell (**R3**).
- No `ProductFacility` record → Available/ATP/Safety stock render `—` with a
  `No inventory record` sub-line, not `0`.
- Absent `minimumStock` renders `—` while still computing as `0`.
- `Allow brokering` keeps `Y` when the field is absent — that is the domain
  default, not missing data.
- `Order limit` / `Remaining capacity` start showing real numbers for the first
  time, from the cached facility record plus the live order count.

### List — 2+ items, summary mode

Desktop/tablet `.list-item` grid, 4 columns
(`minmax(180px, 3fr) minmax(140px, 2fr) 1fr max-content`) — as rendered on
Rails UAT:

| Facility | Coverage | Brokering | Capacity |
| --- | --- | --- | --- |
| 2301 E. 51st St.<br>`M100051` | **3 of 5 items**<br>`Short: 201132-582B-001:41`<br>`No record: 566-150H-12101:L` | Y | 0 / Unlimited<br>Remaining Unlimited |
| Fashion Island<br>`M100005` | **3 of 5 items**<br>`Short: 201132-582B-001:41, 566-150H-12101:L` | Partial | 0 / Unlimited<br>Remaining Unlimited |
| NY - Prince St<br>`M100011` | **2 of 5 items** | Partial | 0 / No capacity<br>Remaining No capacity |

- The coverage sub-line names the items that fall short, truncated to two names
  plus `+N more`. `Short:` (record exists, not enough) and `No record:` (no
  `ProductFacility` row) are listed separately — they mean different things
  operationally.
- Fully covered rows show no sub-line.
- Mobile: `ion-accordion` per facility. Header shows facility identity, radio,
  and `3 of 3`. Content lists **one `ion-item` per selected item**
  (`item name` → `Available N` / `—`) followed by the capacity rows, so mobile
  drill-down works without the chip focus.

### Availability rule

An item is covered at a facility when
`available >= requiredQuantity(productId)`, where `requiredQuantity` aggregates
`quantity` across every selected item sharing that `productId` — two lines of
the same SKU need both units from one facility.

`available` keeps its existing definition,
[facilityInventory.ts:102-103](../src/utils/facilityInventory.ts#L102-L103):
`computedLastInventoryCount ?? max(atp - safetyStock, 0)`.

Three distinct states, never collapsed into one:

| State | Numeric cells | Coverage |
| --- | --- | --- |
| Record exists, enough stock | actual numbers (negatives shown as-is) | covered |
| Record exists, short | actual numbers + `Short by N` | not covered |
| No `ProductFacility` record | `—` + `No inventory record` | not covered |

### Sorting

Summary mode:

1. In-store facilities before `Not in store` facilities.
2. Covered-item count, descending.
3. Minimum surplus (`available - required`), descending.
4. Facility name, `localeCompare` with `numeric: true`.

Single/focused mode re-sorts by **the detailed item alone** (covered first, then
surplus, then name). Ranking a focused list by overall coverage would bury the
facility the operator is actually looking at. `sortFacilityCoverageRows` takes
the detailed index as its second argument for this.

## Data

The seed store already caches most of this, so the modal makes **three** network
calls regardless of item count:

| Source | Call | Notes |
| --- | --- | --- |
| **Row set** | none — `facilityCache` / `seedStore.facilities` | IndexedDB `facilities` table, loaded from `oms/facilities` (`pageSize: 1000`) by [seed.ts:638](../src/store/seed.ts#L638). Filter in memory on `parentTypeId !== 'VIRTUAL_FACILITY'`. 17 rows on Rails UAT. |
| **Order limit** | none — same cached row | `maximumOrderLimit` is already in `facilityProjection`. Cached, per the company app. |
| In-store badge | none — `seedStore.productStoreFacilitiesByStoreId` | From `admin/productStores/{id}/facilities` via `loadProductStoreSeedData`. |
| Inventory | `oms/productFacilities?productId_op=in&productId=<joined>&pageSize=500` | Page while pages come back full. |
| QOH | `oms/inventoryLogs?productId_op=in&productId=<joined>&pageSize=500` | Same paging. One call covers all products. |
| **Consumed today** | `admin/facilities/orderCount?facilityId=<joined>&facilityId_op=in&entryDate=<today>&pageSize=<n>` | Volatile — live on every open, **never cached**, scoped to the facilities being shown. Company app pattern. |

Three network calls, all independent of item count. Reuse the company app's
`useFacilityOrderCounts().fetchOrderCounts(facilityIds)` shape rather than
re-deriving it.

Keep the existing `Promise.allSettled` tolerance: a failed `inventoryLogs` or
`orderCount` degrades to `—` on those cells. A failed `productFacilities` is
**fatal** — the rows would render as though nothing is stocked anywhere, which
is exactly the inaccurate outcome the principle forbids; show an error state
instead.

### Util changes — `src/utils/facilityInventory.ts`

Keep `normalizeFacilityRows` as the per-product primitive. Add:

```ts
export type FacilityItemAvailability = {
  orderItemSeqId: string;
  productId: string;
  required: number;
  available: number | null;   // null = no ProductFacility record
  atp: number | null;
  qoh: number | null;
  safetyStock: number | null; // null = minimumStock absent; computes as 0
  hasRecord: boolean;
  covered: boolean;           // hasRecord && available >= required
  shortBy: number;            // 0 when covered or when !hasRecord
};

export type FacilityCoverageRow = {
  facilityId: string;
  facilityName: string;
  allowBrokering: 'Y' | 'N' | 'Partial';          // absent field defaults to Y
  orderLimit: number | null;                      // cached facility maximumOrderLimit; null = unlimited, 0 = no capacity
  consumedToday: number;                          // live; 0 when today has no row
  remainingCapacity: number | null;               // null when orderLimit is null
  inStore: boolean;
  items: FacilityItemAvailability[];
  coveredCount: number;
  totalCount: number;
  minSurplus: number;
  searchText: string;
};

export function buildFacilityCoverageRows(input: {
  facilities: SourceRecord[];              // seedStore.facilities, physical only
  productFacilities: SourceRecord[];       // all products, one flat list
  inventoryItems?: SourceRecord[];
  facilityOrderCounts?: SourceRecord[];
  productStoreFacilities?: SourceRecord[];
  items: FacilityInventoryModalItem[];
  today?: string;
}): FacilityCoverageRow[];

export function sortFacilityCoverageRows(rows: FacilityCoverageRow[]): FacilityCoverageRow[];
```

Merge rules:

- Row set is `facilities`; `productFacilities` is indexed by
  `${productId}|${facilityId}` and left-joined. A miss yields `hasRecord: false`,
  `available: null`, `covered: false`.
- `allowBrokering` keeps the existing `|| 'Y'` default (absent means `Y`), then
  collapses across products: `Y` when all resolve to `Y`, `N` when none do,
  `Partial` otherwise.
- `orderLimit` comes from the **cached facility record** only. Stop reading
  `ProductStoreFacility.maximumOrderLimit` and `ProductFacility.maximumOrderLimit`
  — neither is populated on Rails UAT and the latter is not a field. Render `0`
  as `No capacity`, absent as `Unlimited`.
- `consumedToday` is `0` when today has no `FacilityOrderCount` row — an accurate
  measurement, matching `counts[facilityId] ?? 0` in the company app.
  `remainingCapacity` is `null` only when `orderLimit` is `null`.
- `inStore` = facility appears in `productStoreFacilities` when a
  `productStoreId` was passed; `true` for all rows otherwise.

## Call-site changes — `src/views/OrderDetail.vue`

1. `rejectAndReleaseItem(item, productId)` — [line 3209](../src/views/OrderDetail.vue#L3209):
   pass `items: [{ orderItemSeqId, productId, name: groupPrimaryIdentifier(group), imageUrl, quantity: item.quantity }]`.
   Downstream reject-then-release logic untouched.
2. `releaseSelectedItems(shipGroup)` — [line 3614](../src/views/OrderDetail.vue#L3614):
   replace `openPhysicalFacilityModal()` with the unified modal, built from the
   `actionableItemObjectsForShipGroup(shipGroup).filter(isItemPreFulfill)` list
   it already computes. Since `actionableItemObjectsForShipGroup` treats checkbox
   selection as a filter and falls back to the whole group, "release with nothing
   checked" opens the modal with every eligible item chipped.
3. Delete `openPhysicalFacilityModal` and `PhysicalFacilityModal.vue`; the
   unified modal is a strict superset of it.
4. Rename `ItemFacilityInventoryModal.vue` → `FacilityInventoryModal.vue` and
   move its spec file with it.

`parkSelectedItems`, `SwapTaskCard`, `BadAddressTaskCard`, `SwapOrders`, and
`BadAddressOrders` keep `FacilityModal`. Untouched.

## Interaction and a11y constraints

- Whole-row tap selects. Desktop rows already do this via
  `@click="selectedFacilityId = facility.facilityId"` on the row `div` with the
  radio as the indicator in `slot="start"` — the `CustomSwapModal` pattern
  required for rows with sibling labels. Do **not** drive selection from
  `ion-radio-group`'s `ionChange`, which does not fire on programmatic changes.
- Mobile accordion header: row tap expands, radio selects (existing behaviour);
  the radio needs its `aria-label`.
- No row is ever disabled (**R2**).
- Save FAB stays `vertical="bottom" horizontal="end" slot="fixed"`, disabled
  until a facility is selected — required by the modal compliance test for any
  modal containing an `ion-radio`.
- `ion-content --padding-bottom: 80px` retained so the FAB never covers the last
  row. Capture top- and bottom-of-scroll screenshots in both modes: three
  stacked toolbars is more header than the current modal has, and the first row
  must not sit under it.

## UI states

| State | Rendering |
| --- | --- |
| Loading | Existing spinner + `Fetching facilities` |
| No items passed | Guard at the call site — both already `return` on empty `itemIds` |
| `productFacilities` failed | Error state, not an empty list |
| Seed facilities empty | `No facilities found` |
| `inventoryLogs` failed | QOH `—`, everything else intact |
| `orderCount` failed | Consumed `—` (unknown), limit still shown from cache |
| `orderCount` returned no row for today | Consumed `0` — a real measurement, not an error |
| Nothing covers anything | Normal list, all rows `0 of N`; no banner |

## Strings to add (`src/locales/en-US.json`, `es-ES.json`)

`{count} of {total} items`, `Coverage`, `Short:`, `Short by {count}`,
`No record:`, `No inventory record`, `+{count} more`, `Partial`, `Capacity`,
`Not in store`, `No capacity`.

Already present: `Available`, `ATP`, `QOH`, `Safety stock`, `Allow brokering`,
`OMS fulfillment`, `Order limit`, `Consumed order limit`, `Remaining capacity`,
`Select Facility`, `Search facilities`, `Fetching facilities`,
`No facilities found`, `Unlimited`.

## Validation plan

1. `tests/utils/facilityInventory.spec.ts` — extend for
   `buildFacilityCoverageRows`: no record → `—`/not covered and **not** `0`;
   duplicate `productId` quantity aggregation; `Short by N`; brokering `Partial`
   with absent fields defaulting to `Y`; order limit read from the cached
   facility row (`0` → `No capacity`, absent → `Unlimited`); `consumedToday: 0`
   when today has no count row; `inStore` badge; sort ordering.
2. `tests/components/ItemFacilityInventoryModal.spec.ts` → renamed; single vs.
   multi rendering, chip focus round-trip, `_op=in` request shape, and
   full-page paging (never `X-Total-Count`, which CORS hides).
3. `scripts/check-ui-diff.sh` and `--staged`.
4. `vitest` + `vue-tsc` with `VITE_APP_VERSION_CONFIG` inline; compare against
   the recorded pre-existing failure baseline.
5. Runtime: `pnpm exec vite --port 8100` with `.env.local` already pointing dev
   auto-login at **rails-uat**. Exercise an item-chip open and a ship-group
   **Release** with 2–3 items. Rails UAT is the right instance for this: real
   sparse data (no order counts today, brokering mostly absent) is exactly the
   case where the `—`-versus-`0` distinction has to hold up on screen.
