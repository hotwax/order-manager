# Order holds via WorkEffort — final implementation spec

Status: **IMPLEMENTED & verified live (2026-05-31).** M103777's Holds tab renders a real hold
("Bad address / Verify shipping address / Assigned to HotWax User / Open") from local Moqui.
See "Implementation notes & compromises" at the bottom.

Replaces the static "Order on hold" banner on the order detail page with real, per-order hold
tasks modeled as WorkEfforts, returned in the order master and labeled via the seed store.
Grounded in the running model (`~/moqui-sd/notnaked/runtime/component/*`) and poorti's
cycle-count WorkEffort precedent.

## Decisions locked
- **Hold = `WorkEffort`** with `workEffortTypeId = ORDER_HOLD`.
- **Purpose** = `workEffortPurposeTypeId` ∈ { bad address, customer request, manual } — modeled
  as `Enumeration`s (the only new vocabulary we introduce).
- **Status = dedicated `ORDER_HOLD_STATUS` set** (`ORD_HOLD_OPEN` / `ORD_HOLD_RELEASED`) with a
  `StatusFlow`. Statuses are modeled the proper Moqui way (`StatusType` + `StatusItem` +
  `StatusFlow`/`StatusFlowTransition`), **not** as Enumerations — and not reusing the
  cycle-count set (those IDs are semantically cycle-count-specific). `WorkEffort.statusId` is a
  soft FK to `StatusItem` with no type constraint, so a hold-specific status set is the correct
  approach and coexists with other work-effort status sets.
- **Order link** = port OFBiz `OrderHeaderWorkEffort`, placed where the other work-effort
  entities live (`ofbiz-oms-udm/entity/DatamodelWorkeffortEntitymodel.xml`).
- **Assignee included** via `WorkEffortPartyAssignment` (roleTypeId `TASK_ASSIGNEE`), with the
  person name nested in the master.
- **Scope = order detail page only.** No list/workflow buckets, no place/release actions.

Open micro-confirmations (don't block review): the type-enum category id (`WORK_EFFORT_TYPE`,
generic — my pick) and the three purpose enum ids (`ORD_HOLD_BAD_ADDR` / `ORD_HOLD_CUST_REQ` /
`ORD_HOLD_MANUAL`).

---

# PART 1 — BACKEND (Moqui)

## 1.1 Port `OrderHeaderWorkEffort`  (new entity)
Add to **`ofbiz-oms-udm/entity/DatamodelWorkeffortEntitymodel.xml`** (where `WorkEffort`,
`WorkEffortStatus`, `WorkEffortPartyAssignment` are defined). Translated from OFBiz
`hotwax-oms/applications/datamodel/entitydef/order-entitymodel.xml`:
```xml
<entity entity-name="OrderHeaderWorkEffort" package="org.apache.ofbiz.order.order" cache="never">
    <field name="orderId" type="id" is-pk="true"/>
    <field name="workEffortId" type="id" is-pk="true"/>
    <relationship type="one" fk-name="ORDERHDWE_OH" related="org.apache.ofbiz.order.order.OrderHeader">
        <key-map field-name="orderId"/>
    </relationship>
    <relationship type="one" fk-name="ORDERHDWE_WEFF" related="org.apache.ofbiz.workeffort.workeffort.WorkEffort" short-alias="workEffort">
        <key-map field-name="workEffortId"/>
    </relationship>
    <master name="default"><detail relationship="workEffort" use-master="default"/></master>
</entity>
```
Moqui creates the table on startup.

