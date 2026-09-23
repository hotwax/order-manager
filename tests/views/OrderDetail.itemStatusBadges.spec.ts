import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail item status badges', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');
  const rowSource = readFileSync(resolve(process.cwd(), 'src/components/orders/OrderItemListRow.vue'), 'utf8');

  it('names an item state from the item status, never from the ship group timeline', () => {
    expect(source).toContain('const status = seed.statusDescription(statusId);');
    expect(source).toContain('const statusColor = commonUtil.getStatusColor(statusId);');
    // A group's fulfillment progress belongs to the lifecycle strip, not to an item's badge.
    expect(source).not.toContain('fulfillmentLineStatus');
  });

  it('hands every row a list of states instead of one label and colour', () => {
    expect(source).toContain(':statuses="soleItem.statuses"');
    expect(source).toContain(':statuses="group.statuses"');
    expect(source).toContain(':statuses="item.statuses"');
    expect(source).not.toContain(':status-label=');
    expect(source).not.toContain(':status-color=');
  });

  it('rolls a product group up into one badge per status instead of a joined label', () => {
    expect(source).toContain('group.statuses = rollUpItemStatuses(group.items);');
    expect(source).not.toContain("statuses.join(' / ')");
  });

  it('gives a single line its own state with no roll-up count', () => {
    expect(source).toContain("statuses: status ? [{ label: status, color: statusColor }] : [],");
  });

  it('renders a badge per state and counts units only where a row rolls items up', () => {
    expect(rowSource).toContain('v-for="status in statuses"');
    expect(rowSource).toContain('return status.count == undefined ? status.label : `${status.count} ${status.label}`;');
  });
});
