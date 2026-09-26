import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { api } from '@common';
import { useOrderDistances } from '@/composables/useOrderDistances';
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