## 1.2 Masters for the nested payload  (`oms/entity/OrderExtendedEntities.xml`)
App-side presentation masters, alongside the existing OrderRole→person join:
```xml
<!-- OrderHeader: expose the holds + pull them into the default master -->
<!-- (add relationship to the existing OrderHeader extend-entity) -->
<relationship type="many" related="org.apache.ofbiz.order.order.OrderHeaderWorkEffort" short-alias="workEfforts">
    <key-map field-name="orderId"/>
</relationship>
<!-- (add to the OrderHeader default master) -->
<detail relationship="workEfforts" use-master="default"/>

<!-- WorkEffort: nest its party assignments -->
<extend-entity entity-name="WorkEffort" package="org.apache.ofbiz.workeffort.workeffort">
    <relationship type="many" related="org.apache.ofbiz.workeffort.workeffort.WorkEffortPartyAssignment" short-alias="partyAssignments">
        <key-map field-name="workEffortId"/>
    </relationship>
    <master name="default"><detail relationship="partyAssignments" use-master="default"/></master>
</extend-entity>

<!-- WorkEffortPartyAssignment: nest the assignee's person (mirrors OrderRole→person) -->
<extend-entity entity-name="WorkEffortPartyAssignment" package="org.apache.ofbiz.workeffort.workeffort">
    <relationship type="one-nofk" related="org.apache.ofbiz.party.party.Person" short-alias="person">
        <key-map field-name="partyId"/>
    </relationship>
    <master name="default"><detail relationship="person"/></master>
</extend-entity>
```
Resulting payload — the order gains a `workEfforts` array. Shape verified against the
`communicationEventOrders` analog already in the live master (same OrderHeader→assoc→nested-one
structure): the assoc row does **not** repeat the parent `orderId`, and every node also carries
`_entity` + `lastUpdatedStamp` (omitted below for brevity):
```jsonc
"workEfforts": [
  {
    "workEffortId": "ORDHOLD10001",          // OrderHeaderWorkEffort row (orderId not repeated)
    "workEffort": {
      "workEffortId": "ORDHOLD10001",
      "workEffortTypeId": "ORDER_HOLD",
      "workEffortPurposeTypeId": "ORD_HOLD_BAD_ADDR",
      "statusId": "ORD_HOLD_OPEN",
      "workEffortName": "Verify shipping address",
      "createdDate": 1748649600000,
      "partyAssignments": [
        {
          "partyId": "HOTWAX_USER",
          "roleTypeId": "TASK_ASSIGNEE",
          "fromDate": 1748649600000,
          "person": { "firstName": "Hotwax", "lastName": "User" }
        }
      ]
    }
  }
]
```
Type/purpose/status come back as **IDs** (resolved to labels by the seed store); only the
assignee's person name is nested (it's per-record, not seed data). The `workEffort` object also
returns all of WorkEffort's other scalar fields (mostly null) — only the relevant ones shown.

## 1.3 Reference (seed) data — `oms/data/OrderHoldTypeData.xml`  (`type="seed"`)
Two distinct Moqui subsystems: **Enumerations** for the type/purpose vocabulary, and the
**Status** entities (`StatusType` + `StatusItem` + `StatusFlow` + `StatusFlowTransition`) for the
lifecycle. Statuses are NOT modeled as Enumerations.
```xml
<entity-facade-xml type="seed">
    <!-- Type & purpose vocabulary → Enumerations (WorkEffort FKs these to moqui.basic.Enumeration) -->
    <moqui.basic.EnumerationType enumTypeId="WORK_EFFORT_TYPE" description="Work Effort Type"/>
    <moqui.basic.Enumeration enumId="ORDER_HOLD" enumTypeId="WORK_EFFORT_TYPE" description="Order Hold"/>

    <moqui.basic.EnumerationType enumTypeId="ORDER_HOLD_PURPOSE" description="Order Hold Purpose"/>
    <moqui.basic.Enumeration enumId="ORD_HOLD_BAD_ADDR" enumTypeId="ORDER_HOLD_PURPOSE" description="Bad address" sequenceNum="1"/>
    <moqui.basic.Enumeration enumId="ORD_HOLD_CUST_REQ" enumTypeId="ORDER_HOLD_PURPOSE" description="Customer request" sequenceNum="2"/>
    <moqui.basic.Enumeration enumId="ORD_HOLD_MANUAL"   enumTypeId="ORDER_HOLD_PURPOSE" description="Manual" sequenceNum="3"/>

    <!-- Lifecycle → Status entities (WorkEffort.statusId FKs StatusItem). Mirrors poorti's CYCLE_CNT_STATUS_FLOW. -->
    <moqui.basic.StatusType statusTypeId="ORDER_HOLD_STATUS" description="Order Hold Status"/>
    <moqui.basic.StatusItem statusId="ORD_HOLD_OPEN"     statusTypeId="ORDER_HOLD_STATUS" description="Open" sequenceNum="1"/>
    <moqui.basic.StatusItem statusId="ORD_HOLD_RELEASED" statusTypeId="ORDER_HOLD_STATUS" description="Released" sequenceNum="2"/>

    <moqui.basic.StatusFlow statusFlowId="ORDER_HOLD_STATUS_FLOW" statusTypeId="ORDER_HOLD_STATUS" description="Status Flow for Order Hold (WorkEffort)"/>
    <moqui.basic.StatusFlowTransition statusFlowId="ORDER_HOLD_STATUS_FLOW" statusId="ORD_HOLD_OPEN" toStatusId="ORD_HOLD_RELEASED" transitionSequence="1" transitionName="Release"/>
</entity-facade-xml>
```
The `StatusType`/`StatusItem` give the values; `StatusFlow` + `StatusFlowTransition` define the
`Open → Released` transition (label "Release") — which the seed store's existing
`allowedTransitions(statusId)` getter picks up for the future release action. `statusCode` is
optional (omitted, like poorti).

