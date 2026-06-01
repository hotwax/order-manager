# API requirements

Status: **remaining backend gaps** for fuller order-detail coverage. The core order-detail
page is already backed by one order master-detail call plus seed/product reference data.

## Current order detail fetch

```text
GET oms/orders?orderId={orderId}&dependentLevels=1
```

The current UI expects a single `OrderHeader` aggregate with nested roles,
identifications, statuses, adjustments, payment preferences, contact mechs, communication
events, returns, work-effort holds, and ship groups with nested items.

## Implemented backend additions

| Need | Result |
| --- | --- |
| Customer display name | `OrderRole` master joins `Person` and `PartyGroup`; UI falls back to shipping `toName` if absent. |
| Communication events | `communicationEventOrders[].communicationEvent` is available in the order payload when rows exist. |
| Returns | `returnItems[]` is available and used for returned quantity by item sequence ID. |
| Holds | `workEfforts[].workEffort` carries `ORDER_HOLD` WorkEfforts with assignee data. |
| Seed labels | Bounded reference endpoints feed `src/store/seed.ts`; no generic entity endpoint is used. |
| Product enrichment | Product display fields are resolved through the Solr-backed Dexie product cache, not the order payload. |

## Remaining order header fields

These `OrderHeader` fields are still useful for future detail or workflow coverage:

| Field | Current response | Notes |
| --- | --- | --- |
| `priority` | Missing | Base `OrderHeader` field. |
| `createdBy` | Missing | Base `OrderHeader` field. |
| `isRushOrder` | Missing | Base `OrderHeader` field. |
| `customerClassificationId` | Missing | Extended `OrderHeader` field. |
| `statusFlowId` | Missing | Extended `OrderHeader` field. |

Already present and used where needed: `localeString`, `presentmentCurrencyUom`,
`autoApprove`.

## Remaining ship-group fields

These `OrderItemShipGroup` fields are still needed before the ship-group UI can be fully
bound:

| Field | Current response | Notes |
| --- | --- | --- |
| `telecomContactMechId` | Missing | Ship-group phone contact. |
| `shippingInstructions` | Missing | Fulfillment/customer-service review. |
| `giftMessage` | Missing | Gift order handling. |
| `shipAfterDate` | Missing | Promise/hold timing. |
| `shipByDate` | Missing | SLA and order-flow monitoring. |
| `estimatedShipDate` | Missing | Fulfillment timeline. |
| `estimatedDeliveryDate` | Missing | Customer promise timeline. |

## Backend review notes

- The current additions are on the existing order `default` master.
- During backend review, decide whether order-detail-specific depth should stay on the
  default master or move to a named order-detail master.
- Keep sample payloads faithful to Moqui's actual master/detail nesting when adding new
  examples. Avoid shorthand payloads that hide association rows or nested relationships.
