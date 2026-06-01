# Seed data

Status: **implemented** in `src/store/seed.ts`.

The app loads stable reference datasets after login and reuses them across order screens.
Refresh behavior is intentionally conservative: datasets that are already `loaded` are not
refetched during the same persisted session, and transient `loading` states are reset on
boot so a browser reload cannot leave labels stuck forever.

Do not use generic entity access endpoints for this app. Seed data should come from explicit, bounded REST APIs.

Do not add a common aggregate seed-data endpoint for now. Keep each dataset mapped to its own existing or planned endpoint.

## Existing endpoints

| Dataset | Endpoint | Scope | Key |
| --- | --- | --- | --- |
| Product stores | `GET admin/productStores` | Global | `productStoreId` |
| Product store settings | `GET admin/productStores/{productStoreId}/settings` | Product store | `productStoreId`, `settingTypeEnumId` |
| Product store facilities | `GET admin/productStores/{productStoreId}/facilities` | Product store | `productStoreId`, `facilityId` |
| Product store facility groups | `GET admin/productStores/{productStoreId}/facilityGroups` | Product store | `productStoreId`, `facilityGroupId` |
| Product store shipment methods | `GET oms/productStores/{productStoreId}/shipmentMethods` | Product store | `productStoreId`, `shipmentMethodTypeId`, `partyId` |
| Product store email settings | `GET oms/productStoreEmailSettings` | Global | `productStoreId`, `emailType` |
| Status items | `GET admin/status?statusTypeId={statusTypeId}` | Global | `statusId` |
| Enums | `GET admin/enums?enumTypeId={enumTypeId}` | Global | `enumId` |
| Status flow transitions | `GET admin/statusFlows/transitions` | Global | `statusFlowId`, `statusId`, `toStatusId` |
| Facilities | `GET oms/facilities` | Global | `facilityId` |
| Facility groups | `GET oms/facilityGroups` | Global | `facilityGroupId` |
| Facility group members | `GET oms/groupFacilities` | Global | `facilityGroupId`, `facilityId` |
| Payment method types | `GET oms/paymentMethodTypes` | Global | `paymentMethodTypeId` |
| Carrier parties | `GET oms/shippingGateways/carrierParties?roleTypeId=CARRIER` | Global | `partyId` |
| Shipment method types | `GET oms/shippingGateways/shipmentMethodTypes` | Global | `shipmentMethodTypeId` |
| Shopify shops | `GET oms/shopifyShops/shops` | Global | `shopId` |
| Shopify shop locations | `GET oms/shopifyShops/locations` | Global | `shopId`, `locationId` |
| Order adjustment types | `GET oms/shippingGateways/orderAdjustmentTypes` | Global | `orderAdjustmentTypeId` |
| Geos (address enrichment) | `GET admin/geos?geoTypeEnumId=GEOT_COUNTRY,GEOT_STATE,GEOT_PROVINCE&geoTypeEnumId_op=in` | Global | `geoId` |

> `orderAdjustmentTypes` is currently nested under the `shippingGateways` resource (a
> misplacement); used as-is. See [Moqui changes](../backend/MoquiChanges.md). Geo
> sizing/analysis is in [Geo data](GeoData.md) (1,388 rows total, ~232 KB; needed subset
> 963 rows, ~162 KB).

## Status types

Load these status types with `admin/status`:

| Status type | Usage |
| --- | --- |
| `ORDER_STATUS` | Order header status labels |
| `ORDER_ITEM_STATUS` | Order item status labels |
| `SHIPMENT_STATUS` | Shipment status labels |
| `RETURN_HEADER_STATUS` | Return header status labels |
| `RETURN_ITEM_STATUS` | Return item status labels |
| `PAYMENT_PREF_STATUS` | Payment preference status labels |
| `COM_EVENT_STATUS` | Communication event status labels |
| `PARTY_STATUS` | Party/customer status labels |
| `ORDER_HOLD_STATUS` | Order-hold WorkEffort lifecycle labels |

