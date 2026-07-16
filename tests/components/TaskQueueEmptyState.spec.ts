import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('TaskQueueEmptyState', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/tasks/TaskQueueEmptyState.vue'), 'utf8');

  it('distinguishes filtered results from queue onboarding', () => {
    expect(source).toContain("props.filtered ? 'No matching tasks'");
    expect(source).toContain("translate('Clear filters')");
    expect(source).toContain("emit('clear')");
  });

  it('provides truthful queue-specific setup guidance', () => {
    expect(source).toContain('FedEx through Unigate is currently supported.');
    expect(source).toContain('risk recommends Investigate');
    expect(source).toContain("order\\'s Holds tab");
    expect(source).toContain("kind === 'hold' && canCreateTasks");
    expect(source).toContain("kind === 'badAddress' && companyCarrierUrl");
  });

  it('links only to official Shopify fraud resources', () => {
    expect(source).toContain('https://help.shopify.com/en/manual/fulfillment/managing-orders/protecting-orders/fraud-analysis');
    expect(source).toContain('https://help.shopify.com/en/manual/fulfillment/managing-orders/protecting-orders/shopify-flow');
    expect(source).toContain('https://help.shopify.com/en/manual/shopify-flow/reference/actions/create-order-risk-assessment');
    expect(source).toContain('rel="noopener noreferrer"');
  });
});
