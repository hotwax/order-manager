import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('nav-count priming', () => {
  const navCounts = read('src/services/navCounts.ts');
  const orderStore = read('src/store/order.ts');
  const customerService = read('src/store/customerService.ts');
  const funnel = read('src/views/Funnel.vue');
  const brokering = read('src/views/BrokeringQueue.vue');

  it('publishes the badges from the Funnel dashboard fetches, not separate menu calls', () => {
    // Unfillable + the hold-task purposes come from the customer-service fetches
    // the Funnel already runs on landing.
    expect(customerService).toContain("useOrderStore().setNavCount('unfillable'");
    expect(customerService).toContain('publishHoldTaskNavCounts');
    // badAddress/swap/fraud map off the hold-task breakdown; every other purpose
    // rolls up into hold, matching the Hold page's "no dedicated queue" population.
    for (const purpose of ['INVALID_ADDRESS', 'NEG_RES_REVIEW', 'REVIEW_RISK_ORDER']) {
      expect(customerService).toContain(purpose);
    }
    expect(customerService).toContain("DEDICATED_PURPOSE_NAV_KEYS[workEffortPurposeTypeId] ?? 'hold'");
  });

  it('keeps only brokering as a dedicated count (page uses distinct-order grouping)', () => {
    expect(navCounts).toContain('fetchBrokeringCount');
    expect(navCounts).toContain('brokering: fetchBrokeringCount');
    // the task-queue and unfillable fetchers were removed from the dedicated service
    expect(navCounts).not.toContain('oms/orders/tasks');
    expect(navCounts).not.toContain('fetchUnfillableCount');
    expect(navCounts).not.toContain('fetchHoldCount');
    expect(orderStore).toContain('async primeNavCounts(');
    expect(funnel).toContain('orderStore.primeNavCounts(productStoreId)');
  });

  it('shares the brokering facility resolution between the page and the count', () => {
    expect(navCounts).toContain("import { fetchBrokeringFacilityIds } from '@/utils/brokeringFacilities'");
    expect(brokering).toContain("from '@/utils/brokeringFacilities'");
    expect(brokering).toContain('buildBrokeringFacilityOptions');
  });
});
