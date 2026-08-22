import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('product master selectable features', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/composables/useProductMaster.ts'), 'utf8');
  const db = readFileSync(resolve(process.cwd(), 'src/services/productDb.ts'), 'utf8');

  it('asks Solr for productFeatures and caches the field', () => {
    expect(source).toContain('goodIdentifications mainImageUrl productFeatures');
    expect(source).toContain('productFeatures: Array.isArray(doc.productFeatures) ? doc.productFeatures : [],');
    expect(db).toContain('productFeatures: string[];');
  });

  it('refetches a product cached before the field existed, instead of stranding it', () => {
    // The cache never refetches a hit, so a record persisted without the key would never
    // gain features. A missing key is a miss; an empty array is a real answer.
    expect(source).toContain('return !!product && "productFeatures" in product;');
    expect(source).toContain('.filter((id) => !isFullyCached(cache.getProduct(id)));');
    expect(source).toContain('if (isFullyCached(existing) && !opts?.refresh)');
  });
});
