import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(resolve(process.cwd(), `src/views/${file}`), 'utf8');

describe('task queue empty states', () => {
  it('guides bad-address setup through the Company app', () => {
    const page = source('BadAddressOrders.vue');
    expect(page).toContain('kind="badAddress"');
    expect(page).toContain("buildAppUrl('company', '/carriers')");
    expect(page).toContain('@clear="clearFilters"');
  });

  it('provides Shopify guidance for an empty fraud queue', () => {
    const page = source('FraudOrders.vue');
    expect(page).toContain('kind="fraud"');
    expect(page).toContain(':filtered="hasFilters"');
  });

  it('offers Find Order only through the task-creation permission', () => {
    const page = source('HoldOrders.vue');
    expect(page).toContain('kind="hold"');
    expect(page).toContain('userStore.hasPermission(ORDER_TASK_CREATE_PERMISSION)');
    expect(page).toContain("router.push('/orders')");
  });
});
