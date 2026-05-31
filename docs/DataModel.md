# Data model

The key entities that represent a sales orders life cycle are:

1. orderHeader
2. orderItemShipGroup
3. orderItem
4. shipment
5. shipmentItem
6. product
7. inventory
8. party
9. contactMech
10. orderPaymentPreference

These entities have a host of detail entities that flesh out each model but focusing on these should accomplish the function of order fulfillment.

When an exception occurs and an order requires human intervention, there are two primary models used to triage orders.

1. facilities of type virtual
   1. allows us to park orders while they are being reviewed by humans for next actions. Virtual facilities allow the OMS to prevent them from committing a single locations inventory while also preventing over selling online by factoring in virtual queue orders in globabl online inventory calculations.
2. workEfforts
   1. Useful when an order requires specific follow up actions like a bad address resolution. WorkEffort and it's related entities allow us to show user precise actions to unblock an order.