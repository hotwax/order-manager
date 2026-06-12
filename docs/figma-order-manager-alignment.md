# Order Manager Figma Alignment

This document maps the reviewed HC Ionic design system nodes to the current Ionic/Vue implementation and records the remaining gaps that should not be guessed in the frontend.

## Implementation Rules

- Use core Ionic components for the visible UI surface.
- Do not use `ion-grid`, `ion-row`, or `ion-col`.
- Keep layout CSS limited to structure and spacing; do not add font or color styling.
- Keep modal behavior aligned with AccxUI rules: close icon-only button in the header start slot, single-step save as fixed bottom-right icon-only FAB, multi-step flows with footer toolbar navigation.
- Keep behavior backed by current frontend and OMS contracts. Do not add visible actions that cannot safely persist.

## Reviewed Figma Nodes

| Figma node | Design surface | Current Ionic mapping | Status |
| --- | --- | --- | --- |
| `54760:1223` | `Order / Park - Alert` | `confirmParkOrder()` in `src/utils/index.ts` uses Ionic `alertController` with Cancel and Park order actions. | Aligned. |
| `54775:47722` | `Order / Park - Modal` | `src/components/fulfillment/FacilityModal.vue` renders the four parking buckets as an `ion-radio-group` and uses the fixed save FAB. | Aligned in PR #75. |
| `54187:184360` | `Order / Holds` order-detail frame | `src/views/OrderDetail.vue` maps the header identity item, summary cards, timeline, `ion-segment`, and Holds segment task-card rendering. | Broad structure aligned; PR #106 aligns the ship-group segment label to the Figma `Shipgroups` copy, PR #111 maps the order status to the identity row end-slot badge, and PR #112 aligns the Order identifications and Source card labels/order. Payment-card placement remains tracked below. |
| `54191:288203` | Swap queue page | `src/views/SwapOrders.vue`, `src/components/tasks/SwapTaskCard.vue`, and `src/components/swaps/SuggestedProductActionPopover.vue`. | Aligned in PRs #92, #94, #95, #96, #97, #100, #101, #104, #105, and #107; progress renders from task data when provided, headings fall back to order identifiers when order names are missing, Park passes the task id to the parking endpoint, Swap status/footer colors match the nested card, empty non-date filter selects render the Figma `Select` resting text, and empty contact rows can collapse for the unfillable-parking variant. |
| `54190:286012` | Swap suggested-product popover | `src/components/swaps/SuggestedProductActionPopover.vue` uses Ionic popover/list/header/items for Cancel item, Custom swap, and View inventory. | Aligned in PR #80. |
| `54181:113016` | `Order / Shipgroups` page, collapsed and expanded cards | `src/views/OrderDetail.vue` ship-group card: header, progress bar, hold warning row, option chips, selected option rows, timeline, collapsed summary, expanded details, actions, and smooth collapse handling. | Aligned across PRs #77, #90, and #99 plus follow-ups; padding is animated on the collapsible wrapper. |
| `54191:295583` | Hold queue page | `src/views/HoldOrders.vue` and `src/components/tasks/HoldTaskCard.vue`. | Mostly aligned; resolution comments are wired in PR #88, filter date selectors in PR #97, task heading/date fallback in PR #100, assigned-date display in the assignee row is present, the task id chip copy affordance is in PR #102, empty non-date filter selects render `Select` in PR #105, and the select-all row maps to Figma in PR #108. Assign action is blocked by backend contract. |
| `54190:216632` | Bad Address queue page | `src/views/BadAddressOrders.vue` and `src/components/tasks/BadAddressTaskCard.vue`. | Aligned in PRs #84, #97, #100, #101, #105, and #108: two Ionic address lists, radio choice, editable rows, filter date selectors, empty non-date filter select resting text, Figma select-all results row, footer actions, task heading fallback, and Park task id handoff. |
| `54642:47115` | Fraud queue page | `src/views/FraudOrders.vue` and `src/components/tasks/FraudTaskCard.vue`. | Aligned in PRs #81, #100, #102, #103, #105, and #108: three content columns, suggested-action footer item, readable order heading/date values when the API omits `orderName`, shared task id chip copy affordance, Figma-mapped payment/risk rows, empty filter selects rendering `Select`, and the select-all results row. |
| `54304:40833` | `Order / Items` order-detail page | `src/views/OrderDetail.vue` items segment and `src/components/orders/OrderItemListRow.vue`. | Aligned in PRs #72, #89, #109, and #110: reusable row with key area, quantity/facility/configuration cells, status, amount, actions, data-guarded chip variants, and Figma-mapped items toolbar add action. |