## 1.4 Sample (demo) data — `oms/data/OrderHoldDemoData.xml`  (`type="demo"`)
Open holds on real orders, with an assignee. Status = `ORD_HOLD_OPEN`.
```xml
<entity-facade-xml type="demo">
    <!-- bad-address hold on M103777, assigned to a party -->
    <WorkEffort workEffortId="ORDHOLD10001" workEffortTypeId="ORDER_HOLD"
        workEffortPurposeTypeId="ORD_HOLD_BAD_ADDR" statusId="ORD_HOLD_OPEN"
        workEffortName="Verify shipping address" createdDate="2026-05-31 00:00:00.000"/>
    <OrderHeaderWorkEffort orderId="M103777" workEffortId="ORDHOLD10001"/>
    <WorkEffortPartyAssignment workEffortId="ORDHOLD10001" partyId="HOTWAX_USER"
        roleTypeId="TASK_ASSIGNEE" fromDate="2026-05-31 00:00:00.000"/>

    <!-- customer-request hold on M103061 -->
    <WorkEffort workEffortId="ORDHOLD10002" workEffortTypeId="ORDER_HOLD"
        workEffortPurposeTypeId="ORD_HOLD_CUST_REQ" statusId="ORD_HOLD_OPEN"
        workEffortName="Customer requested hold" createdDate="2026-05-31 00:00:00.000"/>
    <OrderHeaderWorkEffort orderId="M103061" workEffortId="ORDHOLD10002"/>
</entity-facade-xml>
```
(`partyId="HOTWAX_USER"` is the seeded dev user; swap for any real party. The
`TASK_ASSIGNEE` role exists in the DB; `ORD_HOLD_OPEN` comes from the seed in §1.3.)

## 1.5 Load mechanism
Register both files in `oms/component.xml` (or load ad-hoc with Moqui's data loader). Seed =
always loaded; demo = dev only. `entity-facade-xml` upserts by PK, so it's re-runnable. No
`entityData` REST (forbidden) — same path poorti's `TypeData.xml` uses.

## 1.6 Restarts
Two Moqui restarts: once after the entity port (1.1) so the table is created, once after the
master changes (1.2). Validate XML with `xmllint`; restart by killing the full process tree
(not just the screen) per [Compromises](../history/Compromises.md).

---

# PART 2 — FRONTEND (PWA)

## 2.1 Seed store  (`src/store/seed.ts`)
Add two type ids so labels resolve (getters already exist — `enumDescription`,
`statusDescription`):
- `enumTypeIds` += `"ORDER_HOLD_PURPOSE"`
- `statusTypeIds` += `"ORDER_HOLD_STATUS"`
Update [Seed data](SeedData.md) accordingly. No new getters (the `ORDER_HOLD_STATUS_FLOW`
transitions load via the existing `loadStatusFlowTransitions`, so `allowedTransitions` works too).

## 2.2 Order detail store  (`src/store/orderDetail.ts`)
Three no-arg getters over `current` (same pattern as `headerStatuses`/`allItems`); payload
stored verbatim, no state change:
```ts
holds        // (current.workEfforts || []).map(w => w.workEffort)
             //   .filter(w => w?.workEffortTypeId === 'ORDER_HOLD')
openHolds    // holds.filter(w => w.statusId === 'ORD_HOLD_OPEN')
hasOpenHolds // openHolds.length > 0
```

## 2.3 Order detail page  (`src/views/OrderDetail.vue`)
- **View model**: map each open hold to display fields —
  `purpose: seed.enumDescription(h.workEffortPurposeTypeId)`,
  `status: seed.statusDescription(h.statusId)`,
  `name: h.workEffortName`,
  `assignee:` from `h.partyAssignments[0].person` (firstName + lastName),
  `dueDate`.
- **Template**: replace the hardcoded "Order on hold…" banner in the ship-group card with a
  `v-for="hold in openHolds"` block (read-only). **This is a deliberate template-graph change**
  in that one section — the only graph change in this work, and it's the whole point (the
  banner becomes real). CSS untouched. If no open holds, render nothing (no banner).

## 2.4 Label resolution
All hold labels resolve through the seed store already loaded at login (purpose enum, status
items). The assignee name comes from the nested `person` in the payload. One order API call,
no extra fetches.

---

# PART 3 — OUT OF SCOPE (explicit)
- The **Hold / Bad-address list buckets** (`customerService.ts` + a Solr open-hold flag) —
  deferred; detail page only.
- **Placing / releasing / reassigning holds** (mutations) — deferred with all other actions.
- Status history timeline (`WorkEffortStatus`) — not needed for v1.

---

