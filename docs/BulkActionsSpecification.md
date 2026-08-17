# Bulk Actions Specification for Order Manager List & Find Pages

**Status:** Proposed (MDM-Driven Architecture + Activity Monitoring)  
**Scope:** Find Orders, Find Customers, Unfillable, In-Progress List Pages (`/open`, `/inflight`, `/packed`, `/brokering`), and Bulk Actions Activity Page (`/bulk-actions`).

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
| `/customers` | **Find Customers** | 1. **Add task / Create task** | `CREATE_CUSTOMER_TASKS` |

---

## 4. MDM Configuration & Payload Specifications

### 4.1 Update Ship Group Dates (`UPDATE_ORDER_SHIP_DATES`)
* **Consumer Service:** `co.hotwax.order.OrderServices.update#OrderShipGroupDates`
* **JSON Record Shape:**
```json
[
  {
    "orderId": "10001",
    "shipGroupSeqId": "00001",
    "estimatedShipDate": "2026-08-25T00:00:00Z",
    "estimatedDeliveryDate": "2026-08-28T00:00:00Z"
  }
]
```

### 4.2 Update Carrier & Shipping Method (`UPDATE_ORDER_SHIP_METHOD`)
* **Consumer Service:** `co.hotwax.order.OrderServices.update#OrderShippingMethod`
* **JSON Record Shape:**
```json
[
  {
    "orderId": "10001",
    "carrierPartyId": "UPS",
    "shipmentMethodTypeId": "NEXT_DAY"
  }
]
```

### 4.3 Park Orders (`UPDATE_ORDER_PARKING`)
* **Consumer Service:** `co.hotwax.order.OrderServices.park#Order`
* **JSON Record Shape:**
```json
[
  {
    "orderId": "10001",
    "facilityId": "PARKING_REJECTED",
    "comments": "Bulk parked via Order Manager"
  }
]
```

### 4.4 Re-route / Change Facility (`UPDATE_ORDER_FACILITY`)
* **Consumer Service:** `co.hotwax.order.OrderServices.update#OrderShipGroupFacility`
* **JSON Record Shape:**
```json
[
  {
    "orderId": "10001",
    "shipGroupSeqId": "00001",
    "facilityId": "WH_STORE_01"
  }
]
```

### 4.5 Cancel Open Items (`CANCEL_ORDER_ITEMS`)
* **Consumer Service:** `co.hotwax.order.OrderServices.cancel#OrderOpenItems`
* **JSON Record Shape:**
```json
[
  {
    "orderId": "10001",
    "cancelReasonId": "BULK_OPERATOR_CANCEL"
  }
]
```

### 4.6 Create Order Tasks (`CREATE_ORDER_TASKS`)
* **Consumer Service:** `co.hotwax.order.OrderTaskServices.create#OrderTask`
* **JSON Record Shape:**
```json
[
  {
    "orderId": "10001",
    "workEffortName": "Review shipping hold",
    "workEffortPurposeTypeId": "WEPT_ORDER_HOLD",
    "description": "Customer requested verification",
    "estimatedCompletionDate": "2026-08-20T00:00:00Z"
  }
]
```

### 4.7 Create Customer Tasks (`CREATE_CUSTOMER_TASKS`)
* **Consumer Service:** `co.hotwax.customer.CustomerTaskServices.create#CustomerTask`
* **JSON Record Shape:**
```json
[
  {
    "partyId": "10042",
    "workEffortName": "Customer follow-up",
    "workEffortPurposeTypeId": "WEPT_CUST_INQUIRY",
    "description": "Follow up on order status inquiry"
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
| `CREATE_CUSTOMER_TASKS` | **Create customer tasks** |

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

The frontend uses a reusable MDM upload utility:

```typescript
export async function submitBulkActionMdmFile(
  configId: string,
  records: Record<string, any>[],
  semanticName: string
) {
  // 1. Serialize records to JSON Blob
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const filename = `${semanticName}_${configId}_${Date.now()}.json`;

  // 2. Prepare FormData
  const formData = new FormData();
  formData.append('dataManagerConfigId', configId);
  formData.append('uploadedFile', blob, filename);

  // 3. Upload to standard MDM endpoint
  return api({
    url: 'uploadDataManagerFile',
    method: 'POST',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
```

---

## 7. Implementation Plan & Deliverables

1. **Moqui / Backend Work:**
   - Define `DataManagerConfig` records in XML data for the 7 bulk action configs (`executionModeId="DMC_QUEUE"`).
   - Author / verify consumer services following standard MDM rules (single record design, error handling via message facade).
2. **Frontend Order Manager Work:**
   - Implement `submitBulkActionMdmFile` upload helper.
   - Update `OrderSearch.vue`, `OpenOrders.vue`, `InflightOrders.vue`, `PackedOrders.vue`, `OrderQueueList.vue`, and `Customers.vue` to bind selection modals to the MDM submission helper.
   - Wire reusable `EditDeliveryDatesModal.vue`, `EditShippingMethodModal.vue`, `FacilityModal.vue`, and `TaskCreateModal.vue`.
   - Create **`BulkActions.vue`** (`/bulk-actions`) with human-friendly log list, status filters, error file downloads, and pending-cancel actions.
   - Add **Bulk actions** entry to `Menu.vue`.
3. **Verification:**
   - Run sample files for each `DataManagerConfigId` and verify `DataManagerLog` execution, success outcomes, and error file routing on Moqui backend.
   - Verify that `/bulk-actions` accurately renders real-time job progress and allows error file download.
