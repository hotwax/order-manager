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
| `54187:184360` | `Order / Holds` order-detail frame | `src/views/OrderDetail.vue` maps the header identity item, summary cards, timeline, `ion-segment`, and Holds segment task-card rendering. | Broad structure aligned; task-card details tracked by queue-specific rows below. |
| `54191:288203` | Swap queue page | `src/views/SwapOrders.vue`, `src/components/tasks/SwapTaskCard.vue`, and `src/components/swaps/SuggestedProductActionPopover.vue`. | Aligned in PRs #92, #94, #95, #96, #97, #100, #101, and #104; progress renders from task data when provided, headings fall back to order identifiers when order names are missing, Park passes the task id to the parking endpoint, and Swap status/footer colors match the nested card. |
| `54190:286012` | Swap suggested-product popover | `src/components/swaps/SuggestedProductActionPopover.vue` uses Ionic popover/list/header/items for Cancel item, Custom swap, and View inventory. | Aligned in PR #80. |
| `54181:113016` | `Order / Shipgroups` page, collapsed and expanded cards | `src/views/OrderDetail.vue` ship-group card: header, progress bar, hold warning row, option chips, selected option rows, timeline, collapsed summary, expanded details, actions, and smooth collapse handling. | Aligned across PRs #77, #90, and #99 plus follow-ups; padding is animated on the collapsible wrapper. |
| `54191:295583` | Hold queue page | `src/views/HoldOrders.vue` and `src/components/tasks/HoldTaskCard.vue`. | Mostly aligned; resolution comments are wired in PR #88, filter date selectors in PR #97, task heading/date fallback in PR #100, assigned-date display in the assignee row is present, and the task id chip copy affordance is in PR #102. Assign action is blocked by backend contract. |
| `54190:216632` | Bad Address queue page | `src/views/BadAddressOrders.vue` and `src/components/tasks/BadAddressTaskCard.vue`. | Aligned in PRs #84, #97, #100, and #101: two Ionic address lists, radio choice, editable rows, filter date selectors, footer actions, task heading fallback, and Park task id handoff. |
| `54642:47115` | Fraud queue page | `src/views/FraudOrders.vue` and `src/components/tasks/FraudTaskCard.vue`. | Aligned in PRs #81, #100, #102, and #103: three content columns, suggested-action footer item, readable order heading/date values when the API omits `orderName`, shared task id chip copy affordance, and Figma-mapped payment/risk rows. |
| `54304:40833` | `Order / Items` order-detail page | `src/views/OrderDetail.vue` items segment and `src/components/orders/OrderItemListRow.vue`. | Aligned in PRs #72 and #89: reusable row with key area, quantity/facility/configuration cells, status, amount, and actions. |

## Nested Figma Contexts Reviewed

These nested calls were used to avoid treating the large page frames as complete evidence:

