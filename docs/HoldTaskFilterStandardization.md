# Hold Task Filter, Sort, and List Action Standardization

**Status:** Implemented

**Scope:** Swap, Bad Address, Fraud, and Hold task queues.
**Related plan:** [Order Search, Filter, and Sort Standardization](./OrderSearchFilterStandardization.md)

## Objective

Standardize filters and sorting on the four Hold-task queue pages using the same Ionic treatment as the order-list pages while exposing only fields supported by each task API.

The shared experience should be:

1. Search at the top of a `SearchFilterCard`.
2. Outlined filters in equal-width responsive tracks.
3. One trailing `Clear filters` action below the filter tracks.
4. Automatic result refresh when a filter changes.
5. The same relative filter order on every page.
6. Loaded and total matching task counts in a lightweight result header.
7. Sort followed by a consistent Select or Done action in that header.
8. Selection mode with a loaded-task checkbox and page-appropriate bulk actions.

Unfillable is not part of this plan. It is an order-allocation queue backed by the order-search contract and is already covered by the order filter standardization work.

Sorting is part of this plan, but it remains a result-list action and is never rendered as a filter-card control.

## Decisions

| Topic | Decision |
|---|---|
| Common filters | Order date range, task-created date range, and Sales channel appear on all four task pages. |
| Facility and method filters | Facility and Shipping method filters appear on Swap, Bad Address, and Hold because `shipGroupTasks` exposes both fields. They do not appear as filters on Fraud. |
| Fraud filters | Order status, Risk recommendation, and Risk level appear only on Fraud because `orders/tasks` exposes those order-level fields. |
| Assignee | Remove Assignee from this filter surface. `currentUserPartyId` is not exposed by either task view and is currently ignored by the API. |
| Swappable | Remove Swappable from this filter surface. `swappable` is not exposed by `shipGroupTasks` and is currently ignored by the API. |
| Search | Keep order-name search and change the operator from `like` to `contains` so partial order names work without callers supplying wildcard characters. |
| Date meaning | Order date filters map to `orderDate`. Task-created filters map to `workEffortCreatedDate`, projected from the WorkEffort creation stamp. Labels must state which date is being filtered. |
| Filter ordering | The complete common filter block always comes first. Page-specific filters append after it and never interrupt or reorder the common controls. |
| Sort placement | Sort appears in the result header after the result count and before Select. It is not part of the filter sequence. |
| Initial shared sort scope | Expose task date, order date, and order total. These fields have meaningful operational ascending and descending behavior on every task endpoint. |
| Fraud-specific sorts | Append Risk severity and Risk recommendation after the six shared options on Fraud only. Severity uses the risk-level enumeration sequence; recommendation uses displayed-label order. |
| Fraud sort API contract | Extend `orders/tasks` with server-sortable severity-rank and recommendation-label fields. Do not sort the loaded client-side page or expose raw enum-ID ordering. |
| Deferred sort fields | Order name does not help operators prioritize queue work. Sales channel, Facility, and Order status remain deferred because the API sorts their IDs rather than their displayed labels or business rank. |
| Default sort | Default every task queue to Oldest task first so the longest-waiting operational work appears first. |
| Stable pagination | Every sort includes `workEffortId` as a deterministic secondary field. Do not sort only the loaded client-side page. |
| Result count | Show `{loaded} of {total} matching tasks`. Read total from the API `X-Total-Count` response header and fall back to the loaded count only when the header is absent. |
| Header sequence | The result header always follows this order: selection checkbox while selecting, task count, Sort, then Select or Done. Do not repeat the count elsewhere on the page. |
| Selection boundary | The header checkbox selects only tasks currently loaded in the browser. Selecting every matching task across unloaded pages requires a separate backend bulk contract and is outside this scope. |
| Selection reset | A search, filter, sort, or clear action replaces the first-page result set, clears selected IDs, and exits selection mode. Infinite-scroll appends preserve existing selections. |
| Bulk actions | Keep bulk actions specific to the queue. Swap supports Cancel orders and Park; Bad Address supports Save and release hold, Cancel orders, and Park; Fraud supports Resolve and Cancel orders; Hold supports Resolve. |
| Swap safety | Do not expose bulk Apply swap or Resolve. Suggested products, quantities, prices, and refunds require a decision for each task. |
| Clear | Clear resets search, every visible filter, and sort to Oldest task first; replaces the route query; resets pagination; and refetches the first page. |
| Apply behavior | Do not add an Apply button. Select and date changes refresh automatically; search refreshes through the existing search event. |
| Styling | Reuse `SearchFilterCard`, `UniformFilterLayout`, outlined `ion-select`, and outlined `DateFilterSelect`. Do not edit CSS or use Ionic grid components. |

