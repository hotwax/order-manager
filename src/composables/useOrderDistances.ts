import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { api, logger } from '@common';
import type { EnrichedShipGroup } from '@/types/orderDetail';

type Coordinates = { lat: number; lon: number };
type FacilityOrigin = { lat?: number; lon?: number; zip?: string } | null;

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

// Facility locations and postal codes don't change during a session, so both lookups are
// cached per module — misses included (null), so a facility without an address or a zip the
// geocoder doesn't know is asked for once, not on every recompute.
const postalCoordinatesCache = new Map<string, Coordinates | null>();
const facilityOriginRequests = new Map<string, Promise<FacilityOrigin>>();

/**
 * Fallback geocoder: resolve postal codes to coordinates via the Solr `postalCode` core
 * (fields: postcode / latitude / longitude). Used only for endpoints whose postal address isn't
 * already geocoded; not every OMS exposes the core, and a failure just leaves the distance off.
 */
export async function lookupPostalCoordinates(zips: string[]): Promise<Record<string, Coordinates>> {
  const missingZips = zips.filter((zip) => !postalCoordinatesCache.has(zip));

  if (missingZips.length) {
    try {
      const resp = await api({
        url: 'api/geocode',
        method: 'POST',
        data: { json: { query: `postcode:(${missingZips.map((zip) => `"${zip}"`).join(' OR ')})` } }
      });
      (resp?.data?.response?.docs ?? []).forEach((doc: any) => {
        const zip = String(doc.postcode ?? '').trim();
        const lat = num(doc.latitude);
        const lon = num(doc.longitude);
        if (zip && lat !== undefined && lon !== undefined) postalCoordinatesCache.set(zip, { lat, lon });
      });
      missingZips.forEach((zip) => { if (!postalCoordinatesCache.has(zip)) postalCoordinatesCache.set(zip, null); });
    } catch (error) {
      logger.error('Failed to look up postal-code coordinates', error);
    }
  }

  return Object.fromEntries(
    zips.map((zip) => [zip, postalCoordinatesCache.get(zip)]).filter(([, coords]) => coords)
  ) as Record<string, Coordinates>;
}

/**
 * Origin facility coordinates from its postal address (facilityContactMechs returns lat/lon
 * directly), keeping the zip for a geocoder fallback when the address isn't geocoded.
 * One request per facility per session, shared by concurrent callers.
 */
export function fetchFacilityOrigin(facilityId: string): Promise<FacilityOrigin> {
  if (!facilityOriginRequests.has(facilityId)) {
    facilityOriginRequests.set(facilityId, api({ url: 'oms/facilityContactMechs', method: 'GET', params: { facilityId } })
      .then((resp: any) => {
        const mechs: any[] = resp?.data?.facilityContactMechs ?? [];
        const postal = mechs.find((m) => m.contactMechTypeId === 'POSTAL_ADDRESS' && m.contactMechPurposeTypeId === 'SHIP_ORIG_LOCATION')
          || mechs.find((m) => m.contactMechTypeId === 'POSTAL_ADDRESS');
        return postal ? { lat: num(postal.latitude), lon: num(postal.longitude), zip: postal.postalCode?.trim() } : null;
      })
      .catch((error: any) => {
        logger.error(`Failed to load origin address for facility ${facilityId}`, error);
        facilityOriginRequests.delete(facilityId);
        return null;
      }));
  }
  return facilityOriginRequests.get(facilityId)!;
}

/**
 * Distance (miles) between each BROKERED ship group's origin facility and its ship-to address,
 * keyed by ship group id. Recomputed only when a group's facility or destination changes.
 */
export function useOrderDistances(shipGroups: MaybeRefOrGetter<EnrichedShipGroup[]>) {
  const distances = ref<Record<string, string>>({});

  const legs = computed(() => toValue(shipGroups)
    .filter((sg) => !sg.isVirtual && sg.facilityId)
    .map((sg) => ({
      id: sg.id,
      facilityId: sg.facilityId,
      destination: sg.shippingAddress?.coordinates ?? null,
      destinationZip: sg.shippingAddress?.postalCode || '',
    })));

  let run = 0;
  watch(() => JSON.stringify(legs.value), async () => {
    const current = ++run;
    distances.value = {};
    if (!legs.value.length) return;

    const origins: Record<string, FacilityOrigin> = Object.fromEntries(await Promise.all(
      [...new Set(legs.value.map((leg) => leg.facilityId))].map(async (facilityId) => [facilityId, await fetchFacilityOrigin(facilityId)])
    ));

    // Prefer the lat/lon already on each address; geocode zips only for endpoints that lack them.
    const zips = new Set<string>();
    legs.value.forEach((leg) => {
      if (!leg.destination && leg.destinationZip) zips.add(leg.destinationZip);
      const origin = origins[leg.facilityId];
      if (origin && (origin.lat === undefined || origin.lon === undefined) && origin.zip) zips.add(origin.zip);
    });
    const zipCoords = zips.size ? await lookupPostalCoordinates([...zips]) : {};
    if (current !== run) return; // a newer run owns the result

    const result: Record<string, string> = {};
    legs.value.forEach((leg) => {
      const origin = origins[leg.facilityId];
      const from = origin?.lat !== undefined && origin?.lon !== undefined
        ? { lat: origin.lat, lon: origin.lon }
        : (origin?.zip ? zipCoords[origin.zip] : undefined);
      const to = leg.destination ?? zipCoords[leg.destinationZip];
      if (from && to) result[leg.id] = haversineMiles(from.lat, from.lon, to.lat, to.lon).toFixed(1);
    });
    distances.value = result;
  }, { immediate: true });

  return distances;
}
