# Order Search, Filter, and Sort Standardization

**Status:** Implemented locally and verified  
**Scope:** Find Order, Unfillable, Brokering Queue, Open, Inflight, and Packed.  
**Related plan:** [Order Rows Standardization](./OrderAllocationSummary.md)

**Verification:** Order Manager production build, 35 focused tests, and live localhost checks across all six routes.

## Project objective

Standardize how operators find and organize orders across the six list pages without forcing every page to expose the same controls.

The shared layout should feel familiar on every page:

1. Page navigation and title in the header.
2. Search and membership filters in a `SearchFilterCard` at the top of `ion-content`.
3. Matching result count, sort, and selection actions in the `ion-list-header`.
4. Standardized order rows below the header.

Dedicated queue pages already communicate why an order is present. Their filters should narrow useful dimensions such as channel, shipping method, facility, and date without repeating the queue state.

## Decisions captured in this draft

| Topic | Decision |
|---|---|
| Customer-name search | Remove the separate Customer name input from Open, Inflight, and Packed for now. Do not imply that those pages can find customers through the main search until the workflow API supports it. |
| Main workflow search | Open, Inflight, and Packed search only order name, OMS order ID, and external order ID. |
| Solr search | Find Order, Unfillable, and Brokering keep their current broader search contract, including customer name and email, because those fields are already supported there. |
| Common filters | Sales channel, shipping method, and order-date range use the same labels and Ionic controls wherever they are applicable. |
| Facility | Show Facility only when the operator can meaningfully choose among locations. Do not show it on a queue whose facility scope is fixed to one location. |
| Status | Show Status only on Find Order. Dedicated queue pages already define their state. |
| Priority | Keep Priority on Open, Inflight, and Packed. Do not add it to the Solr-backed pages in this first pass. |
| Allocation state | Replace Find Order's independent virtual-facility and archived toggles with one Allocation state selector so contradictory states cannot be selected together. |
| Sort placement | Put Sort in the result-list header, not inside the filter card. Sorting changes order, not membership. |
| Initial sort options | Support Newest first and Oldest first everywhere. Find Order defaults to Newest first; operational queues default to Oldest first. |
| Product store | Continue using the global product-store selector. Do not duplicate Product store inside each page's filter card. |
| Styling | Reuse existing Ionic components and existing styling. Do not edit CSS or introduce `ion-grid`, `ion-row`, or `ion-col`. |

## Canonical filter sequence

Keep controls in the same semantic order whenever they are present:

1. Search
2. Page-state filters: Status, Allocation state, or Priority
3. Sales channel
4. Facility
5. Shipping method
6. Order date from
7. Order date through
8. Clear

Pages omit fields that do not apply without shifting the relative order of the remaining fields. Sort stays in the result-list header and is not part of the filter sequence.

| Page | Visible sequence after Search |
|---|---|
| Find Order | Status, Allocation state, Sales channel, Shipping method, Order date from, Order date through |
| Unfillable | Sales channel, Shipping method, Order date from, Order date through |
| Brokering Queue | Sales channel, Facility, Shipping method, Order date from, Order date through |
| Open | Priority, Sales channel, Facility, Shipping method, Order date from, Order date through |
| Inflight | Priority, Sales channel, Facility, Shipping method, Order date from, Order date through |
| Packed | Priority, Sales channel, Facility, Shipping method, Order date from, Order date through |

## Responsive filter layout

The six pages use an opt-in uniform filter layout inside `SearchFilterCard`:

- Filter controls use Ionic's outlined fill so each field has a clear physical boundary.
- Available card width determines the column count; every visible column has the same width.
- Empty grid tracks remain reserved so a partially filled final row does not stretch to arbitrary widths.
- Search remains full-width above the filters.
- `Clear filters` sits below the grid as a trailing card action and never consumes a filter column.
- Dates use the same outlined field treatment as selects while retaining the Ionic date popover.

