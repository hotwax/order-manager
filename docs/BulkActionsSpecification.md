# Bulk Actions Specification for Order Manager List & Find Pages

**Status:** Implemented (MDM-Driven Architecture + Activity Monitoring)  
**Scope:** Find Orders, Unfillable, In-Progress List Pages (`/open`, `/inflight`, `/packed`, `/brokering`), and Bulk Actions Activity Page (`/bulk-actions`).  
**Backend:** [hotwax/oms#962](https://github.com/hotwax/oms/pull/962)

> **Sections 3-6 were corrected against the real backend.** The original draft named consumer
> services, payload fields and upload parameters that do not exist in `hotwax/oms`. Three capability
> limits are worth carrying forward:
>
> - **Ship-group dates.** `estimatedShipDate` belongs to `Shipment` and `estimatedDeliveryDate` to
>   `OrderItem`; neither is an `OrderItemShipGroup` field. `shipByDate` is the only date settable at
>   ship-group level, so that is the whole of `UPDATE_ORDER_SHIP_DATES`.
> - **Re-routing.** `oms/orders/{orderId}/facilityChange` is a read-only history view.
>   `process#OrderFacilityAllocation` is the real re-route path, and it only moves items currently at
>   a *virtual* facility - an order already at a physical facility must be parked first.
> - **Customer tasks are out of scope.** There is no `CustomerTaskServices` in `hotwax/oms`, and
>   `create#OrderTask` is order-scoped. `/customers` carries no bulk action, and
>   `CREATE_CUSTOMER_TASKS` was dropped.

---

## 1. Executive Summary & Architecture

Instead of having the Ionic frontend orchestrate multiple HTTP REST calls across dozens/hundreds of orders (which is fragile, browser-dependent, and prone to network drops), all bulk mutations will be executed asynchronously via the **Maarg Data Manager (MDM)** framework.

```
+-------------------+      1. Select & Configure      +-----------------------+
|                   | -----------------------------> | Bulk Action Modal     |
| Order Manager UI  |                                | (e.g., Edit Delivery) |
| (Vue / Ionic)     | <----------------------------- +-----------------------+
|                   |      2. Form Data Submitted
+-------------------+
          |
          | 3. Generate JSON file & Upload via
          |    upload#DataManagerFile (configId)
          v
+-----------------------------------------------------------------------------+
| Moqui / Maarg Backend                                                       |
|                                                                             |
|  [DataManagerLog: DmlsPending]                                              |
|          |                                                                  |
|          v (Scheduled MDM Runner on 60s timer / Queue Worker)               |
|  [MaargDataLoader: Calls Consumer Service per JSON record in isolation]     |
|          |                                                                  |
|          +---> Success: Updates Order / ShipGroup / WorkEffort              |
|          +---> Error: Captured in DataManager error file & log              |
+-----------------------------------------------------------------------------+
          |
          v
+-----------------------------------------------------------------------------+
| Bulk Actions Activity Page (/bulk-actions)                                  |
| View pending, in-progress, completed, and failed bulk action batches         |
+-----------------------------------------------------------------------------+
```

### Key Architectural Benefits
1. **Zero Browser-Session Dependency:** Once the user clicks "Save" / "Confirm", a single file upload request is dispatched. The user can close the app or navigate away without risking partial execution.
2. **Per-Record Transaction Isolation:** MDM processes each record in its own transaction (`MaargDataLoaderImpl`). One bad record is routed to the error file and will never abort other valid records.
3. **Unified Audit & Retry:** All bulk operations generate traceable `DataManagerLog` entries. Failed rows are preserved in standard MDM error files for review.
4. **Scalability:** The same mechanism seamlessly supports 5 orders or 5,000 orders.
5. **Operational Visibility:** Operations managers can monitor progress on a dedicated, non-technical **Bulk Actions** page.

---

## 2. Shared Interaction & UI Model

All list and find pages follow the established AccxUI selection pattern:

```
+-------------------------------------------------------------------+
| Result Header:  [x] {loaded} of {total} items   [Sort v] [Select] |
+-------------------------------------------------------------------+
|  [x] Item Row 1                                                   |
|  [ ] Item Row 2                                                   |
|  [x] Item Row 3                                                   |
+-------------------------------------------------------------------+
| Sticky Footer (Select Mode Only):                                 |
| 2 selected                             [Action 1] [Action 2] ...  |
+-------------------------------------------------------------------+
```

### Key Interaction Rules
- **Enter/Exit Select Mode:** Triggered via the `Select` / `Done` button in the list header.
- **Row Selection Checkbox:** Checkboxes render in `slot="start"` on item rows only when `selectMode` is active.
- **Header Select All / Indeterminate:** The list header checkbox reflects the selection state of currently loaded items.
- **Selection Footer:** A sticky bottom toolbar (`<ion-footer>`) renders when `selectMode` is true. Displays `{count} selected` and the action buttons in `<ion-buttons slot="end">`.
- **Submission Feedback:** Upon file upload submission, the modal closes, select mode exits immediately, and a toast displays:
  > *"Bulk request submitted for {count} order(s). View progress in Bulk Actions."* (with link/action to navigate to `/bulk-actions`).

---

## 3. Page-by-Page Action Matrix & MDM Config Mapping

| Page Route | Page Name | Supported Bulk Actions | MDM `dataManagerConfigId` |
|---|---|---|---|
| `/orders` | **Find Orders** | 1. **Park orders**<br>2. **Re-route / Change facility**<br>3. **Update carrier & shipping method**<br>4. **Update ship group dates**<br>5. **Cancel open items**<br>6. **Add task** | `UPDATE_ORDER_PARKING`<br>`UPDATE_ORDER_FACILITY`<br>`UPDATE_ORDER_SHIP_METHOD`<br>`UPDATE_ORDER_SHIP_DATES`<br>`CANCEL_ORDER_ITEMS`<br>`CREATE_ORDER_TASKS` |
| `/unfillable` | **Unfillable Orders** | 1. **Park orders**<br>2. **Re-route / Change facility**<br>3. **Update carrier & shipping method**<br>4. **Update ship group dates**<br>5. **Cancel orders/items**<br>6. **Add task** | Same as `/orders` |
| `/open` | **Open Orders** | 1. **Park orders**<br>2. **Re-route / Change facility**<br>3. **Update carrier & shipping method**<br>4. **Update ship group dates**<br>5. **Cancel open items**<br>6. **Add task** | Same as `/orders` |
| `/inflight` | **In-Flight Orders** | 1. **Park orders**<br>2. **Re-route / Change facility**<br>3. **Update carrier & shipping method**<br>4. **Update ship group dates**<br>5. **Cancel open items**<br>6. **Add task** | Same as `/orders` |
| `/packed` | **Packed Orders** | 1. **Update carrier & shipping method**<br>2. **Update ship group dates**<br>3. **Add task** | `UPDATE_ORDER_SHIP_METHOD`<br>`UPDATE_ORDER_SHIP_DATES`<br>`CREATE_ORDER_TASKS` |
| `/brokering` | **Brokering Queue** | 1. **Park orders**<br>2. **Re-route / Change facility**<br>3. **Update carrier & shipping method**<br>4. **Update ship group dates**<br>5. **Cancel open items**<br>6. **Add task** | Same as `/orders` |

---

## 4. MDM Configuration & Payload Specifications

All six configs use `executionModeId="DMC_QUEUE"` and `multiThreading="N"`. Every record is one
selected **order**; the consumer service resolves that order's own ship groups and open items, so
the app never fans out per ship group.

### 4.1 Update Ship Group Dates (`UPDATE_ORDER_SHIP_DATES`)
* **Consumer Service:** `co.hotwax.oms.order.OrderBulkServices.update#OrderShipDates` *(new)*
* **Applies to:** every ship group of the order, via `update#OrderItemShipGroup`, which also
  re-stamps the promised dates on that ship group's reservations.
```json
[
  { "orderId": "10001", "shipByDate": "2026-08-25 00:00:00" }
]
```

### 4.2 Update Carrier & Shipping Method (`UPDATE_ORDER_SHIP_METHOD`)
* **Consumer Service:** `co.hotwax.oms.order.OrderServices.update#ShippingMethod` *(existing)*
```json
[
  { "orderId": "10001", "carrierPartyId": "UPS", "shipmentMethodTypeId": "NEXT_DAY" }
]
```

### 4.3 Park Orders (`UPDATE_ORDER_PARKING`)
* **Consumer Service:** `co.hotwax.oms.order.OrderServices.park#Order` *(existing)*
* **Note:** `facilityId` must be a **virtual** facility; the service rejects anything else. There is
  no `comments` parameter.
```json
[
  { "orderId": "10001", "facilityId": "PARKING_REJECTED" }
]
```

### 4.4 Re-route / Change Facility (`UPDATE_ORDER_FACILITY`)
* **Consumer Service:** `co.hotwax.oms.order.OrderBulkServices.update#OrderFacility` *(new)*
* **Applies to:** the order's `ITEM_APPROVED` items, handed to `process#OrderFacilityAllocation`.
```json
[
  { "orderId": "10001", "facilityId": "WH_STORE_01" }
]
```

### 4.5 Cancel Open Items (`CANCEL_ORDER_ITEMS`)
* **Consumer Service:** `co.hotwax.oms.order.OrderBulkServices.cancel#OrderOpenItems` *(new)*
* **`reason`** is an `Enumeration` id from the same reason set the single-item reject flow uses
  (`REPORT_AN_ISSUE` / `RPRT_NO_VAR_LOG`).
```json
[
  { "orderId": "10001", "reason": "NO_VARIANCE_LOG", "comment": "Customer cancelled" }
]
```

### 4.6 Create Order Tasks (`CREATE_ORDER_TASKS`)
* **Consumer Service:** `co.hotwax.oms.order.OrderBulkServices.create#OrderTasks` *(new)*
* **Applies to:** one task per ship group. `create#OrderTask` is ship-group scoped and has no
  `estimatedCompletionDate`; the purpose must be a real `RESOLVE_ONHOLD_ORDER` enum
  (`ORD_HOLD_MANUAL`, `ORD_HOLD_CUST_REQ`).
```json
[
  {
    "orderId": "10001",
    "workEffortTypeId": "RESOLVE_ONHOLD_ORDER",
    "workEffortPurposeTypeId": "ORD_HOLD_CUST_REQ",
    "workEffortName": "Review shipping hold",
    "description": "Customer requested verification"
  }
]
```

---

## 5. Bulk Actions Activity Page (`/bulk-actions`)

To give operations managers complete visibility into background processing without overwhelming technical jargon from Job Manager, Order Manager will include a dedicated **Bulk Actions** activity page.

### 5.1 Menu Placement
* Added to `Menu.vue` under the main navigation or activity section:
  * Icon: `layersOutline` or `timeOutline`
  * Label: **Bulk actions**
  * Route: `/bulk-actions`
  * Badge/Indicator: Count of currently `Pending` or `In progress` bulk action runs.

### 5.2 Screen Layout & Content

```
+--------------------------------------------------------------------+
| [=] Bulk actions                                        [Refresh]  |
+--------------------------------------------------------------------+
| [ Filter by Status: All v ] [ Search by Action v ]                 |
+--------------------------------------------------------------------+
|  CARD / ITEM: Update Ship Dates                                    |
|  Status: [ Processing ]                        Submitted: 2m ago   |
|  Progress: 45 / 120 orders processed                               |
+--------------------------------------------------------------------+
|  CARD / ITEM: Update Shipping Method                               |
|  Status: [ Completed ]                         Submitted: 15m ago  |
|  Summary: 50 of 50 orders updated successfully                     |
+--------------------------------------------------------------------+
|  CARD / ITEM: Park Orders                                          |
|  Status: [ Completed with errors ]             Submitted: 1h ago   |
|  Summary: 18 of 20 orders parked (2 failed)                        |
|  [ Download Error Log ]                                            |
+--------------------------------------------------------------------+
|  CARD / ITEM: Cancel Open Items                                    |
|  Status: [ Pending ]                           Submitted: Just now |
|  Summary: 10 orders queued                     [ Cancel Request ]  |
+--------------------------------------------------------------------+
```

### 5.3 Human-Friendly Business Translations
Technical `DataManagerConfig` IDs and status codes are translated into clear operator language:

| Technical Config ID | Display Action Name |
|---|---|
| `UPDATE_ORDER_SHIP_DATES` | **Update ship dates** |
| `UPDATE_ORDER_SHIP_METHOD` | **Update carrier & shipping method** |
| `UPDATE_ORDER_PARKING` | **Park orders** |
| `UPDATE_ORDER_FACILITY` | **Re-route fulfillment facility** |
| `CANCEL_ORDER_ITEMS` | **Cancel open items** |
| `CREATE_ORDER_TASKS` | **Create order tasks** |

| MDM Log Status (`statusId`) | Operator Status Label | Badge Color |
|---|---|---|
| `DmlsPending` | **Queued / Pending** | `medium` |
| `DmlsRunning` / `DmlsActive` | **Processing** | `primary` |
| `DmlsFinished` (0 errors) | **Completed** | `success` |
| `DmlsFinished` (>0 errors) | **Completed with issues** | `warning` |
| `DmlsFailed` | **Failed** | `danger` |
| `DmlsCancelled` | **Cancelled** | `medium` |

### 5.4 Operator Actions on Runs
1. **Download Error File:** When a run finishes with errors (`errorFileContentLocation` is present), an icon button allows operators to download the JSON error report containing only the rejected records and their specific error messages.
2. **Cancel Pending Run:** If a batch is still in `DmlsPending`, operators can cancel the run before execution begins.
3. **Auto-Refresh:** The page polls active runs (or refreshes on focus) so managers can watch progress in real time.

---

## 6. Frontend Producer Implementation

`upload#DataManagerFile` declares **`configId`** and **`contentFile`** - not `dataManagerConfigId`
and `uploadedFile` - and is mounted at `admin/uploadDataManagerFile`. Content-Type is deliberately
left unset: axios derives the multipart boundary from the `FormData`, and naming the type without a
boundary produces a request the backend cannot parse.

```typescript
export async function submitBulkActionMdmFile(
  configId: string,
  records: BulkActionRecord[],
  semanticName: string
) {
  if (!records.length) throw new Error('No records to submit');

  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const fileName = `${semanticName}_${configId}_${DateTime.now().toFormat('yyyyMMddHHmmss')}.json`;

  const formData = new FormData();
  formData.append('configId', configId);
  formData.append('contentFile', blob, fileName);

  return api({ url: 'admin/uploadDataManagerFile', method: 'POST', data: formData });
}
```

Timestamps are normalised to `yyyy-MM-dd HH:mm:ss` before upload; Moqui does not reliably convert an
ISO string carrying `T`/`Z`.

---

## 7. Implementation Plan & Deliverables

1. **Moqui / Backend Work** — [hotwax/oms#962](https://github.com/hotwax/oms/pull/962):
   - Six `DataManagerConfig` rows in `upgrade/UpcomingRelease/UpgradeData.xml` (upgrades) and
     `data/DA_ExtSeed_AA_SeedData.xml` (fresh installs).
   - Four consumer services in `service/co/hotwax/oms/order/OrderBulkServices.xml`, each designed
     for a single record, declaring no transaction attributes, and returning an error so a bad
     record reaches the MDM error file.
2. **Frontend Order Manager Work:**
   - `src/services/bulkActions.ts` — upload helper, per-action record builders, permission gating,
     and the run-history read side.
   - `src/components/orders/BulkOrderActionFooter.vue` — one shared selection footer, replacing the
     five near-duplicate footers and the client-side mutation loops in `orderDetail`/`customerService`.
   - New modals `CancelOpenItemsModal.vue` and `EditShipDatesModal.vue`; `FacilityModal.vue`
     extended with a `scope` prop so the same picker serves parking (virtual) and re-routing
     (physical); `EditShippingMethodModal.vue` carrier picker converted to a radio group.
   - `src/views/BulkActions.vue` (`/bulk-actions`) plus the **Bulk actions** menu entry.
3. **Verification:**
   - Unit tests cover the upload contract, every record shape, permission gating, and run-state
     mapping (including the `DmlsFinished` + failures → *Completed with issues* split).
   - **Outstanding:** run one real file per `configId` against an instance carrying the new configs
     and confirm each `DataManagerLogDetails` row reaches a terminal status with an empty
     `errorFileContentLocation`. Not yet possible — the configs land with hotwax/oms#962.