## Nested Figma Contexts Reviewed

These nested calls were used to avoid treating the large page frames as complete evidence:

| Nested node | Parent node | Evidence from Figma | Code mapping |
| --- | --- | --- | --- |
| `54760:1223` | `Order / Park - Alert` | Park alert uses the Ionic Alert component with title `Park this order?`, explanatory message, and trailing `Cancel` / `Park order` buttons. | `confirmParkOrder()` creates an Ionic `alertController` alert with matching title, message, cancel role button, and confirm-role Park order button. |
| `54775:47722`, `54786:9928`, `54786:11088`, `54786:12252`, `54786:13416`, `54780:1223` | `Order / Park - Modal` | Park modal uses Ionic Modal/Toolbar/Item/Radio/FAB components: header start close icon, title `Park order`, four radio rows for Rejected, Unfillable, Backorder, Pre-order, and a fixed bottom-right save FAB. | `FacilityModal.vue` maps this to `ion-header`, `ion-toolbar`, icon-only close button, `ion-radio-group` rows backed by the four parking facility ids, and an icon-only fixed save `ion-fab-button`. |
| `54190:189194` | `54187:184360` | Order-detail identity item uses Ionic `Item` and `Badge`: leading `ticket-outline`, `<order name>` primary text, `<order id>` secondary text, and an `Approved` badge in the item end slot. | `OrderDetail.vue` uses a leading `ticketOutline` icon, order name/id label, and PR #111 moves `order.status` into an end-slot `ion-badge` colored through `commonUtil.getStatusColor(order.statusId)`. |
| `54190:189192` | `54187:184360` | Order identifications card uses Ionic list-card rows ordered as `Order Number`, `Order ID`, and `Order Name`. | PR #112 reorders the existing `OrderDetail.vue` identifications rows to external id, order id, and order name, with labels matching the nested Figma card. |
| `54190:189204` | `54187:184360` | Source card uses Ionic list-card rows labeled `Brand` and `Channel`. | PR #112 renames the existing Source rows from product-store/sales-channel wording to `Brand` and `Channel` while keeping the same Ionic card/list structure. |
| `54190:189205` | `54187:184360` | Payment card uses an Ionic list-card row with payment method id overline, method label, status text, and amount in the end slot. | Current `OrderDetail.vue` has the same payment row structure inside the Items segment summary. Moving or duplicating it into the always-visible header cluster is deferred until the Order / Items and Order / Holds card clusters are reconciled together. |
| `54190:215460` | `54187:184360` | Order-detail segment uses Ionic Segment button components with labels `Items`, `Shipgroups`, selected `Holds`, and `Comms`. | `OrderDetail.vue` uses `ion-segment` and `ion-segment-button` for the same four segment values; PR #106 changes the ship-group tab label to `Shipgroups` to match the nested Figma component. |
| `54187:183970` | `54181:113016` | Ship-group warning item with warning icon, `Hold task: ...`, and `View details` button. | `src/views/OrderDetail.vue` renders an Ionic warning `ion-item` and switches to the Holds segment in PR #90. |
| `54184:146519` | `54181:113016` | Ship-group selected options render as Ionic `Item` components; the gift-message selected option includes a `trash-outline` end action. | `src/views/OrderDetail.vue` keeps selected options visible in collapsed and expanded states. PR #99 maps the gift-message trash action to `clearGiftMessage(shipGroup)` through the existing ship-group update path. |
| `54191:295621` | `54191:295583` | Hold task card with checkbox header, work-effort chip, contact copy row, task details, assignee/reporter list, resolution comment input, and Resolve/View actions. | `TaskCardShell.vue` plus `HoldTaskCard.vue`; resolution comment persistence is in PR #88. The inline Assign button is intentionally not implemented until assignment persistence is defined. |
| `54642:47146`, `54191:295670`, `54191:295463` | Fraud, Hold, and Bad Address queue pages | Queue selection row is an Ionic Item with a checkbox, `Select all results` label, and a trailing result count. | `SelectAllResultsItem.vue` in PR #108 maps the row to `ion-item`, `ion-checkbox`, `ion-label`, and `ion-note`, and Fraud, Hold, and Bad Address queues reuse it for their selectable task results. |
| `54359:67363`, `54359:67396` | `54304:40833` | Order / Items toolbar shows a `Select all` checkbox item and an outline medium `Add items` button. | `OrderDetail.vue` maps the select-all item to an Ionic checkbox row and PR #110 aligns the item-toolbar add action to an outline medium Ionic button with `Add items` copy. |
| `54364:69325` | `54304:40833` | Order / Items summary Payment card uses an Ionic list-card with method id overline, method label, payment status, and amount in the end slot. | `OrderDetail.vue` renders the Payment summary in the Items segment with `ion-card`, `ion-card-header`, and `ion-item` payment rows using the same overline/status/end-amount structure. |
| `54362:67925` | `54304:40833` | Order / Items totals card uses Ionic item rows for `Subtotal`, `Shipping` with secondary method text, `Tax`, `Grand total`, and `Payment received`. | `OrderDetail.vue` renders subtotal, adjustment rows with optional detail text, grand total, and payment received rows inside the Items segment totals card. |
| `54191:296466`, `54191:296977`, `54191:297968` | `54191:295621` | Hold details list shows `workEffort.name`, purpose text, due date, `NOTES`, assignee name with assigned date and an `ASSIGN` end button, reporter name, and a stacked `Resolution comment` input. | `HoldTaskCard.vue` renders the task details, due date, notes, assignee assigned date, reporter row, and resolution textarea with Ionic list/input components. The `ASSIGN` button remains omitted because `TaskAssigneeModal.vue` only returns a selected person and `orderTask.ts` has no assignment persistence action. |
| `54191:296634`, `54642:47144` | Hold and Fraud task cards | The task identifier chip is an outlined Ionic `Chip` with a leading identifier icon, `workEffort.id` label, trailing copy glyph, and pointer affordance. | `TaskCardShell.vue` renders the centered task id chip as a clickable Ionic chip in PR #102, using the existing clipboard utility and `copyOutline` icon. |
| `54642:47127`, `54642:47128` | `54642:47125` | Fraud task-card heading uses `Order name`; subtitle uses `orderHeader.orderDate`. | PR #100 adds shared `taskOrderTitle()` and `formatTaskDate()` helpers so Fraud/Hold/Bad Address/Swap cards render readable order titles and dates when task payloads contain missing names or raw numeric dates. |
| `54642:47125` | `54642:47115` | Fraud task card with contact row, Ordered items, Payment, Risk analysis columns, Resolve/Cancel/View actions, and Suggested action footer item. | `FraudTaskCard.vue` uses shell contact/details/actions and a footer `actions-end` item for suggested action. PR #100 shares order-heading fallback/date formatting across task cards. |
| `54648:50859`, `54648:50902`, `54648:51263` | `54642:47125` | Fraud Payment row uses overline payment id, primary payment method label, warning-colored Pending status, and amount in the end slot. Fraud Risk analysis rows use a medium `information-circle-outline` icon and fact rows as secondary text. | PR #103 maps Payment rows to overline/status `ion-text` structure and aligns Risk rows to the medium Ionic info icon. |
| `54190:284563` | `54190:216632` | Bad-address task card with Original address and Suggested address Ionic list columns, radio choice labels, editable address rows, and Save/Cancel/Park actions. | `BadAddressTaskCard.vue` uses an `ion-radio-group`, `ion-list`, editable `ion-item` rows, and the existing footer actions. |
| `54190:284579`, `54190:284600`, `54190:286878` | `54190:284563` | Bad-address Original/Suggested address columns use list headers with `keep original` and `use suggested` radio actions; address fields render as overline-labeled rows for address lines, city, postal code, state, and country; footer buttons are `Save and release hold`, `Cancel order`, and `Park`. | `BadAddressTaskCard.vue` maps the header radio actions through `addressOptions`, renders field rows from `addressRows(...)` with overline labels and editable Ionic input/select controls, and wires the footer actions to update shipping information, cancel order, or park with `workEffortId`. |
| `54191:288241` | `54191:288203` | Swap/unfillable task card with routing detail row, routing justification row, linear progress indicator, ordered/suggested item columns, unavailable ordered-item action affordance, success-colored `APPROVED SWAP` label, refund input, and Release/Cancel/Park actions. | `SwapTaskCard.vue` maps routing details, ordered and suggested item lists, ordered unavailable-item actions, refund input, and popover actions. `TaskCardShell.vue` renders an Ionic progress bar when backend progress data exists. PR #104 aligns the approved-swap label to Ionic success text and keeps the footer `Cancel order` button in the same primary clear style as the Figma footer. |
| `54191:288296` | `54191:288203` | Second Swap card variant shows `001 Unfillable parking`, `Not brokered`, routing details, no contact row, ordered unavailable items, suggested `available` / `cancel` badges, totals, suggested refund input, and Release/Cancel/Park actions. | `SwapTaskCard.vue` already maps the routing, unavailable item, suggested item, totals, refund, and footer action structure. PR #107 stops task cards from forcing an `Unknown` contact name so `TaskCardShell.vue` can collapse the contact row when no contact fields exist. |
| `54191:298387`, `54191:295642` | Swap and Hold contact rows | Contact details are three Ionic `Item` components for name, phone, and email, each with a small outline `Copy` button. | `TaskCardShell.vue` renders the shared contact-details list with Ionic items, person/call/mail icons, and outline copy buttons when contact fields exist; Fraud, Hold, Bad Address, and Swap reuse it. PR #107 keeps the row data-dependent instead of forcing `Unknown`. |
| `54190:286878`, `54191:288288`, `54191:295662` | Bad Address, Swap, and Hold action footers | Footer buttons are Ionic button components. Bad Address uses Save and release hold, Cancel order, Park; Swap uses Release updated order, Cancel order, Park; Hold uses Resolve task and View order. The trailing `stopwatch-outline` instance exists in these Figma footers but is `opacity-0`. | `TaskCardShell.vue` footer actions intentionally render only the visible buttons. No stopwatch icon is mapped because the Figma instance is hidden. |
| `54642:47118`, `54191:295614`, `54190:219644`, `54191:288234` | Queue filter cards | Fraud, Hold, Bad Address, and Swap all use a Figma `Card` containing `Searchbar` and a four-control `Filters` row of `Select / Resting` components. Hold labels are `Assignee`, `Order date after`, `Order date before`, `Channel`; Bad Address and Swap use `Date after` and `Date before`; empty non-date selects show the resting value `Select`. | `SearchFilterCard.vue` provides the shared Ionic card/searchbar/equal-width filter row in PR #96. `SwapOrders.vue` uses an Ionic select for the swappable filter in PR #95. `DateFilterSelect.vue` maps date filters to an item-style select trigger and Ionic date modal in PR #97, preserving arbitrary date selection while matching the Figma resting control. `FilterSelect.vue` in PR #105 wraps non-date Ionic selects so empty filter values display `Select` while retaining the blank clear option in the popover. |
| `54361:67841` | `54304:40833` | Order item row variants: checkbox, item key, quantity, status/configuration, amount/adjustment, facility chip, and attributes chip. The chip-heavy detail variant appears only when facility or attribute data exists. | `OrderItemListRow.vue` handles rollup and detail row variants. PR #89 maps the chip cells and quantity suppression; PR #109 prevents empty facility values and zero-attribute counts from forcing the chip variant. |