This layout is isolated to the six standardized order-list pages. Existing task-queue pages that also use `SearchFilterCard` retain their current presentation.

## Filter applicability matrix

Legend: **Visible** means user-selectable on the page. **Fixed** means page membership already supplies that constraint. **Global** means the app-level product-store selector supplies the value.

| Filter | Find Order | Unfillable | Brokering Queue | Open | Inflight | Packed |
|---|---|---|---|---|---|---|
| Product store | Global | Global | Global | Global | Global | Global |
| Status | Visible | Fixed | Fixed | Fixed | Fixed | Fixed |
| Allocation state | Visible | Fixed | Fixed | Fixed | Fixed | Fixed |
| Priority | Not in first pass | Not in first pass | Not in first pass | Visible | Visible | Visible |
| Sales channel | Visible | Visible | Visible | Visible | Visible | Visible |
| Facility | Not in first pass | Fixed | Visible | Visible | Visible | Visible |
| Shipping method | Visible | Visible | Visible | Visible | Visible | Visible |
| Order date from | Visible | Visible | Visible | Visible | Visible | Visible |
| Order date through | Visible | Visible | Visible | Visible | Visible | Visible |

## Shared Ionic composition

The implementation should continue using the existing `SearchFilterCard`. Filters remain direct slotted controls. Sort belongs in the list header.

```vue
<ion-content>
  <SearchFilterCard
    v-model="searchQuery"
    :placeholder="searchPlaceholder"
    @clear="clearFilters"
  >
    <!-- Page-configured ion-select and DateFilterSelect controls -->
  </SearchFilterCard>

  <ion-list>
    <ion-list-header>
      <ion-label>{{ resultsSummary }}</ion-label>
      <ion-button :id="sortTriggerId" fill="clear">
        {{ sortLabel }}
      </ion-button>
      <ion-button fill="clear" @click="toggleSelectMode">
        {{ selectMode ? translate('Done') : translate('Select') }}
      </ion-button>
    </ion-list-header>

    <ion-popover :trigger="sortTriggerId" trigger-action="click" dismiss-on-select>
      <ion-list>
        <ion-radio-group v-model="sort">
          <ion-item lines="none">
            <ion-radio value="orderDate asc">Oldest first</ion-radio>
          </ion-item>
          <ion-item lines="none">
            <ion-radio value="orderDate desc">Newest first</ion-radio>
          </ion-item>
        </ion-radio-group>
      </ion-list>
    </ion-popover>

    <!-- Standard OrderRow results -->
  </ion-list>
</ion-content>
```

Implementation constraints:

- Use `ion-searchbar` through `SearchFilterCard`.
- Use `ion-select` for enumerated filters.
- Use the existing `DateFilterSelect` for both order-date boundaries.
- Use an `ion-button`, `ion-popover`, and `ion-radio-group` for the compact sort action.
- Keep Clear as one card-level action that resets search, visible filters, and sort to the page default.
- Do not add a separate Apply button. Changes should refresh results automatically.
- Do not put `ion-input` inside `ion-item`.
- Do not add layout wrappers that require new CSS.

## Page mocks

The following mocks describe content and hierarchy, not custom visual styling.

### Find Order

Search remains the broad lookup surface. Status and allocation state are appropriate because this page is not already scoped to a workflow queue.

```text
Find orders

┌──────────────────────────────────────────────────────────────┐
│ Search: Order, external ID, customer, email                  │
│                                                              │
│ Status              Allocation state      Sales channel      │
│ All statuses        All locations         All channels       │
│                                                              │
│ Shipping method     Order date from       Order date through │
│ All methods         Select date           Select date        │
│                                                       Clear  │
└──────────────────────────────────────────────────────────────┘

50 of 17,138 matching orders        Sort: Newest first   Select
```

