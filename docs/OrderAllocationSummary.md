# Order Rows Standardization

**Status:** Draft running implementation document
**Scope:** Find Order, Unfillable, Brokering Queue, Open, Inflight, and Packed order rows.

## Project objective

Standardize how an order is represented across Order Manager without making every page show the same information.

Every row should have a familiar information hierarchy, use the same core Ionic structure, and avoid repeating information already supplied by the page. Each page may then prioritize the one piece of context that explains why the order belongs there.

Allocation summary is a supporting shared capability in this project. It is not the project’s sole objective.

## Product principles

| Principle | Decision |
|---|---|
| Familiar scanning | Keep the same logical row slots across all six pages: identity, customer, fulfillment or queue context, time, and operational summary. |
| Context over repetition | A dedicated queue page already establishes broad order state. Rows show only exceptions or operationally useful status instead of repeating the page name. |
| Useful fulfillment context | Keep a dedicated fulfillment-context column. Render carrier plus shipping method on the primary line, omitting carrier when it is unavailable or `N/A`; render sales channel beneath it. Do not repeat item count there because allocation progress already owns it. |
| One source of truth | Queue membership, actions, totals, and shipment state remain owned by their existing workflow APIs. Solr is used for search pages and batched display enrichment only. |
| Time pressure | Estimated delivery is the shared deadline slot. Show its absolute date/time plus time remaining or overdue state when a reliable source provides it. |
| No implied data | Do not display ship-to address, delivery promise, ship-by date, routing reason, or rule until a row API actually returns it. |
| Reuse behavior | Put shared calculations and row presentation in reusable units; pages configure their context rather than copy conditional markup. |
| Ionic-native delivery | Use core Ionic list, item, label, chip, and badge components. Do not introduce `ion-grid` or change existing CSS. |
| Mobile first | On smaller screens, retain identity, the single page-specific operational context, and the most useful summary. Secondary details remain available on the order detail page. |

## Pages in scope

| Page | Data source | Why an order appears here | Row should emphasize |
|---|---|---|---|
| Find Order | Grouped Solr ORDER documents | Broad lookup result | Allocation state, shipping method/channel, status, ordered age, and deadline |
| Unfillable | Grouped Solr ORDER documents filtered to Unfillable facilities | One or more items are at an Unfillable facility | The relevant Unfillable facility, shipping method/channel, allocation progress, ordered age, and deadline |
| Brokering Queue | Grouped Solr ORDER documents filtered to eligible non-Unfillable queue facilities | One or more items await brokering | The relevant brokering queue, shipping method/channel, allocation progress, ordered age, and deadline |
| Open | `oms/orders/salesOrders/open` plus batch Solr enrichment | Approved items are at a physical facility without a shipment | Base-API facility, shipping method/channel/carrier, ordered age, and deadline |
| Inflight | `oms/orders/salesOrders/inflight` plus batch Solr enrichment | Items are linked to an approved shipment | Base-API facility, carrier/shipping method, channel, ordered age, and deadline |
| Packed | `oms/orders/salesOrders/packed` plus batch Solr enrichment | Items are linked to a packed shipment | Base-API facility, carrier/shipping method, channel, ordered age, and deadline |

## Shared row model

Every row uses the same five logical slots. The fulfillment-context slot remains present across all pages because shipping method and channel are useful operational data; it must not repeat item counts already shown in allocation progress.

| Slot | Responsibility | Typical fields |
|---|---|---|
| Customer and order | Anchor the row in a person, with the order as the supporting identifier | Customer name as primary text; customer-facing `orderName`, OMS ID, and meaningful exception/status as secondary text |
| Allocation or queue | Explain where items are or why the row is in this queue | Shared allocation summary, facility, queue facility |
| Fulfillment context | Show how the order will move | `Carrier - shipping method` on the primary line when carrier is available; otherwise shipping method alone. Sales channel is the supporting line. |
| Ordered | Show creation time without forcing mental calculation | Absolute ordered date/time with relative age directly beneath it; use minutes/hours for same-day orders and days thereafter |
| Estimated delivery | Make time pressure visible in the same place on every page | Absolute estimated delivery date/time with `in x hours/days` or `overdue`; otherwise an Ionic note that says `No estimated delivery date` |

### Mobile behavior

The existing `list-item` class shows only its first and last direct child below the tablet breakpoint. For this project, that means mobile shows:

1. Customer and order reference
2. Estimated delivery deadline when available, or `No estimated delivery date` in an `ion-note`

