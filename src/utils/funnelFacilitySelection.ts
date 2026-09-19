export type FacilityMetricLoadStatus = 'idle' | 'loading' | 'success' | 'error';

export function reconcileSelectedFacilityId(
  currentFacilityId: string,
  facilities: Array<{ facilityId: string }>,
  status: FacilityMetricLoadStatus
) {
  if (status !== 'success') return currentFacilityId;
  if (!facilities.length) return '';
  if (facilities.some((facility) => facility.facilityId === currentFacilityId)) {
    return currentFacilityId;
  }
  return facilities[0].facilityId;
}
