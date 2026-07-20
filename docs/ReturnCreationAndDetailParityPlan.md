# Return Creation and Return Detail Plan

Status: implementation plan, 2026-07-20. Owner: Aditya Patel.

This plan has two milestones:

1. **P1 demo:** a store user finds a completed Shopify order in Find Order,
   opens Order Detail, creates a simple return, and confirms that the return is
   posted to Shopify.
2. **Full lifecycle detail:** evolve `/returns/:returnId` into one Return Detail
   workspace for every customer-return stage, preserving the useful business
   capabilities of the legacy HotWax OMS OFBiz View Return page.

The P1 demo is the immediate priority. Full legacy parity is a later sequence
of independently releasable slices.

## Non-negotiable constraints

- Do not add or propose new backend endpoints for this work.
- Compose APIs already deployed by OMS and Shopify integrations.
- Do not use the browser to reproduce OFBiz's server-side N+1 entity-query
  pattern.
- If an existing mutation is not deployed or does not work on the demo
  instance, treat that as a P1 environment/deployment blocker. Do not replace
  it with a mock or a new endpoint.
- Find Order and workflow-list visual alignment are outside this scope.
- Exchange authoring, appeasements, return-label purchasing, and supplier
  returns are outside P1.

## Evidence and current state

### Current Order Manager code

- `src/views/OrderDetail.vue` is the entry point for Return.
- `src/views/CreateReturn.vue` is a draft order-specific create page.
- `src/services/returns.ts` already contains adapters for order returnability,
  return reasons, customer-return creation, approval, Shopify push, return
  lookup, and sync polling.
- `src/views/ReturnDetail.vue` is currently a lightweight read-only page.
- `src/utils/OrderActionValidator.ts` does not yet use remaining returnable
  quantity when deciding whether Return is available.

### Merged OMS API contract

