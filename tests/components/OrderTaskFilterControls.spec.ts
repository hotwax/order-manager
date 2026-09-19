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

  it('uses shared outlined Ionic selects across task queues', () => {
    const fraudOrders = readFileSync(resolve(process.cwd(), 'src/views/FraudOrders.vue'), 'utf8');
    const holdOrders = readFileSync(resolve(process.cwd(), 'src/views/HoldOrders.vue'), 'utf8');
    const badAddressOrders = readFileSync(resolve(process.cwd(), 'src/views/BadAddressOrders.vue'), 'utf8');
    const swapOrders = readFileSync(resolve(process.cwd(), 'src/views/SwapOrders.vue'), 'utf8');

    // 7 = purpose, sales channel, facility, shipping method, order status, risk
    // recommendation, risk level. The date filters use DateFilterSelect instead.
    expect(filterSource.match(/<ion-select(?:\s|>)/g)?.length).toBe(7);
    expect(filterSource.match(/fill="outline"/g)?.length).toBe(7);
    expect(filterSource.match(/<DateFilterSelect/g)?.length).toBe(4);
    expect(filterSource.match(/ outlined/g)?.length).toBe(4);
    expect(fraudOrders).toContain('show-fraud-filters');
    expect(holdOrders).toContain('show-ship-group-filters');
    expect(badAddressOrders).toContain('show-ship-group-filters');
    expect(swapOrders).toContain('show-ship-group-filters');
    expect(`${filterSource}\n${fraudOrders}\n${holdOrders}\n${badAddressOrders}\n${swapOrders}`).not.toContain('ion-grid');
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
