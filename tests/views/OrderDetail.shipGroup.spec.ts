import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail ship group card', () => {
  it('uses measured collapsible sections without grid-row height animation', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('const vCollapsible = {');
    expect(source).toContain('v-collapsible class="ship-group-expanded-options"');
    expect(source).toContain('v-collapsible class="ship-group-summary-container"');
    expect(source).toContain('v-collapsible class="ship-group-card-details"');
    expect(source).toContain('--ship-group-collapsible-height');
    expect(source).toContain('new ResizeObserver(() => updateCollapsibleHeight(el))');
    expect(source).toContain('observer.observe(el);');
    expect(source).toContain('Array.from(el.children).forEach((child) => observer.observe(child));');
    expect(source).toContain('collapsibleObservers.get(el)?.disconnect();');
    expect(source).toContain('shipGroupHoldTask(shipGroup)');
    expect(source).toContain('shipGroupHoldTaskLabel(shipGroup)');
    expect(source).toContain("selectedSegment.value = 'holds'");
    expect(source).toContain('function shipGroupShippingContactMech(shipGroup: any)');
    expect(source).toContain('partyId,');
    expect(source).toContain('contactMechId,');
    expect(source).toContain('warningOutline');
    expect(source).toContain('trashOutline');
    expect(source).toContain("translate('View details')");
    expect(source).toContain("translate('Clear gift message')");
    expect(source).toContain('@click.stop="clearGiftMessage(shipGroup)"');
    expect(source).toContain('await updateShipGroup(shipGroup.id, { giftMessage: null });');
    expect(source).toContain("`${translate('Hold task')}: ${taskName}`");
    expect(source).toContain("defaultItemStatusId: defaultAddedItemStatusId(shipGroup)");
    expect(source).toContain("requiresFulfillmentReview: requiresAddItemFulfillmentReview(shipGroup)");
    expect(source).toContain("statusId: 'ITEM_APPROVED'");
    expect(source).toContain("url: `oms/orders/${raw.orderId}/items/${item.orderItemSeqId}/status`");
    expect(source).toContain("translate('Approve')");
    expect(source).not.toContain('transition: grid-template-rows');
    expect(source).not.toContain('grid-template-rows: 0fr');
    expect(source).not.toContain('grid-template-rows: 1fr');
    expect(source).not.toContain('class="ship-group-options ion-padding-horizontal ion-padding-vertical"');
    expect(source).not.toContain('class="ship-group-selected-options ion-padding-horizontal ion-padding-top"');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
