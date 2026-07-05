# Hold Task Card Design QA

source visual truth path: `/tmp/order-manager-design-qa/figma-hold-shipgroup.png`
implementation screenshot path: `/tmp/order-manager-design-qa/hold-card-current-crop.jpg`
viewport: `1453x1160` browser viewport, `/hold`, desktop layout with side navigation
state: first visible hold task card, populated task, not intentionally in select mode
full-view comparison evidence: `/tmp/order-manager-design-qa/hold-card-comparison.png`
focused region comparison evidence: separate focused crop not needed; the comparison image already isolates the single Figma card and the single implementation card at readable scale.
patches made since previous QA pass: none; this is an analysis-only QA pass.
final result: blocked

## Findings

- [P1] Assignee workflow is missing from the hold card
  Location: `src/components/tasks/HoldTaskCard.vue`, assignee column.
  Evidence: the Figma card shows `assignee party person name`, assigned date/time, and an `ASSIGN` button in the middle column. The implementation wires assignee name/date when `assignedParties` contains `TASK_ASSIGNEE`, but has no visible assignment action.
  Impact: an operator can see that the task is unassigned but cannot act on that state from the card, so the card explains a problem without providing the expected next step.
  Fix: add the assignee action in the middle column, using an Ionic button matching the Figma small outline button pattern. If assignment is not available yet, add a disabled/empty state that explicitly explains why.

- [P1] Task context is too thin for a real hold decision
  Location: `src/components/tasks/HoldTaskCard.vue`, left detail column.
  Evidence: the Figma card has `workEffort.name`, `workEffort.purposeType`, due date, a `NOTES` label, and `workEffort.notes`. The implementation wires `workEffortName`, `purposeDescription`, `estimatedCompletionDate`, and `notes`, but the latter three are silent/conditional. In the current visible task, only `Hold` appears.
  Impact: the operator cannot tell why the order is on hold or whether the task has time sensitivity without opening the order.
  Fix: render the task name, purpose/description, due date, and notes with clear empty states when the API returns no value. If the backend is expected to provide these fields for manual hold tasks, validate the missing values at the API contract before working around it in the card.

- [P1] Resolution comment does not read as a usable work area
  Location: `src/components/tasks/HoldTaskCard.vue`, right detail column.
  Evidence: the Figma right column is a dedicated multi-line `Input` area with `Resolution comment` and multiple response lines. The implementation renders a compact textarea-like area that visually reads like static label/value text and leaves much of the column empty.
  Impact: users may miss where they are supposed to type the resolution, or assume the task can be resolved without adding context.
  Fix: give the resolution comment field a clear multi-line height in the card body and keep it visually aligned to the Figma input area. Use Ionic `ion-textarea` deliberately with visible placeholder/label and a stable height.

- [P2] Contact row loses useful actions and scan quality
  Location: `src/components/tasks/TaskCardShell.vue` contact details.
  Evidence: Figma has three evenly balanced contact cells and copy buttons for name, phone, and email. The implementation shows a dash for phone with no copy action, wraps the customer name and email aggressively, and produces an uneven scan path.
  Impact: operators scanning repeated cards have to work harder to identify contact data, and a missing phone number looks like broken UI rather than a meaningful empty state.
  Fix: use explicit empty copy such as `No phone` when unavailable, keep the copy action only for real values, and tune contact-cell layout so names/emails do not wrap prematurely at the current desktop content width.

- [P2] Header hierarchy is compressed compared with the target
  Location: `src/components/tasks/TaskCardShell.vue` heading.
  Evidence: Figma gives the order name a prominent 20px medium heading with a quieter single-line date below. The implementation displays a smaller title and wraps `Jun 18, 2026` across three lines in the selected viewport.
  Impact: the primary identifier is less prominent, and the date consumes unnecessary vertical attention.
  Fix: keep the order title/date block closer to the Figma hierarchy: stronger order title, compact date format, and a heading region that prevents the date from stacking into three lines unless the card is genuinely narrow.

- [P2] The card width/state mismatch exposes responsive fragility
  Location: `/hold` page card layout.
  Evidence: the Figma target is a 1103px card. In the live app at a 1453px viewport with sidebar, the card is about 831px wide. This causes text wrapping and a denser, more cramped layout than the target.
  Impact: even on desktop, the hold card behaves closer to a constrained tablet layout. Repeated cards become harder to scan.
  Fix: either confirm the Figma card should adapt to the narrower content well, or add a responsive layout variant for this width that stacks or reallocates detail columns cleanly instead of squeezing all three columns equally.

- [P3] Surface treatment differs from the Figma card
  Location: `src/theme/work-card.css`, `TaskCardShell.vue`.
  Evidence: Figma uses a 16px card radius and specific 1dp elevation. The implementation uses the existing 8px `ship-group-card` radius and Ionic card surface.
  Impact: this is visible fidelity drift but less important than the missing workflow affordances.
  Fix: treat as a design-system decision. If this screen should match the Figma frame exactly, adjust the card shell token for this component. If app-wide cards intentionally stay at 8px, document that as an accepted deviation.

