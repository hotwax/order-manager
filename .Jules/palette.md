## 2024-07-25 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found a widespread accessibility pattern in the application where icon-only `<ion-button>` elements containing `<ion-icon>` frequently lack `aria-label`s. This makes them inaccessible to screen readers, as the icon alone provides no semantic meaning.
**Action:** When working on UI components, actively scan for and add `:aria-label="translate('Action Name')"` to all icon-only buttons to ensure they remain accessible.
