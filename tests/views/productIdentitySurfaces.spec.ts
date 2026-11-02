import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * The operator picks how products are identified in Settings > Product identifier. A surface
 * that hardcodes productName or sku ignores that choice, which is how these four ended up
 * showing a different identifier than the rest of the app. Each now reads the preference
 * through useProductIdentity's primaryId/secondaryId.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('product identity surfaces honour the preference', () => {
  it('swap substitute picker reads the preference for both lists', () => {
    const source = read('src/components/swaps/CustomSwapModal.vue');
    expect(source).toContain('const { primaryId, secondaryId } = useProductIdentity();');
    // the substitute list and the search list, each with its own fallbacks
    expect(source).toContain('primaryId(getProduct(product.productId) || product, [product.productName])');
    expect(source).toContain('primaryId(getProduct(product.productId) || product, [product.parentProductName, product.productName])');
    expect(source).not.toContain('{{ getProduct(product.productId)?.productName || product.productName }}');
    expect(source).not.toContain('{{ product.parentProductName }}');
  });

  it('substitute relationship picker reads the preference', () => {
    const source = read('src/components/swaps/SubstituteRelationshipModal.vue');
    expect(source).toContain('return primaryId(product, [');
    expect(source).toContain('secondaryId(product, [product.sku, product.productId])');
    expect(source).not.toContain('return product.productName || product.parentProductName || product.internalName || product.productId;');
  });

  it('customer order history reads the preference', () => {
    const source = read('src/views/CustomerDetail.vue');
    expect(source).toContain('primaryId(productMaster.getProduct(item.productId) || item, [item.name, item.sku');
    expect(source).toContain('secondaryId(productMaster.getProduct(item.productId) || item, [item.sku])');
    expect(source).not.toContain("name: item.name || item.sku || 'Item',");
  });

  it('return items read the preference', () => {
    const source = read('src/views/ReturnDetail.vue');
    expect(source).toContain('return primaryId(productMaster.getProduct(item.productId) || item, [');
    expect(source).toContain('function itemSecondaryLabel(item: ReturnItemDetail)');
    expect(source).not.toContain('return item.productName || item.description || item.sku || item.productId || translate("Return item");');
  });

  it('fetches and stores every field the preference can point at', () => {
    // The framework's product domain (its Solr fields) and the `products` seed entity.
    const master = read('../../common/db/domain/productDomain.ts');
    const schema = read('../../common/db/schema/commonSchema.ts');
    ['groupId', 'groupName', 'primaryProductCategoryName', 'title', 'goodIdentifications', 'productFeatures'].forEach((field) => {
      expect(master).toContain(field);
      expect(schema).toContain(`${field}:`);
    });
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
      const total = (source.match(/\b(primaryId|secondaryId)\((?!\))/g) || []).length;
      // every call closes on a fallback array: `…, [ … ])`
      const withFallbacks = (source.match(/\b(primaryId|secondaryId)\((?!\))[\s\S]*?\]\s*\)/g) || []).length;
      expect(total).toBeGreaterThan(0);
      expect(withFallbacks).toBe(total);
    });
  });
});
