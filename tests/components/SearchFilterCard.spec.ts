import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('search filter card layout', () => {
  it('uses the Figma searchbar plus equal-width filter row pattern', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/common/SearchFilterCard.vue'), 'utf8');

    expect(source).toContain('class="search-filter-card-content"');
    expect(source).toContain('class="search-filter-row"');
    expect(source).toContain('class="search-filter-controls"');
    expect(source).toContain('class="search-filter-clear"');
    expect(source).toContain('padding: var(--spacer-sm);');
    expect(source).toContain('gap: var(--spacer-sm);');
    expect(source).toContain('.search-filter-controls :slotted(*)');
    expect(source).toContain('flex: 1 1 220px;');
    expect(source).toContain('.search-filter-controls :slotted(.date-filter-select)');
    expect(source).toContain('flex: 0 0 11rem;');
    expect(source).not.toContain('search-filter-grid');
    expect(source).not.toContain('grid-template-columns');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
