# Returns Migration Execution

Status: scope audit + roadmap, 2026-07-20. Owner: Aditya Patel.

> The current combined implementation plan for the production-safe Create
> Return flow and full OFBiz View Return parity is
> [ReturnCreationAndDetailParityPlan.md](ReturnCreationAndDetailParityPlan.md).
> It supersedes the WS2/WS4 sizing in this earlier migration audit; the 4–5 day
> WS4 estimate covered lifecycle and Shopify sync only, not full detail parity.

This earlier audit originally tracked the stubbed Order Detail Return action
and the effort to merge the dedicated returns PWA into Order Manager. Use the
combined plan linked above for the current entry-flow and detail-parity scope.

## Source and target

- **Source:** `accxui/apps/returns` — standalone repo `hotwax/returns.git`,
  branch `feat/rma-returns-pwa` ("RMA Returns PWA"). Vue 3 + Ionic + Pinia +
  `@common`, service-adapter pattern (`services/ReturnsService.ts` →
  `adapters/omsAdapter.ts` with pure tested mappers), Maarg `oms/returns` REST.
  Pages: ReturnsList, CreateReturn (return + exchange + appeasement),
  ReturnDetail (lifecycle actions + Shopify sync), ExchangeDetail.
- **Target:** this app. Direct service modules (no adapters), Pinia stores per
  domain, `@common` Bearer auth, permissions in `src/authorization/permissions.ts`.
- **Design target:** HC Ionic design system, file `bVPRRw282CqGKMdbz7dciH`,
  section **Returns** node `54550:264780` (three 1440px order-manager frames).

## Current state (audited 2026-07-20)

### Integrated on main (June 2026, mainly PR #224 / issue #218)

| Piece | Where |
| --- | --- |
| Read-only RMA viewer | `src/views/ReturnDetail.vue`, route `/returns/:returnId` (`src/router/index.ts`) |
| Customer "Returns" tab → ReturnDetail (the only live entry point) | `src/views/CustomerDetail.vue`, `src/store/customer.ts` (`loadCustomerReturns`) |
| Returns GETs (`oms/returns?fromPartyId=`, `?returnId=`) | `src/services/customer.ts` (`getCustomerReturns`, `getCustomerReturn`, `normalizeCustomerReturn`) |
| Return enums (returnReasons/returnTypes/returnItemTypes) + `describe()` | `src/store/seed.ts` |
| Per-item returnedQty/returnableQty display on OrderDetail | `src/store/orderDetail.ts` (`returnedQtyByItemSeqId`), `OrderDetail.vue` |
| RETURN footer-button eligibility (≥1 completed item; tested) | `src/utils/OrderActionValidator.ts`, `tests/utils/OrderActionValidator.spec.ts` |
| Solr return collections + normalizers — defined, **never called** | `src/services/OrderService.ts` (`returnLookup`, `returnItemLookup`, `normalizeReturnDoc`) |

The original audit found a stubbed Return footer action. The current checkout
now redirects that action to Find Returns; the combined plan records the
remaining change to the order-specific Create Return route.

### Prepared-but-dead artifacts (intended direction, never wired)

- `ORDER_RETURN_PERMISSION` in `src/authorization/permissions.ts` — unreferenced.
- `"Find returns"` locale key (`en-US.json` / `es-ES.json`) — unused; `Menu.vue`
  has no Returns entry.
- `src/store/order.ts` `returnList` / `getReturn` / `loadReturn` — never populated.
- `src/types/order.ts` `ReturnItem`, `ReturnStatusChange` — never imported.

### Built but stranded on branches (July 2026)

Return/exchange lineage in the OrderDetail timeline + exchange↔source links on
Source/Payment cards + item location chips + adjustment labels. Lives on
`feat/order-detail-timeline-and-labels` and the stacked
`codex/order-detail-timeline-foundation` → `codex/order-detail-payment-summary`
→ `codex/order-row-domain-enrichment` chain; the commits are duplicated across
the two lines (codex chain is the reviewed/canonical one). Last activity
2026-07-13..16. Local `main` may be behind origin — fetch before consolidating.

### Not ported from the returns app

Everything write-side: returns list/search page, create return (incl.
appeasements), create exchange, lifecycle actions
(approve/reject/cancel/complete/retryComplete), Shopify sync orchestration
(push, poll, grace-window fallback, completion/close, exchange 2-step push),
exchange detail. Zero of the ~11 write endpoints are called. "Exchange" appears
once in `src/` — in a comment.

