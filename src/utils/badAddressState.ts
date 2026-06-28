import { useSeedStore } from '@/store/seed';
import type { AddressForm, AddressState } from '@/types/order';

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

function buildSuggestedForm(task: any): AddressForm {
  const seedStore = useSeedStore();
  let parsed: any = {};
  try { parsed = task.locationDesc ? JSON.parse(task.locationDesc) : {}; } catch { parsed = {}; }
  return {
    address1: parsed.address1 ?? '',
    address2: parsed.address2 ?? '',
    city: parsed.city ?? '',
    postalCode: parsed.postalCode ?? '',
    stateProvinceGeoId: seedStore.getGeoIdByCode(parsed.stateOrProvinceCode ?? ''),
    countryGeoId: seedStore.getGeoIdByCode(parsed.countryCode ?? ''),
    contactMechId: task?.shippingAddress?.contactMechId ?? '',
    contactMechPurposeTypeId: task?.shippingAddress?.contactMechPurposeTypeId || 'SHIPPING_LOCATION',
    partyId: task?.customer?.partyId ?? '',
    isEdited: true,
  };
}

export function buildAddressState(task: any): AddressState {
  const suggested = buildSuggestedForm(task);
  const hasSuggested = [suggested.address1, suggested.address2, suggested.city, suggested.postalCode, suggested.stateProvinceGeoId, suggested.countryGeoId].some(Boolean);
  const original = buildAddressForm(task.shippingAddress, task);
  return {
    selectedAddressType: hasSuggested ? 'suggested' : 'original',
    original,
    suggested,
  };
}
