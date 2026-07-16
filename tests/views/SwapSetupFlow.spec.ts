import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Swap proactive setup flow', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/SwapOrders.vue'), 'utf8');

  it('shows filtered empty copy separately from proactive setup', () => {
    expect(source).toContain('!swapTasks.length && isSuccess && hasFilters');
    expect(source).toContain('<SwapSetupPanel');
    expect(source).toContain('@manage="openSubstituteModal"');
  });

  it('facets products, batches display enrichment, and gates relationship writes', () => {
    expect(source).toContain('fetchUnfillableProductCandidates(productStoreId)');
    expect(source).toContain('await productMaster.prefetch(candidates.map');
    expect(source).toContain('userStore.hasPermission(PRODUCT_ASSOCIATION_UPDATE_PERMISSION)');
  });

  it('rebrokers affected product ship groups through the existing task store action', () => {
    expect(source).toContain('fetchUnfillableShipGroupsForProduct(productStoreId, candidate.productId)');
    expect(source).toContain('orderTaskStore.brokerShipGroup({');
    expect(source).toContain('RoutingGroupModal');
  });
});