## Figma alignment (section `54550:264780`)

| Frame | Node | Shows |
| --- | --- | --- |
| Returns / Find | `54466:236609` | Menu Find group **Orders, Returns, Shipments, Customers**; search card = searchbar + **Loyalty / Date after / Date before** selects; stat tiles **"Open returns"** (count) and **"Pending refunds"** ($); **select-all + per-row checkboxes**; rows = RMA number / Return Id / Created date / status badge |
| Returns / Create | `54464:222305` | Return items grouped by **"Shipped from location"** with checkboxes; "Additional details" = Return reason + Notes; **"Exchanged items" + ADD PRODUCTS** (arbitrary products, price/qty chips); **Return shipping options** radio: create a return label in HotWax / manually enter tracking details / no shipping required; **Summary card**: items weight, return/exchange item totals, subtotal, Return shipping fee [ADD], Restocking fee [ADD], CREATE RETURN |
| Returns / Label | `54466:227912` | Step 2 of create: **Return-to facility** (+ CHANGE), items with weights, **package selection** (name/dimensions), **carrier rate shopping + PURCHASE LABEL**, summary = customer ship-from address, "Send return label to customer" + SEND RETURN LABEL |

Deltas vs the returns app worth noting:

- Find filters are **loyalty + date range**, not the returns app's status
  select (rows still show status badges). Stat tiles and bulk selection are new.
- Create is **one combined page** — no Return-vs-Exchange segment. Exchange
  items are added as arbitrary products, not mirrored from returned lines, and
  the design omits the returns app's SHIPPED/IMMEDIATE outbound fulfillment +
  address step.
- The **label flow is net-new** — the returns app has no shipping-label
  functionality at all.
- The design shows **no appeasement UI, no lifecycle/sync UI, and no
  ExchangeDetail page** (see decisions below).
- Menu also shows **Shipments** — pre-existing documented gap
  (`docs/figma-order-manager-alignment.md`), out of returns scope.

## Decisions

Decided 2026-07-20 (Aditya):

1. **Appeasements: port anyway.** The create flow gets the returns app's
   appeasement card even though the Figma create frame omits it. Flag to design
   for a proper pass.
2. **Lifecycle + Shopify sync: in scope, on ReturnDetail.** No Figma coverage —
   request a design pass; build with existing order-manager idioms meanwhile.
   Without approve, returns created in-app sit at RETURN_REQUESTED forever.
3. **Return-label flow: own workstream after create v1.** Create ships first
   with "manually enter tracking" + "no shipping required"; label purchase is
   gated on backend rate/label API discovery.

Architecture decisions:

1. **No adapter pattern.** Direct `src/services/returns.ts`; keep the returns
   app's pure tested mappers (`mapReturnDetail`, `mapOrderToReturnable`,
   `mapReplacementOrder`, `buildAppeasementCreateBody`,
   `buildExchangeCreateBody`) as exported functions. Do not port `stubAdapter`.
2. **Create-return is a routed page** `/orders/:orderId/return`, pushed from
   `startReturn()`; the Find page's create entry prompts for an order id and
   navigates to the same route.
3. **List v1 uses REST** `GET oms/returns` + the uniform filter layout /
   route-state composable pattern. REST is the primary source of truth for returns.
4. **Standard Bearer auth via `@common` `api()`.** Do not port
   `util/maargAuth.ts` / `VITE_RETURNS_API_KEY` — order-manager already calls
   `oms/returns` with Bearer in production.