Allocation, fulfillment context, and ordered age appear from the tablet breakpoint onward. This preserves the existing responsive list behavior without changing shared CSS. If product later requires allocation on mobile, that needs an intentional change to the existing list-row responsiveness rather than a hidden wrapper or duplicate mobile data.

### `list-item` composition

Use the existing `list-item` class on the clickable row wrapper. Its **five immediate children** are the five desktop columns, in this exact order:

```vue
<div
  class="list-item queue-order-row"
  :role="selectMode ? 'button' : 'link'"
  tabindex="0"
  @click="handleOrderRowClick(order)"
  @keydown.enter.prevent="handleOrderRowClick(order)"
  @keydown.space.prevent="handleOrderRowClick(order)"
>
  <!-- 1. Always visible; customer is primary, order is supporting metadata. -->
  <ion-item lines="none">
    <ion-checkbox v-if="selectMode" slot="start" @click.stop @keydown.stop />
    <ion-label>
      {{ customerName }}
      <p>{{ orderName }} - {{ internalOrderId }}</p>
    </ion-label>
  </ion-item>

  <!-- 2. Tablet and desktop: allocation or queue summary. -->
  <ion-label class="tablet">
    <OrderAllocationSummary :summary="allocationSummary" />
  </ion-label>

  <!-- 3. Tablet and desktop: carrier + method, then channel. -->
  <ion-label class="tablet">
    {{ carrierAndShippingMethod }}
    <p>{{ channelName }}</p>
  </ion-label>

  <!-- 4. Tablet and desktop: ordered time, then relative age. -->
  <ion-label class="tablet">
    {{ orderedDateTime }}
    <p>{{ orderedRelativeAge }}</p>
  </ion-label>

  <!-- 5. Always visible; preserve the page's existing deadline alignment class. -->
  <ion-label :class="deadlineClass">
    <template v-if="estimatedDeliveryDateTime">
      {{ estimatedDeliveryDateTime }}
      <p>{{ estimatedDeliveryRelativeLabel }}</p>
    </template>
    <ion-note v-else>No estimated delivery date</ion-note>
  </ion-label>
</div>
```

Implementation rules for this structure:

| Rule | Reason |
|---|---|
| Keep the five columns as immediate children of `list-item`. | The shared class hides and reveals direct children at each breakpoint; adding wrapper elements breaks that behavior. |
| Make the customer/order `ion-item` the first child. | It is the primary left-aligned column on desktop and the only identity column shown on mobile. |
| Make the estimated-delivery `ion-label` the last child. | It is the right-aligned desktop deadline and the one supporting column retained on mobile. |
| Add `tablet` only to columns two through four. | The shared theme reveals these at the tablet breakpoint and all columns at desktop. |
| Keep the existing page row modifier and column variables. | Existing modifiers such as `queue-order-row`, `open-order-row`, `inflight-order-row`, and `packed-order-row` already set five-column behavior and row dimensions. Do not add or edit CSS for this project. |
| Preserve root click and keyboard handlers; stop propagation only on the selection checkbox. | The entire row continues to open the order, while selection mode remains usable. |
| Do not use `ion-grid`, `ion-row`, or `ion-col`. | `list-item` already provides the responsive row layout. |

The shared `OrderRow` component should render this direct-child structure itself. Do not implement each column as a wrapper-producing slot component.

## Current data contract and enrichment

### Data confirmed available today

| Surface | Available row data | Not available for row rendering |
|---|---|---|
| Solr search rows | Order IDs/references, status, customer party name/ID, email/phone where indexed, order date, store/channel, facility IDs/names/types, shipment method ID, item-document records | Ship-to address in the current projection; a reliable row-level promise/ship-by date in the validated samples; reliable routing reason/rule in the validated samples |
| Open workflow API | Order IDs/references, status, facility, shipment method ID, store/channel, order date, grand total, currency, item count, ship group | Customer name, carrier, address, delivery/ship-by date |
| Inflight workflow API | Open fields plus shipment ID and shipment status | Customer name, carrier, address, facility-arrival timestamp, picklist/bin, delivery/ship-by date |
| Packed workflow API | Inflight fields, including shipment ID/status | Customer name, carrier, address, delivery/ship-by date |

### Batch enrichment for Open, Inflight, and Packed

Workflow APIs determine the base result set. After each initial or appended workflow fetch:

