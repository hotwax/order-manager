import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Packed orders scan layout', () => {
  const packedOrdersSource = readFileSync(resolve(process.cwd(), 'src/views/PackedOrders.vue'), 'utf8');

  it('renders packed rows through the page-owned scan layout instead of the generic workflow list', () => {
    expect(packedOrdersSource).not.toContain('WorkflowOrderList');
    expect(packedOrdersSource).toContain('row-class="packed-order-row"');
    expect(packedOrdersSource).toContain('--columns-desktop: 5');
    expect(packedOrdersSource).toContain('--columns-tablet: 5');
  });

  it('uses the standardized enriched order row instead of packed-only duplicate fields', () => {
    expect(packedOrdersSource).toContain(':model="orderRow(order)"');
    expect(packedOrdersSource).toContain('toWorkflowOrderRowViewModel(order, orderStore.workflowEnrichment(bucket, order.orderId))');
    expect(packedOrdersSource).not.toContain('shipmentContextLabel(order)');
  });

  it('keeps selection mode, bulk actions, and infinite scroll wired to the packed bucket', () => {
    expect(packedOrdersSource).toContain("const bucket = 'packed'");
    expect(packedOrdersSource).toContain('toggleCurrentPageSelection($event.detail.checked)');
    expect(packedOrdersSource).toContain('setOrderSelection(order.orderId, $event)');
    expect(packedOrdersSource).toContain('store.runBulkAction(bucket, action.id)');
    expect(packedOrdersSource).toContain('orderStore.loadMoreWorkflowOrders(bucket, filters.value)');
  });
});
