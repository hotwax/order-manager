# Blocking order holds via WorkEffort

Order Manager uses the OMS-owned blocking-hold contract. A hold is a normal task whose type is
fixed to `RESOLVE_ONHOLD_ORDER`; its purpose identifies why fulfillment is blocked.

```text
workEffortTypeId = RESOLVE_ONHOLD_ORDER
workEffortPurposeTypeId = <canonical purpose>
open status = TASK_CREATED | TASK_IN_PROGRESS | TASK_ON_HOLD
terminal status = TASK_COMPLETED | TASK_CANCELLED
```

This supersedes the earlier proposal to use `ORDER_HOLD`, `ORDER_HOLD_PURPOSE`, and dedicated
`ORD_HOLD_*` statuses. Those values belong to a separate connector lifecycle and are not the
Order Manager or Pickwave blocking model.

## Canonical purposes and scope

| Purpose | Scope |
| --- | --- |
| `INVALID_ADDRESS` | Selected ship group |
| `NEG_RES_REVIEW` | Selected ship group |
| `ORD_HOLD_MANUAL` | Selected ship groups |
| `ORD_HOLD_CUST_REQ` | Order or selected ship groups |
| `REVIEW_RISK_ORDER` | Entire order |

Every purpose is an `Enumeration` whose `enumTypeId` is `RESOLVE_ONHOLD_ORDER`. The modal fixes
the task type, loads that enum bucket, and exposes only the operator-owned `ORD_HOLD_MANUAL` and
`ORD_HOLD_CUST_REQ` purposes. Address, reservation, and fraud holds are created by their owning
backend flows; allowing the ship-group modal to create them would forge system findings and, for
fraud, violate the single order-level/null-scope invariant. The modal must never load the unrelated
`ORDER_HOLD_PURPOSE` bucket.

## Scope semantics

`OrderHeaderWorkEffort.shipGroupSeqId` determines which fulfillment unit is blocked:

- a concrete ship-group ID blocks that ship group;
- `null` blocks every ship group on the order.

Manual and customer-service creation from Order Manager selects one or more ship groups. Fraud
review is created by OMS at order approval and intentionally has a null ship-group scope. It is
one order-level task, not one task per ship group.

Poorti's Ready-to-Pick query enforces the contract while a task is open:

```sql
OHW.ORDER_ID = OIS.ORDER_ID
AND (OHW.SHIP_GROUP_SEQ_ID IS NULL OR OHW.SHIP_GROUP_SEQ_ID = OIS.SHIP_GROUP_SEQ_ID)
AND WE.WORK_EFFORT_TYPE_ID = 'RESOLVE_ONHOLD_ORDER'
AND WE.STATUS_ID NOT IN ('TASK_COMPLETED', 'TASK_CANCELLED')
```

The order may remain `ORDER_APPROVED`; the WorkEffort blocks fulfillment eligibility without
changing `OrderHeader.statusId` to `ORDER_HOLD`.

## Existing API contract

No dedicated hold API is introduced. Order Manager continues to use the existing resources:

- `POST oms/orders/tasks` to create ship-group-scoped tasks;
- `GET oms/orders/tasks/shipGroupTasks` for ship-group queues;
- `GET oms/orders/tasks` for order-level tasks such as fraud review;
- existing WorkEffort task-status actions for completion and cancellation.

Creation is idempotent for the same open `orderId + scope + type + purpose`. A hold in any open
status remains visible and blocking until completed or cancelled. Terminal order completion or
cancellation cancels its remaining open tasks.

## Queue and dashboard membership

| Queue | Purpose predicate |
| --- | --- |
| Hold | `ORD_HOLD_MANUAL`, `ORD_HOLD_CUST_REQ` (ship-group and order scope) |
| Bad Address | `INVALID_ADDRESS` |
| Swap / Reservation Review | `NEG_RES_REVIEW` |
| Fraud | `REVIEW_RISK_ORDER` |

All four queues filter on type `RESOLVE_ONHOLD_ORDER` and the three open task statuses. The Hold
queue uses the mixed-scope `oms/orders/tasks` view so an order-level customer-request hold is not
lost, while its optional ship-group aliases preserve Facility and Shipping method filters for
scoped tasks. The dashboard total includes all canonical purposes; its purpose rows must reconcile
to that total.

## Ownership

- `ofbiz-oms-udm` retains the generic WorkEffort entities, root enumeration types, task statuses,
  and unrelated QuickBox values.
- `oms` owns the canonical hold type, purposes, creation/status behavior, views, counts, terminal
  cleanup, and migration of legacy task rows.
- `poorti` detects invalid addresses and enforces the blocking contract in Ready-to-Pick, but
  delegates task creation to OMS.
- `order-manager` presents and manages the OMS contract; it does not own hold reference data.

## Explicitly separate model

QuickBox's `ORDER_HOLD` model is outside this contract. Do not convert its WorkEfforts, purpose
rows, recovery sequencing, or direct entity behavior as part of Order Manager hold work.

## Regression scenarios

1. Repeated invalid-address validation creates one open task per affected ship group.
2. A negative-reservation hold is created even if a different-purpose hold already exists.
3. Manual and customer-request purposes appear in the modal and Hold queue.
4. Fraud review creates one null-scope task and blocks every ship group.
5. Completing one hold does not unblock a scope that has another open hold.
6. Completing or cancelling the final hold re-admits an otherwise eligible scope.
7. Closing an order cancels its remaining open tasks.
8. QuickBox `ORDER_HOLD` rows remain unchanged.