1. Deduplicate the returned `orderId`s.
2. Send one grouped Solr query for those IDs.
3. Cache display enrichment and item-level allocation documents by `orderId`.
4. Merge only display context and allocation progress into the row view model. The facility displayed on workflow rows remains the facility returned by the base workflow API.

The enrichment may request:

```text
orderId orderName externalOrderId customerPartyName customerEmailId contactPhoneNumbers
carrierPartyId salesChannelDesc facilityId facilityName facilityTypeId
orderItemSeqId shipmentMethodTypeId
```

This is one request per fetched result page, never one request per row. It must not overwrite workflow membership, facility, status, shipment state, total, item count, or bulk-action eligibility. Clear the enrichment cache whenever the workflow result set is replaced by a filter or product-store change.

### Estimated-delivery implementation gate

Estimated delivery is valuable enough to reserve a consistent row slot, but the currently validated UAT samples do not provide it reliably:

- Search requests may ask Solr for `estimatedDeliveryDate`, `promisedDatetime`, `shipBeforeDate`, and `shipByDate`, but the validated samples did not return a usable value.
- Open, Inflight, and Packed workflow responses do not return a commitment date.
- The batch workflow enrichment samples also did not return a usable commitment date.

The row project should request these candidate fields in its enrichment query and measure coverage. When a reliable value is present, render the absolute deadline and relative urgency. When no reliable value is present, keep the slot visible and render `<ion-note>No estimated delivery date</ion-note>`. Do not fill the slot with a made-up derived date or a symbolic placeholder.

## Revised row mocks

These mocks describe the target information architecture, not final copy or styling. Estimated-delivery examples show the intended deadline treatment and are gated on the data contract above.

### Find Order

| Customer and order | Allocation summary | Fulfillment context | Ordered | Estimated delivery |
|---|---|---|---|---|
| **Priya Shah**<br>`WEB-104281` - OMS-1004281 - Approved | `Dallas FC`<br>`2/3 items brokered` | Standard shipping<br>`Shopify` | Jul 12, 10:31 AM<br>`43 min ago` | Jul 15, 6:00 PM<br>`in 3 days` |
| **Aaron Lee**<br>`WEB-104282` - OMS-1004282 - Hold | `Dallas FC +1`<br>`3/4 items brokered` | Expedited shipping<br>`Amazon` | Jul 12, 9:18 AM<br>`1h 56m ago` | Jul 13, 9:00 AM<br>`in 22h` |
| **Morgan Chen**<br>`WEB-104283` - OMS-1004283 - Created | `Unfillable East`<br>`0/2 items brokered` | Standard shipping<br>`Shopify` | Jul 11, 4:42 PM<br>`1 day ago` | Jul 12, 4:00 PM<br>`overdue by 2h` |

### Unfillable

| Customer and order | Queue summary | Fulfillment context | Ordered | Estimated delivery |
|---|---|---|---|---|
| **Jamie Rivera**<br>`WEB-104284` - OMS-1004284 - Approved | `Unfillable East`<br>`1/3 items brokered` | Standard shipping<br>`Shopify` | Jul 12, 8:20 AM<br>`2h ago` | Jul 13, 7:00 AM<br>`in 21h` |
| **Taylor Brooks**<br>`WEB-104285` - OMS-1004285 - Hold | `Unfillable West +1`<br>`0/3 items brokered` | Expedited shipping<br>`Amazon` | Jul 11, 6:05 PM<br>`1 day ago` | Jul 12, 10:00 AM<br>`overdue by 2h` |

### Brokering Queue

| Customer and order | Queue summary | Fulfillment context | Ordered | Estimated delivery |
|---|---|---|---|---|
| **Alex Morgan**<br>`WEB-104286` - OMS-1004286 - Approved | `Marketplace Queue`<br>`1/3 items brokered` | Standard shipping<br>`Shopify` | Jul 12, 9:05 AM<br>`2h ago` | Jul 13, 8:00 AM<br>`in 22h` |
| **Jordan Kim**<br>`WEB-104287` - OMS-1004287 - Created | `Wholesale Queue +1`<br>`0/3 items brokered` | Economy shipping<br>`Amazon` | Jul 12, 7:56 AM<br>`3h ago` | Jul 12, 5:00 PM<br>`in 5h` |

### Open

