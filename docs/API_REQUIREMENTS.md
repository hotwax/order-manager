# API requirements

## Order header fields

The order detail store needs the order master-detail response to expose these `OrderHeader` fields:

| Field | Current response | Notes |
| --- | --- | --- |
| `priority` | Missing | Base `OrderHeader` field. |
| `createdBy` | Missing | Base `OrderHeader` field. |
| `isRushOrder` | Missing | Base `OrderHeader` field. |
| `localeString` | Present | Extended `OrderHeader` field. |
| `customerClassificationId` | Missing | Extended `OrderHeader` field. |
| `presentmentCurrencyUom` | Present | Extended `OrderHeader` field. |
| `autoApprove` | Present | Extended `OrderHeader` field. |
| `statusFlowId` | Missing | Extended `OrderHeader` field. |

Reference response: `docs/order-master-detail-M103113.json`.

## Order item ship group fields

The order detail store needs the order master-detail response to expose these `OrderItemShipGroup` fields:

| Field | Current response | Notes |
| --- | --- | --- |
| `telecomContactMechId` | Missing | Used for ship group phone contact. |
| `shippingInstructions` | Missing | Needed for fulfillment/customer service review. |
| `giftMessage` | Missing | Needed for gift order handling. |
| `shipAfterDate` | Missing | Needed for promise/hold timing. |
| `shipByDate` | Missing | Needed for SLA and order flow monitoring. |
| `estimatedShipDate` | Missing | Needed for fulfillment timeline. |
| `estimatedDeliveryDate` | Missing | Needed for customer promise timeline. |

## Communication events

The order detail store needs order communication events in the order detail API shape.

| Data | Current response | Notes |
| --- | --- | --- |
| `CommunicationEventOrder` rows for the order | Present after default master update | Order-to-communication join records are included when matching rows exist. |
| Related `CommunicationEvent` details | Present after default master update | Included with the join rows so the store has type, status, content, and event timing without a second lookup per event. |

Plan:

- Add this to the existing `default` order master for now.
- Revisit whether this should move to a named order detail master during backend review.
- Add an `OrderHeader` relationship to `CommunicationEventOrder`, exposed as `communicationEventOrders`.
- Add a `CommunicationEventOrder` master that includes the related `CommunicationEvent`.

Verification payload: `docs/order-master-detail-M103061-after-default-master-update.json`.

## Returns

The order detail store needs return item data for the order so the page can show returned quantity.

| Data | Current order master response | Notes |
| --- | --- | --- |
| `ReturnItem` rows for the order | Present after default master update | Needed to calculate returned quantity by `orderItemSeqId`. |

Plan:

- Add this to the existing `default` order master for now.
- Revisit whether this should move to a named order detail master during backend review.
- Add an `OrderHeader` relationship to `ReturnItem`, exposed as `returnItems`.
- Do not include full `ReturnHeader` details for now.

Verification payload: `docs/order-master-detail-M102416-after-default-master-update.json`.
