import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@common';
import { fetchPhysicalFacilityCatalog } from '@/services/facility';

vi.mock('@common', () => ({
  api: vi.fn(),
}));

describe('physical facility catalog', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it('loads and normalizes names in one bounded physical-facility request', async () => {
    vi.mocked(api).mockResolvedValueOnce({
      data: [{
        facilityId: 'M100051',
        facilityName: '2301 E. 51st St.',
        facilityTypeId: 'WAREHOUSE',
        parentTypeId: 'DISTRIBUTION_CENTER'
      }, {
        id: 'M100052',
        name: 'Second Street'
      }, {
        facilityName: 'Missing ID'
      }]
    });

    await expect(fetchPhysicalFacilityCatalog()).resolves.toEqual([{
      facilityId: 'M100051',
      facilityName: '2301 E. 51st St.'
    }, {
      facilityId: 'M100052',
      facilityName: 'Second Street'
    }]);
    expect(api).toHaveBeenCalledOnce();
    expect(api).toHaveBeenCalledWith({
      url: 'oms/facilities',
      method: 'GET',
      params: {
        pageSize: 1000,
        facilityTypeId: 'VIRTUAL_FACILITY',
        facilityTypeId_not: 'Y',
        parentTypeId: 'VIRTUAL_FACILITY',
        parentTypeId_not: 'Y'
      }
    });
  });
});