## Current Implementation Wiring Map

Conclusion: only some Figma fields are fully wired. Most structural fields exist in the card, but several are conditional on task-detail payload, one required action is absent, and the contact shell computes link props that it never renders.

| Figma field / control | Current implementation | Wiring status |
| --- | --- | --- |
| Checkbox | `HoldOrders.vue` always passes `selectable=true`; `TaskCardShell.vue` emits `update:selected`. | Wired, but always visible rather than gated by an explicit select mode. |
| `Order name` | `taskOrderTitle(task)` chooses `orderName`, then `orderId`, `externalId`, `workEffortName`, `workEffortId`. | Wired. |
| `orderHeader.orderDate` | `formatTaskDate(task.orderDate)`. | Wired. |
| `workEffort.id` chip | `task.workEffortId`; chip copies to clipboard. | Wired. |
| `$orderHeader.total` | `money(task.grandTotal)`. | Wired if `grandTotal` exists; missing-value guard is weak. |
| Full name | `customer.firstName + customer.lastName`; falls back to `Unknown`. | Wired. |
| Phone | `task.customerPhone` or formatted `task.billingPhone`. | Partially wired; current live task shows `-`, and `contactPhoneHref` is computed but not used as a link. |
| Email | `task.customerEmail`, `billingEmail`, or `shippingEmail`. | Wired; `contactEmailHref` is computed but not used as a link. |
| Contact copy buttons | Shell copies name, phone, email when present. | Wired for present values. |
| `workEffort.name` | `task.workEffortName`. | Wired. |
| `workEffort.purposeType` | Rendered as `task.purposeDescription`. | Partially wired; it is a description field, and empty values disappear into blank secondary text. |
| `workEffort.dueDate` | Rendered as `task.estimatedCompletionDate` in an `ion-note` only when present. | Partially wired; hidden when absent and not formatted. |
| `NOTES` / `workEffort.notes` | `task.notes`, with the whole item hidden when absent. | Partially wired; no empty state. |
| `assignee party person name` | `assignedParties[]` lookup for `TASK_ASSIGNEE`; falls back to `Unassigned`. | Wired. |
| `assigned date time` | `TASK_ASSIGNEE.fromDate`, formatted in the component. | Wired when an assignee exists. |
| `ASSIGN` button | No button or action exists in `HoldTaskCard.vue`. | Missing. |
| `REPORTER` / reporter party person name | `assignedParties[]` lookup for `TASK_REPORTER`; falls back to `System`. | Wired, with fallback. |
| `Resolution comment` input | `ion-textarea` bound to local `resolutionComment`, initialized from `task.resolutionComment`. | Wired as an input, but visually too weak and only submitted when resolving the task. |
| `RESOLVE TASK` | Calls `changeTaskStatus(workEffortId, 'TASK_COMPLETED', resolutionCommunication())`. | Wired. |
| `VIEW ORDER` | Routes to `/orders/{task.orderId}` when `showViewOrderAction` is true. | Wired. |

## Required Fidelity Surfaces

- Fonts and typography: both use a Roboto/Ionic-style stack, but implementation hierarchy is weaker. The title/date block is too compressed, email/name wrapping is poor, and the resolution field lacks the optical weight of an editable area.
- Spacing and layout rhythm: the Figma card has clearer row groupings and balanced thirds. The implementation is cramped at the current desktop content width and leaves unused vertical space in the resolution column.
- Colors and visual tokens: primary blue and divider colors are broadly aligned, but the card surface/radius/elevation diverges. This is lower severity unless exact Figma fidelity is required.
- Image quality and asset fidelity: no product imagery is present in this card. Icons are from the Ionic family and broadly match the target, but the phone empty state makes the icon row feel broken.
- Copy and content: implementation conditionally wires purpose/subtype, notes, and due date, but the current visible task does not show them. The assignment action and meaningful phone empty state are missing.

## Open Questions

- Should the hold card include an assignment action now, or is assignment intentionally out of scope for the first implementation?
- Is the Figma 1103px card width the expected desktop content width, or should the implementation define a narrower responsive version for the current app shell?
- Should the app-wide 8px card radius override the Figma 16px radius, or is this card intended to be an exception?

## Implementation Checklist

1. Add the assignee row action and assigned date/time behavior.
2. Render task purpose, due date, and notes in the left detail column with clear empty states.
3. Make the resolution comment a clearly editable multi-line textarea area.
4. Improve contact row empty/value behavior, especially phone and wrapped email.
5. Revisit the card layout at the current 831px content width and decide whether to stack or rebalance columns.
6. Confirm card radius/elevation against app design-system rules before changing surface styling.

## Follow-up Polish

- Align button capitalization, spacing, and small outline button treatment to the Figma Button component.
- Review mobile/tablet behavior after the desktop card is functionally complete.
