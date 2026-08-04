import { api } from '@common';

// Shared brokering-queue facility vocabulary. Both the Brokering queue page and
// the nav-count priming use these helpers so the badge count can never drift
// from the facility set the page actually queries.

export const ALL_FACILITY_OPTION_ID = 'All';
export const GENERAL_OPS_PARKING_FACILITY_ID = 'GENERAL_OPS_PARKING';
export const FALLBACK_BROKERING_FACILITY_IDS = ['_NA_', 'REJECTED_ITM_PARKING', 'REJECTED_PARKING'];

export function isUnfillableFacilityId(facilityId: string) {
  return String(facilityId || '').toUpperCase().includes('UNFILLABLE');
}

export function normalizeFacilityName(facility: any) {
  return facility?.facilityName || facility?.facilityId || facility?.name || facility?.id;
}

/** A virtual facility is excluded from the brokering queue when it is the archive
 * (General Operations Parking) or an unfillable parking location. */
export function isExcludedBrokeringFacility(facility: any) {
  const id = facility?.facilityId || facility?.id || '';
  const name = normalizeFacilityName(facility) || '';
  return !id
    || id === GENERAL_OPS_PARKING_FACILITY_ID
    || isUnfillableFacilityId(id)
    || String(name).toUpperCase().includes('UNFILLABLE');
}

/** Build the deduped, name-sorted {id, name} option list for the facility filter. */
export function buildBrokeringFacilityOptions(facilities: any[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  facilities.forEach((facility) => {
    if (isExcludedBrokeringFacility(facility)) return;
    map.set(facility.facilityId || facility.id, normalizeFacilityName(facility));
  });

  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function fetchBrokeringFacilities(): Promise<any[]> {
  try {
    const resp = await api({ url: 'admin/facilities', method: 'GET', params: { parentTypeId: 'VIRTUAL_FACILITY' } });
    return Array.isArray(resp.data) ? resp.data : [];
  } catch {
    return [];
  }
}

/** The default ("All") facility id set the brokering queue searches — every
 * virtual facility except the archive and unfillable parking, or the fallback
 * parking ids when none are configured. */
export async function fetchBrokeringFacilityIds(): Promise<string[]> {
  const ids = buildBrokeringFacilityOptions(await fetchBrokeringFacilities()).map((option) => option.id);
  return [...new Set([...ids, ...FALLBACK_BROKERING_FACILITY_IDS])];
}
