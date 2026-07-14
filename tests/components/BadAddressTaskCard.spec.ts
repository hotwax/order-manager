import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('bad address task card', () => {
  const cardSource = readFileSync(
    resolve(process.cwd(), 'src/components/tasks/BadAddressTaskCard.vue'),
    'utf8'
  );
  const geoSelectSource = readFileSync(
    resolve(process.cwd(), 'src/components/common/GeoSelectModal.vue'),
    'utf8'
  );

  it('renders the original address as read-only comparison data', () => {
    const originalAddress = cardSource.slice(
      cardSource.indexOf("translate('Original address')"),
      cardSource.indexOf("translate('Suggested address')")
    );

    expect(originalAddress).not.toContain('<ion-input');
    expect(originalAddress).not.toContain('@click="openCountryPicker');
    expect(originalAddress).not.toContain('@click="openStatePicker');
    expect(originalAddress.match(/readOnlyAddressValue\(/g)).toHaveLength(6);
    expect(cardSource).toContain("return value || '\\u00A0';");
  });

  it('uses Ionic radios for the single-select country and state picker', () => {
    expect(geoSelectSource).toContain('<ion-radio-group :value="selectedGeoId">');
    expect(geoSelectSource).toContain('<ion-radio slot="end" :value="item.geoId" />');
    expect(geoSelectSource).not.toContain('checkmarkOutline');
  });

  it('shows the ship group facility and carrier shipping method before the addresses', () => {
    const contextRow = cardSource.indexOf('<template #content-start>');
    const addresses = cardSource.indexOf('<ion-radio-group v-if="addressState"');

    expect(contextRow).toBeGreaterThan(-1);
    expect(contextRow).toBeLessThan(addresses);
    expect(cardSource).toContain("translate('Facility') }}: {{ brokeredFacilityName(task)");
    expect(cardSource).toContain("translate('Shipping method') }}: {{ carrierShippingMethodLabel(task)");
    expect(cardSource).toContain("seedStore.carrierName(task.carrierPartyId)");
    expect(cardSource).toContain("seedStore.shipmentMethodDescription(methodId)");
  });
});
