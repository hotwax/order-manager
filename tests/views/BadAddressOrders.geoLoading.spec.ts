import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * The template shows the "no addresses to review" empty state whenever it is not loading, so the
 * spinner branch has to come first or a slow task fetch looks like an empty queue.
 */
describe('bad address queue loading state', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/BadAddressOrders.vue'), 'utf8');

  it('keeps the empty state behind the loading branch in the template', () => {
    const spinner = source.indexOf('<div v-if="loading"');
    const emptyState = source.indexOf('<TaskQueueEmptyState');
    expect(spinner).toBeGreaterThan(-1);
    expect(spinner).toBeLessThan(emptyState);
    expect(source).toContain('v-if="!addressValidationTasks.length"');
  });
});