| Control | Ionic component | Values |
|---|---|---|
| Search | `ion-searchbar` | Existing Solr-supported lookup fields |
| Status | Existing multi-select popover | All statuses or selected order statuses |
| Allocation state | `ion-select` | All locations, Allocated, Awaiting brokering, Unfillable, Archived |
| Sales channel | `ion-select` | All channels plus configured channel values |
| Shipping method | `ion-select` | All methods plus configured method values |
| Order date from | `DateFilterSelect` | Optional date |
| Order date through | `DateFilterSelect` | Optional date |
| Sort | Header popover | Newest first, Oldest first |

Allocation state replaces the current independent `Items at virtual facilities` and `Archived orders` toggles. Only one state can be active, eliminating the impossible combination where archived orders are both required and excluded.

### Unfillable

The page itself supplies the Unfillable facility and order-status scope. Do not repeat Status, Allocation state, or a single fixed Facility as user controls.

```text
Unfillable

┌──────────────────────────────────────────────────────────────┐
│ Search: Order, external ID, customer, email                  │
│                                                              │
│ Sales channel        Shipping method                         │
│ All channels         All methods                             │
│                                                              │
│ Order date from      Order date through                      │
│ Select date          Select date                             │
│                                                       Clear  │
└──────────────────────────────────────────────────────────────┘

50 of 747 matching orders             Sort: Oldest first   Select
```

| Control | Ionic component | Values |
|---|---|---|
| Search | `ion-searchbar` | Existing Solr-supported lookup fields |
| Sales channel | `ion-select` | All channels plus configured channel values |
| Shipping method | `ion-select` | All methods plus configured method values |
| Order date from | `DateFilterSelect` | Optional date |
| Order date through | `DateFilterSelect` | Optional date |
| Sort | Header popover | Oldest first, Newest first |

If Unfillable later supports multiple independently meaningful queue facilities, Facility can be added as a page-specific selector. It should not be shown while every result is constrained to one fixed facility.

### Brokering Queue

Facility remains page-specific and supports selecting one or more eligible Brokering facilities. Unfillable and General Operations Parking remain excluded from its options and membership scope.

```text
Brokering queue

┌──────────────────────────────────────────────────────────────┐
│ Search: Order, external ID, customer, email                  │
│                                                              │
│ Sales channel        Facility             Shipping method    │
│ All channels         All virtual          All methods        │
│                      facilities                              │
│                                                              │
│ Order date from      Order date through                      │
│ Select date          Select date                             │
│                                                       Clear  │
└──────────────────────────────────────────────────────────────┘

25 of 121 matching orders             Sort: Oldest first   Select
```

| Control | Ionic component | Values |
|---|---|---|
| Search | `ion-searchbar` | Existing Solr-supported lookup fields |
| Sales channel | `ion-select` | All channels plus configured channel values |
| Facility | Multi-select `ion-select` | All virtual facilities or selected eligible queue facilities |
| Shipping method | `ion-select` | All methods plus configured method values |
| Order date from | `DateFilterSelect` | Optional date |
| Order date through | `DateFilterSelect` | Optional date |
| Sort | Header popover | Oldest first, Newest first |

### Open

Remove the separate Customer name input. Main search remains honest about the workflow endpoint's supported order identifiers.

```text
Open orders

┌──────────────────────────────────────────────────────────────┐
│ Search: Order name, order ID, external ID                    │
│                                                              │
│ Priority             Sales channel        Facility           │
│ All priorities       All channels         All facilities     │
│                                                              │
│ Shipping method     Order date from       Order date through │
│ All methods         Select date           Select date        │
│                                                       Clear  │
└──────────────────────────────────────────────────────────────┘

20 of 6,440 matching orders           Sort: Oldest first   Select
| Control | Ionic component | Values |
|---|---|---|
| Search | `ion-searchbar` | Order name, OMS order ID, external order ID |
| Priority | `ion-select` | All priorities, High priority, Normal or no priority |
| Sales channel | `ion-select` | All channels plus configured channel values |
| Facility | `ion-select` | All physical facilities plus configured physical facilities |
| Shipping method | `ion-select` | All methods plus configured method values |
| Order date from | `DateFilterSelect` | Optional date |
| Order date through | `DateFilterSelect` | Optional date |
| Sort | Header popover | Oldest first, Newest first |

### Inflight

Inflight uses the same visible control set as Open. The page's API and route supply Inflight membership; no status control is needed.

```text
Inflight orders