## Current PR Stack

These draft PRs contain the relevant Figma alignment work above the component-folder/facility-selection foundation:

| PR | Scope |
| --- | --- |
| #67 | Organize components by purpose. |
| #68 | Improve facility inventory selection. |
| #69 | Clone order and footer action validation. |
| #70 | Reuse task cards across order workflows. |
| #71 | Customer modal action alignment. |
| #72 | Order item rows aligned to Figma. |
| #73 | Swap shortage data. |
| #74 | Task assignee modal FAB slot compliance. |
| #75 | Parking modal aligned to Figma. |
| #76 | Card radius follow-up. |
| #77 | Smooth ship-group collapse transitions. |
| #78 | Swap routing detail row. |
| #79 | Task-card heading chip centering. |
| #80 | Swap action popover alignment. |
| #81 | Fraud suggested action. |
| #83 | Hold assignment display details. |
| #84 | Bad Address card lists. |
| #86 | Swap unavailable ordered-item marker. |
| #87 | Task card product image guards. |
| #89 | Order item row variants. |
| #88 | Hold resolution comment persistence. |
| #90 | Ship-group hold warning row. |
| #92 | Optional task-card progress indicator support. |
| #94 | Ordered swap item actions. |
| #95 | Swap filter select control. |
| #96 | Shared search/filter card layout. |
| #97 | Queue date filter select controls. |
| #98 | Item attributes modal action placement. |
| #99 | Ship-group selected gift-message clear action. |
| #100 | Task card order heading and date formatting. |
| #101 | Park task-card work-effort id handoff. |
| #102 | Task-card identifier chip copy affordance. |
| #103 | Fraud payment and risk row alignment. |
| #104 | Swap status label and footer color alignment. |
| #105 | Queue filter select resting-state alignment. |
| #106 | Order-detail segment label copy alignment. |
| #107 | Empty task contact row collapse. |
| #108 | Select-all results row alignment. |
| #109 | Order item chip variant guards. |
| #110 | Order items add-action alignment. |
| #111 | Order-detail identity status badge alignment. |
| #112 | Order-detail header card label alignment. |
| #91 | Figma alignment map and remaining gap documentation. |

