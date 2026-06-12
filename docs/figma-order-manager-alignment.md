# Order Manager Figma Alignment

This document maps the reviewed HC Ionic design system nodes to the current Ionic/Vue implementation and records the remaining gaps that should not be guessed in the frontend.

> **Integration status (2026-06-12):** the codex PR stack was integrated selectively. PRs **#75, #84, #89, #107, #109, #120, #121, and #123 were NOT merged** (rejected or superseded in review). Rows below that cite those PRs describe behavior that is **not present** in the codebase — e.g. the parking modal still fetches facilities (no static four-bucket radios from #75), `BadAddressTaskCard.vue` keeps the explicit per-field form (no `addressRows(...)` from #84), `OrderItemListRow.vue` has no quantity-suppression/chip guards (#89/#109), task cards still fall back to an `Unknown` contact name (#107), `/unfillable` uses the `OrderQueueList` page from PR #57 (not the SwapOrders variant from #120), and the menu has no `Find` divider or queue counts (#121/#123).

## Implementation Rules

- Use core Ionic components for the visible UI surface.
- Do not use `ion-grid`, `ion-row`, or `ion-col`.
- Keep layout CSS limited to structure and spacing; do not add font or color styling.
- Keep modal behavior aligned with AccxUI rules: close icon-only button in the header start slot, single-step save as fixed bottom-right icon-only FAB, multi-step flows with footer toolbar navigation.
- Keep behavior backed by current frontend and OMS contracts. Do not add visible actions that cannot safely persist.
- Figma is the structure and component reference, not the only allowed action inventory. Extra workflow buttons are acceptable when they fill real development gaps, stay backed by current behavior, and use the same Ionic patterns instead of custom styling.

## Objective Audit

| Requirement | Evidence | Current result |
| --- | --- | --- |
| Push current work in logical PRs. | The Current PR Stack section lists each draft PR and its focused scope above the component-folder/facility-selection foundation. GitHub mergeability is checked separately from this document before updating PR descriptions. | Satisfied for the pushed frontend/documentation stack; #127 is the current stack tip and #91 carries the canonical mapping/gap documentation. |
| Review every provided Figma node and avoid one-pass-only mapping. | The Reviewed Figma Nodes table covers all top-level node ids from the request. The Nested Figma Contexts Reviewed table records the follow-up node ids used for deeper inspection of cards, lists, rows, footers, modals, filters, and menu structure. | Satisfied for frontend mapping; non-implemented Figma details are recorded under Remaining Gaps or Data Contract Notes. |
| Focus styling/layout on Fraud, Hold, Swap/Unfillable, and Bad Address queues without breaking behavior. | Queue surfaces map through `FraudTaskCard.vue`, `HoldTaskCard.vue`, `SwapTaskCard.vue`, `BadAddressTaskCard.vue`, `TaskCardShell.vue`, `SearchFilterCard.vue`, `FilterSelect.vue`, `DateFilterSelect.vue`, `FilterToggle.vue`, and `SelectAllResultsItem.vue`. Focused specs and production builds are noted in Visual Validation. | Satisfied for frontend-safe Figma surfaces; blocked actions are intentionally omitted instead of mocked. |
| Build reusable components where needed. | Shared task shell, filter controls, select-all row, order payment card, and order item row are called out in the mapping rows instead of duplicating markup per page. | Satisfied in the stacked PRs. |
| Keep AccxUI/Ionic constraints. | Implementation rules, Modal Compliance Scan, and PR-level source guards cover core Ionic components, no Ionic grid primitives, modal close/save placement, and no new font/color styling. | Satisfied for the reviewed stack; future backend-driven gaps should keep the same constraints. |

## Reviewed Figma Nodes

