import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('swap queue standardization', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/SwapOrders.vue'), 'utf8');

  it('uses the shared filters and removes unsupported swappable filtering', () => {
    expect(source).toContain('<OrderTaskFilterCard');
    expect(source).toContain('show-ship-group-filters');
    expect(source).not.toContain('FilterToggle');
    expect(source).not.toContain('swappable');
    expect(source).not.toContain('currentUserPartyId');
  });

  it('adds the common result header and safe bulk actions', () => {
    expect(source).toContain('<TaskQueueListHeader');
    expect(source).toContain("singular-label=\"swap task\"");
    expect(source).toContain("translate('Cancel orders')");
    expect(source).toContain("translate('Park')");
    expect(source).toContain("Promise.allSettled");
    expect(source).not.toContain('bulkApplySwap');
  });
});