5. **Wire `ORDER_RETURN_PERMISSION` for mutations**; viewing stays permissive
   (`ORDER_VIEW OR CUSTOMER_VIEW`, as shipped in PR #224). Verify the permission
   ids exist in Moqui seed data.
6. **Upgrade `ReturnDetail.vue` in place** — switch to the rich
   `GET oms/returns/{returnId}` envelope; extract
   `components/returns/ReturnLifecycleActions.vue` and
   `components/returns/ReturnSyncCards.vue`; render exchange returns inline
   (exchanged-items section). **No standalone ExchangeDetail page** — exchange
   visibility on orders comes from the timeline lineage work.
7. **Shopify-sync orchestration → new Pinia `src/store/returnDetail.ts`**
   (entries keyed by returnId), porting the grace-window approve/poll logic
   from `apps/returns/src/store/returnsStore.ts` with its store tests first.
8. **Port = rewrite in order-manager idiom** (AGENTS.md: no ` · ` separators,
   no arbitrary CSS/grids). Do not port the Tabs/Settings shell, userStore,
   hardcoded label maps (use `seed.describe()`), or the Cypress harness.

## Workstreams

One isolated worktree per workstream (`CLAUDE.local.md`: this checkout is
shared — never mutate its HEAD/index/tree from automation).

| WS | Scope | Size | Depends on |
| --- | --- | --- | --- |
| **WS0** Foundation | `services/returns.ts` + `types/returns.ts` + `utils/returnSyncState.ts` + seed `appeasementReasons` + locales + ported mapper tests. Smoke-check on dev Maarg: Bearer on lifecycle POSTs; approve/reject/cancel/complete endpoint parity; fee fields on create; loyalty + pending-refunds data availability; rate/label API existence. Move `apps/returns/docs/backend-request-*.md` here | M (2–3d) | — |
| **WS6** Land stranded branches | Consolidate the duplicated timeline/lineage commits (codex chain canonical), rebase on fresh origin/main, land | M (2–3d) | do early — heavy `OrderDetail.vue` overlap with WS2 |
| **WS1** Find Returns (Figma `54466:236609`) | `views/Returns.vue` + `store/returns.ts` + `useReturnSearchRouteState` + `/returns` route + Menu "Returns" entry. Searchbar + date-range + loyalty filters, stat tiles (pending WS0 data check), selectable rows with status badges (selection UI now; bulk actions deferred until semantics confirmed) | M (3d) | WS0; filter-standardization landed |
| **WS4** Lifecycle + Shopify sync (no Figma — needs design pass) | `store/returnDetail.ts` + ReturnDetail upgrade (rich envelope, approve/reject/cancel/complete, sync/completion cards, retry paths, exchange-return rendering) + extracted components | L (4–5d) | WS0; Shopify-linked dev instance |
| **WS2** Create return v1 (Figma `54464:222305`) | `views/CreateReturn.vue`: shipped-from-location groups, reason + notes, appeasement card (ported; design gap flagged), shipping options limited to manual-tracking + no-shipping, summary card with fees (if backend supports), CREATE RETURN → `/returns/:returnId`. Route + replace `startReturn()` stub + permission gate | L (4d) | WS0; after WS6 |
| **WS3** Exchange items in create | "Exchanged items" + ADD PRODUCTS (reuse product search/cache patterns), exchange summary lines, `customerExchange` submission; confirm replacement-order fulfillment defaults (design omits SHIPPED/IMMEDIATE) | M (2–3d) | WS2 |
| **WS-L** Return label flow (Figma `54466:227912`) | Step-2 page: return-to facility + CHANGE, package selection, rate shopping, PURCHASE LABEL, send-label-to-customer | L (3–5d, high uncertainty) | WS2; backend confirmed in WS0 |
| **WS7** Cleanup | Delete dead store/type members; re-point `getCustomerReturn` callers to `services/returns.getReturn`; update `docs/figma-order-manager-alignment.md` (Find group); deprecate `apps/returns` after parity sign-off | S (1d) | all |

Estimated total: **~20–28 dev-days**.

## Execution log

### WS0 — Foundation (2026-07-20): code layer landed, verified

Delivered (all additive new files in the order-manager checkout):

- `src/types/returns.ts` — the return/exchange/appeasement/sync type surface, ported verbatim.
- `src/utils/returnSyncState.ts` — the Shopify sync/close/exchange state collapsers + color/label
  helpers (`resolveShopifySyncState`, `resolveShopifyCloseState`, `resolveExchangeSyncState`,
  `resolveOrigin`), ported verbatim.
- `src/services/returns.ts` — the returns service as direct exported functions (no adapter/interface,
  no `stubAdapter`). Pure mappers/body-builders (`mapReturnDetail`, `mapOrderToReturnable`,
  `mapReplacementOrder`, `mapPostalAddress`, `mapReturnType`, `buildAppeasementCreateBody`,
  `buildExchangeCreateBody`) + API functions (`listReturns`, `getReturn`, `createReturn`,
  `createExchange`, `retryExchangePush`, `approve/reject/cancel/complete/retryComplete`,
  `getOrderForReturn`, `getReplacementOrder`, `listAppeasementReasons`, `pushToShopify`,
  `getSyncStatus`). Auth is the standard `@common` `api()` Bearer path + `commonUtil.hasError` —
  the source app's `omsApi()`/`maargAuth` api_key wrapper was **not** ported (decision d). The
  seed-covered list methods (`listFacilities/listShipmentMethods/listCountries/listStates/listReturnReasons`)
  were **not** ported.
- `tests/services/returns.spec.ts` (35 tests) + `tests/utils/returnSyncState.spec.ts` (27 tests) —
  ported from the returns app's `omsAdapter.spec.ts` / `syncState.spec.ts`, repointed to the new
  modules, with a `vi.mock('@common', …)` stub so the pure-function tests don't drag in the
  auth-heavy `@common` barrel (Login.vue → useAuth → cookieHelper).
- `docs/returns-backend-request-approval-flow.md`, `docs/returns-backend-request-list-bug-and-identifiers.md`
  — copied from the returns app as the backend contract of record.

Verification: `npx vitest run` → the two new specs pass (62/62). `npx tsc --noEmit` → no type errors
in any of the three new source files. (The repo currently has ~19 pre-existing failing tests from
unrelated in-progress WIP — `OrderSearchFilterControls`, modal-compliance, `Settings`, customer, etc.
— none returns-related; the additive returns files do not touch them.)

**Not committed** — these sit as untracked/new files alongside the checkout's existing WIP, for review.

Deferred out of WS0 (with reasons), to their consuming workstreams:

- **Seed `appeasementReasons` dataset → WS2.** The seed store's `responseList` extracts
  `array | entityValueList | docs | list | items`, but the source app reads `oms/appeasementReasons`
  as `{ reasons: [...] }`. Which shape order-manager's backend returns is unverified here (a WS0
  backend smoke-check item), so wiring a seed dataset that could silently load empty was avoided.
  `services/returns.listAppeasementReasons` (correct `.reasons` extraction) is the single source for
  now; folding into `store/seed.ts` is a WS2 decision once the response shape is confirmed live.
