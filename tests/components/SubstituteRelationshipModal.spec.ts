import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('SubstituteRelationshipModal', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/swaps/SubstituteRelationshipModal.vue'), 'utf8');

  it('loads existing substitutes as selected products', () => {
    expect(source).toContain('await fetchActiveSubstitutes(props.productId)');
    expect(source).toContain('initialIds.value = new Set');
    expect(source).toContain('selectedById.value = Object.fromEntries');
  });

  it('pins every selected product in a chip row above search', () => {
    const chips = source.indexOf('<ion-chip v-for="product in selectedProducts"');
    const search = source.indexOf('<ion-searchbar');
    expect(chips).toBeGreaterThan(0);
    expect(search).toBeGreaterThan(chips);
    expect(source).toContain('removeSelected(product.productId)');
  });

  it('persists additions and removals from one save action', () => {
    expect(source).toContain('createSubstituteAssociation(props.productId, productId)');
    expect(source).toContain('expireSubstituteAssociation(props.productId, existingById.value[productId])');
    expect(source).toContain('<ion-fab vertical="bottom" horizontal="end" slot="fixed">');
  });
});
