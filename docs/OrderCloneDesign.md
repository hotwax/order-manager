# Order Clone — Design & Implementation

Product decisions: 2026-06-11. Status: implemented (uncommitted) across `order-manager` and `hotwax/oms`.

## Intent

Clone creates a **brand-new order as if it was placed again from an external system**, seeded from the
descriptive intent of the source order. Holds are added by the OMS after the fact and payment is captured
on the order again after the fact — the clone carries **none** of that. Clone is available at **all times**,
including on cancelled/completed orders (see `OrderActionValidator` → `CLONE`, always allowed).

This mirrors Shopify's duplicate-via-draft-order model and NetSuite's "Make Copy": execution state is never
carried; descriptive intent is.

## What carries / what doesn't

| Carried | Recomputed by backend | Dropped |
|---|---|---|
| Line items (productId/sku/title via product cache) | Taxes, shipping, totals | Billing address, discounts/adjustments |
| **All** items at **original** quantities¹ | Inventory reservation / brokering / facility | Gift options, identifications, attributes |
| Customer name / email / phone | Order number / name / dates / status | Holds, payments, fulfillment, status history |
| Shipping address (geoId → name transforms) | | Ship-group structure (flattened) |
| Currency (source `currencyUom`) | | |

¹ The operator trims unwanted items from the **new** order while it is in created status — no item
selection in the clone modal.

The create contract (`POST oms/orders/shopify` → `create#ShopifyOrder` → Shopify GraphQL
`draftOrderCreate` + `draftOrderComplete`) physically cannot carry the dropped columns — there are no
fields for them — so the "as if newly created externally" rule is enforced by construction.

## Price modes (user choice in the modal)

| Mode | Payload | Effect |
|---|---|---|
| **Carry over original prices** (default) | `items[].price = source unitPrice` | Honors originally agreed price (re-ship/correction/warranty) |
| **Use current product prices** | `price` key omitted | Backend omits `originalUnitPrice` → Shopify prices the variant at current catalog² |
| **Free** | `items[].price = 0` | $0 lines (full appeasement-style reship) |

² Requires the paired backend change in `create#ShopifyOrder`: `originalUnitPrice` is only sent when a
price is provided; a custom line (no resolved variant) keeps the `0.00` fallback because Shopify cannot
price it.

## Idempotency — the `-1` externalId rule

Every clone sends `externalId = (source externalId || source orderId) + "-1"`. The backend rejects the
request when that externalId is already taken, so attempting the same clone twice **fails automatically**.

Mechanics (important):

- The service stamps the externalId as an **order-level draft-order customAttribute** plus a `Cloned` tag.
- On bridge re-ingest, Shopify customAttributes persist as **`OrderAttribute`** rows
  (`attrName = "externalId"`); `OrderHeader.externalId` itself is set to the *new Shopify order's* id by
  the bridge — so the duplicate gate checks **OrderAttribute first**, then OrderHeader as belt-and-braces.
- **Pre-sync window:** a second clone fired before the first has synced back from Shopify is not caught.
  Accepted limitation; the window is the Shopify→OMS sync lag.
- Clone of a clone yields `...-1-1`.

## Endpoints

| Endpoint | Status | Purpose |
|---|---|---|
| `POST oms/orders/shopify` | extended | optional `externalId` → duplicate gate + customAttribute/tag stamp; null `price` → omit `originalUnitPrice` |
| `GET oms/orders/{orderId}/shopifyShopOrder` | new | shop resolution: `{shopId, orderId, shopifyOrderId}` rows |
| `GET oms/parties/{partyId}/identifications` | new | customer Shopify id: rows matched on `partyIdentificationTypeId = "SHOPIFY_CUST_ID"` |
| `GET/POST oms/shopify/customers` | existing | fallback customer search-by-email / create |

## Frontend pieces (order-manager)

- `src/utils/cloneOrder.ts` — pure, import-free payload builder (`buildClonePayload`, `cloneExternalId`,
  …). Geo transforms (`stateProvinceGeoId → province`, `countryGeoId → country` via injected `geoName`,
  `postalCode → zip`) and product enrichment (`getProduct` injection) are dependency-injected for
  testability. 18 unit tests in `cloneOrder.spec.ts`.
- `src/components/orders/CloneOrderModal.vue` — explainer, read-only summary (item count, currency, ship-to,
  new external ID), 3-way price radio, editable prefilled note (`Cloned from <orderName> (<orderId>)`),
  shop auto-resolution with manual `ion-select` fallback over seed `shopifyShops`, customer resolution
  chain (PartyIdentification → email search → **deferred** create-at-submit, so cancelling the modal never
  leaves an orphan Shopify customer), distinct already-cloned error rendering.
- `src/views/OrderDetail.vue` — footer **Clone** button, gated through
  `OrderActionValidator.validateFooterAction(order, 'CLONE', …)`.

## Release coordination

- `src/utils/OrderActionValidator.ts` (status-engine workstream) is imported by the clone wiring — it must
  land in the same commit/PR as the clone files or the build breaks.
- The local `hotwax/oms` checkout (branch `JUNE-15`) was ~89 commits behind `origin/JUNE-15` when the
  changes were authored — rebase/pull before raising the PR and re-verify the two edit sites.
- Appeasement / Reship remain **backend gaps** (`src/services/orderActions.ts`) — clone covers the
  "re-ship as new order" case; first-class appeasement/reship services are separate work.
- Cancel/pull-back phase-policy config (company app): hotwax/company#158.