- **Sync/completion label locale keys → WS4.** `returnSyncState`'s `syncLabel`/`completionLabel`
  fall back to the English key when a locale entry is missing, so WS0 is functional without them.
  The keys ("Synced", "Not synced", "Closed in Shopify", "Completing", "Not in Shopify", "Shopify
  sync"; "Pending" already exists) render only in WS4's UI and need reviewed es-ES translations, so
  they land with that UI rather than as English-only additions to the bilingual locale files now.
- **Backend smoke-check (Bearer on lifecycle POSTs; endpoint parity; fee fields; loyalty +
  pending-refunds data; rate/label APIs; `ORDER_RETURN_PERMISSION` seed ids)** — requires a live
  Maarg dev instance; not runnable in this session. Still open.

## Verification strategy

- Port the returns app's vitest specs (16 portable — especially
  `returnsStoreApprove.spec.ts`, which encodes the grace-window race rules:
  never kick `pushToShopify` for exchanges, never auto-kick on `failed`,
  appeasement auto-complete after synced approve).
- Live checks against a real Maarg dev instance via `src/dev/autoLogin.ts` —
  per AGENTS.md, functional validation uses real backend data or states the
  blocker. WS4 needs a Shopify-linked instance.
- UI work follows `accxui-ionic-ui-change`; the three Figma frames are the
  visual acceptance reference for WS1 / WS2 / WS-L.

## Open items

- Design passes needed: appeasement card in create; lifecycle/sync UI on
  ReturnDetail; bulk-action semantics on Find (and whether Find also needs a
  status filter — rows show status badges but no status select is designed).
- WS0 backend checks: lifecycle endpoints on target instances; restocking /
  return-shipping fee fields on `oms/returns` create; loyalty field + pending-
  refunds aggregation source for the Find stat tiles; shipping-gateway
  rate/label APIs for returns; `ORDER_RETURN_PERMISSION` ids in seed data;
  Solr `OrderManagerReturnLookup` / `ReturnItemLookup` population.
- Decommission timing for `apps/returns` / the `hotwax/returns` repo.

## References

- PR #224 (issue #218) — customer returns tab + ReturnDetail + RMA auto-fetch.
- Branches: `feat/order-detail-timeline-and-labels`,
  `codex/order-detail-timeline-foundation`,
  `codex/order-detail-payment-summary`, `codex/order-row-domain-enrichment`.
- Returns-app backend contract docs:
  `apps/returns/docs/backend-request-approval-flow.md`,
  `apps/returns/docs/backend-request-list-bug-and-identifiers.md`.
- Related trackers: `docs/figma-order-manager-alignment.md` (Remaining Gaps
  item 3), `docs/API_REQUIREMENTS.md` (Returns data contract),
  `docs/OrderDetailStore.md` (`returnedQtyByItemSeqId`).