## Canonical filter sequence

Keep controls in this semantic order whenever they are present:

1. Search
2. Sales channel
3. Order date from
4. Order date through
5. Task created from
6. Task created through
7. Facility
8. Shipping method
9. Order status
10. Risk recommendation
11. Risk level
12. Clear filters

Search and the five common filters form a stable prefix on every page. Pages append only the supported page-specific filters after that prefix. Clear remains a separate final card action rather than consuming a filter track.

| Page | Visible sequence after Search |
|---|---|
| Swap | Sales channel, Order date from, Order date through, Task created from, Task created through, Facility, Shipping method |
| Bad Address | Sales channel, Order date from, Order date through, Task created from, Task created through, Facility, Shipping method |
| Fraud | Sales channel, Order date from, Order date through, Task created from, Task created through, Order status, Risk recommendation, Risk level |
| Hold | Sales channel, Order date from, Order date through, Task created from, Task created through, Facility, Shipping method |

## Filter applicability matrix

| Filter | Swap | Bad Address | Fraud | Hold |
|---|---|---|---|---|
| Product store | Global | Global | Global | Global |
| Sales channel | Visible | Visible | Visible | Visible |
| Order date from | Visible | Visible | Visible | Visible |
| Order date through | Visible | Visible | Visible | Visible |
| Task created from | Visible | Visible | Visible | Visible |
| Task created through | Visible | Visible | Visible | Visible |
| Facility | Visible | Visible | Not supported | Visible |
| Shipping method | Visible | Visible | Not supported | Visible |
| Order status | Not supported | Not supported | Visible | Not supported |
| Risk recommendation | Not supported | Not supported | Visible | Not supported |
| Risk level | Not supported | Not supported | Visible | Not supported |

Queue membership remains fixed by task status, task type, task purpose, and the globally selected product store. Those values are not repeated as user filters.

## API parameter mapping

| UI field | API parameter | Notes |
|---|---|---|
| Search | `orderName` with `orderName_op=contains` | Available on both task endpoints. |
| Sales channel | `salesChannelEnumId` | Available on both task endpoints. |
| Order date from | `orderDate_from` | Convert the selected date to the beginning of the local day. |
| Order date through | `orderDate_thru` | Convert the selected date to the end of the local day so the selected day is inclusive. |
| Task created from | `workEffortCreatedDate_from` | Convert the selected date to the beginning of the local day. |
| Task created through | `workEffortCreatedDate_thru` | Convert the selected date to the end of the local day so the selected day is inclusive. |
| Facility | `facilityId` | Available on `shipGroupTasks`. |
| Shipping method | `shipmentMethodTypeId` | Available on `shipGroupTasks`. |
| Order status | `orderStatusId` | Available only on the Fraud `orders/tasks` view. |
| Risk recommendation | `riskRecommendationEnumId` | Available only on Fraud. |
| Risk level | `riskLevelEnumId` | Available only on Fraud. |

The store payload types should explicitly include these supported fields. Remove `currentUserPartyId` and `swappable` from the queue filter payloads instead of continuing to send ignored parameters.

## Sorting analysis

The generic entity-list APIs accept `orderByField`. A leading `-` means descending order, and comma-separated fields provide deterministic tie-breakers.

### API sort capability matrix

| Sort field | Swap | Bad Address | Fraud | Hold | First-pass UI |
|---|---|---|---|---|---|
| Task created date | Supported | Supported | Supported | Supported | Visible |
| Order date | Supported | Supported | Supported | Supported | Visible |
| Order name | Supported | Supported | Supported | Supported | Deferred: no operational prioritization value |
| Order total | Supported | Supported | Supported | Supported | Visible |
| Sales channel | Supported | Supported | Supported | Supported | Deferred |
| Facility | Supported | Supported | Not supported | Supported | Deferred |
| Shipping method | Supported | Supported | Not supported | Supported | Deferred |
| Order status | Not supported | Not supported | Supported | Not supported | Deferred |
| Risk recommendation | Not supported | Not supported | Requires display-label sort key | Not supported | Fraud-specific after API support |
| Risk level | Not supported | Not supported | Requires severity-rank sort key | Not supported | Fraud-specific after API support |

