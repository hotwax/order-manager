## 2026-07-22 - Missing ARIA Labels on Ionic Modals
**Learning:** Found a widespread pattern across many modal components where `<ion-button>` elements containing only an `<ion-icon>` lacked `aria-label` attributes. This is a common accessibility trap in Ionic/Vue applications because visually the icon conveys the meaning (e.g. `closeOutline` for dismissing a modal, `trashOutline` for delete), but screen readers announce nothing useful for the button without the label.
**Action:** Always add `:aria-label="translate('[Action]')"` (e.g. 'Close', 'Delete', 'Options') to `<ion-button>` elements that rely solely on an `<ion-icon>` for their visual representation to ensure proper accessibility for screen reader users.

## 2024-07-23 - Add ARIA Labels to Icon-Only Buttons
**Learning:** Icon-only buttons (like `<ion-button>` and `<ion-fab-button>`) frequently miss `aria-label`s in this app, making them inaccessible to screen reader users because the purpose of the action is visually communicated only by an icon.
**Action:** When finding an icon-only button without visible text, always check for an `aria-label` (using the `translate()` function when possible for internationalization) to improve accessibility. Look specifically at `ion-fab-button`s, as they often just contain an icon.

## 2024-07-25 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found a widespread accessibility pattern in the application where icon-only `<ion-button>` elements containing `<ion-icon>` frequently lack `aria-label`s. This makes them inaccessible to screen readers, as the icon alone provides no semantic meaning.
**Action:** When working on UI components, actively scan for and add `:aria-label="translate('Action Name')"` to all icon-only buttons to ensure they remain accessible.
