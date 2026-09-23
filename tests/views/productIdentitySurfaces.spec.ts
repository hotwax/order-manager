import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * The operator picks how products are identified in Settings > Product identifier. A surface
 * that hardcodes productName or sku ignores that choice, which is how these four ended up
 * showing a different identifier than the rest of the app. Each now reads the preference
 * through useProductMaster's primaryId/secondaryId.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('product identity surfaces honour the preference', () => {
  it('swap substitute picker reads the preference for both lists', () => {
    const source = read('src/components/swaps/CustomSwapModal.vue');
    expect(source).toContain('const productMaster = useProductMaster();');
    // the substitute list and the search list, each with its own fallbacks
    expect(source).toContain('productMaster.primaryId(getProduct(product.productId) || product, [product.productName])');
    expect(source).toContain('productMaster.primaryId(getProduct(product.productId) || product, [product.parentProductName, product.productName])');
    expect(source).not.toContain('{{ getProduct(product.productId)?.productName || product.productName }}');
    expect(source).not.toContain('{{ product.parentProductName }}');
  });

  it('substitute relationship picker reads the preference', () => {
    const source = read('src/components/swaps/SubstituteRelationshipModal.vue');
    expect(source).toContain('return productMaster.primaryId(product, [');
    expect(source).toContain('productMaster.secondaryId(product, [product.sku, product.productId])');
    expect(source).not.toContain('return product.productName || product.parentProductName || product.internalName || product.productId;');
  });

  it('customer order history reads the preference', () => {
    const source = read('src/views/CustomerDetail.vue');
    expect(source).toContain('productMaster.primaryId(productCache.getProduct(item.productId) || item, [item.name, item.sku');
    expect(source).toContain('productMaster.secondaryId(productCache.getProduct(item.productId) || item, [item.sku])');
    expect(source).not.toContain("name: item.name || item.sku || 'Item',");
  });

  it('return items read the preference', () => {
    const source = read('src/views/ReturnDetail.vue');
    expect(source).toContain('return productMaster.primaryId(productCache.getProduct(item.productId) || item, [');
    expect(source).toContain('function itemSecondaryLabel(item: ReturnItemDetail)');
    expect(source).not.toContain('return item.productName || item.description || item.sku || item.productId || translate("Return item");');
  });

  it('caches every field the preference can point at, and heals records that predate them', () => {
    const master = read('src/composables/useProductMaster.ts');
    ['groupId', 'groupName', 'primaryProductCategoryName', 'title', 'goodIdentifications'].forEach((field) => {
      expect(master).toContain(field);
    });
    expect(master).toContain('CACHED_IDENTITY_KEYS.every((key) => key in product)');
    expect(read('src/services/productDb.ts')).toContain('primaryProductCategoryName: string;');
  });

  it('substitute picker keeps identity data through normalization', () => {
    const source = read('src/components/swaps/SubstituteRelationshipModal.vue');
    expect(source).toContain('goodIdentifications: product.goodIdentifications,');
    expect(source).toContain('title: product.title,');
  });

  // Without the caller-supplied fallbacks a custom line item, which has no catalog product,
  // would render an empty name once the preferred field came back blank.
  it('every call site passes its own fallbacks', () => {
    ['src/components/swaps/CustomSwapModal.vue',
     'src/components/swaps/SubstituteRelationshipModal.vue',
     'src/views/CustomerDetail.vue',
     'src/views/ReturnDetail.vue'].forEach((path) => {
      const source = read(path);
      const total = (source.match(/productMaster\.(primaryId|secondaryId)\(/g) || []).length;
      // every call closes on a fallback array: `…, [ … ])`
      const withFallbacks = (source.match(/productMaster\.(primaryId|secondaryId)\([\s\S]*?\]\s*\)/g) || []).length;
      expect(total).toBeGreaterThan(0);
      expect(withFallbacks).toBe(total);
    });
  });
});