Raw categorical fields remain unsuitable because `orderByField` sorts their stored IDs. For example, sorting `riskLevelEnumId` does not produce a trustworthy severity order. The requested Fraud sorts are therefore backed by enumeration sequence or normalized display-label fields rather than raw IDs.

### Canonical sort menu

The same common options appear in this exact order on all four pages:

1. Oldest task first
2. Newest task first
3. Oldest order first
4. Newest order first
5. Highest order total
6. Lowest order total

Fraud appends these page-specific options after the complete shared block:

7. Highest risk severity first
8. Lowest risk severity first
9. Risk recommendation A-Z
10. Risk recommendation Z-A

Swap, Bad Address, and Hold stop after the six shared options. Shipping-method filtering remains available on these ship-group task pages, but shipping-method sorting is not offered on the order-level Fraud queue.

| UI option | API `orderByField` |
|---|---|
| Oldest task first | `workEffortCreatedDate,workEffortId` |
| Newest task first | `-workEffortCreatedDate,-workEffortId` |
| Oldest order first | `orderDate,workEffortId` |
| Newest order first | `-orderDate,-workEffortId` |
| Highest order total | `-grandTotal,-workEffortId` |
| Lowest order total | `grandTotal,workEffortId` |

Fraud-specific server mappings:

| UI option | API `orderByField` | Required semantics |
|---|---|---|
| Highest risk severity first | `riskLevelSortRank,workEffortId` | Ascending enumeration sequence puts High above Medium, Low, None, and Pending. |
| Lowest risk severity first | `-riskLevelSortRank,-workEffortId` | Reverse the same enumeration sequence. |
| Risk recommendation A-Z | `riskRecommendationSortValue,workEffortId` | Case-normalized displayed recommendation; blank values last. |
| Risk recommendation Z-A | `-riskRecommendationSortValue,-workEffortId` | Reverse displayed recommendation; blank values last. |

The two Fraud sort fields above are aliases added to the `orders/tasks` response rather than raw entity fields. `riskLevelSortRank` uses the risk-level enumeration sequence. `riskRecommendationSortValue` matches the label shown by the seed enumeration.

Use the existing `ORDER_RISK_LEVEL` enumeration sequence: High `10`, Medium `20`, Low `30`, None `40`, and Pending `50`. This keeps severity ordering in seed data and makes both directions predictable.

Use a closed application sort type rather than accepting arbitrary route or API strings. The route may store a stable UI value, but the request builder must map it to one of the approved `orderByField` values above.

### Sort Ionic composition

Reuse `OrderSortPopover` with task-specific options inside the shared result header defined below instead of creating another popover or a second sort control.

Sort behavior:

- Changing sort resets pagination and fetches the first page from the API.
- Infinite-scroll requests preserve the active `orderByField`.
- Sort is stored in route state with search and filters.
- Invalid route sort values fall back to Oldest task first.
- Clear filters resets sort to Oldest task first.
- Do not sort the loaded array in the browser because that would produce incorrect ordering across pages.

## Result header, selection, and bulk actions

The current pages are close but inconsistent. Standardization should preserve the working actions while giving every queue the same entry point and selection behavior.

### Current-state matrix

| Capability | Swap | Bad Address | Fraud | Hold |
|---|---|---|---|---|
| List header | Missing | Present | Present | Present |
| Loaded task count | Missing | Present | Present | Present |
| API total task count | Missing | Missing | Missing | Missing |
| Select or Done mode | Missing | Present | Present | Present |
| Select loaded tasks | Missing | Present | Present | Present |
| Bulk actions | Missing | Save and release hold, Cancel order, Park | Resolve, Cancel orders | Resolve |

Swap task cards already support the selectable and selected card contract through `TaskCardShell`; the page needs to connect that capability to header state and bulk actions.

### Target header contract

Use one `TaskQueueListHeader.vue` composition on all four pages. It should be made only from core Ionic components and the existing `OrderSortPopover`; it must not introduce new layout CSS or Ionic grid components.