## Visual Validation

- Previously served the #91 checkout, then based on #106, from a detached AccxUI validation worktree at `http://127.0.0.1:8120`.
- The validation server was started from `/Users/adityapatel/Documents/GitHub/accxui` with the local dev auto-login env and a valid `VITE_DEFAULT_PRODUCT_STORE_SETTINGS` override.
- Chrome authenticated against local OMS and rendered `/swap`, `/bad-address`, `/fraud`, `/hold`, and `/orders/M100818`.
- `/swap`, `/bad-address`, and `/hold` rendered the shared filter card with one Ionic searchbar and the expected date filter select triggers. These routes returned no local task records in the current data set.
- `/fraud` rendered the shared filter card plus real task cards with Ordered items, Payment, Risk analysis columns, Resolve/Cancel/View actions, Suggested action footer items, and the task id chip copy affordance.
- A follow-up local API probe found risk-test fraud tasks with missing `orderName` values and millisecond `orderDate` values. PR #100 adds shared task-card display helpers so Fraud and Hold headings fall back to order identifiers and render formatted dates.
- A follow-up status seed probe found no `TASK_PARKED` status in the local backend. PR #101 removes the Bad Address `TASK_PARKED` status post and passes `workEffortId` through the existing Park endpoint for both Bad Address and Swap task cards.
- A follow-up nested Fraud row review found Payment and Risk item details below the high-level card frame. PR #103 aligns Payment overline/status text and Risk icon presentation to those nested rows.
- A follow-up nested Swap card review found a success-colored `APPROVED SWAP` label and primary clear footer actions. PR #104 aligns the approved-swap status text and Swap footer Cancel button.
- A follow-up nested queue filter review found the non-date `Select / Resting` controls should show `Select` when empty. PR #105 adds `FilterSelect.vue`; Chrome confirmed `/fraud`, `/hold`, `/swap`, and `/bad-address` render empty non-date filters as `Label, Select` in Ionic shadow DOM while preserving empty filter values.
- A follow-up order-detail copy review found the Figma segment label is `Shipgroups`. PR #106 updates the `OrderDetail.vue` segment label and locale keys without removing the existing `Ship groups` translation key.
- A follow-up nested Swap variant review found the `001 Unfillable parking` card omits contact details when none are present. PR #107 lets the shared task-card contact row collapse instead of forcing an `Unknown` customer name.
- Follow-up nested Fraud, Hold, and Bad Address queue reviews found the select-all row should read `Select all results` with the result count in the end slot. PR #108 adds a shared Ionic `SelectAllResultsItem` used by those queues.
- A follow-up nested Order / Items review found the chip-heavy detail row should only appear for real facility or attribute data. PR #109 keeps empty facility values and zero-attribute counts on the normal quantity row variant.
- A follow-up nested Order / Items toolbar review found the add action should be an outline medium Ionic button labeled `Add items`. PR #110 aligns that toolbar action while leaving other `Add Items` actions unchanged.
- Follow-up nested Order / Items summary-card reviews found the Payment and totals cards already map to Ionic cards/lists in `OrderDetail.vue`; no code change was needed.
- A follow-up nested Order / Holds identity-item review found the order status belongs in an end-slot Ionic badge rather than as duplicate overline text above the order name. PR #111 moves `order.status` into that badge and validates the pattern with a focused source guard plus production build.
- Follow-up nested Order / Holds list-card reviews found Figma labels for the Order identifications and Source cards. PR #112 aligns those row labels/order and validates the pattern with the same focused header spec plus production build.
- PR #109 was validated with the focused order-item row spec and a production build from a detached AccxUI checkout. A Chrome retry at `http://127.0.0.1:8121/orders/M100818` redirected back to `/funnel` through the route permission guard before item rows could be inspected.
- In the earlier #91 browser pass, `/orders/M100818` rendered the order-detail route with the expected header, summary cards, item rows, footer actions, and tabs. Local backend warnings remained for missing fulfillment timeline and product/Solr lookup data.
- A ship-group collapse smoke test found PR #77's open options wrapper could clip after moving padding onto the animated state because global border-box sizing made `max-height` consume padding.
- PR #77 now sets the collapsible wrappers to content-box sizing. A validation-only cherry-pick of #77 commit `891cda8` onto the current #91 checkout confirmed `/orders/M100818` ship-group geometry in Chrome: collapsed expanded-options `height: 0`, `padding-block: 0`, summary visible; expanded options `height/max-height/scrollHeight: 88px`, `padding-block: 24px 24px`, summary collapsed, and details visible.