| Nested node | Parent node | Evidence from Figma | Code mapping |
| --- | --- | --- | --- |
| `54187:183970` | `54181:113016` | Ship-group warning item with warning icon, `Hold task: ...`, and `View details` button. | `src/views/OrderDetail.vue` renders an Ionic warning `ion-item` and switches to the Holds segment in PR #90. |
| `54184:146519` | `54181:113016` | Ship-group selected options render as Ionic `Item` components; the gift-message selected option includes a `trash-outline` end action. | `src/views/OrderDetail.vue` keeps selected options visible in collapsed and expanded states. PR #99 maps the gift-message trash action to `clearGiftMessage(shipGroup)` through the existing ship-group update path. |
| `54191:295621` | `54191:295583` | Hold task card with checkbox header, work-effort chip, contact copy row, task details, assignee/reporter list, resolution comment input, and Resolve/View actions. | `TaskCardShell.vue` plus `HoldTaskCard.vue`; resolution comment persistence is in PR #88. The inline Assign button is intentionally not implemented until assignment persistence is defined. |
| `54191:296466`, `54191:296977`, `54191:297968` | `54191:295621` | Hold details list shows `workEffort.name`, purpose text, due date, `NOTES`, assignee name with assigned date and an `ASSIGN` end button, reporter name, and a stacked `Resolution comment` input. | `HoldTaskCard.vue` renders the task details, due date, notes, assignee assigned date, reporter row, and resolution textarea with Ionic list/input components. The `ASSIGN` button remains omitted because `TaskAssigneeModal.vue` only returns a selected person and `orderTask.ts` has no assignment persistence action. |
| `54191:296634`, `54642:47144` | Hold and Fraud task cards | The task identifier chip is an outlined Ionic `Chip` with a leading identifier icon, `workEffort.id` label, trailing copy glyph, and pointer affordance. | `TaskCardShell.vue` renders the centered task id chip as a clickable Ionic chip in PR #102, using the existing clipboard utility and `copyOutline` icon. |
| `54642:47127`, `54642:47128` | `54642:47125` | Fraud task-card heading uses `Order name`; subtitle uses `orderHeader.orderDate`. | PR #100 adds shared `taskOrderTitle()` and `formatTaskDate()` helpers so Fraud/Hold/Bad Address/Swap cards render readable order titles and dates when task payloads contain missing names or raw numeric dates. |
| `54642:47125` | `54642:47115` | Fraud task card with contact row, Ordered items, Payment, Risk analysis columns, Resolve/Cancel/View actions, and Suggested action footer item. | `FraudTaskCard.vue` uses shell contact/details/actions and a footer `actions-end` item for suggested action. PR #100 shares order-heading fallback/date formatting across task cards. |
| `54648:50859`, `54648:50902`, `54648:51263` | `54642:47125` | Fraud Payment row uses overline payment id, primary payment method label, warning-colored Pending status, and amount in the end slot. Fraud Risk analysis rows use a medium `information-circle-outline` icon and fact rows as secondary text. | PR #103 maps Payment rows to overline/status `ion-text` structure and aligns Risk rows to the medium Ionic info icon. |
| `54190:284563` | `54190:216632` | Bad-address task card with Original address and Suggested address Ionic list columns, radio choice labels, editable address rows, and Save/Cancel/Park actions. | `BadAddressTaskCard.vue` uses an `ion-radio-group`, `ion-list`, editable `ion-item` rows, and the existing footer actions. |
| `54190:284579`, `54190:284600`, `54190:286878` | `54190:284563` | Bad-address Original/Suggested address columns use list headers with `keep original` and `use suggested` radio actions; address fields render as overline-labeled rows for address lines, city, postal code, state, and country; footer buttons are `Save and release hold`, `Cancel order`, and `Park`. | `BadAddressTaskCard.vue` maps the header radio actions through `addressOptions`, renders field rows from `addressRows(...)` with overline labels and editable Ionic input/select controls, and wires the footer actions to update shipping information, cancel order, or park with `workEffortId`. |
| `54191:288241` | `54191:288203` | Swap/unfillable task card with routing detail row, routing justification row, linear progress indicator, ordered/suggested item columns, unavailable ordered-item action affordance, success-colored `APPROVED SWAP` label, refund input, and Release/Cancel/Park actions. | `SwapTaskCard.vue` maps routing details, ordered and suggested item lists, ordered unavailable-item actions, refund input, and popover actions. `TaskCardShell.vue` renders an Ionic progress bar when backend progress data exists. PR #104 aligns the approved-swap label to Ionic success text and keeps the footer `Cancel order` button in the same primary clear style as the Figma footer. |
| `54191:298387`, `54191:295642` | Swap and Hold contact rows | Contact details are three Ionic `Item` components for name, phone, and email, each with a small outline `Copy` button. | `TaskCardShell.vue` renders the shared contact-details list with Ionic items, person/call/mail icons, and outline copy buttons; Fraud, Hold, Bad Address, and Swap reuse it. |
| `54190:286878`, `54191:288288`, `54191:295662` | Bad Address, Swap, and Hold action footers | Footer buttons are Ionic button components. Bad Address uses Save and release hold, Cancel order, Park; Swap uses Release updated order, Cancel order, Park; Hold uses Resolve task and View order. The trailing `stopwatch-outline` instance exists in these Figma footers but is `opacity-0`. | `TaskCardShell.vue` footer actions intentionally render only the visible buttons. No stopwatch icon is mapped because the Figma instance is hidden. |
| `54642:47118`, `54191:295614`, `54190:219644`, `54191:288234` | Queue filter cards | Fraud, Hold, Bad Address, and Swap all use a Figma `Card` containing `Searchbar` and a four-control `Filters` row of `Select / Resting` components. Hold labels are `Assignee`, `Order date after`, `Order date before`, `Channel`; Bad Address and Swap use `Date after` and `Date before`. | `SearchFilterCard.vue` provides the shared Ionic card/searchbar/equal-width filter row in PR #96. `SwapOrders.vue` uses an Ionic select for the swappable filter in PR #95. `DateFilterSelect.vue` maps date filters to an item-style select trigger and Ionic date modal in PR #97, preserving arbitrary date selection while matching the Figma resting control. |
| `54361:67841` | `54304:40833` | Order item row variants: checkbox, item key, quantity, status/configuration, amount/adjustment, facility chip, and attributes chip. | `OrderItemListRow.vue` handles rollup and detail row variants, with chip cells and quantity suppression covered by PR #89. |

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
| #91 | Figma alignment map and remaining gap documentation. |