```vue
<ion-list-header>
  <ion-checkbox
    v-if="selectMode"
    :checked="allLoadedSelected"
    :indeterminate="someLoadedSelected"
    aria-label="Select all loaded tasks"
    @ion-change="toggleLoadedSelection($event.detail.checked)"
  />

  <ion-label>{{ loadedCount }} of {{ totalCount }} matching tasks</ion-label>

  <OrderSortPopover
    v-model="sort"
    :options="taskSortOptions"
    :trigger-id="`${queueId}-sort-trigger`"
  />

  <ion-button fill="clear" size="small" @click="toggleSelectMode">
    {{ selectMode ? translate('Done') : translate('Select') }}
  </ion-button>
</ion-list-header>
```

Header behavior:

- Use the queue noun in the rendered label where it helps orientation, such as `20 of 83 bad address tasks`.
- Before the API responds, retain the page loading treatment instead of briefly displaying a false zero.
- When the response has no `X-Total-Count`, use the number of loaded tasks as a defensive fallback.
- When all matching tasks fit in the loaded page, the label naturally reads `20 of 20 matching tasks`.
- In selection mode, the checkbox is checked when every loaded task is selected and indeterminate when only some loaded tasks are selected.
- The checkbox never implies selection of unloaded server results.
- `Done` exits selection mode and clears the selected task IDs.

### Total-count data contract

The queue store currently keeps only response data. Extend it to parse the entity-list response header and store a total for each queue:

- `swapTotal`
- `addressValidationTotal`
- `fraudTotal`
- `holdTotal`

Read `response.headers.get?.('x-total-count') ?? response.headers['x-total-count'] ?? response.headers['X-Total-Count']`, normalize it to a finite non-negative number, and fall back to the current loaded result count if the header is absent or invalid. A first-page request replaces both the list and its total. Infinite scroll appends to the list while retaining the latest matching total returned by the API.

### Selection contract

- Key selection by `workEffortId`, not by array index or card reference.
- Entering Select mode exposes the existing task-card checkboxes.
- Selecting a card updates the page-level selected-ID set.
- The header checkbox selects or deselects every task currently loaded on the page.
- Tasks appended through infinite scroll start unselected and do not disturb existing selections.
- Replacing the first page because of search, filter, sort, clear, product-store change, or manual refresh clears selection and exits selection mode.
- Do not implement cross-page selection or an `all matching tasks` mode in this scope.

### Bulk-action matrix

| Page | Bulk actions | Notes |
|---|---|---|
| Swap | Cancel orders, Park | Reuse the same domain operations as the individual card. Do not bulk-apply a suggested swap. |
| Bad Address | Save and release hold, Cancel orders, Park | Preserve the existing capabilities and standardize labels and completion behavior. |
| Fraud | Resolve, Cancel orders | Preserve the existing capabilities and standardize completion behavior. |
| Hold | Resolve | Preserve the existing capability. |

For Swap, expose bulk-safe `submitCancel()` and `submitPark(facilityId)` operations from `SwapTaskCard`. These methods perform the domain operation without opening their own confirmation UI. The page owns one cancellation confirmation for the batch, or one `FacilityModal` choice for Park, and then applies that decision to every selected card.

Use the existing Ionic footer pattern:

```vue
<ion-footer v-if="selectMode">
  <ion-toolbar>
    <ion-buttons>
      <!-- Queue-specific bulk action buttons -->
    </ion-buttons>
  </ion-toolbar>
</ion-footer>
```

Bulk-action behavior:

- Disable actions when no task is selected or while a bulk operation is running.
- Ask for one confirmation before a destructive batch action such as Cancel orders.
- Process the selected IDs with `Promise.allSettled` so one failure does not hide the outcome of the remaining tasks.
- Report successful and failed task counts when a batch is only partially successful.
- After completion, clear selection, exit selection mode, and refetch the first page so the count and queue membership are current.
- Preserve the individual card actions outside selection mode.
- Normalize shared labels to `Cancel orders`, `Park`, and `Resolve`; use `Save and release hold` only on Bad Address.

## Shared Ionic composition

Create a small task-filter component that composes the existing shared primitives. It should accept the filter model, option lists, and flags for page-specific fields.

```vue
<SearchFilterCard
  :model-value="modelValue.query"
  :placeholder="translate('Order name')"
  :show-clear="false"
  @update:modelValue="updateField('query', $event)"
  @search="emit('search')"
>
  <UniformFilterLayout @clear="emit('clear')">
    <!-- Common outlined controls always render first -->
    <!-- Conditional page-specific controls append after the common block -->
  </UniformFilterLayout>
</SearchFilterCard>
```

Implementation constraints:

