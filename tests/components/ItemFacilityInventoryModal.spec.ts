import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('item facility inventory modal', () => {
  it('uses desktop rows and mobile-only accordions from the same facility data', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/fulfillment/ItemFacilityInventoryModal.vue'), 'utf8');

    expect(source).toContain('<ion-toolbar>\n      <ion-searchbar');
    expect(source).toContain('v-else-if="isMobileViewport"');
    expect(source).toContain('<ion-accordion-group');
    expect(source).toContain("translate('Consumed order limit')");
    expect(source).toContain("translate('Consumed / Limit')");
    expect(source).toContain('v-else');
    expect(source).toContain('normalizeFacilityRows');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
