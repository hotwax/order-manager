# Moqui changes for order detail enrichment

Status: **partly implemented in the local Moqui/OMS working trees**, with remaining API
gaps tracked in [API requirements](API_REQUIREMENTS.md).

Single fetch the order detail page uses:

```
GET oms/orders?orderId={orderId}&dependentLevels=1   → [ OrderHeader default master ]
```

## 1. Customer name — extend the OrderRole master to join Person/PartyGroup

**Problem:** `roles[]` carries only `partyId`. The customer's name is on the `Person`
(or `PartyGroup`) record. Ship-to `postalAddress.toName` is only the recipient, not the
account name.

**Solution (mirrors the existing `PicklistRole` pattern in `OmsExtendedEntities.xml`):**
extend `OrderRole` with `person` + `partyGroup` relationships and a `party` master, then
have the OrderHeader `default` master pull `roles` through that master.

In `entity/OrderExtendedEntities.xml`:

```xml
<extend-entity entity-name="OrderRole" package="org.apache.ofbiz.order.order">
    <relationship type="one-nofk" related="org.apache.ofbiz.party.party.Person" short-alias="person">
        <key-map field-name="partyId"/>
    </relationship>
    <relationship type="one-nofk" related="org.apache.ofbiz.party.party.PartyGroup" short-alias="partyGroup">
        <key-map field-name="partyId"/>
    </relationship>
    <master name="party">
        <detail relationship="person"/>
        <detail relationship="partyGroup"/>
    </master>
</extend-entity>
```

And change the OrderHeader `default` master's roles line:

```xml
<detail relationship="roles" use-master="party"/>   <!-- was: <detail relationship="roles"/> -->
```

**Result:** each role gains nested `person { firstName, lastName, … }` and
`partyGroup { groupName, … }`. The UI reads the `PLACING_CUSTOMER` role:
`person.firstName + ' ' + person.lastName` (B2C) or `partyGroup.groupName` (B2B).

**⚠ Requires a Moqui restart.** Entity-definition/master changes load at framework
startup; they do not hot-reload. Until the server is restarted with this change, the order
payload will not contain `roles[].person`. The PWA therefore falls back to
`postalAddress.toName` and upgrades automatically once `person` appears. See
[Compromises](../history/Compromises.md).

## 2. Type/reference endpoints — already live, no Moqui change

Verified against the running server:

| Need | Endpoint | Status |
| --- | --- | --- |
| Facility/contact-purpose/comm-event/return/role types | `GET oms/{type}` (top-level) | **200** — live |
| Order identification types | `GET admin/enums?enumTypeId=ORDER_IDENTITY` | **200** — live (they are Enumerations) |
| Order adjustment types | `GET oms/shippingGateways/orderAdjustmentTypes` | **200** — live |
| Geo (countries/states/provinces) | `GET admin/geos` | **200** — live |

### Endpoint reconciliation (important)

The committed `bc6892a` put the 7 reference endpoints under `oms/reference/*`. The current
**working tree of `oms.rest.xml` moved them to top-level `oms/*`** (uncommitted), and the
**running server serves them top-level**. `oms/reference/facilityTypes` now returns **404**.

→ The PWA `seed.ts` (which still called `oms/reference/*`) was therefore **broken** and is
realigned to top-level `oms/*` in this work. We preserve the worktree's top-level layout.

### Order identification types are Enumerations

`co.hotwax.order.OrderIdentification.orderIdentificationTypeId` has an FK to
`moqui.basic.Enumeration` (enumTypeId `ORDER_IDENTITY`). So there is **no** type entity and
**no** new endpoint — we just add `ORDER_IDENTITY` to the seed enum list and resolve via
`seed.enumDescription`.

### Order adjustment types live under shippingGateways

`oms/orderAdjustmentTypes` is **misplaced** under `shippingGateways` (line ~538, nested in
the `shippingGateways` resource). It works at `oms/shippingGateways/orderAdjustmentTypes`.
The seed store uses that path. A future cleanup could promote it to top-level
`oms/orderAdjustmentTypes` alongside the other type endpoints — noted, not done here (avoid
touching unrelated structure).

## Validation

- `xmllint --noout entity/OrderExtendedEntities.xml` after the OrderRole edit.
- Restart Moqui, then re-fetch `oms/orders?orderId=M103061&dependentLevels=1` and confirm
  `roles[].person.firstName` / `roles[].partyGroup.groupName` are present.