- Use `ion-select` with `label-placement="stacked"`, `fill="outline"`, and `interface="popover"`.
- Use the existing `DateFilterSelect` with its `outlined` property.
- Use `All statuses`, `All recommendations`, `All risk levels`, `All channels`, `All facilities`, and `All methods` as resting values.
- Reuse the seed store for order statuses, sales channels, risk enumerations, and shipment-method labels.
- Reuse the physical-facility option loading already used by Open, Inflight, and Packed.
- Do not add a separate filter summary that repeats the selected values.
- Do not add or change CSS as part of this implementation.
- Do not use `ion-grid`, `ion-row`, `ion-col`, or Ionic grid utility classes.

## Page mocks

These mocks show hierarchy and sequence, not custom styling.

### Swap

```text
Swap

┌──────────────────────────────────────────────────────────────┐
│ Search: Order name                                           │
│                                                              │
│ Sales channel        Order date from      Order date through │
│ All channels         Select date          Select date        │
│                                                              │
│ Task created from    Task created through Facility           │
│ Select date          Select date          All facilities     │
│                                                              │
│ Shipping method                                      Clear  │
│ All methods                                                  │
└──────────────────────────────────────────────────────────────┘

20 of 47 swap tasks        Sort: Oldest task first      Select

Selection mode footer: Cancel orders | Park
```

### Bad Address

```text
Bad address

┌──────────────────────────────────────────────────────────────┐
│ Search: Order name                                           │
│                                                              │
│ Sales channel        Order date from      Order date through │
│ All channels         Select date          Select date        │
│                                                              │
│ Task created from    Task created through Facility           │
│ Select date          Select date          All facilities     │
│                                                              │
│ Shipping method                                      Clear  │
│ All methods                                                  │
└──────────────────────────────────────────────────────────────┘

20 of 83 bad address tasks Sort: Oldest task first      Select

Selection mode footer: Save and release hold | Cancel orders | Park
```

### Fraud

```text
Fraud

┌──────────────────────────────────────────────────────────────┐
│ Search: Order name                                           │
│                                                              │
│ Sales channel        Order date from      Order date through │
│ All channels         Select date          Select date        │
│                                                              │
│ Task created from    Task created through Order status       │
│ Select date          Select date          All statuses       │
│                                                              │
│ Risk recommendation  Risk level                              │
│ All recommendations  All risk levels                         │
│                                                       Clear  │
└──────────────────────────────────────────────────────────────┘

20 of 36 fraud tasks       Sort: Oldest task first      Select

Selection mode footer: Resolve | Cancel orders

Fraud-only sort options append after the shared six:
Highest risk severity first | Lowest risk severity first |
Risk recommendation A-Z | Risk recommendation Z-A |
Shipping method A-Z | Shipping method Z-A
```

### Hold

```text
Hold

┌──────────────────────────────────────────────────────────────┐
│ Search: Order name                                           │
│                                                              │
│ Sales channel        Order date from      Order date through │
│ All channels         Select date          Select date        │
│                                                              │
│ Task created from    Task created through Facility           │
│ Select date          Select date          All facilities     │
│                                                              │
│ Shipping method                                      Clear  │
│ All methods                                                  │
└──────────────────────────────────────────────────────────────┘

20 of 64 hold tasks        Sort: Oldest task first      Select

Selection mode footer: Resolve
```

The responsive layout determines the actual number of tracks from available width. Mobile stacks the controls at full width without a separate mobile-only filter surface.

## Proposed implementation structure

