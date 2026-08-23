import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/fulfillment/FacilityInventoryModal.vue'), 'utf8');

describe('facility inventory modal', () => {
  it('uses desktop rows and mobile-only accordions from the same facility data', () => {
    expect(source).toContain('<ion-searchbar');
    expect(source).toContain('v-else-if="isMobileViewport"');
    expect(source).toContain('<ion-accordion-group');
    expect(source).toContain("translate('Consumed order limit')");
    expect(source).toContain("translate('Consumed / Limit')");
    expect(source).toContain('buildFacilityCoverageRows');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });

  it('details one item and summarises coverage for several', () => {
    // The chip strip is the mode switch: a detailed item shows its own inventory columns, and
    // without one the row falls back to how many of the selected items the facility covers.
    expect(source).toContain('detailedItemIndex = ref(props.items.length === 1 ? 0 : -1)');
    expect(source).toContain('facility-inventory-row');
    expect(source).toContain('facility-coverage-row');
    expect(source).toContain("translate('{count} of {total} items'");
    expect(source).toContain("translate('Short by {count}'");
    expect(source).toContain("translate('No inventory record')");
    expect(source).toContain("translate('Not in store')");
  });

  it('reads every product in one request and keeps paging while pages come back full', () => {
    expect(source).toContain("productId_op: 'in'");
    expect(source).toContain('if (page.length < pageSize) break;');
    // X-Total-Count is sent but not exposed through CORS, so it cannot be the paging signal.
    expect(source).not.toContain("headers?.['x-total-count']");
  });

  it('takes the order limit from the cached facility and the consumption live', () => {
    expect(source).toContain('seedStore.loadFacilities()');
    expect(source).toContain("url: 'admin/facilities/orderCount'");
    expect(source).toContain("facilityId_op: 'in'");
    // The unscoped oms mount returned every facility for every date; the admin mount is the one
    // the company app uses and the only one scoped to today and to the facilities on screen.
    expect(source).not.toContain('oms/facilities/facilityOrderCounts');
  });

  it('keeps the whole row tappable and the save action reachable', () => {
    expect(source).toContain('@click="selectedFacilityId = facility.facilityId"');
    expect(source).toContain('<ion-fab vertical="bottom" horizontal="end" slot="fixed">');
    expect(source).toContain(':disabled="!selectedFacilityId"');
  });
});
