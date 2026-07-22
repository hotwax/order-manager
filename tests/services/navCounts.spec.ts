import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('nav-count priming', () => {
  const navCounts = read('src/services/navCounts.ts');
  const orderStore = read('src/store/order.ts');
  const orderTask = read('src/store/orderTask.ts');
  const funnel = read('src/views/Funnel.vue');
  const brokering = read('src/views/BrokeringQueue.vue');

  it('primes every blocked/brokering badge from the Funnel on landing', () => {
    expect(funnel).toContain('orderStore.primeNavCounts(productStoreId)');
    expect(orderStore).toContain('async primeNavCounts(');
    expect(orderStore).toContain("import { queueCountFetchers } from '@/services/navCounts'");
    for (const key of ['unfillable', 'brokering', 'hold', 'badAddress', 'swap', 'fraud']) {
      expect(navCounts).toContain(`${key}:`);
    }
  });

  it('counts each queue with the same query its page uses (no separate dashboard aggregate)', () => {
    // Order queues reuse the shared solr search; brokering reuses the shared facility set.
    expect(navCounts).toContain("import { searchOrders } from '@/services/order'");
    expect(navCounts).toContain("import { fetchBrokeringFacilityIds } from '@/utils/brokeringFacilities'");
    // Task queues reuse the shared, dependency-free task-queue constants.
    expect(navCounts).toContain("from '@/utils/taskQueues'");
    expect(orderTask).toContain("from '@/utils/taskQueues'");
    expect(navCounts).toContain("url: 'oms/orders/tasks'");
  });

  it('shares the brokering facility resolution between the page and the count', () => {
    expect(brokering).toContain("from '@/utils/brokeringFacilities'");
    expect(brokering).toContain('buildBrokeringFacilityOptions');
  });

  it('falls back to counting rows when the tasks endpoint omits x-total-count', () => {
    expect(navCounts).toContain('taskTotalFromHeaders');
    expect(navCounts).toContain('rows.length');
  });
});