# PART 4 — EXECUTION ORDER & VERIFICATION
1. Port `OrderHeaderWorkEffort` (1.1) → `xmllint` → **restart Moqui** → confirm table exists.
2. Load seed + demo data (1.3/1.4) → confirm via `admin/enums?enumTypeId=ORDER_HOLD_PURPOSE`
   and a WorkEffort read.
3. Add masters (1.2) → `xmllint` → **restart Moqui**.
4. Verify `GET oms/orders?orderId=M103777&dependentLevels=1` returns
   `workEfforts[].workEffort` with the nested `partyAssignments[].person`.
5. Seed-store ids (2.1) → order-detail getters (2.2) → bind the banner (2.3).
6. Verify in the preview: M103777 shows a "Bad address" open hold with assignee; an order with
   no holds shows no banner. Run `vitest` + `build`.

# PART 5 — FILES TOUCHED
- `ofbiz-oms-udm/entity/DatamodelWorkeffortEntitymodel.xml` — new `OrderHeaderWorkEffort`
- `oms/entity/OrderExtendedEntities.xml` — masters (1.2)
- `oms/data/OrderHoldTypeData.xml` (new), `oms/data/OrderHoldDemoData.xml` (new), `oms/component.xml`
- `apps/order-manager/src/store/seed.ts`, [Seed data](SeedData.md)
- `apps/order-manager/src/store/orderDetail.ts`
- `apps/order-manager/src/views/OrderDetail.vue` (script + the one banner block; no CSS)

---

# Implementation notes & compromises (2026-05-31)

Implemented and verified end-to-end (Holds tab on M103777 shows the real hold from local
Moqui). Notes/compromises:

1. **`WorkEffortPartyAssignment → PartyRole` FK relaxed to `one-nofk` (RESOLVED).** Initially the
   demo failed because `WorkEffortPartyAssignment` had a hard FK to `PartyRole(partyId, roleTypeId)`
   and `HOTWAX_USER` had no `TASK_ASSIGNEE` role. Per decision, that relationship was changed to
   **`one-nofk`** in `ofbiz-oms-udm/.../DatamodelWorkeffortEntitymodel.xml` (link kept for
   navigation, no DB FK), and the existing MySQL constraint was dropped on the live `notnaked` DB:
   `ALTER TABLE work_effort_party_assignment DROP FOREIGN KEY work_effort_party_assignment_ibfk_2;`.
   Verified: a `WorkEffortPartyAssignment` for a party with **no** matching `PartyRole` now saves.
   The demo's `PartyRole(HOTWAX_USER, TASK_ASSIGNEE)` row is **kept as a preset** (nice-to-have),
   but is no longer required. Moqui won't recreate the FK (def is now `one-nofk`); no restart needed.

2. **Data load required stopping Moqui (embedded DB).** The datasource is embedded (derby), so
   an external load can't run while the server holds the DB. Sequence used: stop server →
   `java -jar moqui.war load location=component://oms/data/OrderHoldTypeData.xml` (then the demo
   file) → restart. The new OrderHeaderWorkEffort table was auto-created during load. The files
   live in `oms/data/` and will also load on a normal `gradlew load`.

3. **Entity ported into the udm (a shared dependency repo).** Per the decision, `OrderHeaderWorkEffort`
   was added to `ofbiz-oms-udm/entity/DatamodelWorkeffortEntitymodel.xml` — i.e. this touches the
   `ofbiz-oms-udm` repo, not just `oms`. Flagging since it's a dependency.

4. **Holds rendered in the existing "Holds" segment tab, not the per-ship-group banner.** Holds
   are order-level (`OrderHeaderWorkEffort` → order), so the per-ship-group banner would have
   duplicated them (M103061 has 8 ship groups). The static fake "Order on hold" banner was
   removed from the ship-group card and real holds now render in the (previously empty) Holds
   tab. This is the pre-approved template-graph change. CSS untouched.

5. **Dev-server staleness during verification (environment, not product).** The Vite dev server
   did not hot-reload the `seed.ts` change into the already-instantiated Pinia store, so the new
   `ORDER_HOLD_PURPOSE`/`ORDER_HOLD_STATUS` seed types didn't load until I restarted the
   order-manager dev server (port 8106) and used a clean session. **On a normal fresh login it
   works automatically** (verified: cleared localStorage → autologin → labels resolved to
   "Bad address"/"Open" with no manual step). The order-manager dev server was restarted and is
   running fresh; other apps' dev servers and Moqui are untouched/healthy.

6. **Every nested node carries `_entity` + `lastUpdatedStamp`** (standard Moqui master output);
   the assoc row does not repeat the parent `orderId` — as the spec predicted.

Nothing committed — all changes are in the working trees of `oms`, `ofbiz-oms-udm`, and
`apps/order-manager` for review.