| Figma node | Design surface | Current Ionic mapping | Status |
| --- | --- | --- | --- |
| `54760:1223` | `Order / Park - Alert` | `confirmParkOrder()` in `src/utils/index.ts` uses Ionic `alertController` with Cancel and Park order actions. | Aligned. |
| `54775:47722` | `Order / Park - Modal` | `src/components/fulfillment/FacilityModal.vue` renders the four parking buckets as an `ion-radio-group` and uses the fixed save FAB. | Aligned in PR #75. |
| `54187:184360` | `Order / Holds` order-detail frame | `src/views/OrderDetail.vue` maps the header identity item, summary cards, timeline, `ion-segment`, and Holds segment task-card rendering. | Broad structure aligned; PR #106 aligns the ship-group segment label to the Figma `Shipgroups` copy, PR #111 maps the order status to the identity row end-slot badge, PR #112 aligns the Order identifications and Source card labels/order, and PR #114 places Payment in the Holds header cluster through a reusable card component. |
| `54191:288203` | Unfillable queue page | `src/views/UnfillableOrders.vue`, `src/views/SwapOrders.vue`, `src/components/tasks/SwapTaskCard.vue`, `src/components/swaps/SuggestedProductActionPopover.vue`, and `src/components/layout/Menu.vue`. | Aligned in PRs #92, #94, #95, #96, #97, #100, #101, #104, #105, #107, #113, #116, #117, #120, and #121; progress renders from task data when provided, headings fall back to order identifiers when order names are missing, Park passes the task id to the parking endpoint, status/footer colors match the nested card, empty non-date filter selects render the Figma `Select` resting text, the Swappable filter maps to an Ionic toggle, empty contact rows can collapse for the unfillable-parking variant, ordered/suggested item rows use visible dividers, the suggested-product popover rows use visible dividers, `/unfillable` is now a real menu/route target while `/swap` remains titled `Swap`, and the shared menu groups Find records after the In progress queues with Figma-style end-slot queue counts. |
| `54190:286012` | Swap suggested-product popover | `src/components/swaps/SuggestedProductActionPopover.vue` uses Ionic popover/list/header/items for Cancel item, Custom swap, and View inventory. | Aligned in PRs #80 and #117. |
| `54181:113016` | `Order / Shipgroups` page, collapsed and expanded cards | `src/views/OrderDetail.vue` ship-group card: header, progress bar, hold warning row, option chips, selected option rows, timeline, collapsed summary, expanded details, actions, and smooth collapse handling. | Aligned across PRs #77, #90, and #99 plus follow-ups; padding is animated on the collapsible wrapper. |
| `54191:295583` | Hold queue page | `src/views/HoldOrders.vue` and `src/components/tasks/HoldTaskCard.vue`. | Mostly aligned; resolution comments are wired in PR #88, filter date selectors in PR #97, task heading/date fallback in PR #100, assigned-date display in the assignee row is present, the task id chip copy affordance is in PR #102, empty non-date filter selects render `Select` in PR #105, the select-all row maps to Figma in PR #108, and PR #115 aligns the Hold detail row dividers. Assign action is blocked by backend contract. |
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
| `54190:189205` | `54187:184360` | Payment card uses an Ionic list-card row with payment method id overline, method label, status text, and amount in the end slot. | PR #114 extracts the payment rows into `OrderPaymentCard.vue`, renders it in the Holds header cluster, and reuses the same component in the Items summary so the markup is not duplicated. |
| `54190:215460` | `54187:184360` | Order-detail segment uses Ionic Segment button components with labels `Items`, `Shipgroups`, selected `Holds`, and `Comms`. | `OrderDetail.vue` uses `ion-segment` and `ion-segment-button` for the same four segment values; PR #106 changes the ship-group tab label to `Shipgroups` to match the nested Figma component. |
| `54187:183970` | `54181:113016` | Ship-group warning item with warning icon, `Hold task: ...`, and `View details` button. | `src/views/OrderDetail.vue` renders an Ionic warning `ion-item` and switches to the Holds segment in PR #90. |
| `54184:146519` | `54181:113016` | Ship-group selected options render as Ionic `Item` components; the gift-message selected option includes a `trash-outline` end action. | `src/views/OrderDetail.vue` keeps selected options visible in collapsed and expanded states. PR #99 maps the gift-message trash action to `clearGiftMessage(shipGroup)` through the existing ship-group update path. |
| `54191:295621` | `54191:295583` | Hold task card with checkbox header, work-effort chip, contact copy row, task details, assignee/reporter list, resolution comment input, and Resolve/View actions. | `TaskCardShell.vue` plus `HoldTaskCard.vue`; resolution comment persistence is in PR #88. The inline Assign button is intentionally not implemented until assignment persistence is defined. |
| `54642:47146`, `54191:295670`, `54191:295463` | Fraud, Hold, and Bad Address queue pages | Queue selection row is an Ionic Item with a checkbox, `Select all results` label, and a trailing result count. Nested context for `54642:47146` confirms the end-slot count row. | `SelectAllResultsItem.vue` in PR #108 maps the row to `ion-item`, `ion-checkbox`, `ion-label`, and `ion-note`, and Fraud, Hold, and Bad Address queues reuse it for their selectable task results. No additional code change needed after the nested row audit. |
| `54359:67363`, `54359:67396` | `54304:40833` | Order / Items toolbar shows a `Select all` checkbox item and an outline medium `Add items` button. | `OrderDetail.vue` maps the select-all item to an Ionic checkbox row and PR #110 aligns the item-toolbar add action to an outline medium Ionic button with `Add items` copy. |
| `54364:69325` | `54304:40833` | Order / Items summary Payment card uses an Ionic list-card with method id overline, method label, payment status, and amount in the end slot. | PR #114 keeps the Items summary mapped through the shared `OrderPaymentCard.vue`, preserving the same Ionic card/header/list/item structure and end-slot amount row. |
| `54362:67925` | `54304:40833` | Order / Items totals card uses Ionic item rows for `Subtotal`, `Shipping` with secondary method text, `Tax`, `Grand total`, and `Payment received`. | `OrderDetail.vue` renders subtotal, adjustment rows with optional detail text, grand total, and payment received rows inside the Items segment totals card. |
| `54191:296466`, `54191:296977`, `54191:297968` | `54191:295621` | Hold details list shows `workEffort.name`, purpose text, due date, `NOTES`, assignee name with assigned date and an `ASSIGN` end button, reporter name, and a stacked `Resolution comment` input. The Figma list rows use visible item dividers. | `HoldTaskCard.vue` renders the task details, due date, notes, assignee assigned date, reporter row, and resolution textarea with Ionic list/input components. PR #115 changes those Hold content lists to `lines="full"` to match the Figma row dividers. The `ASSIGN` button remains omitted because `TaskAssigneeModal.vue` only returns a selected person and `orderTask.ts` has no assignment persistence action. |
| `54191:295585` | `54191:295583` | Hold page toolbar visible title is `Hold`. | `HoldOrders.vue` already renders the Ionic toolbar title with `translate('Hold')`; no code change needed. |
| `54191:296634`, `54642:47144` | Hold and Fraud task cards | The task identifier chip is an outlined Ionic `Chip` with a leading identifier icon, `workEffort.id` label, trailing copy glyph, and pointer affordance. | `TaskCardShell.vue` renders the centered task id chip as a clickable Ionic chip in PR #102, using the existing clipboard utility and `copyOutline` icon. |
| `54642:47127`, `54642:47128` | `54642:47125` | Fraud task-card heading uses `Order name`; subtitle uses `orderHeader.orderDate`. | PR #100 adds shared `taskOrderTitle()` and `formatTaskDate()` helpers so Fraud/Hold/Bad Address/Swap cards render readable order titles and dates when task payloads contain missing names or raw numeric dates. |
| `54642:47125` | `54642:47115` | Fraud task card with contact row, Ordered items, Payment, Risk analysis columns, Resolve/Cancel/View actions, and Suggested action footer item. | `FraudTaskCard.vue` uses shell contact/details/actions and a footer `actions-end` item for suggested action. PR #100 shares order-heading fallback/date formatting across task cards. |
| `54648:48313`, `54648:50884`, `54648:50893` | `54642:47125` | Fraud content columns use Ionic list-header components labeled `Ordered items`, `Payment`, and `Risk analysis`. | `FraudTaskCard.vue` renders the three columns as Ionic lists with matching `ion-list-header` labels and the shared grid content layout from `TaskCardShell.vue`. |
| `54648:50859`, `54648:50902`, `54648:51263` | `54642:47125` | Fraud Payment row uses overline payment id, primary payment method label, warning-colored Pending status, and amount in the end slot. Fraud Risk analysis rows use a medium `information-circle-outline` icon and fact rows as secondary text. | PR #103 maps Payment rows to overline/status `ion-text` structure and aligns Risk rows to the medium Ionic info icon. |
| `54642:47137`, `54642:47140` | `54642:47125` | Fraud footer actions are Ionic buttons ordered `Resolve task`, `Cancel order`, `View order`, followed by a trailing Ionic item with `hardware-chip-outline` and `Suggested action: Cancel`. | `FraudTaskCard.vue` renders the same action order with clear primary/danger/primary Ionic buttons and uses the `actions-end` slot for the suggested-action item with `hardwareChipOutline` and danger coloring for cancel recommendations. |
| `54642:47117` | `54642:47115` | Fraud page toolbar visible title is `Fraud`. | `FraudOrders.vue` already renders the Ionic toolbar title with `translate('Fraud')`; no code change needed. |
| `54190:284563` | `54190:216632` | Bad-address task card with Original address and Suggested address Ionic list columns, radio choice labels, editable address rows, and Save/Cancel/Park actions. | `BadAddressTaskCard.vue` uses an `ion-radio-group`, `ion-list`, editable `ion-item` rows, and the existing footer actions. |
| `54190:284579`, `54190:284600`, `54190:286878` | `54190:284563` | Bad-address Original/Suggested address columns use Ionic `List`, `List Header`, `Radio`, and `Item` components. Nested `54190:284579` confirms the `Original address` header, `keep original` radio action, and overline-labeled rows for address line 1, address line 2, city, postal code, state, and country; footer buttons are `Save and release hold`, `Cancel order`, and `Park`. | `BadAddressTaskCard.vue` maps the header radio actions through `addressOptions`, renders field rows from `addressRows(...)` with overline labels and editable Ionic input/select controls, and wires the footer actions to update shipping information, cancel order, or park with `workEffortId`. No additional code change needed after the nested list audit. |
| `54190:216634` | `54190:216632` | Bad Address page toolbar visible title is `Bad address`. | `BadAddressOrders.vue` already renders the Ionic toolbar title with `translate('Bad address')`; no code change needed. |
| `54191:288241`, `54191:288249`, `54191:288270`, `54191:288291` | `54191:288203` | Swap/unfillable task card with routing detail row, routing justification row, linear progress indicator, `Ordered items` and `Suggested items` list headers, unavailable ordered-item action affordance, success-colored `APPROVED SWAP` label, refund input, and footer actions ordered `Release updated order`, `Cancel order`, `Park`. | `SwapTaskCard.vue` maps routing details, ordered and suggested item lists, ordered unavailable-item actions, refund input, and popover actions. `TaskCardShell.vue` renders an Ionic progress bar when backend progress data exists. PR #104 aligns the approved-swap label to Ionic success text and keeps the footer `Cancel order` button in the same primary clear style as the Figma footer. |
| `54191:288257` | `54191:288241` | Representative Swap item row uses an Ionic `Item` with thumbnail, primary identifier, secondary identifier, and a visible bottom divider. | PR #116 changes the Swap ordered and suggested item lists to `lines="full"` so the Ionic item rows show dividers matching the nested Figma row. |
| `54190:286012` | Swap suggested-product popover | Popover uses a primary identifier header followed by `Cancel item`, `Custom swap`, and `View inventory` item actions. The action rows show visible full-width dividers. | `SuggestedProductActionPopover.vue` maps this to `ion-content`, `ion-list-header`, product-primary `popoverTitle`, and three button `ion-item` actions. PR #117 sets the popover `ion-list` to `lines="full"` to match the Figma row dividers. |
| `54191:288296` | `54191:288203` | Second Swap card variant shows `001 Unfillable parking`, `Not brokered`, routing details, no contact row, ordered unavailable items, suggested `available` / `cancel` badges, totals, suggested refund input, and Release/Cancel/Park actions. | `SwapTaskCard.vue` already maps the routing, unavailable item, suggested item, totals, refund, and footer action structure. PR #107 stops task cards from forcing an `Unknown` contact name so `TaskCardShell.vue` can collapse the contact row when no contact fields exist. |
| `54191:298387`, `54191:295642` | Swap and Hold contact rows | Contact details are three Ionic `Item` components for name, phone, and email, each with person/call/mail media and a small outline `Copy` button. Nested `54191:295642` confirms the visible row values and button style. | `TaskCardShell.vue` renders the shared contact-details list with Ionic items, person/call/mail icons, and outline copy buttons when contact fields exist; Fraud, Hold, Bad Address, and Swap reuse it. PR #107 keeps the row data-dependent instead of forcing `Unknown`. No additional code change needed after the nested contact-row audit. |
| `54190:286878`, `54191:288288`, `54191:295662` | Bad Address, Swap, and Hold action footers | Footer buttons are Ionic button components. Bad Address uses Save and release hold, Cancel order, Park; Swap uses Release updated order, Cancel order, Park; Hold uses Resolve task and View order. The trailing `stopwatch-outline` instance exists in these Figma footers but is `opacity-0`. | `TaskCardShell.vue` footer actions intentionally render only the visible buttons. No stopwatch icon is mapped because the Figma instance is hidden. |
| `54223:47293` | `54191:288203` | Shared Order Manager menu groups `Funnel`, `Blocked` queues, `In progress` queues, `Find` records (`Orders`, `Returns`, `Shipments`, `Customers`), and `Settings`. Blocked and In progress queue rows use end-slot count text; Unfillable includes the `swappable` qualifier. | `Menu.vue` maps the Blocked queue group, In progress queue group, Orders, Customers, Create order, and Settings. PR #121 moves Orders/Customers into a `Find` divider after In progress while keeping Create order available under the same group, and adds `ion-note slot="end"` counts backed by existing dashboard/workflow stores. Returns and Shipments are documented as a route/search gap below because the app has no top-level views or routes for those records yet. |
| `54642:47118`, `54191:295614`, `54190:219644`, `54191:288234` | Queue filter cards | Fraud, Hold, Bad Address, and Unfillable all use a Figma `Card` containing `Searchbar` and a four-control `Filters` row. Fraud uses Assignee, Channel, Recommendation, Severity selects; Hold uses Assignee, Order date after, Order date before, Channel; Bad Address uses Assignee, Date after, Date before, Channel; Unfillable uses a `Swappable` Switch/Toggle followed by Date after, Date before, and Channel selects. Empty non-date selects show the resting value `Select`. | `SearchFilterCard.vue` provides the shared Ionic card/searchbar/equal-width filter row in PR #96. `DateFilterSelect.vue` maps date filters to an item-style select trigger and Ionic date modal in PR #97, preserving arbitrary date selection while matching the Figma resting control. `FilterSelect.vue` in PR #105 wraps non-date Ionic selects so empty filter values display `Select` while retaining the blank clear option in the popover. `FilterToggle.vue` in PR #113 maps the `Swappable` switch to an Ionic `ion-toggle` while preserving the existing `swappable: 'Y'` API parameter; PR #120 renders that queue under the `/unfillable` route with the Figma toolbar title. |
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
| #113 | Swap filter toggle alignment. |
| #114 | Holds payment card placement and reusable payment card extraction. |
| #115 | Hold card list divider alignment. |
| #116 | Swap card list divider alignment. |
| #117 | Swap suggested-product popover divider alignment. |
| #120 | Unfillable route and menu alignment. |
| #121 | Order Manager menu section and queue-count alignment. |
| #122 | App-wide modal compliance source guard. |
| #123 | Optional menu count probe cleanup and locale warning fixes. |
| #127 | Confirmation alert action-copy alignment. |
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
- A follow-up nested Fraud card review confirmed the content-column headers and footer action/suggested-action item match `FraudTaskCard.vue` without additional code changes.
- A follow-up nested Swap card review found a success-colored `APPROVED SWAP` label and primary clear footer actions. PR #104 aligns the approved-swap status text and Swap footer Cancel button.
- A follow-up nested queue filter review found the non-date `Select / Resting` controls should show `Select` when empty. PR #105 adds `FilterSelect.vue`; Chrome confirmed `/fraud`, `/hold`, `/swap`, and `/bad-address` render empty non-date filters as `Label, Select` in Ionic shadow DOM while preserving empty filter values.
- A follow-up order-detail copy review found the Figma segment label is `Shipgroups`. PR #106 updates the `OrderDetail.vue` segment label and locale keys without removing the existing `Ship groups` translation key.
- A follow-up nested Swap variant review found the `001 Unfillable parking` card omits contact details when none are present. PR #107 lets the shared task-card contact row collapse instead of forcing an `Unknown` customer name.
- Follow-up nested Fraud, Hold, and Bad Address queue reviews found the select-all row should read `Select all results` with the result count in the end slot. PR #108 adds a shared Ionic `SelectAllResultsItem` used by those queues.
- A follow-up nested contact-row review confirmed the shared task contact details match Figma's three Ionic item rows with person/call/mail icons and small outline `Copy` buttons; `TaskCardShell.vue` already maps this surface.
- A follow-up nested Order / Items review found the chip-heavy detail row should only appear for real facility or attribute data. PR #109 keeps empty facility values and zero-attribute counts on the normal quantity row variant.
- A follow-up nested Order / Items toolbar review found the add action should be an outline medium Ionic button labeled `Add items`. PR #110 aligns that toolbar action while leaving other `Add Items` actions unchanged.
- Follow-up nested Order / Items summary-card reviews found the Payment and totals cards already map to Ionic cards/lists in `OrderDetail.vue`; no code change was needed.
- A follow-up nested Order / Holds identity-item review found the order status belongs in an end-slot Ionic badge rather than as duplicate overline text above the order name. PR #111 moves `order.status` into that badge and validates the pattern with a focused source guard plus production build.
- Follow-up nested Order / Holds list-card reviews found Figma labels for the Order identifications and Source cards. PR #112 aligns those row labels/order and validates the pattern with the same focused header spec plus production build.
- A follow-up nested Swap filter-card review found the `Swappable` filter is a Switch/Toggle, not a select. PR #113 adds a reusable `FilterToggle.vue` and uses it for Swap while preserving the backend `swappable: 'Y'` parameter only when enabled.
- A follow-up nested Order / Holds Payment-card review found the Payment list card belongs in the Holds header detail cluster. PR #114 extracts the existing payment rows into `OrderPaymentCard.vue`, renders it in the Holds header, and keeps the Items summary using the same component to avoid duplicated payment markup.
- A follow-up nested Hold task-card review found visible row dividers in the task details, assignment, and resolution input columns. PR #115 aligns those sections with Ionic `ion-list lines="full"` and validates the focused Hold card source guard plus production build.
- A follow-up nested Bad Address review confirmed the Original/Suggested address headers, keep/use radio labels, and footer action order already match `BadAddressTaskCard.vue` through Ionic list, radio, and button components.
- A follow-up nested Bad Address list review confirmed the Original address list rows use overline labels for address line 1, address line 2, city, postal code, state, and country; `BadAddressTaskCard.vue` already maps those rows through `addressRows(...)`.
- A follow-up nested Swap row review found visible dividers on item rows. PR #116 aligns the ordered and suggested item lists with Ionic `ion-list lines="full"` and validates the focused Swap card source guard plus production build.
- A follow-up suggested-product popover review found visible full-width dividers between `Cancel item`, `Custom swap`, and `View inventory`. PR #117 aligns the popover list with Ionic `ion-list lines="full"` and validates the focused popover source guard plus production build.
- A follow-up Unfillable page/menu review found the Figma top-level frame `54191:288203` is named `Unfillable`, the toolbar title is `Unfillable`, the menu item is `Blocked > Unfillable`, and the filter card uses Searchbar, Swappable toggle, Date after, Date before, and Channel controls. PR #120 adds `/unfillable`, maps the menu entry there, keeps `/swap` titled `Swap`, and validates the route/menu/swap guards plus production build.
- A follow-up shared menu review found `54223:47293` groups record lookup links under a `Find` divider after the `In progress` queue group and shows end-slot counts on Blocked/In progress queue rows. PR #121 moves Orders and Customers into that group, keeps Create order there without adding missing Returns or Shipments routes, and adds count notes using existing dashboard/workflow data sources.
- PR #122 adds a modal compliance source guard across modal components and inline `ion-modal` blocks. It passed 43 checks for header start-slot close icons and editable modal fixed bottom-end FAB actions.
- A latest-stack Chrome pass served PR #123 at `http://127.0.0.1:8125` from a detached AccxUI checkout. `/orders/M100818` rendered the order header, Items segment, payment/totals, and footer actions; `/fraud` rendered the shared filter card, select-all row, two real task cards, Payment/Risk columns, and Resolve/Cancel/View actions; `/hold` and `/bad-address` rendered their filter cards with no records in the local dataset; `/unfillable?validation=runtime-warnings` rendered the Unfillable title, Swappable toggle, date filters, Channel select, and menu groups/count notes without optional `funnelDashboard/*` menu-count requests.
- A fresh menu design-context spot-check for `54223:47293` reconfirmed the `Find` group includes `Orders`, `Returns`, `Shipments`, and `Customers`; the current route table still only exposes top-level Orders and Customers record-search pages, so Returns and Shipments remain documented as route/search gaps instead of dead menu links.
- A latest metadata re-audit reloaded the Hold, Fraud, Bad Address, and Unfillable top-level Figma nodes and confirmed their toolbar, filter-card, task-card, contact row, list, footer, and menu structures are already represented by the mapped Ionic components. No new frontend-safe mismatch was found beyond the remaining backend/route-contract gaps below.
- PR #127 aligns Ionic confirmation-alert copy with the reviewed park-order alert: cancel-role actions read `Cancel`, confirm-role actions use the operation being confirmed, and the source guard passed two focused checks.
- A follow-up PR #127 runtime attempt started the latest branch through the AccxUI wrapper and reached the Vite server on `http://localhost:5173`; Chrome route automation was then blocked by an existing extension UI before page-level assertions could complete.
- PR #109 was validated with the focused order-item row spec and a production build from a detached AccxUI checkout. A Chrome retry at `http://127.0.0.1:8121/orders/M100818` redirected back to `/funnel` through the route permission guard before item rows could be inspected.
- In the earlier #91 browser pass, `/orders/M100818` rendered the order-detail route with the expected header, summary cards, item rows, footer actions, and tabs. Local backend warnings remained for missing fulfillment timeline and product/Solr lookup data.
- A ship-group collapse smoke test found PR #77's open options wrapper could clip after moving padding onto the animated state because global border-box sizing made `max-height` consume padding.
- PR #77 now sets the collapsible wrappers to content-box sizing. A validation-only cherry-pick of #77 commit `891cda8` onto the current #91 checkout confirmed `/orders/M100818` ship-group geometry in Chrome: collapsed expanded-options `height: 0`, `padding-block: 0`, summary visible; expanded options `height/max-height/scrollHeight: 88px`, `padding-block: 24px 24px`, summary collapsed, and details visible.

