import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Entering the route waits for the geo dataset before listing tasks, so the cards can name a
 * country. That wait happens with an empty task store, and the template shows the "no addresses
 * to review" empty state whenever it is not loading — so the flag has to cover the prerequisite,
 * not just the task fetch, or a slow geo request reads as an empty queue.
 */
describe('bad address queue loading state', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/BadAddressOrders.vue'), 'utf8');
  const onEnter = source.slice(source.indexOf('onIonViewWillEnter(async () => {'), source.lastIndexOf('</script>'));

  it('raises the loading flag before awaiting the geo dataset', () => {
    expect(onEnter).toContain('await seedStore.loadGeos();');
    expect(onEnter.indexOf('loading.value = true')).toBeGreaterThan(-1);
    expect(onEnter.indexOf('loading.value = true')).toBeLessThan(onEnter.indexOf('await seedStore.loadGeos();'));
  });

  it('releases it even if the geo request fails, so the task fetch still runs', () => {
    expect(onEnter).toContain('} finally {');
    expect(onEnter.indexOf('} finally {')).toBeLessThan(onEnter.indexOf('await replaceAddressValidationTasks();'));
    expect(onEnter).toContain('if (showFullLoading) loading.value = false;');
  });

  // A revisit already has hydrated cards; blanking them behind a spinner to re-check geos would
  // be a step backwards from what the task fetch itself does.
  it('only takes over the page when there is nothing on it yet', () => {
    expect(onEnter).toContain('const showFullLoading = !addressValidationTasks.value.length;');
    expect(onEnter).toContain('if (showFullLoading) loading.value = true;');
  });

  it('keeps the empty state behind the loading branch in the template', () => {
    const spinner = source.indexOf('<div v-if="loading"');
    const emptyState = source.indexOf('<TaskQueueEmptyState');
    expect(spinner).toBeGreaterThan(-1);
    expect(spinner).toBeLessThan(emptyState);
    expect(source).toContain('v-if="!addressValidationTasks.length"');
  });
});
