import { computed } from 'vue';
import { commonUtil } from '@common';
import { useProductCacheStore } from '@/store/productCache';
import { useProductStore } from '@/store/productStore';

/**
 * How a product reads on the order page: the operator's chosen primary/secondary identifiers
 * and the variant's feature line, resolved from the product cache.
 */
export function useProductIdentity() {
  const productCache = useProductCacheStore();
  const productStore = useProductStore();
  const identificationPref = computed(() => productStore.getProductIdentificationPref);

  const getProduct = (productId?: string) => productCache.getProduct(productId as string);
  const identification = (prefId: string, productId?: string) =>
    commonUtil.getProductIdentificationValue(prefId, getProduct(productId) || {}) || '';
  const primaryIdentifier = (productId?: string) => identification(identificationPref.value.primaryId, productId);

  return {
    getProduct,
    primaryIdentifier,
    secondaryIdentifier: (productId?: string) => identification(identificationPref.value.secondaryId, productId),
    /**
     * What v-image-preview opens: the product's image, titled by its primary identifier as the
     * row names it. The product name alone can be just the variant, such as "XS". The directive
     * reads this once, when mounted, so key the thumbnail by the image and the identifier.
     */
    imagePreview: (productId?: string) => ({
      mainImageUrl: getProduct(productId)?.mainImageUrl,
      productName: primaryIdentifier(productId) || productId,
    }),
    /**
     * A variant's selectable features as one line ("SIZE/M" -> "M"). `productFeatures` is the Solr
     * field the fulfillment app already renders this way, so the two apps agree on what a variant
     * reads as. Empty when the product is uncached or carries no features.
     */
    featureLabel: (productId?: string) => commonUtil.getFeatures(getProduct(productId)?.productFeatures),
  };
}
