# Order detail store

Status: **implemented** in `src/store/orderDetail.ts` with API access isolated in
`src/composables/useOrderDetail.ts`.

The store keeps the raw order master-detail payload and exposes small derived getters for
indexes and UI joins. It does not normalize the order aggregate or copy seed labels into
transactional state.

## API call

`src/composables/useOrderDetail.ts` owns the order API request:

```ts
GET oms/orders?orderId={orderId}&dependentLevels=1
```

The response may be an array; the store stores the first result as the current order
payload. Write actions should be added to the composable when they are implemented.

## State contract

```ts
type LoadStatus = "idle" | "loading" | "loaded" | "error";

interface OrderEntry {
  payload: any | null;   // verbatim API response[0]
  status: LoadStatus;
  loadedAt: string;
  error: string;
}

state: () => ({
  byOrderId: {} as Record<string, OrderEntry>,
  currentOrderId: ""
})
```

`persist: false`. Order data is transactional and should be fetched fresh on navigation,
with only an in-session cache.

## Implemented getters

| Getter | Purpose |
| --- | --- |
| `current` | Current raw order payload. |
| `currentEntry` | Current load entry with status/error metadata. |
| `isLoading` | Current order loading state. |
| `error` | Current order load error. |
| `headerStatuses` | Header-level status history, newest first. |
| `contactMechsByPurpose` | Header contact mechs indexed by purpose. |
| `contactMechsById` | Contact mechs indexed by `contactMechId`, used by ship groups. |
| `placingCustomerRole` | `PLACING_CUSTOMER` role with joined Person/PartyGroup when present. |
| `customerPartyId` | Party ID for customer-scoped links or future customer views. |
| `customerName` | Person/PartyGroup name, falling back to shipping `toName`. |
| `returnedQtyByItemSeqId` | Returned quantity totals keyed by order item sequence ID. |
| `allItems` | Flat item list across ship groups, with ship-group context attached. |
| `holds` | `ORDER_HOLD` WorkEfforts joined through `OrderHeaderWorkEffort`. |
| `openHolds` | Holds where `statusId === "ORD_HOLD_OPEN"`. |
| `hasOpenHolds` | Boolean convenience getter for read-only hold UI. |

`allItems` is for flat views such as the Items segment. Inside a ship-group loop, render
`shipGroup.items` directly because the group object is already in scope.

## Implemented actions

```ts
fetchOrder(orderId: string, force = false): Promise<void>
```

- Creates an entry if missing.
- Skips a loaded order unless `force` is true.
- Stores the reactive entry through Pinia so load-state changes update the UI.
- Calls `useOrderDetail().getOrder(orderId)`.
- Stores the raw payload on success and load error metadata on failure.

```ts
setCurrentOrder(orderId: string): Promise<void>
```

Sets `currentOrderId`, then calls `fetchOrder(orderId)`.

```ts
reset(): void
```

Clears order-detail state on logout.

## Payload shape

From live Moqui:

```text
OrderHeader
|- scalars
|  orderId, statusId, orderDate, entryDate, grandTotal, remainingSubTotal,
|  currencyUom, presentmentCurrencyUom, productStoreId, salesChannelEnumId,
|  orderName, externalId, orderTypeId, originFacilityId, localeString,
|  autoApprove, lastUpdatedStamp
|
|- roles[]
|  roleTypeId, partyId, person?, partyGroup?
|
|- identifications[]
|  orderIdentificationTypeId, idValue
|
|- statuses[]
|  statusId, orderItemSeqId, statusDatetime, orderStatusId
|  orderItemSeqId === "_NA_" means a header event
|
|- adjustments[]
|  orderAdjustmentTypeId, amount, orderItemSeqId, shipGroupSeqId
|
|- paymentPreferences[]
|  paymentMethodTypeId, statusId, maxAmount, presentmentAmount
|
|- contactMechs[]
|  contactMechPurposeTypeId, contactMechId, contactMech, postalAddress?, telecomNumber?
|
|- communicationEventOrders[]
|  communicationEventId, communicationEvent
|
|- returnItems[]
|  returnId, returnItemSeqId, orderItemSeqId, productId, returnQuantity, statusId
|
|- workEfforts[]
|  workEffortId, workEffort
|
`- shipGroups[]
   shipGroupSeqId, facilityId, shipmentMethodTypeId, carrierPartyId, contactMechId
   `- items[]
      orderItemSeqId, productId, itemDescription, quantity, statusId, unitPrice,
      unitListPrice, orderItemTypeId, externalId, statuses[], adjustments[]
```

## Remaining API gaps

Some ship-group fields are still missing from the current response and are tracked in
[API requirements](../backend/API_REQUIREMENTS.md): `giftMessage`, `shippingInstructions`,
`shipAfterDate`, `shipByDate`, `estimatedShipDate`, `estimatedDeliveryDate`, and
`telecomContactMechId`.
