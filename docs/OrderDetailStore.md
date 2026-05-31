# Order detail store — implementation plan

## Files

```
src/composables/useOrderDetail.ts
src/store/orderDetail.ts
```

`services/` in this codebase is for infrastructure (axios config, app init, utils).
Domain API calls live in composables. See `inventory-count/src/composables/useInventoryCountRun.ts`
for the reference pattern.

---

## `src/composables/useOrderDetail.ts`

Owns all `api()` calls for the order domain. The store calls this — it never calls `api()` directly.

```ts
export function useOrderDetail() {

  async function getOrder(orderId: string): Promise<any> {
    return api({
      url: 'oms/orders',
      method: 'GET',
      params: { orderId, dependentLevels: 1 }
    });
  }

  return { getOrder };
}
```

Returns the raw axios response. The store unwraps `response.data[0]` and owns error handling.

As write actions are added (broker, park, cancel item, etc.) their API calls go here too.

---

## `src/store/orderDetail.ts`

### State

```ts
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface OrderEntry {
  payload: any | null;   // verbatim API response[0] — no transformation
  status: LoadStatus;
  loadedAt: string;
  error: string;
}

state: () => ({
  byOrderId: {} as Record<string, OrderEntry>,
  currentOrderId: '',
})
```

`persist: false` — transactional data goes stale. Fetch fresh on navigation, cache in-session.

### Getters

All no-arg, all computed over `currentOrderId`. Vue caches these — they only recompute when the payload changes.