## Enum types

Load these enum types with `admin/enums`:

| Enum type | Usage |
| --- | --- |
| `ORDER_SALES_CHANNEL` | Sales channel labels |
| `ORDER_IDENTITY` | Order identification type labels (`OrderIdentification.orderIdentificationTypeId` is an `Enumeration`, so resolve via `enumDescription`). |
| `ORDER_HOLD_PURPOSE` | Order-hold WorkEffort purpose labels. |

## Bounded reference endpoints

Use these explicit read-only endpoints for type datasets. Do not expose them through a generic entity endpoint.

| Dataset | Proposed endpoint | Entity | Key |
| --- | --- | --- | --- |
| Facility types | `GET oms/facilityTypes` | `org.apache.ofbiz.product.facility.FacilityType` | `facilityTypeId` |
| Contact mech purpose types | `GET oms/contactMechPurposeTypes` | `org.apache.ofbiz.party.contact.ContactMechPurposeType` | `contactMechPurposeTypeId` |
| Communication event types | `GET oms/communicationEventTypes` | `org.apache.ofbiz.party.communication.CommunicationEventType` | `communicationEventTypeId` |
| Return reasons | `GET oms/returnReasons` | `org.apache.ofbiz.order.return.ReturnReason` | `returnReasonId` |
| Return types | `GET oms/returnTypes` | `org.apache.ofbiz.order.return.ReturnType` | `returnTypeId` |
| Return item types | `GET oms/returnItemTypes` | `org.apache.ofbiz.order.return.ReturnItemType` | `returnItemTypeId` |
| Role types | `GET oms/roleTypes` | `org.apache.ofbiz.party.party.RoleType` | `roleTypeId` |

## Skipped for now

Do not load product store payment settings. This dataset is not currently needed for the order detail rebuild.

## Pinia store contract

One app-owned Pinia store owns this data:

`src/store/seed.ts`

This store owns stable lookup data that is reused across screens. It does not own order
detail data, customer detail data, inventory, shipments, returns, or work items.

### State

Use normalized maps for lookup speed and predictable use in computed properties.

```ts
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

type SeedDatasetState<T> = {
  byId: Record<string, T>;
  ids: string[];
  status: LoadStatus;
  loadedAt: string;
  error: string;
};
```

The store has these top-level groups:

```ts
{
  productStores: SeedDatasetState<ProductStore>;
  productStoreSettingsByStoreId: Record<string, SeedDatasetState<ProductStoreSetting>>;
  productStoreFacilitiesByStoreId: Record<string, SeedDatasetState<ProductStoreFacility>>;
  productStoreFacilityGroupsByStoreId: Record<string, SeedDatasetState<ProductStoreFacilityGroup>>;
  productStoreShipmentMethodsByStoreId: Record<string, SeedDatasetState<ProductStoreShipmentMethod>>;
  productStoreEmailSettings: SeedDatasetState<ProductStoreEmailSetting>;

  statusesByType: Record<string, SeedDatasetState<StatusItem>>;
  enumsByType: Record<string, SeedDatasetState<Enumeration>>;
  statusFlowTransitions: SeedDatasetState<StatusFlowTransition>;

  facilities: SeedDatasetState<Facility>;
  facilityTypes: SeedDatasetState<FacilityType>;
  facilityGroups: SeedDatasetState<FacilityGroup>;
  facilityGroupMembers: SeedDatasetState<FacilityGroupMember>;

  paymentMethodTypes: SeedDatasetState<PaymentMethodType>;
  contactMechPurposeTypes: SeedDatasetState<ContactMechPurposeType>;
  communicationEventTypes: SeedDatasetState<CommunicationEventType>;
  returnReasons: SeedDatasetState<ReturnReason>;
  returnTypes: SeedDatasetState<ReturnType>;
  returnItemTypes: SeedDatasetState<ReturnItemType>;
  roleTypes: SeedDatasetState<RoleType>;
  orderAdjustmentTypes: SeedDatasetState<OrderAdjustmentType>;
  geos: SeedDatasetState<Geo>;

  carriers: SeedDatasetState<CarrierParty>;
  shipmentMethodTypes: SeedDatasetState<ShipmentMethodType>;
  shopifyShops: SeedDatasetState<ShopifyShop>;
  shopifyShopLocations: SeedDatasetState<ShopifyShopLocation>;
}
```

