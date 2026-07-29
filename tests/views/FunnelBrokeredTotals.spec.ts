import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Funnel Brokered workload totals', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/Funnel.vue'), 'utf8');

  it('uses the total counts returned by the Open, Inflight, and Packed workflow APIs', () => {
    expect(source).toContain('const workload = await fetchWorkflowOrderTotals(productStoreId)');
    expect(source).toContain('requestGeneration !== brokeredWorkloadRequestGeneration');
    expect(source).toContain('brokeredWorkload.value.open + brokeredWorkload.value.inflight + brokeredWorkload.value.packed');
    expect(source).toContain('formatCount(brokeredWorkload.open)');
    expect(source).toContain('formatCount(brokeredWorkload.inflight)');
    expect(source).toContain('formatCount(brokeredWorkload.packed)');
  });

  it('navigates to the unfiltered operational queues', () => {
    expect(source).toContain(`:href="dashboardRoute('/open').href"`);
    expect(source).toContain(`:href="dashboardRoute('/inflight').href"`);
    expect(source).toContain(`:href="dashboardRoute('/packed').href"`);
    expect(source).toContain(`:href="unfillableError ? undefined : dashboardRoute('/unfillable').href"`);
    expect(source).not.toContain('router-link=');
    expect(source).not.toContain("{ path: '/open', query: { dateFrom: todayDateStr } }");
    expect(source).not.toContain("{ path: '/inflight', query: { dateFrom: todayDateStr } }");
    expect(source).not.toContain("{ path: '/packed', query: { dateFrom: todayDateStr } }");
  });

  it('keeps the selected facility while refreshed metric rows are still loading', () => {
    expect(source).toContain('watch([filteredFacilities, facilityMetricsLoading]');
    expect(source).toContain('} else if (!isLoading) {');
    expect(source).toContain('store.clearFacilityDashboardData();');
  });
});