| Area | Planned change |
|---|---|
| Shared filter model | Add a typed task-filter shape containing search, common fields, and optional page-specific fields. |
| Shared UI | Add `OrderTaskFilterCard.vue` using `SearchFilterCard`, `UniformFilterLayout`, outlined `ion-select`, and outlined `DateFilterSelect`. |
| Shared sort model | Add a closed task-sort type and map each UI option to an approved, stable `orderByField`. |
| Sort UI | Reuse `OrderSortPopover` with the canonical task options on all four pages. |
| Fraud sort dependency | Add or coordinate the `orders/tasks` rank and display-label sort aliases before enabling the four Fraud-specific options. |
| Shared result header | Add `TaskQueueListHeader.vue` for total count, Sort, Select or Done, and the loaded-task checkbox. |
| Route state | Add a shared task-filter route-state composable so filter and sort selections survive refresh and back navigation. |
| Store payloads | Extend the four fetch payloads with supported filter parameters and `orderByField`; remove ignored Assignee and Swappable parameters; capture `X-Total-Count`. |
| Store totals | Add one matching-total state value for each queue and update it on every fetch response. |
| Result headers | Replace page-specific header markup with the shared sequence: loaded-task checkbox, total count, Sort, Select or Done. |
| Swap | Replace its current filter slot with the shared component configured for Facility and Shipping method. |
| Bad Address | Replace its current filter slot with the same ship-group configuration. |
| Fraud | Configure the shared component for Order status, Risk recommendation, and Risk level. |
| Hold | Use the same ship-group configuration as Swap and Bad Address. |
| Pagination | Reset to page zero whenever search, membership filters, or sort changes. Preserve the existing append behavior for infinite scroll. |
| Selection | Key selected tasks by `workEffortId`; select only loaded tasks from the header; clear and exit when the first-page result set is replaced. |
| Existing bulk actions | Retain and standardize Bad Address, Fraud, and Hold bulk actions. |
| Swap bulk actions | Connect the existing selectable card contract and add Cancel orders and Park without adding bulk Apply swap. |

## Delivery sequence

1. Confirm or add the two Fraud sort aliases on `orders/tasks` for severity rank and recommendation label.
2. Add the typed filter and sort models plus API parameter mapping helpers.
3. Add focused tests for partial order-name search, inclusive date boundaries, shared sort mappings, and Fraud-specific sort mappings.
4. Extend the store to capture a total for each queue from `X-Total-Count`.
5. Create `OrderTaskFilterCard.vue` using the existing outlined filter primitives.
6. Add shared and Fraud-specific options to the existing `OrderSortPopover` composition.
7. Add `TaskQueueListHeader.vue` with the shared total, sort, and selection contract.
8. Add the shared route-state composable and clear behavior for filters and sort.
9. Update the store payload types and stop sending unsupported Assignee and Swappable parameters.
10. Migrate Swap and Bad Address first because they share the same endpoint and control set; add Swap selection and safe bulk actions.
11. Migrate Hold using the same ship-group filter configuration.
12. Migrate Fraud with its order-status and risk-specific controls plus the appended severity and recommendation sorts.
13. Normalize selection reset, bulk completion, and partial-failure reporting across all four pages.
14. Run focused component, view, store, and route-state tests.
15. Build from the AccxUI wrapper and verify all four routes against the configured backend.

## Verification plan

Automated checks should cover:

- Every page uses `SearchFilterCard` and `UniformFilterLayout`.
- Every visible select is outlined and appears in canonical order.
- Every visible date uses outlined `DateFilterSelect`.
- Partial search sends `orderName_op=contains`.
- Order dates map to `orderDate_from/thru`.
- Task-created dates map to `workEffortCreatedDate_from/thru`.
- Through dates include the full selected day.
- Swap, Bad Address, and Hold send Facility and Shipping method only when selected.
- Fraud sends Order status, Risk recommendation, and Risk level only when selected.
- No page sends `currentUserPartyId` or `swappable` as a filter.
- Every page shows the same six common sort options in the same order.
- Fraud appends the six page-specific severity, recommendation, and shipping-method options after the common block.
- Every sort maps to an approved `orderByField` with a `workEffortId` tie-breaker.
- Fraud severity sorting uses `riskLevelSortRank`, never `riskLevelEnumId` alphabetical order.
- Fraud recommendation sorting follows the displayed recommendation label, not the enum ID.
- Fraud shipping-method sorting follows the deterministic primary method's displayed label.
- Changing sort resets pagination and fetches the first page.
- Clearing filters resets route state, pagination, visible controls, and sort.
- Infinite scrolling preserves the active filter and sort payload.
- Every first-page response records the normalized `X-Total-Count` value.
- Every header renders loaded and total matching tasks without duplicating the count elsewhere.
- All four pages use the same header sequence and Select or Done behavior.
- The header checkbox selects only loaded tasks and represents checked and indeterminate states correctly.
- First-page replacement clears selection and exits selection mode; infinite-scroll append preserves selection.
- Swap offers only Cancel orders and Park as bulk actions.
- Bulk actions are disabled with no selection and while requests are running.
- Partial bulk failures report separate success and failure counts.

Live checks should cover:

