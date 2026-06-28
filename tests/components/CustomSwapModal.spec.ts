import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('custom swap modal facility stock labels', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/swaps/CustomSwapModal.vue'), 'utf8');

  it('labels substitute and search stock as facility-scoped inventory', () => {
    expect(source).toContain("import { useSeedStore } from '@/store/seed';");
    expect(source).toContain('seedStore.facilityName(props.facilityId)');
    expect(source).toContain('function facilityStockLabel');
    expect(source).toContain("translate('Available at {facility}: {count}'");
    expect(source).toContain("translate('Available: {count}'");
    expect(source).toContain('facilityStockLabel(getSubstituteStock(product.productId)?.computedAtp)');
    expect(source).toContain('facilityStockLabel(product.inventoryConfig?.computedLastInventoryCount)');
    expect(source).not.toContain('<ion-note slot="end">{{ getSubstituteStock(product.productId)?.computedAtp ?? 0 }}</ion-note>');
    expect(source).not.toContain('<ion-note slot="end">{{ product.inventoryConfig?.computedLastInventoryCount ?? 0 }}</ion-note>');
  });

  it('keeps the existing Ionic modal/list structure without grid layout', () => {
    expect(source).toContain('<ion-segment v-model="selectedSegment">');
    expect(source).toContain('<ion-list v-if="selectedSegment === \'substitute\'">');
    expect(source).toContain('<ion-list>');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
