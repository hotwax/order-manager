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
    expect(originalAddress).toContain('{{ addressState.original.address1 }}');
    expect(originalAddress).toContain('{{ countryName(addressState.original.countryGeoId) }}');
  });

  it('uses Ionic radios for the single-select country and state picker', () => {
    expect(geoSelectSource).toContain('<ion-radio-group :value="selectedGeoId">');
    expect(geoSelectSource).toContain('<ion-radio slot="end" :value="item.geoId" />');
    expect(geoSelectSource).not.toContain('checkmarkOutline');
  });
});
