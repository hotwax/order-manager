import { ref, watch, type Ref } from 'vue';
import { api } from '@common';
import { useOrderDetailStore } from '@/store/orderDetail';

/** Great-circle distance between two lat/lon points, in miles. */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const num = (value: any): number | undefined => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Fallback geocoder: resolve postal codes to coordinates via the Solr `postalCode`
 * core (fields: postcode / latitude / longitude), returning a { zip: {lat, lon} }
 * map. Used only for endpoints whose postal address isn't already geocoded; both
 * the ship-to address and the origin facility normally carry lat/lon directly
 * (see fetchDistancesForOrder). A failed/absent core is swallowed — the distance
 * simply isn't shown for that ship group.
 */
export async function lookupPostalCoordinates(zips: string[]): Promise<Record<string, { lat: number; lon: number }>> {
  const coords: Record<string, { lat: number; lon: number }> = {};
  if (!zips.length) return coords;
  try {
    const resp = await api({
      url: 'api/geocode',
      method: 'POST',
      data: {
        json: {
          query: `postcode:(${zips.map((zip) => `"${zip}"`).join(' OR ')})`
        }
      }
    });
    (resp?.data?.response?.docs ?? []).forEach((doc: any) => {
      const zip = String(doc.postcode ?? '').trim();
      const lat = num(doc.latitude);
      const lon = num(doc.longitude);
      if (zip && lat !== undefined && lon !== undefined) coords[zip] = { lat, lon };
    });
  } catch (error) {
    console.error('Failed to look up postal-code coordinates:', error);
  }
  return coords;
}

/** Origin facility coordinates from its postal address (lat/lon are returned
 *  directly by facilityContactMechs); falls back to the facility's zip for a
 *  Solr lookup when the address isn't geocoded. Deduped per facilityId. */
export async function fetchFacilityOrigins(facilityIds: string[]): Promise<Record<string, { lat?: number; lon?: number; zip?: string }>> {
  const origins: Record<string, { lat?: number; lon?: number; zip?: string }> = {};
  await Promise.all(facilityIds.map(async (facilityId) => {
    try {
      const resp = await api({ url: 'oms/facilityContactMechs', method: 'GET', params: { facilityId } });
      const mechs: any[] = resp?.data?.facilityContactMechs ?? [];
      const postal = mechs.find((m) => m.contactMechTypeId === 'POSTAL_ADDRESS' && m.contactMechPurposeTypeId === 'SHIP_ORIG_LOCATION')
        || mechs.find((m) => m.contactMechTypeId === 'POSTAL_ADDRESS');
      if (postal) origins[facilityId] = { lat: num(postal.latitude), lon: num(postal.longitude), zip: postal.postalCode?.trim() };
    } catch (error) {
      console.error(`Failed to load origin address for facility ${facilityId}:`, error);
    }
  }));
  return origins;
}

/**
 * Distance (miles) between each BROKERED ship group's origin facility and the
 * order's ship-to address.
 */
export function useOrderDistances(
  orderId: string | Ref<string>,
  order: Ref<any>,
  isVirtualFacility: (shipGroup: any) => boolean
) {
  const orderDetailStore = useOrderDetailStore();
  const shipGroupDistances = ref<Record<string, string>>({});

  const fetchDistancesForOrder = async (shipGroups: any[]) => {
    shipGroupDistances.value = {};
    const brokered = (shipGroups || []).filter((sg: any) => !isVirtualFacility(sg) && sg.facilityId);
    if (!brokered.length) return;

    const currentOrderId = typeof orderId === 'string' ? orderId : orderId.value;
    const origins = await fetchFacilityOrigins([...new Set(brokered.map((sg: any) => sg.facilityId))]);

    // Prefer the lat/lon already on each ship-to address; collect zips for a Solr
    // fallback only for endpoints (ship-to or origin facility) that aren't geocoded.
    const destCoordsBySg: Record<string, { lat: number; lon: number }> = {};
    const destZipBySg: Record<string, string> = {};
    const zipsToLookup = new Set<string>();

    brokered.forEach((sg: any) => {
      const mech = sg.contactMechId
        ? orderDetailStore.contactMechsByIdByOrderId(currentOrderId)[sg.contactMechId]
        : orderDetailStore.contactMechsByPurposeByOrderId(currentOrderId)['SHIPPING_LOCATION'];
      const addr = mech?.postalAddress;
      const destLat = num(addr?.latitude);
      const destLon = num(addr?.longitude);
      if (destLat !== undefined && destLon !== undefined) {
        destCoordsBySg[sg.id] = { lat: destLat, lon: destLon };
      } else {
        const destZip = addr?.postalCode?.trim();
        if (destZip) {
          destZipBySg[sg.id] = destZip;
          zipsToLookup.add(destZip);
        }
      }
      const origin = origins[sg.facilityId];
      if (origin && (origin.lat === undefined || origin.lon === undefined) && origin.zip) {
        zipsToLookup.add(origin.zip);
      }
    });

    const zipCoords = zipsToLookup.size ? await lookupPostalCoordinates([...zipsToLookup]) : {};

    brokered.forEach((sg: any) => {
      const origin = origins[sg.facilityId];
      const originCoords = origin && origin.lat !== undefined && origin.lon !== undefined
        ? { lat: origin.lat, lon: origin.lon }
        : (origin?.zip ? zipCoords[origin.zip] : undefined);
      const destCoords = destCoordsBySg[sg.id] ?? zipCoords[destZipBySg[sg.id]];
      if (originCoords && destCoords) {
        shipGroupDistances.value[sg.id] = haversineMiles(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon).toFixed(1);
      }
    });
  };

  watch(
    () => order.value?.shipGroups,
    (shipGroups) => {
      fetchDistancesForOrder(shipGroups);
    },
    { immediate: true }
  );

  return {
    shipGroupDistances,
    fetchDistancesForOrder,
  };
}
