import { describe, expect, it, vi } from 'vitest';
import { buildAddressState } from '@/utils/badAddressState';



describe('bad address state', () => {
  it('defaults to the suggested address even when the suggestion is empty', () => {
    const state = buildAddressState([], {
      shippingAddress: {
        address1: '7007 Friars Rd',
        city: 'San Diego',
        postalCode: '92108',
        countryGeoId: 'USA',
      },
      locationDesc: '',
    });

    expect(state.selectedAddressType).toBe('suggested');
  });
});
