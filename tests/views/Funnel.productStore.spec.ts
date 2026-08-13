import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Funnel product store scope', () => {
  const funnelSource = readFileSync(resolve(process.cwd(), 'src/views/Funnel.vue'), 'utf8');
  const customerServiceSource = readFileSync(resolve(process.cwd(), 'src/store/customerService.ts'), 'utf8');
  const openOrdersSource = readFileSync(resolve(process.cwd(), 'src/views/OpenOrders.vue'), 'utf8');
  const packedOrdersSource = readFileSync(resolve(process.cwd(), 'src/views/PackedOrders.vue'), 'utf8');

  it('uses the Settings product store instead of rendering a second product store selector', () => {
    expect(funnelSource).toContain('currentProductStore');
    expect(funnelSource).toContain('selectedProductStoreId');
    expect(funnelSource).not.toContain('RadioFacetGroup');
    expect(funnelSource).not.toContain('selectedStoreId');
    expect(funnelSource).not.toContain('storeOptions');
  });

  it('does not pass product store through route query because queues read the shared setting', () => {
    expect(funnelSource).not.toContain('productStoreId: selectedProductStoreId.value');
    expect(funnelSource).not.toContain('route.query.productStoreId');
  });

  it('shows the full Unfillable queue on the dashboard card, not a today-scoped count', () => {
    // Only the top fulfillment-progress banner is day-scoped; the queue-count cards
    // (including Unfillable) show the full queue and link through unfiltered.
    expect(funnelSource).toContain('router-link="/unfillable"');
    expect(funnelSource).not.toContain("query: { dateFrom: todayDateStr }");
    expect(funnelSource).not.toContain("import { getDashboardDateFilter } from '@/utils/dashboardDate';");
  });

  it('does not keep static fallback facilities in the customer service store', () => {
    expect(customerServiceSource).not.toContain('const FACILITIES');
    expect(customerServiceSource).not.toContain('facilities: () => FACILITIES');
  });

  it('scopes the facility list to order volume only', () => {
    expect(funnelSource).toContain('store.fetchFacilityOrderVolume(productStoreId)');
    expect(funnelSource).toContain('facilityOrderVolume.value.map');
    expect(funnelSource).not.toContain('ion-segment');
    expect(funnelSource).not.toContain('selectedDimension');
    expect(funnelSource).not.toContain('facilityFulfillmentVelocity');
    expect(funnelSource).not.toContain('facilityRejections');
  });

  it('keeps workflow order pages scoped to the Settings product store', () => {
    for (const source of [openOrdersSource, packedOrdersSource]) {
      expect(source).toContain("import { useProductStore } from '@/store/productStore'");
      expect(source).toContain('selectedProductStoreId');
      expect(source).toContain('filters.value.productStoreId = selectedProductStoreId.value');
      expect(source).toContain('watch(selectedProductStoreId');
    }
  });
});
