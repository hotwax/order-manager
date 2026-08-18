## 2026-07-22 - Missing ARIA Labels on Ionic Modals
**Learning:** Found a widespread pattern across many modal components where `<ion-button>` elements containing only an `<ion-icon>` lacked `aria-label` attributes. This is a common accessibility trap in Ionic/Vue applications because visually the icon conveys the meaning (e.g. `closeOutline` for dismissing a modal, `trashOutline` for delete), but screen readers announce nothing useful for the button without the label.
**Action:** Always add `:aria-label="translate('[Action]')"` (e.g. 'Close', 'Delete', 'Options') to `<ion-button>` elements that rely solely on an `<ion-icon>` for their visual representation to ensure proper accessibility for screen reader users.

## 2024-07-23 - Add ARIA Labels to Icon-Only Buttons
**Learning:** Icon-only buttons (like `<ion-button>` and `<ion-fab-button>`) frequently miss `aria-label`s in this app, making them inaccessible to screen reader users because the purpose of the action is visually communicated only by an icon.
**Action:** When finding an icon-only button without visible text, always check for an `aria-label` (using the `translate()` function when possible for internationalization) to improve accessibility. Look specifically at `ion-fab-button`s, as they often just contain an icon.

## 2024-07-25 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found a widespread accessibility pattern in the application where icon-only `<ion-button>` elements containing `<ion-icon>` frequently lack `aria-label`s. This makes them inaccessible to screen readers, as the icon alone provides no semantic meaning.
**Action:** When working on UI components, actively scan for and add `:aria-label="translate('Action Name')"` to all icon-only buttons to ensure they remain accessible.
## 2025-07-25 - Icon-only buttons accessibility pattern
**Learning:** Many icon-only buttons (`<ion-button>` with an inner `<ion-icon>`) across the application are missing both `aria-label`s for screen readers and `slot="icon-only"` on the inner icon for proper Ionic alignment.
**Action:** When creating or reviewing UI components, especially modals and lists, explicitly verify that all buttons containing only icons have a localized `aria-label` (using `translate()`) and that the `<ion-icon>` has `slot="icon-only"`.
## 2024-07-28 - Internationalization of ARIA labels
**Learning:** Found several icon-only buttons with hardcoded English strings for accessibility (e.g. `aria-label="Close"`). This degrades the experience for screen reader users relying on localized interfaces.
**Action:** Always wrap standard aria-label attributes with the application's `translate()` function (e.g. `:aria-label="translate('Close')"`) to ensure icon-only buttons remain accessible across all supported languages.

## 2024-05-18 - Missing ARIA labels and Icon slots on Ionic Close Buttons
**Learning:** Ionic `<ion-button>` elements containing only an `<ion-icon>` need `slot="icon-only"` on the icon element for proper UI spacing/layout, and they absolutely require an `aria-label` (or `:aria-label="translate('Key')"`) for screen readers, which was missing in several modal close buttons across the app.
**Action:** When adding or auditing icon-only buttons (especially modal close buttons), ensure both `:aria-label="translate('...')"` is present on the button and `slot="icon-only"` is added to the `<ion-icon>` to guarantee both visual correctness and accessibility.
## 2024-07-30 - Missing ARIA labels on Ionic Fab Buttons
**Learning:** Ionic `<ion-fab-button>` elements are often missed during accessibility audits for missing ARIA labels because they function as primary action buttons and are visually distinct, but they remain completely inaccessible to screen readers without them.
**Action:** Always verify that `<ion-fab-button>` elements that only contain an `<ion-icon>` include an explicit `aria-label` attribute.
## 2024-08-04 - Missing ARIA Labels on ion-fab-button
**Learning:** Found multiple instances of icon-only `<ion-fab-button>` components without an `aria-label` attribute. While these buttons function as visually distinct primary action buttons, they require an explicit `aria-label` for screen reader accessibility since the inner `<ion-icon>` does not convey meaning to assistive technologies.
**Action:** When creating or auditing `<ion-fab-button>` elements that only contain icons, always ensure the `aria-label` attribute is set using the `translate()` function (e.g., `:aria-label="translate('Save')"`) to guarantee accessibility and localization.
## 2024-05-24 - External Link Indicators
**Learning:** Adding an `openOutline` icon to buttons with `target="_blank"` improves predictability by visually warning users that the action will open in a new tab.
**Action:** Always append `<ion-icon slot="end" :icon="openOutline" />` to elements that open external resources in a new tab.
## 2026-08-08 - Adding loading states to destructive actions\n**Learning:** Destructive actions, such as deleting a customer profile, often use an icon-only button (e.g., trash icon) without visual feedback during asynchronous processing. In Vue and Ionic applications, these async processes typically have a reactive state flag (e.g., `deleting`).\n**Action:** When inspecting destructive or asynchronous actions in icon-only buttons, replace the default icon with an `<ion-spinner>` when the async state is true. Ensure the `<ion-spinner>` has the `slot="icon-only"` attribute to maintain proper alignment during loading.