- Each filter independently narrows the result set.
- Combined filters use AND semantics and remain predictable.
- Clearing restores the unfiltered queue.
- Each sort direction changes the server-returned order predictably.
- Equal primary values remain stable across repeated requests and pagination.
- Fraud severity produces the agreed High-to-Low and Low-to-High business order.
- Fraud recommendation and shipping method follow the displayed labels in both directions.
- A multi-ship-group Fraud order uses the same documented primary method in the response, row, and sort order.
- Filter changes do not leave stale task selections active.
- Loaded count increases during infinite scroll while matching total remains accurate.
- Entering Select shows card checkboxes, and Done clears them.
- The header checkbox affects every loaded card but makes no claim about unloaded tasks.
- Each page exposes only its documented bulk actions.
- A successful or partially successful bulk operation refreshes both queue membership and total count.
- Desktop tracks remain equal width and wrap in a stable sequence.
- Mobile controls stack cleanly and remain keyboard accessible.

Before final live acceptance, confirm the fixed task type and task purpose predicates against the backend serving the local app. That queue-membership contract is separate from filter standardization and should not be silently changed inside this work.

## Acceptance criteria

| Scenario | Expected result |
|---|---|
| Partial order-name search | Typing part of an order name returns matching tasks without wildcard characters. |
| Order date selected | Results are filtered by the order's date, not the task creation date. |
| Task-created date selected | Results are filtered by the task's creation date, not the order date. |
| Through date selected | Tasks from the entire selected day remain eligible. |
| Sales channel selected | All four pages send the same `salesChannelEnumId` contract. |
| Facility or method selected | Swap, Bad Address, and Hold narrow through `facilityId` or `shipmentMethodTypeId`; Fraud never renders those controls. |
| Fraud-specific filter selected | Fraud narrows through `orderStatusId`, `riskRecommendationEnumId`, or `riskLevelEnumId`. |
| Unsupported legacy filter | Assignee and Swappable are absent and their ignored parameters are not sent. |
| Default sort | Every queue initially requests `workEffortCreatedDate,workEffortId` and labels it Oldest task first. |
| Sort changed | The API receives the mapped `orderByField`, pagination returns to page zero, and the result set is replaced. |
| Infinite scroll after sort | Appended results use the same filter and sort payload as the first page. |
| Invalid route sort | The page safely falls back to Oldest task first. |
| Deferred categorical sort | No page offers raw ID-based sorting for channel, facility, method, status, recommendation, or risk level. |
| Deferred order-name sort | No page offers alphabetical order-name sorting because it does not improve operational prioritization. |
| Fraud sort menu | The six shared options appear first; severity and recommendation options append afterward. |
| Fraud severity sort | Results follow the risk-level enumeration sequence rather than alphabetical `riskLevelEnumId` order. |
| Fraud recommendation sort | Results follow the displayed recommendation label in the selected direction. |
| Missing Fraud sort alias | The affected option is not enabled; the client never substitutes loaded-page sorting. |
| Initial result load | The header shows loaded and total matching tasks using the API total rather than only the current page length. |
| Infinite scroll | Loaded count increases while total continues to represent all matching server results. |
| Enter selection mode | Card checkboxes and the loaded-task header checkbox appear; Select changes to Done. |
| Select all loaded | Every currently loaded task is selected; unloaded matching tasks are not implied or selected. |
| Filters or sort change while selecting | Selected IDs clear, selection mode exits, and the replacement result set cannot inherit stale selection. |
| Swap bulk action | Swap offers Cancel orders and Park but never bulk Apply swap or Resolve. |
| Other bulk actions | Bad Address, Fraud, and Hold expose only the actions in the bulk-action matrix. |
| Partial bulk failure | Successful tasks complete, failed tasks are counted and reported, and the queue is refreshed. |
| Narrow viewport | Filters stack at full width in canonical order without randomly stretched final-row controls. |
| Clear filters | Search and all visible filters reset together, sort returns to Oldest task first, and the first page reloads. |

## Implementation verification

- Focused task filter, store, card, and view tests pass: 6 files and 15 tests.
- The Order Manager application builds successfully from the AccxUI wrapper.
- Swap, Bad Address, Fraud, and Hold were verified against the configured localhost backend at desktop and narrow viewport widths.
- Selection mode and each queue's documented bulk-action footer were verified without executing a bulk mutation.
- Fraud severity and recommendation sorts were accepted by the live backend and persisted in route state.
- The OMS entity XML is well formed. A standalone OMS Gradle build remains an environment check because the local shell provides Java 11 while the current build requires Java 17.