### Actions

The app has one login-time entrypoint:

```ts
loadInitialSeedData(productStoreIds: string[]): Promise<void>
```

This action:

- fetches global datasets once
- fetches product-store-scoped datasets for each available product store
- uses `Promise.allSettled` so one failed seed dataset does not block the app
- sets per-dataset loading state and errors
- avoids refetching datasets already marked `loaded`
- demotes stale transient persisted states before loading

The store also exposes focused loaders:

```ts
loadProductStoreSeedData(productStoreId: string): Promise<void>
loadStatusType(statusTypeId: string): Promise<void>
loadEnumType(enumTypeId: string): Promise<void>
resetSeedData(): void
```

`resetSeedData` is called on logout.

### Getters

Prefer getters that return a useful fallback instead of forcing every screen to repeat fallback logic.

```ts
productStore(productStoreId: string)
productStoreName(productStoreId: string)
status(statusId: string)
statusDescription(statusId: string)
enumDescription(enumId: string)
facility(facilityId: string)
facilityName(facilityId: string)
facilityType(facilityTypeId: string)
shipmentMethod(shipmentMethodTypeId: string)
shipmentMethodDescription(shipmentMethodTypeId: string)
carrierName(partyId: string)
paymentMethodDescription(paymentMethodTypeId: string)
contactPurposeDescription(contactMechPurposeTypeId: string)
communicationEventTypeDescription(communicationEventTypeId: string)
returnReasonDescription(returnReasonId: string)
returnTypeDescription(returnTypeId: string)
returnItemTypeDescription(returnItemTypeId: string)
roleTypeDescription(roleTypeId: string)
orderAdjustmentTypeDescription(orderAdjustmentTypeId: string)
orderIdentificationTypeDescription(orderIdentificationTypeId: string)  // alias of enumDescription (ORDER_IDENTITY)
geoName(geoId: string)
allowedTransitions(statusId: string)
```

Fallback rule: if a lookup record is missing, return the ID. The UI should not need to know whether a label was found.

## App usage

### Login

After login, the user store should load user profile, permissions, and product stores first. Then it should call:

```ts
await useSeedStore().loadInitialSeedData(productStoreIds);
```

`productStoreIds` should come from the product stores available to the logged-in user.

### Logout

On logout, call:

```ts
useSeedStore().resetSeedData();
```

This prevents a later user from seeing stale seed data from a previous session.

### Screens

Screens should not call seed APIs directly. They should read from `seedStore` getters.

Examples:

```ts
const seedStore = useSeedStore();

const statusLabel = computed(() => seedStore.statusDescription(order.value.statusId));
const facilityLabel = computed(() => seedStore.facilityName(shipGroup.value.facilityId));
const channelLabel = computed(() => seedStore.enumDescription(order.value.salesChannelEnumId));
```

### Order detail store

The order detail store should keep order API data separate from seed data.

Order detail data should store IDs from the order payload. The UI layer should join those IDs to seed labels through `seedStore` getters.

Example:

```ts
const orderStatus = computed(() => {
  return seedStore.statusDescription(orderDetailStore.order?.statusId);
});
```

Do not copy seed labels into the order detail store. That creates stale duplicated data.

### Existing util store

The former util-store seed responsibilities have moved into `seed`. Keep generic UI
helpers outside this store; domain labels belong here.
