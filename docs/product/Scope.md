# Order manager scope

Order Manager helps retailers keep orders moving after a sale is placed.

The guiding idea is that the retailer and customer have made a delivery agreement. The app
should help operators protect that agreement by answering two practical questions:

1. Will the customer receive the items on time?
2. Will the customer receive exactly what they ordered?

## Operational problems

Order flow breaks down when exceptions are spread across too many systems or are only
visible as raw order status. The app focuses on exception surfaces that need human review:

1. Inventory was overcommitted.
   - Refund the customer.
   - Offer an alternate item.
   - Ship later when the promised item is back in stock.
2. The shipping address is invalid and needs correction.
3. The payment method or order context requires review before fulfillment continues.
4. An order is waiting on an operator task, such as a hold, reassignment, or customer
   follow-up.

## Current implementation direction

- The order detail page is the first stable read model.
- It uses one Moqui order master-detail payload and joins labels through seed data.
- Product display enrichment is external to the order payload and cached per OMS.
- Holds are modeled as WorkEfforts and shown on the order detail page before broader hold
  workflow buckets are built.

## Product boundary

The app should prefer focused operational screens over generic dashboard cards. Screens
should make the next review/action obvious, avoid duplicate information, and stay usable on
mobile store-operations devices.
