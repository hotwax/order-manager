import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('OrderSearch result count', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/views/OrderSearch.vue'), 'utf8');

  it('labels the Find Order total as matching the active search and filters', () => {
    expect(source).toContain('translate("{loaded} of {total} matching orders"');
    expect(source).toContain('total: searchTotal');
    expect(source).toContain('const { searchQuery, searchFilters, searchSort, searchResults, searchTotal, loading, error, hasMore } = storeToRefs(orderStore)');
    expect(source).toContain('watch(searchFilters, () => {');
    expect(source).toContain('orderStore.runSearch();');
    expect(source).not.toContain('translate("{loaded} of {total} orders"');
  });
});
