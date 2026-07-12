export interface ProductIdentity {
  productId: string;
  sku?: string;
  internalName?: string;
}

function identifiers(product: ProductIdentity): Set<string> {
  return new Set(
    [product.productId, product.sku, product.internalName]
      .filter(Boolean)
      .map((identifier) => String(identifier).trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSameProduct(left: ProductIdentity, right: ProductIdentity): boolean {
  const leftIdentifiers = identifiers(left);
  return [...identifiers(right)].some((identifier) => leftIdentifiers.has(identifier));
}
