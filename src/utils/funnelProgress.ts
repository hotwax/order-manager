type FacilityDimension = 'volume' | 'velocity' | 'rejections';
type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Each dimension's message key. The facility list header links to it by name
 * (`@.lower:{metric}`), so it never passes through translate() where the locale check looks.
 */
export const DIMENSION_LABELS = { volume: 'Order volume', velocity: 'Fulfillment velocity', rejections: 'Rejections' } as const;

export function facilityProgressAccessibleName(
  facilityName: string,
  dimension: FacilityDimension,
  activeFacilityFallback: boolean,
  translate: Translate
) {
  if (dimension === 'volume') {
    return translate('{facility}: {metric}', { facility: facilityName, metric: translate('Order volume') });
  }
  if (dimension === 'velocity' && !activeFacilityFallback) {
    return translate('{facility}: {metric}', { facility: facilityName, metric: translate('Fulfillment velocity') });
  }
  if (dimension === 'rejections') {
    return translate('{facility}: {metric}', { facility: facilityName, metric: translate('Active orders (rejections)') });
  }
  return translate('{facility}: {metric}', { facility: facilityName, metric: translate('Active orders') });
}
