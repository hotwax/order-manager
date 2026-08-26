type FacilityDimension = 'volume' | 'velocity' | 'rejections';
type Translate = (key: string) => string;

export function facilityProgressAccessibleName(
  facilityName: string,
  dimension: FacilityDimension,
  activeFacilityFallback: boolean,
  translate: Translate
) {
  if (dimension === 'volume') {
    return `${facilityName}: ${translate('Order Volume')}`;
  }
  if (dimension === 'velocity' && !activeFacilityFallback) {
    return `${facilityName}: ${translate('Fulfillment Velocity')}`;
  }
  if (dimension === 'rejections') {
    return `${facilityName}: ${translate('active orders')} (${translate('Rejections')})`;
  }
  return `${facilityName}: ${translate('active orders')}`;
}
