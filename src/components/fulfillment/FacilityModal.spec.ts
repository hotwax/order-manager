import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('facility parking modal', () => {
  it('uses the Figma parking bucket radio list', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/fulfillment/FacilityModal.vue'), 'utf8');

    expect(source).toContain("translate('Park order')");
    expect(source).toContain('<ion-radio-group v-model="selectedFacilityId">');
    expect(source).toContain("facilityId: 'REJECTED_ITM_PARKING'");
    expect(source).toContain("facilityId: 'UNFILLABLE_PARKING'");
    expect(source).toContain("facilityId: 'BACKORDER_PARKING'");
    expect(source).toContain("facilityId: 'PRE_ORDER_PARKING'");
    expect(source).toContain('slot="fixed"');
    expect(source).not.toContain('IonSearchbar');
    expect(source).not.toContain("url: 'admin/facilities'");
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
