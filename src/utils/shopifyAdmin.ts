/**
 * Pure builders for Shopify Admin deep-links from OMS order data (no store/`@common`
 * imports — unit testable without mocks).
 *
 * Mirrors the Moqui OMS `get#OrderShopifyUrl` service: an order's SHOPIFY_ORD_ID
 * identification value IS the Shopify order id, and the shop's myshopify domain
 * yields the store handle (the label before `.myshopify.com`). The resulting URL
 * uses the modern unified admin host:
 *
 *   https://admin.shopify.com/store/{handle}/orders/{shopifyOrderId}
 */

const SHOPIFY_ADMIN_BASE = 'https://admin.shopify.com/store';
const MYSHOPIFY_SUFFIX = '.myshopify.com';

/**
 * Extract the Shopify store handle from a myshopify domain.
 *
 * "coolstore.myshopify.com" -> "coolstore". A value that does not contain the
 * `.myshopify.com` suffix is returned host-only as-is (mirrors the Moqui
 * fallback), so a bare handle already stored as the domain still works.
 */
export function shopifyStoreHandle(domain?: string | null): string {
  if (!domain) return '';
  const host = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!host) return '';
  return host.endsWith(MYSHOPIFY_SUFFIX) ? host.slice(0, -MYSHOPIFY_SUFFIX.length) : host;
}

/**
 * Build the Shopify Admin order URL, or '' when any input is missing.
 *
 * @param domain         the shop's myshopify domain (e.g. "coolstore.myshopify.com")
 * @param shopifyOrderId the SHOPIFY_ORD_ID identification value
 */
export function shopifyAdminOrderUrl(domain?: string | null, shopifyOrderId?: string | null): string {
  const handle = shopifyStoreHandle(domain);
  const orderId = (shopifyOrderId ?? '').toString().trim();
  if (!handle || !orderId) return '';
  return `${SHOPIFY_ADMIN_BASE}/${handle}/orders/${encodeURIComponent(orderId)}`;
}
