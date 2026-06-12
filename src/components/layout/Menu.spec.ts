import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order manager menu', () => {
  it('links the blocked unfillable queue to the unfillable route', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');

    expect(source).toContain('router-link="/unfillable"');
    expect(source).toContain('translate("Unfillable")');
    expect(source).not.toContain('router-link="/swap" router-direction="root"');
  });

  it('groups searchable records under the Figma Find section', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');
    const findDivider = source.indexOf('translate("Find")');
    const ordersItem = source.indexOf('router-link="/orders"');
    const customersItem = source.indexOf('router-link="/customers"');
    const settingsItem = source.indexOf('router-link="/settings"');

    expect(findDivider).toBeGreaterThan(source.indexOf('translate("In progress")'));
    expect(ordersItem).toBeGreaterThan(findDivider);
    expect(customersItem).toBeGreaterThan(ordersItem);
    expect(settingsItem).toBeGreaterThan(customersItem);
    expect(source).toContain('translate("Orders")');
    expect(source).toContain('translate("Customers")');
    expect(source).not.toContain('translate("Find order")');
    expect(source).not.toContain('translate("Find customers")');
  });

  it('renders Figma queue counts from existing dashboard and workflow stores', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Menu.vue'), 'utf8');

    expect(source).toContain('IonNote');
    expect(source).toContain('slot="end">{{ formatSwappableCount(menuCounts.unfillable) }}</ion-note>');
    expect(source).toContain('slot="end">{{ formatCount(menuCounts.badAddress) }}</ion-note>');
    expect(source).toContain('slot="end">{{ formatCount(menuCounts.fraud) }}</ion-note>');
    expect(source).toContain('slot="end">{{ formatCount(menuCounts.hold) }}</ion-note>');
    expect(source).toContain('slot="end">{{ formatCount(menuCounts.open) }}</ion-note>');
    expect(source).toContain('slot="end">{{ formatCount(menuCounts.inflight) }}</ion-note>');
    expect(source).toContain('slot="end">{{ formatCount(menuCounts.packed) }}</ion-note>');
    expect(source).toContain('customerServiceStore.unfillableTrend');
    expect(source).toContain('customerServiceStore.getHoldTasks');
    expect(source).toContain('customerServiceStore.getOpenOrders');
    expect(source).toContain("orderStore.fetchWorkflowOrders('open', menuCountFilters('open'))");
    expect(source).toContain("orderStore.fetchWorkflowOrders('inflight', menuCountFilters('inflight'))");
    expect(source).toContain("orderStore.fetchWorkflowOrders('packed', menuCountFilters('packed'))");
    expect(source).not.toContain('customerServiceStore.fetchUnfillable(productStoreId)');
    expect(source).not.toContain('customerServiceStore.fetchHoldTasks(productStoreId)');
    expect(source).not.toContain('customerServiceStore.fetchOpenOrders(productStoreId)');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
