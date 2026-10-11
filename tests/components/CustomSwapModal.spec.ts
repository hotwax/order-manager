import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('custom swap modal facility stock labels', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/swaps/CustomSwapModal.vue'), 'utf8');

  it('labels substitute and search stock as facility-scoped inventory', () => {
    expect(source).toContain("import { useSeedStore } from '@/store/seed';");
    expect(source).toContain('seedStore.facilityName(props.facilityId)');
    expect(source).toContain('seedStore.loadFacilities()');
    expect(source).toContain('function facilityStockLabel');
    expect(source).toContain("translate('Available at {facility}: {count}'");
    expect(source).toContain("translate('Available: {count}'");
    expect(source).toContain('facilityStockLabel(getSubstituteStock(product.productId)?.computedAtp)');
    expect(source).toContain('facilityStockLabel(product.inventoryConfig?.computedLastInventoryCount)');
    expect(source).not.toContain('<ion-note slot="end">{{ getSubstituteStock(product.productId)?.computedAtp ?? 0 }}</ion-note>');
    expect(source).not.toContain('<ion-note slot="end">{{ product.inventoryConfig?.computedLastInventoryCount ?? 0 }}</ion-note>');
  });

  it('seeds Product Search from the provided product context', () => {
    expect(source).toContain('defaultSearchKeyword?: string;');
    expect(source).toContain("const searchKeyword = ref((props.defaultSearchKeyword ?? '').trim());");
    expect(source).toContain('if (searchKeyword.value.trim()) await searchProducts(0, false);');
    expect(source).toContain("keyword: searchKeyword.value.trim()");
  });

  it('keeps the existing Ionic modal/list structure without grid layout', () => {
    expect(source).toContain('<ion-segment v-model="selectedSegment">');
    expect(source).toContain('<ion-list v-if="selectedSegment === \'substitute\'">');
    expect(source).toContain('<ion-list>');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });

  it('single-selects search results with a radio group whose whole row is the tap target', () => {
    expect(source).toContain('<ion-radio-group v-else v-model="selectedProductId">');
    expect(source).toContain('@click="selectSearchProduct(product)"');
    expect(source).toContain('<ion-radio slot="start" :value="product.productId"');
    expect(source).toContain('function selectSearchProduct');
    // the entire ion-item row selects, not just the small radio control
    expect(source).toContain('@click="selectSubstituteProduct(product.productId)"');
    // the old ad-hoc single-select checkmark pattern is gone
    expect(source).not.toContain('checkmarkCircle');
    expect(source).not.toContain('@click="hasSearchStock(product) && selectProduct(toSubstituteShape(product))"');
  });

  it('live-filters the approved-swaps list from a toolbar searchbar', () => {
    expect(source).toContain('v-model="substituteKeyword"');
    expect(source).toContain('const filteredSubstitutes = computed(');
    expect(source).toContain('v-for="product in filteredSubstitutes"');
    expect(source).toContain("translate('No substitute products match your search.')");
  });
});
