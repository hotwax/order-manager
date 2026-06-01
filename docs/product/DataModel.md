# Data model

The order lifecycle is represented by a small set of core OMS entities plus detail tables
around them.

## Core order flow

| Area | Primary entities | Purpose |
| --- | --- | --- |
| Order | `OrderHeader`, `OrderItemShipGroup`, `OrderItem`, `OrderStatus` | Header state, ship groups, item state, status history. |
| Fulfillment | `Shipment`, `ShipmentItem`, `Facility`, `InventoryItem` | Physical movement, facility assignment, inventory commitment. |
| Customer/contact | `Party`, `Person`, `PartyGroup`, `ContactMech`, `PostalAddress`, `TelecomNumber` | Customer identity and contact destinations. |
| Payment | `OrderPaymentPreference` | Payment method, authorization, and payment status. |
| Product | `Product`, product identification data, Solr product docs | Product display and SKU enrichment. |

## Exception handling

When an order needs human intervention, this app uses two complementary models:

| Model | Use |
| --- | --- |
| Virtual facilities | Park inventory or orders in operational queues without committing one physical location's inventory. These queues can still be included in online inventory calculations so the retailer avoids overselling. |
| WorkEfforts | Represent explicit follow-up tasks, such as bad-address resolution or a manual order hold. WorkEfforts let the UI show the task purpose, lifecycle status, and assignee. |

## Current hold model

Order holds are `WorkEffort` records linked to orders through `OrderHeaderWorkEffort`.
The current detail page reads them from the order master payload and filters for
`workEffortTypeId = ORDER_HOLD`.