The backend source contract was verified against
[hotwax/oms#604](https://github.com/hotwax/oms/pull/604) and
[hotwax/oms#638](https://github.com/hotwax/oms/pull/638):

- PR #604 merged `feat/pwa-returns` into `JUNE-15` on 2026-06-18.
- PR #638 merged `JUNE-15` into `main` on 2026-06-22.
- The complete return route block remains present in the current OMS `main`
  branch.
- PR #604 also added `sku`, `alreadyReturnedQuantity`, and
  `returnableQuantity` to each order-detail item. Cancelled returns are excluded
  from the already-returned sum, and the backend clamps remaining quantity at
  zero.

The merged endpoints are:

| Existing endpoint | Use |
| --- | --- |
| `GET /rest/s1/oms/returnReasons` | Customer-facing Shopify-mapped reasons |
| `GET /rest/s1/oms/returns` | Paginated and filtered return list |
| `POST /rest/s1/oms/returns/customerReturn` | Create a standard customer return |
| `GET /rest/s1/oms/returns/{returnId}` | Full return detail and Shopify sync state |
| `POST /rest/s1/oms/returns/{returnId}/approve` | Approve and trigger the normal Shopify return push |
| `POST /rest/s1/oms/returns/{returnId}/reject` | Reject a requested return |
| `POST /rest/s1/oms/returns/{returnId}/cancel` | Cancel an allowed return and propagate when already pushed |
| `POST /rest/s1/oms/returns/{returnId}/complete` | Complete the OMS return and trigger Shopify completion/refund processing |
| `POST /rest/s1/oms/returns/{returnId}/retryComplete` | Retry failed Shopify completion |
| `POST /rest/s1/oms/returns/{returnId}/pushToShopify` | Retry standard-return Shopify creation |
| `GET /rest/s1/oms/appeasementReasons` | Appeasement reasons |
| `POST /rest/s1/oms/returns/appeasementReturn` | Create an appeasement |
| `POST /rest/s1/oms/returns/customerExchange` | Create an exchange and replacement order |
| `POST /rest/s1/oms/returns/{returnId}/pushExchangeToShopify` | Retry exchange Shopify creation/processing |

No new backend endpoint is required for P1. The earlier Demo Maarg Swagger
scan did not advertise the nested service-backed routes and showed an older
order-detail schema. That is a Swagger/deployment-version signal, not evidence
that the APIs are absent from `main`. P1 still starts with a non-mutating target
runtime check to confirm that Demo Maarg has the matching OMS and Shopify bridge
artifacts deployed before consuming demo data.

## P1 demo outcome

### Demo script

1. Sign in as a store user with permission to create and approve a return.
2. Open Find Order and locate a Shopify-origin order in a completed state.
3. Open Order Detail and confirm that at least one line has
   `returnableQuantity > 0`.
4. Click **Return** to open `/orders/:orderId/return`.
5. Select one line, quantity `1`, and a valid return reason.
6. Submit once and open the newly created `/returns/:returnId` page.
7. Approve/send the return using the existing lifecycle operation.
8. Observe the integration state until Shopify reports success and a Shopify
   return identifier is available.
9. Open Shopify and confirm the return against the same source order.

P1 does not require a full legacy-parity Return Detail page. It requires a
small trustworthy success page that shows the created RMA, source order,
returned line and quantity, OMS status, Shopify sync status, Shopify return ID,
and a clear retryable error when sync fails.

### P1 demo-data prerequisites

The selected order must:

- originate from the Shopify shop connected to the demo OMS instance;
- be completed in OMS and eligible for return under the existing backend
  rules;
- contain at least one item with `returnableQuantity > 0`;
- not be a fully returned or exchange-only order; and
- have the external order/item identifiers required by the existing Shopify
  return service.

Prepare and record one primary order and one backup order before the demo.
Never rely on an order whose returnability has not been refreshed immediately
before rehearsal.

## P1 implementation workstreams

### P1.0 — Target-runtime deployment check (0.5 day)

- In the authenticated Demo Maarg application session, verify that the merged
  customer-return, detail, approve, and Shopify-push routes resolve.
- Capture non-sensitive request/response shapes and permission failures.
- Confirm whether approval starts Shopify sync automatically and when the
  manual push operation is allowed.
- Confirm that order-detail items contain backend-calculated
  `alreadyReturnedQuantity` and `returnableQuantity`.
- Stop and report a target-runtime deployment blocker if a merged operation or
  field is unavailable; do not create a replacement endpoint.

### P1.1 — Entry, permission, and eligibility (0.5 day)

- Change the Order Detail Return action to
  `/orders/:orderId/return`.
- Require `ORDER_RETURN_PERMISSION` for both the action and route.
- Load the order through the existing order-detail read and show Return only
  when its backend-calculated values say at least one line has
  `returnableQuantity > 0`.
- Keep the backend as the final authority if returnability changes between
  page load and submit.

### P1.2 — Returnable order and simple form (1–1.5 days)

- Replace the draft page's incompatible `order.items` assumption with the
  existing order-for-return mapper over `shipGroups[].items`.
- Exclude zero-quantity lines and display already-returned and remaining
  quantities.
- Support the P1 case: one or more standard merchandise lines, quantity, and
  one valid reason per selected line.
- Enforce `1 <= returnQuantity <= returnableQuantity`.
- Add loading, empty, validation, and recoverable API-error states.
- Omit appeasement and exchange controls from P1.

### P1.3 — Creation and navigation (0.5–1 day)

- Submit the existing `customerReturn` operation through
  `returns.createReturn()`.
- Lock the form while submitting so one click creates at most one return.
- Surface backend validation text without losing the user's selections.
- On success, invalidate cached order returnability and navigate to the new
  Return Detail route.

### P1.4 — Minimal detail and Shopify confirmation (1.5–2 days)

- Use the merged `GET /oms/returns/{returnId}` detail endpoint for first paint.
- Show RMA, customer, source order, returned line/quantity, reason, OMS status,
  and Shopify sync state.
- Wire the existing approve action and the existing manual Shopify-push action
  only in their allowed states.
- After approval, use the existing grace-window polling behavior. Invoke the
  existing manual push only when the fresh state remains unsynced and the
  operation is valid.
- Treat `PUSH_PENDING`, success, retryable failure, and terminal failure as
  distinct states. Never display success until a fresh read reports it.
- Expose the Shopify return ID on success so the operator can verify the record
  in Shopify.

### P1.5 — Tests, rehearsal, and evidence (1–2 days)

- Add service and component coverage for route/permission checks, item mapping,
  quantity/reason validation, duplicate-submit prevention, creation errors,
  approval, polling, and manual retry.
- Run focused tests and the application build separately.
- Rehearse the full flow against the real Demo Maarg backend with the prepared
  order. Mock tests are useful but are not functional proof.
- Record the OMS order ID, RMA, Shopify order ID, Shopify return ID, final sync
  state, and screenshots for the demo evidence packet.

### P1 estimate and go/no-go

P1 is **5–7 development days** with **no new backend endpoint work**, assuming
the target runtime has the merged OMS/bridge API surface deployed. The first
half-day is a hard go/no-go deployment check. An absent or broken merged
operation blocks the real Shopify demo and must be resolved as an environment
or deployment issue outside this frontend scope.

## P1 acceptance criteria

- A store user can find a completed order from Find Order and open its detail.
- Return is available only with mutation permission and positive remaining
  returnable quantity.
- Clicking Return opens the order-specific Create Return page.
- Previously returned quantities cannot be selected again.
- Every selected line has a valid quantity and return reason.
- Duplicate clicks cannot create duplicate returns.
- A successful create opens the exact new RMA.
- The user can complete the existing approval/send path and see honest Shopify
  sync progress.
- Success is backed by a fresh OMS read with a Shopify return ID and direct
  confirmation on the Shopify order.
- API and integration failures are visible and retryable when the existing
  contract allows retry.
- The demo uses the real backend and Shopify shop; no mock response is used as
  proof.

## Full-lifecycle Return Detail direction

After P1, `/returns/:returnId` becomes one responsive workspace whose section
order remains stable across statuses. Stage changes affect emphasis and
actions, not the user's mental model.

### Information architecture

1. **Identity and actions** — RMA, type, status, dates, channel, customer,
   linked order or blind-return state, destination, sync state, and one primary
   stage action.
2. **Lifecycle and integration** — chronological status history and Shopify
   create/close state shown independently from the OMS lifecycle.
3. **Returned items** — order-grouped or blind-return lines, product identity,
   reason/type/status, requested/received/rejected quantities, price, and line
   adjustments.
4. **Money** — backend-provided subtotal, tax, discounts, shipping, duty,
   manual adjustments, total, refund, payment, invoice, and exchange-credit
   values. The frontend must not reconstruct accounting totals from partial
   rows.
5. **Shipment and receiving** — ship-from/ship-to context, shipment, carrier,
   tracking, dates, receipts, discrepancies, and put-away data when an existing
   API supplies them.
6. **References** — source/replacement orders, invoices, payments, shipments,
   and identifiers such as Shopify return/refund IDs.
7. **Activity** — status history, notes, and communications when existing APIs
   expose them with the required permissions.

### Lifecycle treatment

| Stage | Emphasis | Existing-operation candidates to verify |
| --- | --- | --- |
| `RETURN_REQUESTED` | Review customer, order, lines, reasons, and totals | Approve, reject, cancel |
| `RETURN_APPROVED` | Shopify push and inbound instructions | Retry existing push, cancel, receive |
| `RETURN_ACCEPTED` | Inbound shipment and receiving readiness | Receive or quick receive |
| `RETURN_RECEIVED` | Receipt discrepancies and refund readiness | Refund, complete |
| `RETURN_MAN_REFUND` | Manual-refund exception and payment context | Existing manual-refund workflow |
| `RETURN_COMPLETED` | Immutable audit and external references | Existing Shopify-close retry only |
| `RETURN_REJECTED` | Terminal reason and audit trail | Read-only |
| `RETURN_CANCELLED` | Cancellation and integration consequence | Read-only unless an existing retry is valid |

Phase 0 must confirm whether `RETURN_APPROVED` and `RETURN_ACCEPTED` are
separate stages, deployment aliases, or a migration artifact. The UI must not
merge them without evidence.

## Existing-API composition strategy

There is no proposed backend endpoint. Use the merged return-detail endpoint
plus only the smallest set of existing supporting reads needed by the current
section.

- Use `GET /oms/returns/{returnId}` as the canonical Return Detail adapter.
- Use the existing order read for source-order and product context that is not
  returned with the RMA.
- Resolve party/facility display information with existing party/facility or
  Solr reads already available to the app.
- Load optional panels independently so an unavailable notes or communication
  read does not blank the core detail page.
- Paginate naturally large existing resources.
- Cache stable lookups such as reasons, types, status descriptions, party
  names, and facility names.
- Refetch the return after every mutation; never predict a successful server
  transition in the client.

For each legacy capability, the contract audit must classify it as:

1. directly supplied by an existing API;
2. safely composable from existing APIs;
3. present but missing data needed for a truthful UI; or
4. unavailable and therefore deferred or explicitly retired.

The fourth classification is not a request to create an endpoint.

## Post-P1 delivery sequence

### RD0 — Contract and fixture inventory (2–3 days)

- Capture real read payloads for requested, approved/accepted, received,
  manual-refund, completed, rejected, cancelled, blind, partial-receipt,
  exchange, and failed-sync returns.
- Build a capability matrix against the legacy OFBiz View Return templates.
- Record the existing API or composition for each capability and explicitly
  defer unsupported capabilities.
- Confirm permission IDs, transition guards, idempotency, and error behavior
  for every existing mutation considered for the page.

### RD1 — Detail foundation (2–3 days)

- Consolidate Return Detail on `services/returns.getReturn()` and remove the
  duplicate lightweight customer-return adapter.
- Add typed mappers for sparse real payloads, named customer/facility context,
  linked order or blind return, lifecycle, and sync.
- Build responsive loading, error, not-found, identity, action, and timeline
  states.

### RD2 — Items and authoritative money (3–4 days)

- Add grouped return items and blind-return rendering.
- Show requested/received/rejected quantities, reason/type/status, prices, and
  available adjustments.
- Render only backend-supplied financial values and preserve currency
  boundaries.

### RD3 — Existing lifecycle and Shopify operations (3–4 days)

- Wire only live-verified approve, reject, cancel, receive, refund, complete,
  and retry operations.
- Apply permission and status guards, confirmations, in-flight locks, errors,
  and post-action refetches.
- Keep OMS lifecycle and Shopify integration state visually separate.

### RD4 — Shipments, receipts, and references (3–4 days)

- Compose existing shipment and receipt reads into tracking and discrepancy
  sections.
- Add existing order, invoice, payment, shipment, and replacement references.
- Add print/download actions only when an existing document operation is live
  verified.

### RD5 — Notes, communications, and identifiers (2–3 days)

- Add each panel only where an existing read provides the required data.
- Add create/delete/compose actions only where an existing mutation and
  permission contract are verified.
- Defer unsupported legacy controls instead of inventing browser-side entity
  mutations.

### RD6 — Cross-stage release hardening (2–3 days)

- Cover sparse payloads, each status and permission combination, action
  failures, blind returns, partial receipts, financial edge cases, and sync
  recovery.
- Verify the real browser flow, responsive layout, keyboard/focus behavior,
  localization, deep links, refresh/back navigation, and session expiry.
- Close every legacy capability row as supported, composed, deferred, or
  retired.

The post-P1 frontend effort is approximately **15–21 development days** for
capabilities supported by the APIs already deployed. Unsupported legacy
capabilities are not included in that estimate and remain deferred rather than
creating backend work.

## Full-detail acceptance criteria

- One page renders every supported customer-return stage without stage-specific
  page forks.
- Customer, linked order or blind return, destination, item quantities,
  reasons, statuses, and backend-authoritative money are clear.
- History shows timestamp and actor when existing reads provide them.
- Only permitted and live-verified actions appear; stale/repeated operations
  fail safely and refetch current state.
- Shopify failures show the backend state and retry only through an existing,
  valid operation.
- Shipment, receipt, references, replacements, notes, communications,
  identifiers, and documents match their capability-matrix disposition.
- No feature claims parity merely because a placeholder panel exists.

## Release gates

1. Existing create, approve, and Shopify-push operations pass the Demo Maarg
   smoke check.
2. A completed Shopify-origin order with positive returnable quantity is
   reserved for rehearsal, with a backup order.
3. Focused tests and the production build pass or their independent blockers
   are documented.
4. The real P1 flow creates one return and produces one Shopify return ID.
5. Re-running or refreshing the flow does not duplicate the OMS or Shopify
   return.
6. Full-detail work does not start a capability slice until RD0 maps it to an
   existing API or explicitly defers it.
