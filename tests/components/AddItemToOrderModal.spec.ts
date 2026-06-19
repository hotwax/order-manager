import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('add item to order modal', () => {
  it('shows facility availability and forwards approved status for in-progress ship groups', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/orders/AddItemToOrderModal.vue'), 'utf8');

    expect(source).toContain("url: 'oms/productFacilities'");
    expect(source).toContain('normalizeFacilityRows({');
    expect(source).toContain('isInventoryUnavailable(product.productId)');
    expect(source).toContain('if (props.defaultItemStatusId) data.statusId = props.defaultItemStatusId;');
    expect(source).toContain("props.defaultItemStatusId === 'ITEM_APPROVED'");
    expect(source).toContain("translate('{quantity} available at {facility}')");
    expect(source).toContain("translate('No inventory record at {facility}')");
  });
});
