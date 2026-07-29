import { api } from '@common';

const VIRTUAL_FACILITY_TYPE_ID = 'VIRTUAL_FACILITY';

export interface PhysicalFacilityCatalogEntry {
  facilityId: string;
  facilityName: string;
}

function responseList(data: any): any[] {
  return Array.isArray(data)
    ? data
    : data?.entityValueList || data?.docs || data?.list || data?.items || [];
}

export async function fetchPhysicalFacilityCatalog(): Promise<PhysicalFacilityCatalogEntry[]> {
  const response = await api({
    url: 'oms/facilities',
    method: 'GET',
    params: {
      pageSize: 1000,
      facilityTypeId: VIRTUAL_FACILITY_TYPE_ID,
      facilityTypeId_not: 'Y',
      parentTypeId: VIRTUAL_FACILITY_TYPE_ID,
      parentTypeId_not: 'Y'
    }
  });

  return responseList(response.data)
    .map((facility: any) => ({
      facilityId: facility.facilityId || facility.id || '',
      facilityName: facility.facilityName || facility.name || ''
    }))
    .filter((facility) => facility.facilityId);
}
