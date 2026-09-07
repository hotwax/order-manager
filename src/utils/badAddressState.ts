import type { AddressForm, AddressState } from '@/types/order';
import { getGeoIdByCode } from '@/db/seedLookups';

// Builds the editable address-form state a BadAddressTaskCard renders from.
// Shared by the /bad-address list and the OrderDetail "Holds" segment so both
// hydrate cards identically.

function buildAddressForm(src: any, task: any): AddressForm {
  return {
    address1: src?.address1 ?? '',
    address2: src?.address2 ?? '',
    city: src?.city ?? '',
    postalCode: src?.postalCode ?? '',
    stateProvinceGeoId: src?.stateProvinceGeoId ?? '',
    countryGeoId: src?.countryGeoId ?? '',
    contactMechId: task?.shippingAddress?.contactMechId ?? '',
    contactMechPurposeTypeId: task?.shippingAddress?.contactMechPurposeTypeId || 'SHIPPING_LOCATION',
    partyId: task?.customer?.partyId ?? '',
    isEdited: true,
  };
}

function buildSuggestedForm(geos: Array<Record<string, any>>, task: any): AddressForm {
  let parsed: any = {};
  try { parsed = task.locationDesc ? JSON.parse(task.locationDesc) : {}; } catch { parsed = {}; }
  return {
    address1: parsed.address1 ?? '',
    address2: parsed.address2 ?? '',
    city: parsed.city ?? '',
    postalCode: parsed.postalCode ?? '',
    stateProvinceGeoId: getGeoIdByCode(geos, parsed.stateOrProvinceCode ?? ''),
    countryGeoId: getGeoIdByCode(geos, parsed.countryCode ?? ''),
    contactMechId: task?.shippingAddress?.contactMechId ?? '',
    contactMechPurposeTypeId: task?.shippingAddress?.contactMechPurposeTypeId || 'SHIPPING_LOCATION',
    partyId: task?.customer?.partyId ?? '',
    isEdited: true,
  };
}

export function buildAddressState(geos: Array<Record<string, any>>, task: any): AddressState {
  const suggested = buildSuggestedForm(geos, task);
  const original = buildAddressForm(task.shippingAddress, task);
  return {
    selectedAddressType: 'suggested',
    original,
    suggested,
  };
}
