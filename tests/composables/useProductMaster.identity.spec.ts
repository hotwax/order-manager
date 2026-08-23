import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

/**
 * A faithful stand-in for commonUtil.getProductIdentificationValue (common/utils/commonUtil.ts),
 * not a stub: same crash-on-undefined behaviour, same field-then-goodIdentifications lookup. No
 * order-manager test imports the real @common barrel — every one mocks it — so this is the
 * closest thing to an integration test primaryId/secondaryId get. The real function's own
 * correctness has no test of its own anywhere in the monorepo; that gap belongs to
 * common/utils/commonUtil.spec.ts.
 *
 * primaryId/secondaryId live in useProductMaster.ts (not a separate composable) to mirror
 * inventory-count/src/composables/useProductMaster.ts's own primaryId/secondaryId, which the
 * module's header comment already commits to keeping API-parallel with.
 */
function getProductIdentificationValue(idKey: string, product: any) {
  if (!Object.keys(product).length) return undefined;
  let value = product[idKey];
  const identification = product.goodIdentifications?.find((entry: any) =>
    typeof entry === 'string' ? entry.startsWith(idKey + '/') : entry?.type === idKey);
  if (identification) value = typeof identification === 'string' ? identification.split('/')[1] : identification.value;
  return value;
}

vi.mock('@common', () => ({ commonUtil: { getProductIdentificationValue } }));

import { useProductMaster } from '@/composables/useProductMaster';
import { useProductStore } from '@/store/productStore';

function setPref(primaryId: string, secondaryId: string) {
  useProductStore().settings.productIdentifier.productIdentificationPref = { primaryId, secondaryId };
}

describe('useProductMaster identity (primaryId/secondaryId)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('reads the operator-configured preference from productStore, not a hardcoded field', () => {
    setPref('internalName', 'parentProductName');
    const productMaster = useProductMaster();

    const product = { internalName: 'H-001-009-001001:O/S', parentProductName: 'JUNEAU CANDLE - 9OZ', productName: 'O/S' };

    expect(productMaster.primaryId(product)).toBe('H-001-009-001001:O/S');
    expect(productMaster.secondaryId(product)).toBe('JUNEAU CANDLE - 9OZ');
  });

  it('reacts when the preference changes, rather than caching the first read', () => {
    setPref('productName', 'sku');
    const productMaster = useProductMaster();
    const product = { productName: 'O/S', sku: 'H-001-009-001001:O/S', internalName: 'ignored' };

    expect(productMaster.primaryId(product)).toBe('O/S');

    setPref('internalName', 'productName');
    expect(productMaster.primaryId(product)).toBe('ignored');
  });

  it('falls back through the call site\'s own fields only when the preferred one is empty', () => {
    setPref('internalName', 'parentProductName');
    const productMaster = useProductMaster();
    // A product missing the preferred field entirely (e.g. before the cache has warmed).
    const bareProduct = { productName: 'O/S' };

    expect(productMaster.primaryId(bareProduct, ['order-payload name', 'sku-fallback'])).toBe('order-payload name');
    expect(productMaster.primaryId(bareProduct, [undefined, '', 'second fallback'])).toBe('second fallback');
    expect(productMaster.primaryId(bareProduct, [])).toBe('');
  });

  it('prefers the resolved identifier over any fallback, even when a fallback is also present', () => {
    setPref('internalName', 'parentProductName');
    const productMaster = useProductMaster();
    const product = { internalName: 'real-identity' };

    expect(productMaster.primaryId(product, ['should not win'])).toBe('real-identity');
  });

  it('never throws when there is no product yet — the whole point of the cache-warming window', () => {
    setPref('internalName', 'parentProductName');
    const productMaster = useProductMaster();

    // commonUtil.getProductIdentificationValue crashes on `Object.keys(undefined)`; every
    // call site used to guard this with `|| {}` by hand, which is exactly the kind of thing
    // that gets forgotten once and shows up as a raw internal id on screen.
    expect(() => productMaster.primaryId(undefined)).not.toThrow();
    expect(() => productMaster.primaryId(null)).not.toThrow();
    expect(productMaster.primaryId(undefined, ['fallback name'])).toBe('fallback name');
    expect(productMaster.primaryId(undefined)).toBe('');
  });

  it('resolves an identifier backed by goodIdentifications, not just a direct product field', () => {
    setPref('UPCA', 'GTIN');
    const productMaster = useProductMaster();
    const product = {
      productName: 'O/S',
      goodIdentifications: ['UPCA/195692366128', 'GTIN/00195692366128'],
    };

    expect(productMaster.primaryId(product)).toBe('195692366128');
    expect(productMaster.secondaryId(product)).toBe('00195692366128');
  });

  it('truncates a goodIdentifications value at its first "/" — a real commonUtil quirk, not this composable\'s', () => {
    // getProductIdentificationValue does `identification.split('/')[1]`, so a SKU that itself
    // contains a slash (live example: "H-001-009-001001:O/S") comes back truncated. Documented
    // here because the composable can't and shouldn't paper over what the shared resolver does —
    // it belongs to commonUtil, which has no test coverage of its own anywhere in the monorepo.
    setPref('SKU', 'SKU');
    const productMaster = useProductMaster();
    const product = { goodIdentifications: ['SKU/H-001-009-001001:O/S'] };

    expect(productMaster.primaryId(product)).toBe('H-001-009-001001:O');
  });

  it('resolves independently for primary and secondary from the same product', () => {
    setPref('internalName', 'parentProductName');
    const productMaster = useProductMaster();
    const product = { internalName: 'primary-value', parentProductName: 'secondary-value' };

    expect(productMaster.primaryId(product)).toBe('primary-value');
    expect(productMaster.secondaryId(product)).toBe('secondary-value');
    // Swapping which key each reads confirms they are not accidentally aliased.
    expect(productMaster.primaryId(product)).not.toBe(productMaster.secondaryId(product));
  });
});
