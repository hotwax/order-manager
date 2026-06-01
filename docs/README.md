# Order Manager docs

These docs describe the current order-manager rebuild state after the first real-data
implementation pass. They are organized by intent:

## Product direction

- [Scope](product/Scope.md) - product goal and operational problems the app owns.
- [Data model](product/DataModel.md) - core OMS entities behind order flow and exceptions.

## Current order detail architecture

- [Order detail data binding](architecture/OrderDetailDataBinding.md) - source-of-truth contract for
  what the page renders and where each value comes from.
- [Order detail store](architecture/OrderDetailStore.md) - implemented Pinia store and payload shape.
- [Seed data](architecture/SeedData.md) - implemented login-time reference-data store.
- [Product data](architecture/ProductData.md) - implemented product enrichment cache backed by Dexie.
- [Geo data](architecture/GeoData.md) - measured address geo-label loading decision.
- [Order holds via WorkEffort](architecture/OrderHoldWorkEffort.md) - implemented hold data model and
  read-only order-detail UI binding.

## Backend contracts and follow-up

- [Moqui changes](backend/MoquiChanges.md) - backend master/detail and reference endpoint changes
  that support the current UI.
- [API requirements](backend/API_REQUIREMENTS.md) - remaining order master-detail gaps still
  needed for fuller order-detail coverage.
- [Compromises log](history/Compromises.md) - historical implementation notes, resolved blockers,
  and environment-specific verification details.

## Current results

- The order detail page uses one `GET oms/orders?orderId={orderId}&dependentLevels=1`
  request per order.
- Transactional order data stays verbatim in `src/store/orderDetail.ts`; labels are
  resolved at the UI layer through the seed store.
- Stable reference data loads once after login through explicit bounded endpoints in
  `src/store/seed.ts`.
- Product names, SKU, and images come from `useProductMaster()` and persist per OMS in
  Dexie (`${oms}-CommonDB`).
- Order holds are represented as `ORDER_HOLD` WorkEfforts and render in the order detail
  Holds tab when present.