| Customer and order | Allocation summary | Fulfillment context | Ordered | Estimated delivery |
|---|---|---|---|---|
| **Aisha Patel**<br>`WEB-104288` - OMS-1004288 | `Dallas FC`<br>`4/4 items brokered` | UPS - Ground<br>`Shopify` | Jul 12, 7:48 AM<br>`3h ago` | Jul 13, 4:00 PM<br>`in 1 day` |
| **Noah Williams**<br>`AMZ-68295` - OMS-1004289 | `Miami FC +1`<br>`3/4 items brokered` | FedEx - Home delivery<br>`Amazon` | Jul 12, 6:35 AM<br>`4h ago` | Jul 12, 3:00 PM<br>`in 3h` |

### Inflight

| Customer and order | Allocation summary | Fulfillment context | Ordered | Estimated delivery |
|---|---|---|---|---|
| **Oliver Smith**<br>`WEB-104289` - OMS-1004290 | `Denver FC`<br>`2/2 items brokered` | FedEx - Home delivery<br>`Shopify` | Jul 12, 6:02 AM<br>`4h ago` | Jul 12, 6:00 PM<br>`in 6h` |
| **Maya Chen**<br>`AMZ-68296` - OMS-1004291 | `Dallas FC +1`<br>`3/4 items brokered` | UPS - Ground<br>`Amazon` | Jul 11, 8:19 PM<br>`1 day ago` | Jul 13, 10:00 AM<br>`in 2 days` |

### Packed

| Customer and order | Allocation summary | Fulfillment context | Ordered | Estimated delivery |
|---|---|---|---|---|
| **Ava Johnson**<br>`WEB-104291` - OMS-1004292 | `Dallas FC`<br>`3/3 items brokered` | UPS - Ground<br>`Shopify` | Jul 12, 5:44 AM<br>`5h ago` | Jul 12, 4:00 PM<br>`in 4h` |
| **Liam Davis**<br>`AMZ-68297` - OMS-1004293 | `Miami FC +1`<br>`2/3 items brokered` | FedEx - Home delivery<br>`Amazon` | Jul 11, 9:02 PM<br>`1 day ago` | Jul 12, 2:00 PM<br>`overdue by 1h` |

## Shared implementation pieces

| Piece | Responsibility |
|---|---|
| `OrderRow` | Common Ionic list-row structure with five logical slots. Pages pass row context; the component does not fetch data. |
| `OrderRowViewModel` | A normalized page-ready shape combining the authoritative base order with display-only enrichment. |
| `OrderAllocationSummary` | Small Ionic chip and progress-line presentation component. Receives a resolved summary; it does not elect facilities or fetch data. |
| `summarizeOrderAllocation()` | Pure domain helper that groups item documents and elects the most relevant facility for the requested mode. |
| `fetchOrderRowEnrichment()` | Batched grouped Solr query for workflow pages, cached by `orderId`. |
| Page configurations | Defines the page title, status treatment, allocation-summary mode, queue scope, and final operational-summary formatter. |

## Allocation summary logic

### Why it exists

Allocation is a useful cross-page concept, but the relevant facility depends on context:

- Find Order answers, “where is this order allocated?”
- Unfillable answers, “which Unfillable location has this order’s items?”
- Brokering Queue answers, “which brokering queue has this order’s items?”

### Confirmed rules

| Rule | Chosen behavior |
|---|---|
| Progress count | Preserve the current Find Order item-document count. `1/3 items brokered` means one of three indexed item documents is at a physical facility. It is not ordered quantity. |
| Find Order election | Physical allocation wins. A virtual/parking location appears only when no item is physically allocated. |
| Unfillable election | Unfillable scope wins over physical allocation. Use the actual facility name because there may be multiple Unfillable facilities. |
| Brokering election | Eligible non-Unfillable Brokering scope wins over physical allocation. Use the actual facility name. |
| Multiple facilities | Elect the facility with the highest item-document count. `+N` is the number of additional relevant facilities, not additional items. |
| Stable ties | Sort by facility display name, then facility ID. |

### Contract

```ts
type AllocationSummaryMode = 'physical-first' | 'queue-first';

interface AllocationItemDocument {
  orderId: string;
  orderItemSeqId?: string;
  facilityId?: string;
  facilityName?: string;
  facilityTypeId?: string;
}

interface AllocationSummaryOptions {
  mode: AllocationSummaryMode;
  queueFacilityIds?: readonly string[];
}

interface OrderAllocationSummaryModel {
  facilityId: string;
  facilityName: string;
  additionalFacilityCount: number;
  brokeredItemCount: number;
  totalItemCount: number;
}
```

