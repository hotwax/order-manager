# Components

Components are grouped by purpose so imports describe the workflow they belong to.

- `common/`: reusable UI primitives used across multiple pages, such as empty/error states and search filter cards.
- `layout/`: app shell components, such as the side menu.
- `settings/`: settings-page components and controls.
- `orders/`: order-detail, order-list, and order-item components.
- `fulfillment/`: facility, routing, shipping, and fulfillment-selection modals.
- `inventory/`: inventory inspection components.
- `tasks/`: task creation and assignment components.
- `swaps/`: swap workflow components.

Put a new component in the narrowest folder that matches its primary job. Use `common/` only when the component is already shared by more than one workflow.