## Modal Compliance Scan

- Editable modal components in the focused order workflows use the AccxUI header close pattern: an icon-only close button inside `ion-buttons slot="start"`.
- Single-step editable modals use a fixed bottom-right icon-only `ion-fab-button` for save/add/confirm actions. PR #98 aligns `OrderItemAttributesModal.vue` with this rule by moving the add action out of inline content and into the fixed FAB.
- PR #122 makes this app-wide by guarding every `*Modal.vue` component and every inline `ion-modal` block with source-level checks for the header close pattern and editable modal FAB placement.
- A follow-up alert guard keeps dismissive `role="cancel"` confirmation actions labeled `Cancel` and positive `role="confirm"` actions labeled with the operation being confirmed, matching the reviewed park-order alert instead of presenting destructive choices as generic `No` / `Yes` answers.
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

3. Menu `Returns` and `Shipments` records:
   - Figma node `54223:47293` shows `Returns` and `Shipments` inside the `Find` group.
   - Current routing only exposes `/orders`, `/customers`, `/create-order`, and the operational queues; there are no top-level Returns or Shipments views.
   - `OrderService.ts` has return/shipment normalizers and DataDocument identifiers, but there are no corresponding search actions, route records, or view components.
   - PR #121 intentionally keeps those menu rows omitted until the app has real Returns and Shipments search surfaces to link to.

## Data Contract Notes

1. Swap card progress:
   - Figma shows a linear progress indicator under the Swap task-card header.
   - `TaskCardShell.vue` supports the Ionic progress component and `SwapTaskCard.vue` passes through existing progress-shaped task fields in PR #92.
   - The current task payload does not define a guaranteed Swap progress value. Do not invent a frontend-only value unless product confirms whether the bar represents card state, resolution completeness, or ship-group progress.

2. Unfillable queue source:
   - PR #120 maps `/unfillable` to the existing substitution-task queue surface rather than the dashboard `funnelDashboard/unfillable` count endpoint.
   - The dashboard endpoint remains count/trend data for Funnel, while the queue cards continue to use `fetchSwapTasks(...)` and the `NEG_RES_REVIEW` work-effort purpose task list.
