import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { api } from '@common';
import { fetchDistancesFromFacility, useOrderDistances } from '@/composables/useOrderDistances';
import type { EnrichedShipGroup } from '@/types/orderDetail';

vi.mock('@common', async (importOriginal) => ({ ...(await importOriginal<any>()), api: vi.fn() }));

const shipGroup = (id: string, facilityId: string, isVirtual = false) => ({
  id,
  facilityId,
  isVirtual,
  shippingAddress: { coordinates: { lat: 40.7128, lon: -74.006 }, postalCode: '10001' },
}) as unknown as EnrichedShipGroup;

describe('useOrderDistances', () => {
  it('measures each brokered group from a getter input, asking for each facility once', async () => {
    vi.mocked(api).mockResolvedValue({
      data: { facilityContactMechs: [{ contactMechTypeId: 'POSTAL_ADDRESS', latitude: '42.3601', longitude: '-71.0589' }] }
    } as any);

    const groups = ref([shipGroup('00001', 'BOSTON'), shipGroup('00002', 'BOSTON'), shipGroup('00003', 'PARKING', true)]);
    const scope = effectScope();
    const distances = scope.run(() => useOrderDistances(() => groups.value))!;

    await vi.waitFor(() => expect(Object.keys(distances.value)).toHaveLength(2));
    expect(distances.value['00001']).toBe(distances.value['00002']);
    expect(Number(distances.value['00001'])).toBeGreaterThan(180);
    expect(distances.value['00003']).toBeUndefined();
    expect(api).toHaveBeenCalledTimes(1);

    // A recompute with the same facilities and destinations does not refetch or reset.
    groups.value = [...groups.value];
    await Promise.resolve();
    expect(api).toHaveBeenCalledTimes(1);
    expect(Object.keys(distances.value)).toHaveLength(2);
    scope.stop();
  });
});

describe('fetchDistancesFromFacility', () => {
  /** Answers each endpoint from the given responses, by url. */
  const respond = (responses: Record<string, unknown>) =>
    vi.mocked(api).mockReset().mockImplementation(async ({ url }: any) => ({ data: responses[url] }) as any);

  it('measures every indexed facility from one store lookup around the facility, in miles', async () => {
    respond({
      'oms/facilityContactMechs': { facilityContactMechs: [{ contactMechTypeId: 'POSTAL_ADDRESS', latitude: '42.3601', longitude: '-71.0589' }] },
      // A store indexed without a location comes back at an infinite distance.
      'api/stores': { docs: [{ storeCode: 'NEAR', dist: '10' }, { storeCode: 'NOWHERE', dist: 'Infinity' }] },
    });

    const distances = await fetchDistancesFromFacility('HUB');

    expect(Object.keys(distances)).toEqual(['NEAR']);
    expect(distances.NEAR).toBeCloseTo(6.21, 2);
    expect(api).toHaveBeenCalledWith(expect.objectContaining({ url: 'api/stores', data: expect.objectContaining({ point: '42.3601,-71.0589' }) }));
  });

  it('places the facility by its zip when its address has no coordinates', async () => {
    respond({
      'oms/facilityContactMechs': { facilityContactMechs: [{ contactMechTypeId: 'POSTAL_ADDRESS', postalCode: '10001' }] },
      'api/geocode': { response: { docs: [{ postcode: '10001', latitude: '40.75', longitude: '-73.99' }] } },
      'api/stores': { docs: [] },
    });

    await fetchDistancesFromFacility('ZIP_ONLY');

    expect(api).toHaveBeenCalledWith(expect.objectContaining({ url: 'api/stores', data: expect.objectContaining({ point: '40.75,-73.99' }) }));
  });

  it('has no distances, and asks for none, for a facility without an address', async () => {
    respond({ 'oms/facilityContactMechs': { facilityContactMechs: [] } });

    await expect(fetchDistancesFromFacility('NO_ADDRESS')).resolves.toEqual({});
    expect(api).not.toHaveBeenCalledWith(expect.objectContaining({ url: 'api/stores' }));
  });
});