┌──────────────────────────────────────────────────────────────┐
│ Search: Order name, order ID, external ID                    │
│                                                              │
│ Priority             Sales channel        Facility           │
│ All priorities       All channels         All facilities     │
│                                                              │
│ Shipping method     Order date from       Order date through │
│ All methods         Select date           Select date        │
│                                                       Clear  │
└──────────────────────────────────────────────────────────────┘

20 of 557 matching orders             Sort: Oldest first   Select
```

| Control | Ionic component | Values |
|---|---|---|
| Search | `ion-searchbar` | Order name, OMS order ID, external order ID |
| Priority | `ion-select` | All priorities, High priority, Normal or no priority |
| Sales channel | `ion-select` | All channels plus configured channel values |
| Facility | `ion-select` | All physical facilities plus configured physical facilities |
| Shipping method | `ion-select` | All methods plus configured method values |
| Order date from | `DateFilterSelect` | Optional date |
| Order date through | `DateFilterSelect` | Optional date |
| Sort | Header popover | Oldest first, Newest first |

### Packed

Packed uses the same visible control set as Open and Inflight. Carrier is not introduced in this first pass because the current workflow endpoint does not accept it as a filter.

```text
Packed orders

┌──────────────────────────────────────────────────────────────┐
│ Search: Order name, order ID, external ID                    │
│                                                              │
│ Priority             Sales channel        Facility           │
│ All priorities       All channels         All facilities     │
│                                                              │
│ Shipping method     Order date from       Order date through │
│ All methods         Select date           Select date        │
│                                                       Clear  │
└──────────────────────────────────────────────────────────────┘

20 of 349 matching orders             Sort: Oldest first   Select
```

| Control | Ionic component | Values |
|---|---|---|
| Search | `ion-searchbar` | Order name, OMS order ID, external order ID |
| Priority | `ion-select` | All priorities, High priority, Normal or no priority |
| Sales channel | `ion-select` | All channels plus configured channel values |
| Facility | `ion-select` | All physical facilities plus configured physical facilities |
| Shipping method | `ion-select` | All methods plus configured method values |
| Order date from | `DateFilterSelect` | Optional date |
| Order date through | `DateFilterSelect` | Optional date |
| Sort | Header popover | Oldest first, Newest first |

## Normalized page configuration

The six pages should configure one reusable search/filter model instead of copying control markup.

```ts
type OrderListPage =
  | 'find'
  | 'unfillable'
  | 'brokering'
  | 'open'
  | 'inflight'
  | 'packed';

