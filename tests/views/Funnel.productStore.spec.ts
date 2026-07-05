import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Funnel product store scope', () => {
  const funnelSource = readFileSync(resolve(process.cwd(), 'src/views/Funnel.vue'), 'utf8');
  const customerServiceSource = readFileSync(resolve(process.cwd(), 'src/store/customerService.ts'), 'utf8');
  const workflowOrderListSource = readFileSync(resolve(process.cwd(), 'src/components/orders/WorkflowOrderList.vue'), 'utf8');
  const openOrdersSource = readFileSync(resolve(process.cwd(), 'src/views/OpenOrders.vue'), 'utf8');

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

  it('does not keep static fallback facilities in the customer service store', () => {
    expect(customerServiceSource).not.toContain('const FACILITIES');
    expect(customerServiceSource).not.toContain('facilities: () => FACILITIES');
  });

  it('keeps workflow order pages scoped to the Settings product store', () => {
    for (const source of [workflowOrderListSource, openOrdersSource]) {
      expect(source).toContain("import { useProductStore } from '@/store/productStore'");
      expect(source).toContain('selectedProductStoreId');
      expect(source).toContain('filters.value.productStoreId = selectedProductStoreId.value');
      expect(source).toContain('watch(selectedProductStoreId');
    }
  });
});
