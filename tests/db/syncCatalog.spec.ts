import { describe, expect, it } from 'vitest';
import { orderManagerDb } from '@/db/orderManagerDb';

describe('order manager seed declaration', () => {
  const names = orderManagerDb.statusCatalog.map((e) => e.name);

  it('syncs the shopify domains the order and create-order screens read', () => {
    expect(names).toContain('shopifyShop');
    expect(names).toContain('shopifyShopLocation');
  });

  it('syncs statusFlowTransition, which OrderDetail needs for status transitions', () => {
    expect(names).toContain('statusFlowTransition');
  });

  it('has no duplicate domain names or tables', () => {
    expect(new Set(names).size).toBe(names.length);
    const tables = orderManagerDb.statusCatalog.map((e) => e.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it('gives every entry a label for the Settings screen', () => {
    for (const entity of orderManagerDb.statusCatalog) {
      expect(entity.label, `missing label for ${entity.name}`).toBeTruthy();
    }
  });
});