## Modal Compliance Scan

- Editable modal components in the focused order workflows use the AccxUI header close pattern: an icon-only close button inside `ion-buttons slot="start"`.
- Single-step editable modals use a fixed bottom-right icon-only `ion-fab-button` for save/add/confirm actions. PR #98 aligns `OrderItemAttributesModal.vue` with this rule by moving the add action out of inline content and into the fixed FAB.
- `AddItemToOrderModal.vue` keeps per-row `Add` buttons because adding a product is a repeated row action inside a search result list, not the modal's single primary confirmation action.
- View-only or result-preview modals such as inventory/history/Shopify-created previews keep close-only or completion UI because they do not collect and save a form.

## Remaining Gaps

1. Hold `ASSIGN` action:
   - Figma shows an `ASSIGN` button in the assignee column.
   - Current app has `TaskAssigneeModal.vue`, but it only selects and returns an assignee.
   - `orderTask.ts` currently exposes task status, park, cancel, and shipping-information updates, but no frontend action that persists task assignee changes.
   - `oms/service/oms.rest.xml` currently exposes only `POST /workEffortPartyAssignments` for `WorkEffortPartyAssignment` create.
   - Task reads apply a date filter to active assignments. The underlying OFBiz services include update/delete flows that can set `thruDate`, but those are not exposed through the current OMS REST resource.
   - Adding a frontend-only reassign button against the create-only resource could create duplicate active `TASK_ASSIGNEE` rows. This needs an OMS update/expire assignment endpoint or a confirmed create-only assignment rule before implementation.

