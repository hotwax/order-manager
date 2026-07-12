import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const readView = (name: string) => readFileSync(resolve(process.cwd(), `src/views/${name}.vue`), 'utf8');

describe('Brokered Funnel date navigation', () => {
  it('adds the Funnel date to each brokered queue link', () => {
    const source = readView('Funnel');

    expect(source).toContain("{ path: '/open', query: { dateFrom: todayDateStr } }");
    expect(source).toContain("{ path: '/inflight', query: { dateFrom: todayDateStr } }");
    expect(source).toContain("{ path: '/packed', query: { dateFrom: todayDateStr } }");
  });

  it.each(['OpenOrders', 'InflightOrders', 'PackedOrders'])('%s reapplies route filters when its cached Ionic view becomes active', (view) => {
    const source = readView(view);

    expect(source).toContain('const dateFrom = router.currentRoute.value.query.dateFrom;');
    expect(source).toContain('filters.value.dateFrom = dateFrom;');
    expect(source).toContain('onIonViewWillEnter(applyRouteFilters);');
    expect(source).not.toContain('const route = router.currentRoute.value;');
  });
});
