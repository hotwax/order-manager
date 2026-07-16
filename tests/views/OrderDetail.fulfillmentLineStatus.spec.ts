import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail fulfillment line statuses', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

  it('derives item fulfillment state from the item ship-group timeline', () => {
    expect(source).toContain('fulfillmentLineStatus(timelineByShipGroup.value[sg.id])');
    expect(source).toContain(':status-label="item.status"');
    expect(source).toContain(':status-color="item.statusColor"');
  });

  it('uses the derived fulfillment state on product rollup rows', () => {
    expect(source).toContain(':status-label="group.status"');
    expect(source).toContain(':status-color="group.statusColor"');
    expect(source).toContain("group.status = statuses.join(' / ')");
  });
});
