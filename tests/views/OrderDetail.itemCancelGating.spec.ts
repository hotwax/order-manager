import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Restoring the row's action slot made both per-item Cancel buttons live again. A button that
 * only skips terminal items still offers a cancellation the validator refuses — on a terminal
 * order, against the store's cancelAllowedWhen policy, or with no ITEM_CANCELLED edge in the
 * seed transition table. Both call sites and the handler read the validator instead.
 */
describe('order detail per-item cancel gating', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

  // Scoped to the item list: whole-order cancel collects its own items elsewhere and is gated
  // by the footer validator, so it keeps its own terminal filter.
  const itemList = source.slice(source.indexOf('<template #actions>'), source.indexOf('</ion-accordion-group>'));

  it('gates both Cancel buttons on the validator, not on the item status alone', () => {
    expect(itemList).toContain('v-if="isItemCancelAllowed(soleItem)"');
    expect(itemList).toContain('v-if="isItemCancelAllowed(item)"');
    expect(itemList).not.toContain("ITEM_CANCELLED', 'ITEM_COMPLETED'].includes(soleItem.statusId)");
    expect(itemList).not.toContain("ITEM_CANCELLED', 'ITEM_COMPLETED'].includes(item.statusId)");
  });

  it('asks the same validator the action runs, with the row's own item context', () => {
    expect(source).toContain("OrderActionValidator.validateItemAction(order.value, item, 'CANCEL_ITEM', itemActionContext(item))");
  });

  // A row rendered before a refresh moved the item or the order on would otherwise cancel
  // straight past the validator.
  it('re-validates inside cancelSingleItem and reports the refusal instead of cancelling', () => {
    const handler = source.slice(
      source.indexOf('async function cancelSingleItem'),
      source.indexOf('async function viewInventory')
    );
    expect(handler).toContain('const validation = itemCancelValidation(item);');
    expect(handler).toContain('await showUnavailableAction(validation);');
    expect(handler.indexOf('itemCancelValidation')).toBeLessThan(handler.indexOf('alertController.create'));
  });
});
