type FacilityDimension = 'volume' | 'velocity' | 'rejections';
type Translate = (key: string, params?: Record<string, unknown>) => string;

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
