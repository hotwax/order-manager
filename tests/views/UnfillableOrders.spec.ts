import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('UnfillableOrders', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/UnfillableOrders.vue'), 'utf8');

  it('enables the selected-order brokering action for the unfillable queue', () => {
    expect(source).toContain(':facility-ids="[\'UNFILLABLE_PARKING\']"');
    expect(source).toContain(':global-actions="[\'brokerSelected\']"');
  });

  it('passes both route date bounds into the queue list', () => {
    // The funnel's Unfillable card deep-links into a single order date, so the
    // page has to seed the through bound as well as the from bound.
    expect(source).toContain(':date-from="dateFrom"');
    expect(source).toContain(':date-thru="dateThru"');
    expect(source).toContain('router.currentRoute.value.query[name]');
    expect(source).toContain("const dateFrom = queryDate('dateFrom');");
    expect(source).toContain("const dateThru = queryDate('dateThru');");
  });
});