### Election steps

1. Ignore item documents without a facility ID.
2. Resolve a facility name from the document, with facility ID as a fallback.
3. Resolve physical versus virtual using `facilityTypeId`, then the seed-store parent facility type when needed.
4. Count item documents by facility.
5. Calculate brokered progress across the entire order: physical item documents divided by all item documents.
6. For `physical-first`, rank physical facilities first; only use virtual/parking facilities if no physical item exists.
7. For `queue-first`, limit candidates to the supplied `queueFacilityIds`, then rank only those candidates.
8. Return no summary when `queue-first` has no scoped item. This is safer than labeling an unrelated location.

### Queue scopes

```ts
const allocationSummaryScopes = {
  allocation: { mode: 'physical-first' },
  unfillable: {
    mode: 'queue-first',
    facilityIds: unfillableFacilityIds,
  },
  brokering: {
    mode: 'queue-first',
    facilityIds: virtualBrokeringFacilityIds.filter(
      (facilityId) => !unfillableFacilityIds.includes(facilityId)
        && facilityId !== GENERAL_OPS_PARKING_FACILITY_ID
    ),
  },
} as const;
```

The facility lists remain sourced from the current page/store configuration. The change is that selection receives those lists explicitly rather than inferring a queue from a virtual-facility fallback.

## Delivery sequence

1. Document and type the shared order-row view model and page configuration.
2. Extract the current Find Order allocation calculation into `summarizeOrderAllocation()` with focused unit coverage.
3. Keep `summarizeBrokeredFacilities()` as a compatibility wrapper over `physical-first` until Find Order is migrated.
4. Create the presentation-only allocation-summary component using the existing outlined Ionic chip pattern and no new CSS.
5. Migrate Find Order first and compare output against the current chip on mixed allocation orders.
6. Define explicit Unfillable and Brokering facility scopes; ensure Brokering excludes all Unfillable facilities and General Operations Parking.
7. Migrate Unfillable and Brokering to the shared row/summary configuration, replacing the unreliable reason/rule block only after live comparison.
8. Add one batched Solr enrichment flow for Open, Inflight, and Packed and expose a normalized row view model.
9. Migrate Open, Inflight, and Packed to the shared row structure while preserving their current actions and API authority.
10. Validate desktop and mobile information hierarchy, bulk selection behavior, infinite scrolling, and cache invalidation.

## Acceptance checks

| Scenario | Expected result |
|---|---|
| One physical item, two Unfillable items | Find Order shows the physical facility and `1/3 items brokered`; Unfillable shows the relevant Unfillable facility and the same progress. |
| Two Unfillable facilities, no physical items | Find Order and Unfillable show the facility with more items; both append `+1`; progress is `0/3 items brokered`. |
| One physical item, two Brokering items | Find Order shows the physical facility; Brokering shows the relevant queue facility; both report `1/3 items brokered`. |
| Two Brokering facilities tied | The selected chip is stable according to facility display name, then facility ID. |
| Queue page has no matching scoped item | The queue summary is absent rather than showing an unrelated physical or virtual location. |
| Workflow page loads more results | Exactly one additional enrichment request is made for newly fetched order IDs. |
| Product-store or filter change | Existing workflow enrichment is cleared and rebuilt for the new result set. |
| Existing Find Order row | The chip behavior remains unchanged for physical, virtual-only, and split-facility orders. |
| Every row identity | The supporting line renders customer-facing `orderName`, OMS `orderId`, and status. `externalOrderId` remains searchable but is not used as the row label. |
| Same-day order | Ordered relative age is expressed in minutes or hours, not only `Today`. |
| Older order | Ordered relative age is expressed in whole days once the order is no longer same-day. |
| Estimated delivery is available | Every page displays the same absolute deadline plus time-remaining or overdue treatment. |
| Estimated delivery is unavailable | The deadline slot remains visible and renders `No estimated delivery date` in an `ion-note`; no derived date is shown. |
| Workflow enrichment favors a different facility | Open, Inflight, and Packed display the facility returned by the base workflow API while retaining enriched allocation progress counts. |
| Every row | Fulfillment context shows `carrier - shipping method` as the primary line when carrier is available, with sales channel beneath. It does not repeat item count. |
| Carrier unavailable | The fulfillment-context primary line shows shipping method alone. |
| Mobile row | Identity, customer, allocation or queue context, and one operational summary remain readable without duplicate information. |
