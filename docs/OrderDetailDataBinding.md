# Order detail — data binding & label coverage

The order detail page makes **one order API call** on load:

```
GET oms/orders?orderId={orderId}&dependentLevels=1
```

Everything on the page resolves from one of three sources, none of which is a second
*order* call:

1. **The order payload itself** (transactional data — IDs, amounts, dates, inlined
   addresses, and — via the extended master — the customer's Person/PartyGroup)
2. **The seed store** (stable reference data loaded once at login via `loadInitialSeedData`
   — status/enum/type labels and geo names)
3. **The product cache** (rich product fields fetched once per `productId` and never
   refetched — a shared lookup, not a per-order call; see `docs/ProductData.md`)

This doc is the contract for what the page renders and where each label comes from.

> There is no `util` store anymore — it was folded into `seed`. Generic UI helpers
> live in `src/utils`. All reference labels come from `seed`.

## Label coverage matrix

| UI element | Payload field | Label resolver | Seed dataset (loaded at login?) |
| --- | --- | --- | --- |
| Order status badge | `statusId` | `seed.statusDescription` | `ORDER_STATUS` ✓ |
| Sales channel | `salesChannelEnumId` | `seed.enumDescription` | `ORDER_SALES_CHANNEL` ✓ |
| Product store | `productStoreId` | `seed.productStoreName` | `productStores` ✓ |
| Timeline events | `statuses[]` (`orderItemSeqId === '_NA_'`) | `seed.statusDescription(statusId)` | `ORDER_STATUS` ✓ |
| Payment method | `paymentPreferences[].paymentMethodTypeId` | `seed.paymentMethodDescription` | `paymentMethodTypes` ✓ |
| Payment status | `paymentPreferences[].statusId` | `seed.statusDescription` | `PAYMENT_PREF_STATUS` ✓ |
| Ship group facility | `shipGroups[].facilityId` | `seed.facilityName` | `facilities` ✓ |
| Ship group method | `shipGroups[].shipmentMethodTypeId` | `seed.shipmentMethodDescription` | `shipmentMethodTypes` ✓ |
| Ship group carrier | `shipGroups[].carrierPartyId` | `seed.carrierName` | `carriers` ✓ |
| Item status | `items[].statusId` | `seed.statusDescription` | `ORDER_ITEM_STATUS` ✓ |
| Contact mech purpose | `contactMechs[].contactMechPurposeTypeId` | `seed.contactPurposeDescription` | `contactMechPurposeTypes` ✓ |
| Comm event type | `communicationEventOrders[].communicationEvent.communicationEventTypeId` | `seed.communicationEventTypeDescription` | `communicationEventTypes` ✓ |
| Comm event status | `communicationEventOrders[].communicationEvent.statusId` | `seed.statusDescription` | `COM_EVENT_STATUS` ✓ |
| Return reason | `returnItems[].returnReasonId` | `seed.returnReasonDescription` | `returnReasons` ✓ |
| Return type | `returnItems[].returnTypeId` | `seed.returnTypeDescription` | `returnTypes` ✓ |
| Return item type | `returnItems[].returnItemTypeId` | `seed.returnItemTypeDescription` | `returnItemTypes` ✓ |
| Role labels | `roles[].roleTypeId` | `seed.roleTypeDescription` | `roleTypes` ✓ |

**The seed store already covers every reference label the page needs except one** (see gaps below).

## Three data sources, no extra order calls

1. **The order payload** — one `GET oms/orders?...` per order (transactional data).
2. **The seed store** — stable reference data loaded once at login (labels + geo).
3. **The product cache** — rich product data fetched **once per productId, ever**, and
   cached (see `docs/ProductData.md`). Not an order call; a shared lookup that never
   refetches the same product.

| UI element | Source |
| --- | --- |
| Customer / account name | payload `roles[PLACING_CUSTOMER].person` / `.partyGroup` (via extended master), fallback `postalAddress.toName` |
| Customer email | payload `contactMechs[ORDER_EMAIL].contactMech.infoString` |
| Customer phone | payload `contactMechs[...].telecomNumber` (often absent) |
| Shipping / billing address | payload `contactMechs[SHIPPING_LOCATION|BILLING_LOCATION].postalAddress` |
| Per-ship-group address | payload `shipGroups[].contactMechId` → `contactMechsById` |
| Geo names in addresses | seed `geoName(countryGeoId / stateProvinceGeoId)` |
| Item product name / SKU / image | **product cache** `getById(productId)` (fallback `itemDescription` / `productId`) |
| Identification type labels | seed `enumDescription(orderIdentificationTypeId)` (`ORDER_IDENTITY`) |
| Adjustment type labels | seed `orderAdjustmentTypeDescription(orderAdjustmentTypeId)` |
| Amounts / totals | payload `grandTotal`, `items[].unitPrice`, `adjustments[].amount` |

## Decisions

### Customer name comes from Person/PartyGroup, not ship-to name
`roles[]` carries only `partyId`. We **extend the OrderRole entity master** to join
`Person` + `PartyGroup` (see `docs/MoquiChanges.md` §1), so the order payload itself carries
`roles[PLACING_CUSTOMER].person.{firstName,lastName}` (B2C) or `.partyGroup.groupName` (B2B).
No extra call — it's in the same master fetch.

**Fallback:** until Moqui is restarted with the master change, `person` is absent; the UI
falls back to `postalAddress.toName`. The `customer` store is **dropped** from this page.

### Product data is rich, via the shared product cache
The payload has no product name/SKU/image — only `itemDescription`, `productId`,
`externalId`. We adopt the inventory-count product-master pattern: fetch product display
fields from Solr **on demand, cached per `productId`, never refetched** (`docs/ProductData.md`).
After the order loads, `prefetch(itemProductIds)` runs once; item labels then resolve to
`product.productName` with `itemDescription`/`productId` as graceful fallback.

### Geo names resolved from the seed store
`postalAddress.stateProvinceGeoId` / `countryGeoId` resolve through `seed.geoName(...)`.
Geo (1,388 rows, ~232 KB) loads at login like other reference data — see `docs/GeoData.md`.

### Identification + adjustment type labels resolved from seed
- Identification types are **Enumerations** (`enumTypeId ORDER_IDENTITY`) → `enumDescription`.
- Adjustment types load from `oms/shippingGateways/orderAdjustmentTypes` →
  `orderAdjustmentTypeDescription`.
Both added to `loadInitialSeedData`.

## Net result

- **One** `GET oms/orders` per order. Customer name, addresses, items, statuses, payments,
  comms, returns all come from that single payload.
- All reference labels (statuses, enums, types, **geo**, **identification types**,
  **adjustment types**) come from the seed store loaded at login.
- Product names/SKUs/images come from the shared product cache — fetched once per product,
  never twice.