| Getter | Returns |
| --- | --- |
| `current` | `byOrderId[currentOrderId]?.payload` |
| `isLoading` | `byOrderId[currentOrderId]?.status === 'loading'` |
| `headerStatuses` | `current?.statuses` filtered to `orderItemSeqId === '_NA_'`, sorted by `statusDatetime` desc |
| `contactMechsByPurpose` | `current?.contactMechs` indexed by `contactMechPurposeTypeId` (header email/billing/shipping) |
| `contactMechsById` | `current?.contactMechs` indexed by `contactMechId` (resolve a ship group's address) |
| `customerPartyId` | `current?.roles.find(r => r.roleTypeId === 'PLACING_CUSTOMER')?.partyId` |
| `customerName` | placing-customer `role.person.{firstName,lastName}` or `role.partyGroup.groupName` (via extended master), fallback to shipping `postalAddress.toName` — see `docs/MoquiChanges.md` |
| `returnedQtyByItemSeqId` | `current?.returnItems` reduced to `{ [orderItemSeqId]: sum of returnQuantity }` |
| `allItems` | `current?.shipGroups.flatMap(sg => sg.items.map(i => ({ ...i, shipGroupSeqId: sg.shipGroupSeqId, facilityId: sg.facilityId })))` |

**`allItems`** is only for the flat Items segment view. Inside the ship groups `v-for`, use `shipGroup.items` directly.

**No `itemsBySeqId` getter.** Any cross-array join is one line at the call site and not repeated enough to warrant it.

Ship group attributes (`giftMessage`, `shippingInstructions`, `maySplit`, `isGift`) are read directly off `shipGroup` in the template — the object is already in scope, no index needed.

### Actions

```ts
async fetchOrder(orderId: string, force = false): Promise<void>
```
- Skip if `byOrderId[orderId]?.status === 'loaded'` and `!force`
- Set `status = 'loading'`
- Call `useOrderDetail().getOrder(orderId)`
- Unwrap `response.data[0]`, reject if empty
- On success: store payload, `status = 'loaded'`, `loadedAt = new Date().toISOString()`
- On failure: `status = 'error'`, store `error.message`

```ts
async setCurrentOrder(orderId: string): Promise<void>
```
- Set `currentOrderId = orderId`
- Call `fetchOrder(orderId)` — skips if already loaded

```ts
reset(): void
```
- Called on logout alongside `useSeedStore().resetSeedData()`
- Clears `byOrderId` and `currentOrderId`

---

## Payload shape reference

From live Moqui (`GET oms/orders?orderId={id}&dependentLevels=1`). Returns array — take `[0]`.

```
OrderHeader
├─ scalars
│    orderId, statusId, orderDate, entryDate, grandTotal, remainingSubTotal,
│    currencyUom, presentmentCurrencyUom, productStoreId, salesChannelEnumId,
│    orderName, externalId, orderTypeId, originFacilityId, localeString,
│    autoApprove, lastUpdatedStamp
│
├─ roles[]
│    roleTypeId, partyId
│
├─ identifications[]
│    orderIdentificationTypeId, idValue
│
├─ contents[]
│    contentId, orderContentTypeId, orderItemSeqId
│
├─ statuses[]                          ← header AND item rows mixed
│    statusId, orderItemSeqId, statusDatetime, orderStatusId
│    orderItemSeqId === '_NA_' → header event
│    orderItemSeqId !== '_NA_' → item event
│
├─ adjustments[]                       ← order-level only
│    orderAdjustmentTypeId, amount, orderItemSeqId ('_NA_'), shipGroupSeqId
│
├─ paymentPreferences[]
│    paymentMethodTypeId, statusId, maxAmount, presentmentAmount
│    "moqui.basic.StatusItem": { statusId, description, … }
│    "org.apache.ofbiz.accounting.payment.PaymentMethodType": { description, … }
│    ↑ Moqui inlines related entities using full Java package names as keys
│
├─ contactMechs[]
│    contactMechPurposeTypeId, contactMechId
│    contactMech: { contactMechTypeId, infoString }
│    postalAddress?: { address1, address2, city, stateProvinceGeoId, postalCode, countryGeoId }
│    telecomNumber?: { … }
│
├─ communicationEventOrders[]
│    communicationEventId
│    communicationEvent: { communicationEventTypeId, content, datetimeStarted, statusId, … }
│
├─ returnItems[]
│    returnId, returnItemSeqId, orderItemSeqId, productId
│    returnQuantity, receivedQuantity, returnReasonId, returnTypeId,
│    returnItemTypeId, statusId, returnPrice
│
└─ shipGroups[]
     shipGroupSeqId, facilityId, shipmentMethodTypeId, carrierPartyId,
     contactMechId, maySplit, isGift
     │
     └─ items[]                        ← NOT at top level — nested here
          orderItemSeqId, productId, itemDescription, quantity, statusId,
          unitPrice, unitListPrice, orderItemTypeId, externalId
          statuses[]    ← item-level status history
          adjustments[] ← item-level adjustments
```

**Fields missing from current API response** (tracked in `API_REQUIREMENTS.md`).
These need to be added to the `OrderItemShipGroup` master before ship group UI can use them:
`giftMessage`, `shippingInstructions`, `shipAfterDate`, `shipByDate`,
`estimatedShipDate`, `estimatedDeliveryDate`, `telecomContactMechId`

---

## Wire into logout

```ts
// src/store/user.ts — postLogout()
useSeedStore().resetSeedData();
useOrderDetailStore().reset();   // ← add this
this.$reset();
```

---

## Usage in OrderDetail.vue

```ts
const orderDetail = useOrderDetailStore();
const seed = useSeedStore();

onMounted(() => orderDetail.setCurrentOrder(props.orderId));
watch(() => props.orderId, id => orderDetail.setCurrentOrder(id));

const statusLabel   = computed(() => seed.statusDescription(orderDetail.current?.statusId));
const channelLabel  = computed(() => seed.enumDescription(orderDetail.current?.salesChannelEnumId));
const storeName     = computed(() => seed.productStoreName(orderDetail.current?.productStoreId));
const shippingAddr  = computed(() => orderDetail.contactMechsByPurpose['SHIPPING_LOCATION']);
const timeline      = computed(() => orderDetail.headerStatuses);
```

Inside the ship groups loop:
```html
<ion-card v-for="sg in orderDetail.current?.shipGroups" :key="sg.shipGroupSeqId">
  <ion-item v-for="item in sg.items" :key="item.orderItemSeqId">
```

For the Items segment:
```html
<ion-item v-for="item in orderDetail.allItems" :key="item.orderItemSeqId">
```