interface OrderListFilterConfig {
  page: OrderListPage;
  searchPlaceholder: string;
  showStatus: boolean;
  showAllocationState: boolean;
  showPriority: boolean;
  facilityMode: 'hidden' | 'single' | 'multiple';
  showSalesChannel: boolean;
  showShippingMethod: boolean;
  showOrderDateRange: boolean;
  defaultSort: 'orderDate asc' | 'orderDate desc';
}
```

| Page | Status | Allocation state | Priority | Facility mode | Default sort |
|---|---:|---:|---:|---|---|
| Find Order | Yes | Yes | No | Hidden | Newest first |
| Unfillable | No | No | No | Hidden | Oldest first |
| Brokering Queue | No | No | No | Multiple | Oldest first |
| Open | No | No | Yes | Single | Oldest first |
| Inflight | No | No | Yes | Single | Oldest first |
| Packed | No | No | Yes | Single | Oldest first |

The first implementation may keep page-specific query adapters because Solr and workflow APIs have different parameter names. The visual control configuration and state behavior should still be shared.

## Query and state behavior

### Customer-name removal

Removing the workflow Customer name input must not leave an invisible active filter:

1. Remove the input from Open, Inflight, and Packed.
2. Remove `customerName` from the active workflow-page query model, or guarantee that it is reset to an empty value before every workflow request.
3. Do not send `customerName` from these pages while the control is hidden.
4. Leave the backend capability unchanged so unified customer search can be designed later.

### Product-store scope

- Every page refetches when the global product store changes.
- Clear resets page filters but preserves the selected global product store.
- Infinite-scroll pages reset to page zero when product store, search, filter, or sort changes.

### Request correctness

- Debounce search text by 300 milliseconds.
- Use latest-request-wins behavior so a slower old response cannot replace newer results.
- Do not discard a new filter request merely because another request is loading.
- Clear selection when the result set is replaced.
- Preserve selection only across appended pages belonging to the same query.

### Date behavior

- Both date controls mean order date, not time in the current workflow stage.
- Interpret the selected calendar date consistently in the signed-in user's timezone.
- `Order date from` starts at the beginning of the selected local day.
- `Order date through` ends at the end of the selected local day.

### URL behavior

The plan should preserve incoming links from the Funnel while making filter state reproducible:

- Read supported initial filters such as `facilityId` and `dateFrom` from the route.
- Write current search, visible filters, and sort back to route query parameters.
- Omit default values from the URL.
- Clear removes page-owned query parameters but keeps unrelated navigation state.

## Deferred capabilities

| Capability | Reason deferred |
|---|---|
| Unified customer search on workflow pages | The current workflow keyword search does not include customer fields. |
| Customer-name standalone filter | Intentionally removed to establish a cleaner base state. |
| Customer email/phone search on workflow pages | Not supported by the workflow endpoints. |
| Carrier filter | Not accepted by the workflow endpoint contract today. |
| Estimated-delivery filter or sort | Estimated-delivery coverage is not reliable enough. |
| Workflow-stage age filter or sort | Queue-entry, picked, and packed timestamps are not consistently returned. |
| Relevance sorting across all pages | Solr relevance and workflow database search do not share a common scoring contract. |

## Delivery sequence

1. Add a typed shared filter configuration for the six pages.
2. Remove the visible Customer name input from Open, Inflight, and Packed and eliminate hidden customer filtering.
3. Standardize labels and reuse `DateFilterSelect` across all six pages.
4. Replace Find Order's virtual and archived toggles with one Allocation state selector.
5. Move Find Order sort from the filter card to the list header.
6. Add the same list-header sort control to Unfillable, Brokering, Open, Inflight, and Packed.
7. Pass `orderByField` to workflow endpoints and the existing Solr sort parameter to search pages.
8. Make every page refetch on global product-store changes.
9. Add latest-request-wins handling for search and filter changes.
10. Synchronize visible filter and sort state with route query parameters.
11. Verify desktop and mobile hierarchy without adding or changing CSS.

## Acceptance checks

| Scenario | Expected result |
|---|---|
| Open, Inflight, or Packed loads | No standalone Customer name input is visible and no hidden customer-name value is sent. |
| Find Order is opened | Status and Allocation state are available; Allocation state cannot represent contradictory virtual and archived selections. |
| Unfillable is opened | No redundant status, allocation-state, or fixed-facility control is shown. |
| Brokering Queue is opened | Facility supports multiple eligible virtual facilities and excludes Unfillable and General Operations Parking. |
| Product store changes | Every page replaces its result set using the new global store scope. |
| Search and filters change rapidly | Only the response for the latest state is rendered. |
| Sort changes | Results reset to page zero and reload using the chosen order. |
| Clear is selected | Search, visible filters, and sort return to the page defaults while product store remains unchanged. |
| A filtered URL is opened | Supported filters and sort are restored from the route. |
| Mobile layout is used | Search, filters, Clear, result count, Sort, and Select remain usable with core Ionic behavior and no new CSS. |
