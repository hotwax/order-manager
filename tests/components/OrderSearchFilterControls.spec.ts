import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order search and filter controls', () => {
  const workflowFilterSource = readFileSync(
    resolve(process.cwd(), 'src/components/orders/WorkflowOrderFilterCard.vue'),
    'utf8'
  );
  const sortSource = readFileSync(
    resolve(process.cwd(), 'src/components/orders/OrderSortPopover.vue'),
    'utf8'
  );
  const findOrderSource = readFileSync(resolve(process.cwd(), 'src/views/OrderSearch.vue'), 'utf8');
  const queueSource = readFileSync(resolve(process.cwd(), 'src/components/OrderQueueList.vue'), 'utf8');
  const uniformLayoutSource = readFileSync(
    resolve(process.cwd(), 'src/components/common/UniformFilterLayout.vue'),
    'utf8'
  );
  const workflowPages = ['OpenOrders.vue', 'InflightOrders.vue', 'PackedOrders.vue'].map((file) =>
    readFileSync(resolve(process.cwd(), 'src/views', file), 'utf8')
  );

  it('keeps customer-name filtering out of the workflow-page UI and request model', () => {
    expect(workflowFilterSource).not.toContain('Customer name');
    expect(workflowFilterSource).not.toContain('customerName');
    workflowPages.forEach((source) => {
      expect(source).toContain('<WorkflowOrderFilterCard');
      expect(source).not.toContain('filters.customerName');
    });
  });

  it('uses the shared sort popover in every list header', () => {
    expect(sortSource).toContain('<ion-radio-group');
    expect(sortSource).toContain("{ label: 'Oldest first', value: 'orderDate asc' }");
    expect(findOrderSource).toContain('<OrderSortPopover');
    workflowPages.forEach((source) => expect(source).toContain('<OrderSortPopover'));
  });

  it('replaces contradictory Find Order toggles with one allocation-state selector', () => {
    expect(findOrderSource).toContain('v-model="searchFilters.allocationState"');
    expect(findOrderSource).toContain('<ion-select-option value="Archived">');
    expect(findOrderSource).not.toContain('v-model="searchFilters.hasVirtualFacilityItems"');
    expect(findOrderSource).not.toContain('v-model="searchFilters.archivedOnly"');
  });

  it('keeps shared filters in the canonical cross-page sequence', () => {
    expectInOrder(findOrderSource, [
      'Status',
      'label="Allocation state"',
      'label="Sales channel"',
      'label="Shipping method"',
      "translate('Order date from')",
      "translate('Order date through')",
    ]);
    expectInOrder(queueSource, [
      'label="Sales channel"',
      '<slot name="filters" />',
      'label="Shipping method"',
      "translate('Order date from')",
      "translate('Order date through')",
    ]);
    expectInOrder(workflowFilterSource, [
      'label="Priority"',
      'label="Sales channel"',
      'label="Facility"',
      'label="Shipping method"',
      "translate('Order date from')",
      "translate('Order date through')",
    ]);
  });

  it('uses one sales-channel label and default value on every page', () => {
    [findOrderSource, queueSource, workflowFilterSource].forEach((source) => {
      expect(source).toContain('label="Sales channel"');
      expect(source).toContain('<ion-select-option value="All">All channels</ion-select-option>');
      expect(source).not.toContain('label="Channel"');
      expect(source).not.toContain('All sales channels');
    });
  });

  it('uses outlined controls, equal grid tracks, and a separate clear action', () => {
    [findOrderSource, queueSource, workflowFilterSource].forEach((source) => {
      expect(source).toContain('<UniformFilterLayout');
      expect(source).toContain('fill="outline"');
      expect(source).toContain(':show-clear="false"');
    });
    expect(uniformLayoutSource).toContain('grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr))');
    expect(uniformLayoutSource).toContain("translate('Clear filters')");
    expect(uniformLayoutSource).toContain('align-self: flex-end');
  });
});

function expectInOrder(source: string, markers: string[]) {
  let previousIndex = -1;
  markers.forEach((marker) => {
    const currentIndex = source.indexOf(marker);
    expect(currentIndex, `Missing sequence marker: ${marker}`).toBeGreaterThan(-1);
    expect(currentIndex, `Out-of-sequence marker: ${marker}`).toBeGreaterThan(previousIndex);
    previousIndex = currentIndex;
  });
}
