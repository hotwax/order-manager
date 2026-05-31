# Seed data

The app should load these seed datasets at least once after login. Refresh behavior will be decided later.

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
> misplacement); used as-is. See `docs/MoquiChanges.md`. Geo sizing/analysis is in
> `docs/GeoData.md` (1,388 rows total, ~232 KB; needed subset 963 rows, ~162 KB).

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

## Enum types

Load these enum types with `admin/enums`:

| Enum type | Usage |
| --- | --- |
| `ORDER_SALES_CHANNEL` | Sales channel labels |
| `ORDER_IDENTITY` | Order identification type labels (`OrderIdentification.orderIdentificationTypeId` is an `Enumeration`, so resolve via `enumDescription`). |

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

Do not load work effort seed data yet. The local model will be revisited after migration work.

Do not load product store payment settings. This dataset is not currently needed for the order detail rebuild.

## Pinia store contract

Create one app-owned Pinia store for this data:

`src/store/seed.ts`

This store owns stable lookup data that is reused across screens. It should not own order detail data, customer detail data, inventory, shipments, returns, or work items.

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

The store should have these top-level groups:

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

The app should have one login-time entrypoint:

```ts
loadInitialSeedData(productStoreIds: string[]): Promise<void>
```

This action should:

- fetch global datasets once
- fetch product-store-scoped datasets for each available product store
- use `Promise.allSettled` so one failed seed dataset does not block the app
- set per-dataset loading state and errors
- avoid refetching datasets already marked `loaded`

The store should also expose focused loaders for later use:

```ts
loadProductStoreSeedData(productStoreId: string): Promise<void>
loadStatusType(statusTypeId: string): Promise<void>
loadEnumType(enumTypeId: string): Promise<void>
resetSeedData(): void
```

`resetSeedData` should be called on logout.

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

The existing `util` store currently owns some of this behavior. As this plan is implemented, seed-data ownership should move out of `util` and into `seed`.

Keep `util` only for generic UI/utilities that are not domain seed data.