## Visual Validation

- Served the current #91 checkout, based on #104, from a detached AccxUI validation worktree at `http://127.0.0.1:8120`.
- The validation server was started from `/Users/adityapatel/Documents/GitHub/accxui` with the local dev auto-login env and a valid `VITE_DEFAULT_PRODUCT_STORE_SETTINGS` override.
- Chrome authenticated against local OMS and rendered `/swap`, `/bad-address`, `/fraud`, `/hold`, and `/orders/M100818`.
- `/swap`, `/bad-address`, and `/hold` rendered the shared filter card with one Ionic searchbar and the expected date filter select triggers. These routes returned no local task records in the current data set.
- `/fraud` rendered the shared filter card plus real task cards with Ordered items, Payment, Risk analysis columns, Resolve/Cancel/View actions, Suggested action footer items, and the task id chip copy affordance.
- A follow-up local API probe found risk-test fraud tasks with missing `orderName` values and millisecond `orderDate` values. PR #100 adds shared task-card display helpers so Fraud and Hold headings fall back to order identifiers and render formatted dates.
- A follow-up status seed probe found no `TASK_PARKED` status in the local backend. PR #101 removes the Bad Address `TASK_PARKED` status post and passes `workEffortId` through the existing Park endpoint for both Bad Address and Swap task cards.
- A follow-up nested Fraud row review found Payment and Risk item details below the high-level card frame. PR #103 aligns Payment overline/status text and Risk icon presentation to those nested rows.
- A follow-up nested Swap card review found a success-colored `APPROVED SWAP` label and primary clear footer actions. PR #104 aligns the approved-swap status text and Swap footer Cancel button.
- `/orders/M100818` rendered the order-detail route with the expected header, summary cards, item rows, footer actions, and tabs. Local backend warnings remain for missing fulfillment timeline and product/Solr lookup data, but the route no longer redirects away from the validation checkout.
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

## Data Contract Notes

1. Swap card progress:
   - Figma shows a linear progress indicator under the Swap task-card header.
   - `TaskCardShell.vue` supports the Ionic progress component and `SwapTaskCard.vue` passes through existing progress-shaped task fields in PR #92.
   - The current task payload does not define a guaranteed Swap progress value. Do not invent a frontend-only value unless product confirms whether the bar represents card state, resolution completeness, or ship-group progress.
