import { describe, expect, it } from 'vitest';
import { ORDER_MANAGER_SYNC_CATALOG } from '@/config/appSyncConfig';

describe('order manager sync catalog', () => {
  const names = ORDER_MANAGER_SYNC_CATALOG.map((d) => d.name);

  it('syncs the shopify domains the order and create-order screens read', () => {
    expect(names).toContain('shopifyShop');
    expect(names).toContain('shopifyShopLocation');
  });

  it('has no duplicate domain names or tables', () => {
    expect(new Set(names).size).toBe(names.length);
    const tables = ORDER_MANAGER_SYNC_CATALOG.map((d) => d.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it('gives every entry a label for the Settings screen', () => {
    for (const entry of ORDER_MANAGER_SYNC_CATALOG) {
      expect(entry.label, `missing label for ${entry.name}`).toBeTruthy();
    }
  });
});