2. Park task status:
   - Figma includes Park actions on Bad Address and Swap task cards.
   - The local status seed probe did not return a `TASK_PARKED` status.
   - PR #101 makes Bad Address and Swap pass `workEffortId` to `parkOrder(...)` and avoids direct frontend status normalization after parking.
   - Backend confirmation is still needed for the post-park task lifecycle: whether the Park endpoint closes, cancels, or leaves the task open when a work-effort id is supplied.

3. Order-detail payment card placement:
   - Nested Figma node `54190:189205` places the Payment list card in the `Order / Holds` header detail cluster.
   - Current `OrderDetail.vue` renders the Payment card in the Items segment summary, next to totals.
   - Moving it into the always-visible header would improve `Order / Holds` alignment, but duplicating it would violate the screen deduplication rule.
   - This should be resolved by reconciling the `Order / Items` and `Order / Holds` header/detail clusters together before moving the payment card.

## Data Contract Notes

1. Swap card progress:
   - Figma shows a linear progress indicator under the Swap task-card header.
   - `TaskCardShell.vue` supports the Ionic progress component and `SwapTaskCard.vue` passes through existing progress-shaped task fields in PR #92.
   - The current task payload does not define a guaranteed Swap progress value. Do not invent a frontend-only value unless product confirms whether the bar represents card state, resolution completeness, or ship-group progress.
