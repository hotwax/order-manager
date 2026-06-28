import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail item attributes', () => {
  it('keeps item attribute chips actionable when the item has no attributes yet', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');
    const detailRowStart = source.indexOf('class="order-item-detail-entry"');
    const detailRowEnd = source.indexOf('@attributes-click="openItemAttributesModal(item)"');
    const detailRowSource = source.slice(detailRowStart, detailRowEnd);

    expect(detailRowStart).toBeGreaterThan(-1);
    expect(detailRowEnd).toBeGreaterThan(detailRowStart);
    expect(detailRowSource).toContain(':attributes-label="attributeChipLabel(item.attributeCount)"');
    expect(detailRowSource).not.toContain(':attributes-disabled="!item.attributeCount"');
    expect(source).toContain('component: OrderItemAttributesModal');
    expect(source).toContain('await modal.onDidDismiss();');
    expect(source).toContain('await loadOrder(order.value.id, true);');
  });
});
