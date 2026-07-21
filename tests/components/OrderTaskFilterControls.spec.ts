import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order task filter controls', () => {
  const filterSource = readFileSync(resolve(process.cwd(), 'src/components/tasks/OrderTaskFilterCard.vue'), 'utf8');
  const headerSource = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskQueueListHeader.vue'), 'utf8');

  it('keeps common filters first and appends conditional page fields', () => {
    expectInOrder(filterSource, [
      "translate('Sales channel')",
      "translate('Order date from')",
      "translate('Order date through')",
      "translate('Task created from')",
      "translate('Task created through')",
      'showShipGroupFilters',
      "translate('Facility')",
      "translate('Shipping method')",
      'showFraudFilters',
      "translate('Order status')",
      "translate('Risk recommendation')",
      "translate('Risk level')",
    ]);
    expect(filterSource).toContain('fill="outline"');
    expect(filterSource).not.toContain('<ion-grid');
  });

  it('shows total, sort, and selection in one Ionic list header', () => {
    expect(headerSource).toContain('<ion-list-header>');
    expectInOrder(headerSource, ['<ion-checkbox', '<ion-label>', '<OrderSortPopover', '<ion-button']);
    expect(headerSource).toContain("translate('Select all loaded tasks')");
    expect(headerSource).not.toContain('<style');
  });
});

function expectInOrder(source: string, markers: string[]) {
  let previous = -1;
  markers.forEach((marker) => {
    const index = source.indexOf(marker);
    expect(index, `Missing marker: ${marker}`).toBeGreaterThan(-1);
    expect(index, `Out-of-order marker: ${marker}`).toBeGreaterThan(previous);
    previous = index;
  });
}
