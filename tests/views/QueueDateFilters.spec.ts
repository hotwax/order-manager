import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('task queue date filters', () => {
  it('uses one shared outlined filter card on all four task queues', () => {
    const filterCard = readFileSync(resolve(process.cwd(), 'src/components/tasks/OrderTaskFilterCard.vue'), 'utf8');
    const queueSources = ['HoldOrders.vue', 'BadAddressOrders.vue', 'SwapOrders.vue', 'FraudOrders.vue']
      .map((file) => readFileSync(resolve(process.cwd(), 'src/views', file), 'utf8'));

    expect(filterCard).toContain("translate('Order date from')");
    expect(filterCard).toContain("translate('Order date through')");
    expect(filterCard).toContain("translate('Task created from')");
    expect(filterCard).toContain("translate('Task created through')");
    expect((filterCard.match(/outlined/g) ?? []).length).toBeGreaterThanOrEqual(4);

    queueSources.forEach((source) => {
      expect(source).toContain('<OrderTaskFilterCard');
      expect(source).toContain('buildTaskQueueRequest(');
      expect(source).not.toContain('currentUserPartyId');
      expect(source).not.toContain("orderName_op: 'like'");
    });
  });
});
