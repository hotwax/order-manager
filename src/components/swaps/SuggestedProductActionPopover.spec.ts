import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('suggested product action popover', () => {
  it('maps the Figma popover to an Ionic list of item actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/swaps/SuggestedProductActionPopover.vue'), 'utf8');

    expect(source).toContain('<ion-list-header>');
    expect(source).toContain('popoverTitle');
    expect(source).toContain('commonUtil.getProductIdentificationValue');
    expect(source).toContain('productIdentificationPref.value.primaryId');
    expect(source).toContain('translate("Cancel item")');
    expect(source).toContain('translate("Custom swap")');
    expect(source).toContain('translate("View inventory")');
    expect(source).toContain('detail="false"');
    expect(source).not.toContain('shipmentMethod');
    expect(source).not.toContain('customerSwap');
    expect(source).not.toContain('<ion-grid');
    expect(source).not.toContain('<ion-row');
    expect(source).not.toContain('<ion-col');
  });
});
