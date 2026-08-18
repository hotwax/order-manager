/**
 * Cancel and return are applied in the OMS but do not propagate back to Shopify yet, so
 * every entry point for them is hidden app-wide until that sync exists — otherwise an
 * operator can put the two systems out of step in one click.
 *
 * Set to `false` to bring all of them back at once. Covers:
 *  - the order detail footer's "Cancel N items" and "Return" (OrderActionValidator)
 *  - "Cancel open items" on the queue pages (OrderQueueList) and Find order (OrderSearch)
 *  - the bulk `cancel` action on the workflow queues (BULK_ACTIONS in the store)
 *  - bulk "Cancel orders" on the swap, fraud and bad-address task queues
 *  - the per-card "Cancel order" button on the swap, fraud and bad-address task cards
 *
 * Two cancels are deliberately still reachable:
 *  - Whole-order "Cancel order" on the detail footer. That button morphs with the item
 *    selection, so suppressing the bulk half simply lets it fall through.
 *  - "Cancel item" in the swap suggestion popover, which is how a swap decision is
 *    composed rather than a standalone cancel; removing it would break the swap queue.
 */
export const HIDE_SHOPIFY_UNSYNCED_ACTIONS = true;
